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
 // Fallback: busca PaymentIntent sem metadata pack_prompts (cupom 100% pode não ter metadata)
 // Verifica se o PI tem amount 0 ou se a invoice associada contém o produto do pack
 for await (const customer of stripe.customers.list({ email, limit: 100 })) {
 for await (const pi of stripe.paymentIntents.list({ customer: customer.id, limit: 20 })) {
 if (pi.status === 'succeeded' && !pi.metadata?.pack_prompts) {
 // Verifica via invoice se este PI está ligado ao produto do pack
 if (pi.invoice) {
 try {
 const inv = await stripe.invoices.retrieve(pi.invoice);
 const hasPackItem = inv.lines?.data?.some(line => line.price?.product === PACK_PRODUCT_ID);
 if (hasPackItem) {
 // Adiciona metadata para futuras buscas
 await stripe.paymentIntents.update(pi.id, { metadata: { pack_prompts: 'true' } });
 return { type: 'one_time', id: pi.id };
 }
 } catch (err) {
 console.error('Erro ao verificar invoice do PI:', err.message);
 }
 }
 // Se não tem invoice, verifica se amount é 0 (cupom 100%)
 if (pi.amount === 0) {
 await stripe.paymentIntents.update(pi.id, { metadata: { pack_prompts: 'true' } });
 return { type: 'one_time', id: pi.id };
 }
 }
 }
 }
 // Busca invoices pagas diretamente (caso não haja PaymentIntent)
 for await (const customer of stripe.customers.list({ email, limit: 100 })) {
 for await (const inv of stripe.invoices.list({ customer: customer.id, status: 'paid', limit: 20 })) {
 const hasPackItem = inv.lines?.data?.some(line => line.price?.product === PACK_PRODUCT_ID);
 if (hasPackItem) {
 return { type: 'invoice', id: inv.id };
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
 if (checkout.payment_intent) {
 try {
 const pi = await stripe.paymentIntents.retrieve(checkout.payment_intent);
 if (pi.status !== 'succeeded') return res.status(403).json({ error: 'Pagamento não confirmado.' });
 // Garante que a metadata exista
 if (!pi.metadata?.pack_prompts) {
 await stripe.paymentIntents.update(pi.id, { metadata: { pack_prompts: 'true' } });
 }
 } catch (err) {
 console.error('Erro ao verificar PaymentIntent:', err.message);
 return res.status(403).json({ error: 'Erro ao verificar pagamento.' });
 }
 } else if (checkout.invoice) {
 try {
 const invoice = await stripe.invoices.retrieve(checkout.invoice);
 if (invoice.status !== 'paid') return res.status(403).json({ error: 'Pagamento não confirmado.' });
 } catch (err) {
 console.error('Erro ao verificar Invoice:', err.message);
 return res.status(403).json({ error: 'Erro ao verificar pagamento.' });
 }
 }
 } else if (checkout.subscription) {
 if (!eligible(checkout.subscription)) return res.status(403).json({ error: 'Acesso ao pack não encontrado.' });
 }
 }
 if (typeof email !== 'string' || !email.includes('@') || email.length > 254) {
 return res.status(400).json({ error: 'Informe o e-mail da compra.' });
 }
 const access = await findPackAccess(email.trim().toLowerCase());

 if (!access) {
 return res.status(403).json({ error: 'Nenhum acesso ativo ao Pack Prompt I.A. para esse e-mail.' });
 }

 const token = randomBytes(32).toString('hex');
 if (access.type === 'subscription') {
 await stripe.subscriptions.update(access.id, { metadata: { pack_session: digest(token) } });
 } else if (access.type === 'invoice') {
 // Para invoices, armazenamos o token na metadata da invoice
 await stripe.invoices.update(access.id, { metadata: { pack_session: digest(token) } });
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
 const inv = await stripe.invoices.retrieve(resourceId);
 valid = inv.status === 'paid';
 if (valid) {
 const hasPackItem = inv.lines?.data?.some(line => line.price?.product === PACK_PRODUCT_ID);
 valid = valid && hasPackItem;
 // Verifica token na metadata da invoice
 if (valid && inv.metadata?.pack_session) {
 valid = inv.metadata.pack_session === digest(token);
 }
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