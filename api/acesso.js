const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { randomBytes, createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const product = 'prod_VYy7KhMPBv0lJg';
const cookieName = '__Host-calc_session';
const digest = token => createHash('sha256').update(token).digest('hex');
function eligible(sub) {
  return ['active', 'trialing'].includes(sub.status) &&
    sub.items.data.some(item => item.price.product === product);
}

async function findSubscription(email) {
  for await (const customer of stripe.customers.list({ email, limit: 100 })) {
    for await (const sub of stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })) {
      if (eligible(sub)) return sub;
    }
  }
}

async function grant(req, res) {
  let email = req.body?.email;
  if (req.body?.sessionId) {
    const checkout = await stripe.checkout.sessions.retrieve(req.body.sessionId, { expand: ['subscription'] });
    if (checkout.status !== 'complete' || !checkout.subscription || !eligible(checkout.subscription)) {
      return res.status(403).json({ error: 'Assinatura inativa.' });
    }
    email = checkout.customer_details?.email;
  }
  if (typeof email !== 'string' || !email.includes('@') || email.length > 254) {
    return res.status(400).json({ error: 'Informe o e-mail da assinatura.' });
  }
  const sub = await findSubscription(email.trim().toLowerCase());
  if (!sub) return res.status(403).json({ error: 'Nenhuma assinatura ativa da calculadora para esse e-mail.' });
  const token = randomBytes(32).toString('hex');
  await stripe.subscriptions.update(sub.id, { metadata: { calculator_session: digest(token) } });
  res.setHeader('Set-Cookie', cookieName + '=' + sub.id + '.' + token +
    '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000');
  return res.status(200).json({ active: true });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const page = req.query.view === 'page';
  try {
    if (req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json') || req.headers['sec-fetch-site'] === 'cross-site') {
        return res.status(403).end();
      }
      return await grant(req, res);
    }
    if (req.method !== 'GET') return res.status(405).end();
    const value = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    const match = /^(sub_[A-Za-z0-9]+)\.([a-f0-9]{64})$/.exec(value || '');
    let reason = 'login';
    if (match) {
      const sub = await stripe.subscriptions.retrieve(match[1]);
      if (eligible(sub) && sub.metadata.calculator_session === digest(match[2])) {
        if (!page) return res.status(200).json({ active: true });
        return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8')
          .end(readFileSync(path.join(process.cwd(), 'private/calculadora.html')));
      }
      reason = eligible(sub) ? 'substituida' : 'inativa';
    }
    if (page) return res.redirect(303, '/calculadora-vendas.html?motivo=' + reason);
    return res.status(401).json({ reason });
  } catch (error) {
    console.error('Falha ao consultar acesso da calculadora', error.type || error.name);
    return res.status(503).json({ error: 'Acesso indisponível no momento. Tente novamente.' });
  }
};
