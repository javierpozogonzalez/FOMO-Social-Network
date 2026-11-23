// @ts-nocheck
import { serve } from "https://deno.land/std@0.207.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// VERIFICACIÓN CRÍTICA DE SECRETS
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ FALTA CONFIGURACIÓN:')
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'OK' : 'MISSING')
  console.error('SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? 'OK (length: ' + SERVICE_ROLE_KEY.length + ')' : 'MISSING')
}

const adminClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' }
})

interface DeleteBody { userId: string }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

async function safeDelete(table: string, column: string, userId: string) {
  try {
    const { error, count } = await adminClient.from(table).delete({ count: 'exact' }).eq(column, userId)
    if (error) {
      console.log('Error deleting from', table, column, error.message)
    } else {
      console.log('Deleted', count, 'rows from', table)
    }
  } catch (e: any) {
    console.log('Exception on', table, e?.message)
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
    const { userId }: DeleteBody = await req.json()
    if (!userId) throw new Error('userId requerido')

    console.log('🗑️ Iniciando eliminacion de usuario:', userId)
    console.log('🔑 Service Role Key presente:', SERVICE_ROLE_KEY ? 'SI (length: ' + SERVICE_ROLE_KEY.length + ')' : 'NO')

    console.log('📋 Eliminando relaciones...')
    await safeDelete('friendships', 'user_id', userId)
    await safeDelete('friendships', 'friend_id', userId)
    await safeDelete('friend_requests', 'sender_id', userId)
    await safeDelete('friend_requests', 'receiver_id', userId)
    await safeDelete('event_attendees', 'user_id', userId)
    await safeDelete('notifications', 'user_id', userId)
    await safeDelete('venue_followers', 'user_id', userId)
    await safeDelete('messages', 'sender_id', userId)
    await safeDelete('events', 'creator_id', userId)

    console.log('👤 Eliminando de tabla users...')
    const { error: deleteUsersErr } = await adminClient.from('users').delete().eq('id', userId)
    if (deleteUsersErr) {
      console.error('❌ ERROR en users:', deleteUsersErr.message)
      console.error('❌ Detalles completos:', JSON.stringify(deleteUsersErr, null, 2))
      throw new Error('No se pudo eliminar de users: ' + deleteUsersErr.message)
    }
    console.log('✅ Usuario eliminado de tabla users')

    console.log('🔐 Eliminando de Auth...')
    const { error: authErr } = await adminClient.auth.admin.deleteUser(userId)
    if (authErr) {
      console.error('❌ ERROR en auth:', authErr.message)
      throw new Error('No se pudo eliminar de auth: ' + authErr.message)
    }
    console.log('✅ Usuario eliminado de auth')
    console.log('🎉 ELIMINACIÓN COMPLETADA EXITOSAMENTE')

    return new Response(JSON.stringify({ success: true, message: 'Usuario eliminado correctamente' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (e: any) {
    console.error('❌ ERROR GENERAL:', e.message)
    console.error('Stack:', e.stack)
    return new Response(JSON.stringify({ 
      error: e?.message || 'Error desconocido', 
      details: e?.toString(),
      timestamp: new Date().toISOString()
    }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
