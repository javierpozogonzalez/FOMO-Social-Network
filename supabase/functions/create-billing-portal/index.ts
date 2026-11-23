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

    // Buscar venue_application del usuario
    const { data: venueApp, error: venueError } = await supabase
      .from('venue_applications')
      .select('id, stripe_customer_id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .single()

    if (venueError || !venueApp) {
      return json({ error: 'No tienes un venue aprobado' }, 403)
    }

    if (!venueApp.stripe_customer_id) {
      return json({ error: 'No tienes una suscripción activa' }, 400)
    }

    // Leer returnUrl del body (opcional)
    const body = await req.json().catch(() => ({}))
    const returnUrl = body.returnUrl || `${Deno.env.get('FRONTEND_BASE_URL')}/billing`

    // Crear Billing Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: venueApp.stripe_customer_id,
      return_url: returnUrl,
    })

    console.log(`✅ Billing portal creado para customer ${venueApp.stripe_customer_id}`)

    return json({
      success: true,
      url: session.url,
    })

  } catch (err: any) {
    console.error('❌ Error:', err)
    return json({ error: err.message || 'Error desconocido' }, 500)
  }
})
