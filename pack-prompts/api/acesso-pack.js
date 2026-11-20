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
  // Busca assinatura ativa do pack
  for await (const customer of stripe.customers.list({ email, limit: 100 })) {
    for await (const sub of stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })) {
      if (eligible(sub)) return { type: 'subscription', id: sub.id };
    }
  }
  // Busca pagamento único concluído (PaymentIntent com metadata pack_prompts)
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
    let checkout;
    try {
      checkout = await stripe.checkout.sessions.retrieve(req.body.sessionId, { expand: ['subscription'] });
    } catch (err) {
      console.error('Erro ao recuperar checkout session:', err.message);
      return res.status(403).json({ error: 'Sessão de checkout inválida.' });
    }
    if (checkout.status !== 'complete') {
      return res.status(403).json({ error: 'Pagamento não confirmado.' });
    }
    email = checkout.customer_details?.email;
    if (checkout.mode === 'payment') {
      // Compra única - pode ter PaymentIntent ou Invoice (cupom 100%)
      if (checkout.payment_intent) {
        try {
          const pi = await stripe.paymentIntents.retrieve(checkout.payment_intent);
          if (pi.status !== 'succeeded') return res.status(403).json({ error: 'Pagamento não confirmado.' });
        } catch (err) {
          console.error('Erro ao verificar PaymentIntent:', err.message);
          return res.status(403).json({ error: 'Erro ao verificar pagamento.' });
        }
      } else if (checkout.invoice) {
        // Cupom 100% gera invoice sem payment_intent
        try {
          const invoice = await stripe.invoices.retrieve(checkout.invoice);
          if (invoice.status !== 'paid') return res.status(403).json({ error: 'Pagamento não confirmado.' });
        } catch (err) {
          console.error('Erro ao verificar Invoice:', err.message);
          return res.status(403).json({ error: 'Erro ao verificar pagamento.' });
        }
      }
      // Se não tem payment_intent nem invoice, mas checkout está complete, aceita
    } else if (checkout.subscription) {
      if (!eligible(checkout.subscription)) return res.status(403).json({ error: 'Acesso ao pack não encontrado.' });
    }
  }
  if (typeof email !== 'string' || !email.includes('@') || email.length > 254) {
    return res.status(400).json({ error: 'Informe o e-mail da compra.' });
  }
  const access = await findPackAccess(email.trim().toLowerCase());

  // Se não encontrou acesso via busca direta, mas veio de sessionId válido,
  // cria acesso baseado no checkout session diretamente
  if (!access && req.body?.sessionId) {
    // Para compras com cupom 100%, o PaymentIntent pode não ter metadata ainda
    // Vamos buscar pelo customer do checkout
    let checkout;
    try {
      checkout = await stripe.checkout.sessions.retrieve(req.body.sessionId);
    } catch {
      return res.status(403).json({ error: 'Nenhum acesso ativo ao Pack Prompt I.A. para esse e-mail.' });
    }

    const customerId = checkout.customer;
    if (customerId) {
      // Tenta encontrar PaymentIntent recente deste customer
      try {
        const pis = await stripe.paymentIntents.list({ customer: customerId, limit: 5 });
        for (const pi of pis.data) {
          if (pi.status === 'succeeded') {
            // Adiciona metadata se não tiver
            if (!pi.metadata?.pack_prompts) {
              await stripe.paymentIntents.update(pi.id, { metadata: { pack_prompts: 'true' } });
            }
            const token = randomBytes(32).toString('hex');
            await stripe.paymentIntents.update(pi.id, { metadata: { pack_session: digest(token) } });
            res.setHeader('Set-Cookie', cookieName + '=one_time.' + pi.id + '.' + token +
              '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000');
            return res.status(200).json({ active: true });
          }
        }
      } catch (err) {
        console.error('Erro ao buscar PaymentIntents do customer:', err.message);
      }

      // Se não achou PI, pode ser cupom 100% - verifica invoices
      try {
        const invoices = await stripe.invoices.list({ customer: customerId, limit: 5 });
        for (const inv of invoices.data) {
          if (inv.status === 'paid') {
            // Verifica se a invoice contém o produto do pack
            const hasPackItem = inv.lines?.data?.some(line => line.price?.product === PACK_PRODUCT_ID);
            if (hasPackItem) {
              const token = randomBytes(32).toString('hex');
              // Usa invoice ID como identificador
              const invoiceId = inv.id;
              res.setHeader('Set-Cookie', cookieName + '=invoice.' + invoiceId + '.' + token +
                '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000');
              return res.status(200).json({ active: true });
            }
          }
        }
      } catch (err) {
        console.error('Erro ao buscar Invoices do customer:', err.message);
      }
    }

    return res.status(403).json({ error: 'Nenhum acesso ativo ao Pack Prompt I.A. para esse e-mail.' });
  }

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
    const match = /^(one_time|subscription|invoice)\.([A-Za-z0-9_]+)\.([a-f0-9]{64})$/.exec(value || '');
    let reason = 'login';
    if (match) {
      const [, type, resourceId, token] = match;
      let valid = false;
      if (type === 'subscription') {
        const sub = await stripe.subscriptions.retrieve(resourceId);
        valid = eligible(sub) && sub.metadata.pack_session === digest(token);
      } else if (type === 'invoice') {
        // Acesso via invoice (cupom 100%)
        const inv = await stripe.invoices.retrieve(resourceId);
        valid = inv.status === 'paid';
        // Verifica se a invoice contém o produto do pack
        if (valid) {
          const hasPackItem = inv.lines?.data?.some(line => line.price?.product === PACK_PRODUCT_ID);
          valid = valid && hasPackItem;
        }
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
    console.error('Falha ao consultar acesso do pack', error.type || error.name, error.message);
    return res.status(503).json({ error: 'Acesso indisponível no momento. Tente novamente.' });
  }
};