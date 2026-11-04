const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Erro na verificação do webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Log dos eventos relevantes para monitoramento
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`✅ Checkout concluído: ${session.customer_email || session.customer_details?.email} | subscription: ${session.subscription}`);
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      console.log(`🔄 Assinatura atualizada: ${sub.id} → status: ${sub.status}`);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log(`❌ Assinatura cancelada: ${sub.id}`);
      break;
    }
    default:
      console.log(`Evento recebido: ${event.type}`);
  }

  // Sempre retorne 200 para o Stripe não reenviar o evento
  res.status(200).json({ received: true });
};