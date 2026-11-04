const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ active: false, error: 'Session ID obrigatório' });
    }

    // Recupera a sessão de checkout para obter o customerId e subscriptionId
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session.subscription) {
      return res.status(200).json({ active: false, error: 'Nenhuma assinatura associada' });
    }

    // Verifica o status da assinatura diretamente no Stripe
    const subscription = await stripe.subscriptions.retrieve(session.subscription);

    const isActive = ['active', 'trialing'].includes(subscription.status);

    res.status(200).json({
      active: isActive,
      status: subscription.status,
      customerId: session.customer,
      subscriptionId: subscription.id,
      priceId: subscription.items?.data?.[0]?.price?.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  } catch (err) {
    console.error('Erro ao verificar assinatura:', err.message);
    res.status(200).json({ active: false, error: err.message });
  }
};