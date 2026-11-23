// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.11.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    // Autenticar usuario
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'No autorizado' }, 401)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return json({ error: 'No autorizado' }, 401)
    }

    // Leer body
    const { priceId, successUrl, cancelUrl } = await req.json()

    if (!priceId) {
      return json({ error: 'priceId requerido' }, 400)
    }

    // Buscar venue_application del usuario
    const { data: venueApp, error: venueError } = await supabase
      .from('venue_applications')
      .select('id, stripe_customer_id, billing_email, venue_name, user_id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .single()

    if (venueError || !venueApp) {
      return json({ error: 'No tienes un venue aprobado' }, 403)
    }

    // Crear o recuperar Stripe Customer
    let customerId = venueApp.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: venueApp.billing_email || user.email,
        name: venueApp.venue_name,
        metadata: {
          venue_application_id: venueApp.id,
          user_id: user.id,
        },
      })
      customerId = customer.id

      // Guardar en BD
      await supabase
        .from('venue_applications')
        .update({ stripe_customer_id: customerId })
        .eq('id', venueApp.id)
    }

    // Crear Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${Deno.env.get('FRONTEND_BASE_URL')}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${Deno.env.get('FRONTEND_BASE_URL')}/billing/cancel`,
      subscription_data: {
        metadata: {
          venue_application_id: venueApp.id,
          user_id: user.id,
        },
      },
      tax_id_collection: {
        enabled: true,  // Recoger CIF/NIF
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      metadata: {
        venue_application_id: venueApp.id,
        user_id: user.id,
      },
    })

    console.log(`✅ Checkout session creada: ${session.id} para venue ${venueApp.id}`)

    return json({
      success: true,
      sessionId: session.id,
      url: session.url,
    })

  } catch (err: any) {
    console.error('❌ Error:', err)
    return json({ error: err.message || 'Error desconocido' }, 500)
  }
})
