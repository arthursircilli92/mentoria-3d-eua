const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ active: false, error: 'Email inválido' });
    }

    // Busca clientes no Stripe pelo email
    const customers = await stripe.customers.list({
      email: email.trim().toLowerCase(),
      limit: 1,
    });

    if (customers.data.length === 0) {
      return res.status(200).json({ active: false, error: 'Nenhuma assinatura encontrada para este email' });
    }

    const customer = customers.data[0];

    // Busca assinaturas ativas do cliente
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // Verifica também assinaturas em período de teste
      const trialing = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'trialing',
        limit: 1,
      });

      if (trialing.data.length > 0) {
        return res.status(200).json({
          active: true,
          status: 'trialing',
          customerId: customer.id,
          subscriptionId: trialing.data[0].id,
          priceId: trialing.data[0].items?.data?.[0]?.price?.id,
          currentPeriodEnd: new Date(trialing.data[0].current_period_end * 1000).toISOString(),
        });
      }

      return res.status(200).json({ active: false, error: 'Assinatura não ativa para este email' });
    }

    const sub = subscriptions.data[0];

    res.status(200).json({
      active: true,
      status: sub.status,
      customerId: customer.id,
      subscriptionId: sub.id,
      priceId: sub.items?.data?.[0]?.price?.id,
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    });
  } catch (err) {
    console.error('Erro ao verificar email:', err.message);
    res.status(200).json({ active: false, error: err.message });
  }
};