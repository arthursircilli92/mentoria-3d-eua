const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Preço avulso do Pack Prompt I.A. - compra única
const PACK_PRICE_ID = process.env.PACK_PROMPTS_PRICE_ID || 'price_1UdbprL6dFACWnIOcSIwmTRf';

module.exports = async function handler(req, res) {
 if (req.method !== 'POST') {
 return res.status(405).json({ error: 'Method not allowed' });
 }

 try {
 // Garante que o customer seja criado/vinculado mesmo com cupom 100%
 const session = await stripe.checkout.sessions.create({
 mode: 'payment',
 payment_method_types: ['card'],
 line_items: [
 {
 price: PACK_PRICE_ID,
 quantity: 1,
 },
 ],
 customer_creation: 'always',
 payment_intent_data: {
 metadata: {
 pack_prompts: 'true',
 },
 },
 success_url: `${req.headers.origin}/pack-prompts/?session_id={CHECKOUT_SESSION_ID}`,
 cancel_url: `${req.headers.origin}/pack-prompts/?canceled=true`,
 allow_promotion_codes: true,
 billing_address_collection: 'auto',
 locale: 'pt-BR',
 });

 res.status(200).json({ sessionId: session.id, url: session.url });
 } catch (err) {
 console.error('Erro ao criar checkout do pack:', err);
 res.status(500).json({ error: err.message });
 }
};