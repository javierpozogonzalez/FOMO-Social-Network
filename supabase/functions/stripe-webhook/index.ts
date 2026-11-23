// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.11.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    // Leer body raw (no parseado)
    const body = await req.text()

    // Verificar firma
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    console.log(`📥 Webhook recibido: ${event.type}`)

    // Procesar eventos
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`ℹ️  Evento no manejado: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('❌ Error webhook:', err)
    return new Response(`Webhook error: ${err.message}`, { status: 400 })
  }
})

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const venueAppId = subscription.metadata.venue_application_id

  if (!venueAppId) {
    console.warn('⚠️  Subscription sin venue_application_id en metadata')
    return
  }

  const priceId = subscription.items.data[0]?.price.id
  const status = subscription.status
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()
  const cancelAtPeriodEnd = subscription.cancel_at_period_end

  // Llamar a la función SQL para actualizar
  const { error } = await supabase.rpc('update_stripe_subscription', {
    p_venue_app_id: venueAppId,
    p_stripe_customer_id: subscription.customer as string,
    p_stripe_subscription_id: subscription.id,
    p_stripe_price_id: priceId,
    p_subscription_status: status,
    p_current_period_end: currentPeriodEnd,
    p_cancel_at_period_end: cancelAtPeriodEnd,
  })

  if (error) {
    console.error('❌ Error actualizando subscription:', error)
  } else {
    console.log(`✅ Subscription actualizada: ${subscription.id} → ${status}`)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const venueAppId = subscription.metadata.venue_application_id

  if (!venueAppId) return

  // Marcar como cancelado
  const { error } = await supabase
    .from('venue_applications')
    .update({
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', venueAppId)

  if (error) {
    console.error('❌ Error al cancelar:', error)
  } else {
    console.log(`✅ Subscription cancelada: ${subscription.id}`)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log(`✅ Pago exitoso: ${invoice.id}`)
  // Aquí podrías enviar un email de confirmación al venue
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  // Buscar venue por customer_id
  const { data: venue } = await supabase
    .from('venue_applications')
    .select('id, user_id, venue_name')
    .eq('stripe_customer_id', customerId)
    .single()

  if (venue) {
    console.warn(`⚠️  Pago fallido para venue ${venue.venue_name}`)
    // TODO: Enviar email o push notification avisando del fallo de pago
  }
}
