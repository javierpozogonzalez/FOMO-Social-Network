// @ts-nocheck
import { serve } from "https://deno.land/std@0.207.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ FALTA CONFIGURACIÓN: SUPABASE_URL o SERVICE_ROLE_KEY')
}

const adminClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { 
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' }
})

interface ExportBody { userId: string; sendEmail?: boolean; email?: string }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

async function fetchTable(table: string, column: string, userId: string) {
  try {
    return await adminClient.from(table).select('*').eq(column, userId)
  } catch (e) {
    console.log('⏭️ Skipping table', table, e?.message)
    return { data: [], error: null }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405, 
        headers: corsHeaders 
      })
    }
    const { userId, sendEmail, email }: ExportBody = await req.json()
    if (!userId) throw new Error('userId requerido')

    console.log('Exportando datos para usuario:', userId)

    const profile = await adminClient.from('users').select('*').eq('id', userId).single()
    const events = await fetchTable('events', 'creator_id', userId)
    const attendances = await fetchTable('event_attendees', 'user_id', userId)
    const friendshipsA = await fetchTable('friendships', 'user_id', userId)
    const friendshipsB = await fetchTable('friendships', 'friend_id', userId)
    const messages = await fetchTable('messages', 'sender_id', userId)

    const aggregate = {
      generated_at: new Date().toISOString(),
      user_id: userId,
      profile: profile.data || null,
      events: events.data || [],
      attendances: attendances.data || [],
      friendships: [...(friendshipsA.data || []), ...(friendshipsB.data || [])],
      messages: messages.data || [],
      disclaimer: 'Copia de datos personales FOMO segun GDPR.'
    }

    if (sendEmail && email && RESEND_API_KEY) {
      console.log('📧 Enviando exportación por email a:', email)
      
      try {

        const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exportación de datos FOMO</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header con gradiente morado -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">FOMO</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Exportación de tus datos personales</p>
            </td>
          </tr>
          
          <!-- Contenido -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #333; font-size: 16px; line-height: 1.6;">¡Hola <strong>${aggregate.profile?.full_name || 'Usuario'}</strong>!</p>
              <p style="margin: 0 0 30px; color: #666; font-size: 14px; line-height: 1.6;">Adjuntamos una copia completa de todos tus datos almacenados en FOMO, según lo solicitado.</p>
              
              <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <p style="margin: 0 0 10px; color: #333; font-size: 14px;"><strong>📅 Generado el:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' })}</p>
                <p style="margin: 0; color: #333; font-size: 14px;"><strong>👤 Usuario ID:</strong> ${aggregate.user_id}</p>
              </div>

              <!-- PERFIL DE USUARIO -->
              <h2 style="color: #667eea; font-size: 20px; margin: 30px 0 15px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">👤 Tu Perfil</h2>
              <table width="100%" cellpadding="12" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <tr style="background-color: #f9f9f9;">
                  <td style="font-weight: 600; color: #333; border-bottom: 1px solid #e0e0e0; width: 40%;">Nombre completo</td>
                  <td style="color: #666; border-bottom: 1px solid #e0e0e0;">${aggregate.profile?.full_name || 'No especificado'}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #333; border-bottom: 1px solid #e0e0e0; background-color: #f9f9f9;">Email</td>
                  <td style="color: #666; border-bottom: 1px solid #e0e0e0;">${aggregate.profile?.email || 'No especificado'}</td>
                </tr>
                <tr style="background-color: #f9f9f9;">
                  <td style="font-weight: 600; color: #333; border-bottom: 1px solid #e0e0e0;">Ciudad</td>
                  <td style="color: #666; border-bottom: 1px solid #e0e0e0;">${aggregate.profile?.city || 'No especificado'}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #333; border-bottom: 1px solid #e0e0e0; background-color: #f9f9f9;">Edad</td>
                  <td style="color: #666; border-bottom: 1px solid #e0e0e0;">${aggregate.profile?.age || 'No especificado'}</td>
                </tr>
                <tr style="background-color: #f9f9f9;">
                  <td style="font-weight: 600; color: #333;">Cuenta creada</td>
                  <td style="color: #666;">${aggregate.profile?.created_at ? new Date(aggregate.profile.created_at).toLocaleDateString('es-ES', { dateStyle: 'long' }) : 'No especificado'}</td>
                </tr>
              </table>

              <!-- RESUMEN DE ACTIVIDAD -->
              <h2 style="color: #667eea; font-size: 20px; margin: 30px 0 15px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">📊 Resumen de Actividad</h2>
              <table width="100%" cellpadding="16" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td align="center" style="border-right: 1px solid #e0e0e0; width: 25%;">
                    <div style="font-size: 32px; font-weight: 700; color: #667eea;">${aggregate.events.length}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">Eventos creados</div>
                  </td>
                  <td align="center" style="border-right: 1px solid #e0e0e0; width: 25%;">
                    <div style="font-size: 32px; font-weight: 700; color: #667eea;">${aggregate.attendances.length}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">Asistencias</div>
                  </td>
                  <td align="center" style="border-right: 1px solid #e0e0e0; width: 25%;">
                    <div style="font-size: 32px; font-weight: 700; color: #667eea;">${aggregate.friendships.length}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">Amistades</div>
                  </td>
                  <td align="center" style="width: 25%;">
                    <div style="font-size: 32px; font-weight: 700; color: #667eea;">${aggregate.messages.length}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">Mensajes</div>
                  </td>
                </tr>
              </table>

              ${aggregate.events.length > 0 ? `
              <!-- EVENTOS CREADOS -->
              <h2 style="color: #667eea; font-size: 20px; margin: 30px 0 15px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">🎉 Eventos Creados (${aggregate.events.length})</h2>
              <table width="100%" cellpadding="10" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <thead>
                  <tr style="background-color: #667eea; color: white;">
                    <th style="text-align: left; padding: 12px; font-weight: 600;">Título</th>
                    <th style="text-align: left; padding: 12px; font-weight: 600;">Fecha</th>
                    <th style="text-align: left; padding: 12px; font-weight: 600;">Ciudad</th>
                  </tr>
                </thead>
                <tbody>
                  ${aggregate.events.slice(0, 10).map((event: any, index: number) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'};">
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333;">${event.title || 'Sin título'}</td>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666;">${event.event_date ? new Date(event.event_date).toLocaleDateString('es-ES') : 'No especificado'}</td>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666;">${event.city || 'No especificado'}</td>
                    </tr>
                  `).join('')}
                  ${aggregate.events.length > 10 ? `
                    <tr>
                      <td colspan="3" style="padding: 12px; text-align: center; color: #667eea; font-size: 13px;">
                        ... y ${aggregate.events.length - 10} evento(s) más
                      </td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
              ` : ''}

              ${aggregate.attendances.length > 0 ? `
              <!-- ASISTENCIAS -->
              <h2 style="color: #667eea; font-size: 20px; margin: 30px 0 15px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">🎫 Asistencias a Eventos (${aggregate.attendances.length})</h2>
              <table width="100%" cellpadding="10" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 30px;">
                <thead>
                  <tr style="background-color: #667eea; color: white;">
                    <th style="text-align: left; padding: 12px; font-weight: 600;">Estado</th>
                    <th style="text-align: left; padding: 12px; font-weight: 600;">Registrado el</th>
                  </tr>
                </thead>
                <tbody>
                  ${aggregate.attendances.slice(0, 10).map((att: any, index: number) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'};">
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">
                        <span style="background-color: ${att.status === 'going' ? '#10b981' : att.status === 'interested' ? '#f59e0b' : '#6b7280'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                          ${att.status === 'going' ? '✓ Asistiendo' : att.status === 'interested' ? '★ Interesado' : 'No asiste'}
                        </span>
                      </td>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666;">${att.created_at ? new Date(att.created_at).toLocaleDateString('es-ES') : 'No especificado'}</td>
                    </tr>
                  `).join('')}
                  ${aggregate.attendances.length > 10 ? `
                    <tr>
                      <td colspan="2" style="padding: 12px; text-align: center; color: #667eea; font-size: 13px;">
                        ... y ${aggregate.attendances.length - 10} asistencia(s) más
                      </td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
              ` : ''}

              <!-- INFORMACIÓN ADICIONAL -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 30px 0;">
                <p style="margin: 0 0 10px; color: #92400e; font-weight: 600; font-size: 14px;">🔒 Seguridad y Privacidad</p>
                <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.5;">
                  Este email contiene información personal sensible. Si no solicitaste esta exportación, 
                  por favor ignora este mensaje y contacta con nuestro soporte en 
                  <a href="mailto:seguridad@fomon.es" style="color: #667eea; text-decoration: none;">seguridad@fomon.es</a>
                </p>
              </div>

              <div style="background-color: #f0f9ff; border-left: 4px solid #667eea; padding: 16px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0 0 10px; color: #1e40af; font-weight: 600; font-size: 14px;">📋 ¿Qué incluye esta exportación?</p>
                <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 13px; line-height: 1.8;">
                  <li>Tu perfil completo de usuario</li>
                  <li>Todos los eventos que has creado</li>
                  <li>Tu historial de asistencias</li>
                  <li>Todas tus conexiones y amistades</li>
                  <li>Mensajes que has enviado</li>
                </ul>
              </div>

              <p style="margin: 30px 0 10px; color: #666; font-size: 13px; line-height: 1.6;">
                Esta exportación cumple con el <strong>Reglamento General de Protección de Datos (GDPR)</strong>. 
                Tienes derecho a solicitar la eliminación de tus datos en cualquier momento desde la app.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px; color: #666; font-size: 13px;">
                Este email fue generado automáticamente por <strong>FOMO</strong>
              </p>
              <p style="margin: 0; color: #999; font-size: 12px;">
                Si tienes dudas, contacta: <a href="mailto:seguridad@fomon.es" style="color: #667eea; text-decoration: none;">seguridad@fomon.es</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'FOMO <noreply@fomon.es>',
            to: email,
            subject: 'Exportación de tus datos FOMO',
            html: htmlContent
          })
        })

        const result = await response.json()
        
        if (!response.ok) {
          console.error('❌ Error Resend API:', result)
          throw new Error(result.message || 'Error enviando email')
        }
        
        console.log('✅ Email enviado correctamente:', result.id)
        
      } catch (emailError: any) {
        console.error('❌ Error enviando email:', emailError.message)
        // No lanzamos error para que el JSON se devuelva igualmente
      }
    } else {
      if (sendEmail && !RESEND_API_KEY) {
        console.warn('⚠️ Email solicitado pero RESEND_API_KEY no configurado')
      }
    }

    return new Response(JSON.stringify({ success: true, data: aggregate }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (e: any) {
    console.error('Export user error', e)
    return new Response(JSON.stringify({ error: e?.message || 'Error desconocido' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
