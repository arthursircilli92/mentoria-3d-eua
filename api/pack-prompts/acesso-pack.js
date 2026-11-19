const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { randomBytes, createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const PACK_PRODUCT_ID = process.env.PACK_PROMPTS_PRODUCT_ID || 'prod_VevhG8Mku4Pv7r';
const cookieName = '__Host-pack_session';
const digest = token => createHash('sha256').update(token).digest('hex');

function eligible(sub) {
  if (!sub) return false;
  const hasPack = sub.items?.data?.some(item => item.price?.product === PACK_PRODUCT_ID);
  return ['active', 'trialing'].includes(sub.status) && hasPack;
}

async function findPackAccess(email) {
  for await (const customer of stripe.customers.list({ email, limit: 100 })) {
    for await (const sub of stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })) {
      if (eligible(sub)) return { type: 'subscription', id: sub.id };
    }
  }
  for await (const customer of stripe.customers.list({ email, limit: 100 })) {
    for await (const pi of stripe.paymentIntents.list({ customer: customer.id, limit: 100 })) {
      if (pi.status === 'succeeded' && pi.metadata?.pack_prompts === 'true') {
        return { type: 'one_time', id: pi.id };
      }
    }
  }
  return null;
}

async function grant(req, res) {
  let email = req.body?.email;
  if (req.body?.sessionId) {
    const checkout = await stripe.checkout.sessions.retrieve(req.body.sessionId, { expand: ['subscription'] });
    if (checkout.status !== 'complete') {
      return res.status(403).json({ error: 'Pagamento não confirmado.' });
    }
    email = checkout.customer_details?.email;
    if (checkout.mode === 'payment') {
      const pi = await stripe.paymentIntents.retrieve(checkout.payment_intent);
      if (pi.status !== 'succeeded') return res.status(403).json({ error: 'Pagamento não confirmado.' });
    } else if (checkout.subscription) {
      if (!eligible(checkout.subscription)) return res.status(403).json({ error: 'Acesso ao pack não encontrado.' });
    }
  }
  if (typeof email !== 'string' || !email.includes('@') || email.length > 254) {
    return res.status(400).json({ error: 'Informe o e-mail da compra.' });
  }
  const access = await findPackAccess(email.trim().toLowerCase());
  if (!access) return res.status(403).json({ error: 'Nenhum acesso ativo ao Pack Prompt I.A. para esse e-mail.' });
  const token = randomBytes(32).toString('hex');
  if (access.type === 'subscription') {
    await stripe.subscriptions.update(access.id, { metadata: { pack_session: digest(token) } });
  } else {
    await stripe.paymentIntents.update(access.id, { metadata: { pack_session: digest(token) } });
  }
  res.setHeader('Set-Cookie', cookieName + '=' + access.type + '.' + access.id + '.' + token +
    '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000');
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
    const match = /^(one_time|subscription)\.([A-Za-z0-9_]+)\.([a-f0-9]{64})$/.exec(value || '');
    let reason = 'login';
    if (match) {
      const [, type, resourceId, token] = match;
      let valid = false;
      if (type === 'subscription') {
        const sub = await stripe.subscriptions.retrieve(resourceId);
        valid = eligible(sub) && sub.metadata.pack_session === digest(token);
      } else {
        const pi = await stripe.paymentIntents.retrieve(resourceId);
        valid = pi.status === 'succeeded' && pi.metadata?.pack_prompts === 'true' && pi.metadata?.pack_session === digest(token);
      }
      if (valid) {
        if (!page) return res.status(200).json({ active: true });
        return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8')
          .end(readFileSync(path.join(process.cwd(), 'pack-prompts/private/galeria.html')));
      }
      reason = 'inativa';
    }
    if (page) return res.redirect(303, '/pack-prompts/?motivo=' + reason);
    return res.status(401).json({ reason });
  } catch (error) {
    console.error('Falha ao consultar acesso do pack', error.type || error.name);
    return res.status(503).json({ error: 'Acesso indisponível no momento. Tente novamente.' });
  }
};