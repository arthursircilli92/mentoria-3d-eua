const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId } = req.body;

    // Validação básica do priceId
    if (!priceId || !priceId.startsWith('price_')) {
      return res.status(400).json({ error: 'Price ID inválido' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin}/calculadora-vendas.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/calculadora-vendas.html?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'pt-BR',
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Erro ao criar sessão de checkout:', err);
    res.status(500).json({ error: err.message });
  }
};