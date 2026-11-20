const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PACK_PRODUCT_ID = process.env.PACK_PROMPTS_PRODUCT_ID || 'prod_VevhG8Mku4Pv7r';

module.exports = async function handler(req, res) {
 // Endpoint temporário de diagnóstico - remover após resolver o acesso
 if (req.method !== 'GET') return res.status(405).end();

 const email = req.query.email;
 if (!email) return res.status(400).json({ error: 'Informe ?email=seu@email.com' });

 const result = {
 email,
 packProductId: PACK_PRODUCT_ID,
 customers: [],
 paymentIntents: [],
 invoices: [],
 checkoutSessions: [],
 };

 try {
 // Buscar customers
 for await (const customer of stripe.customers.list({ email: email.trim().toLowerCase(), limit: 10 })) {
 const custInfo = {
 id: customer.id,
 email: customer.email,
 name: customer.name,
 created: new Date(customer.created * 1000).toISOString(),
 metadata: customer.metadata,
 };

 // Subscriptions
 const subs = [];
 for await (const sub of stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 20 })) {
 const hasPack = sub.items?.data?.some(item => item.price?.product === PACK_PRODUCT_ID);
 subs.push({
 id: sub.id,
 status: sub.status,
 hasPackProduct: hasPack,
 productIds: sub.items?.data?.map(i => i.price?.product),
 priceIds: sub.items?.data?.map(i => i.price?.id),
 metadata: sub.metadata,
 });
 }
 custInfo.subscriptions = subs;

 // PaymentIntents
 const pis = [];
 for await (const pi of stripe.paymentIntents.list({ customer: customer.id, limit: 20 })) {
 pis.push({
 id: pi.id,
 status: pi.status,
 amount: pi.amount,
 currency: pi.currency,
 invoice: pi.invoice,
 metadata: pi.metadata,
 created: new Date(pi.created * 1000).toISOString(),
 });
 }
 custInfo.paymentIntents = pis;

 // Invoices
 const invs = [];
 for await (const inv of stripe.invoices.list({ customer: customer.id, limit: 20 })) {
 const lines = inv.lines?.data?.map(l => ({
 productId: l.price?.product,
 priceId: l.price?.id,
 amount: l.amount,
 description: l.description,
 }));
 invs.push({
 id: inv.id,
 status: inv.status,
 total: inv.total,
 currency: inv.currency,
 paymentIntent: inv.payment_intent,
 lines,
 metadata: inv.metadata,
 created: new Date(inv.created * 1000).toISOString(),
 });
 }
 custInfo.invoices = invs;

 result.customers.push(custInfo);
 }

 // Buscar checkout sessions recentes pelo email
 for await (const session of stripe.checkout.sessions.list({ limit: 50 })) {
 if (session.customer_details?.email?.toLowerCase() === email.trim().toLowerCase()) {
 result.checkoutSessions.push({
 id: session.id,
 status: session.status,
 mode: session.mode,
 paymentIntent: session.payment_intent,
 invoice: session.invoice,
 subscription: session.subscription,
 customer: session.customer,
 amountTotal: session.amount_total,
 currency: session.currency,
 metadata: session.metadata,
 created: new Date(session.created * 1000).toISOString(),
 });
 }
 }

 res.status(200).json(result);
 } catch (error) {
 console.error('Debug access error:', error.message);
 res.status(500).json({ error: error.message });
 }
};