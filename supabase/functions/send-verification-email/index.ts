// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")

interface EmailRequest {
  email: string
  code: string
  fullName?: string
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  })
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    if (!RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY no definido')
      return json({ success: false, error: 'RESEND_API_KEY no configurado' }, 500)
    }

    const { email, code, fullName = 'Usuario' }: EmailRequest = await req.json()

    if (!email || !code) {
      return json({ success: false, error: 'Email y code son requeridos' }, 400)
    }

    // Validación simple email
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ success: false, error: 'Formato de email inválido' }, 400)
    }

    console.log(`📧 Enviando código de verificación a ${email}`)

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FOMO <noreply@fomon.es>',
        from: 'FOMO <noreply@fomon.es>',
        to: [email],
        subject: '🔐 Tu código de verificación FOMO',
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
        <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
          <table width="100%" style="padding:40px 20px;background:#f3f4f6;">
            <tr><td align="center">
              <table width="100%" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 20px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:32px;">FOMO</h1>
                    <p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Tu código de verificación</p>
                  </td>
                </tr>
                <tr><td style="padding:40px 30px;">
                  <p style="margin:0 0 20px;font-size:16px;color:#374151;">¡Hola <strong>${fullName}</strong>!</p>
                  <p style="margin:0 0 30px;font-size:16px;color:#374151;">Ingresa este código en la app:</p>
                  <table width="100%"><tr><td align="center" style="padding:30px;background:#f9fafb;border-radius:8px;border:2px dashed #e5e7eb;">
                    <p style="margin:0 0 10px;font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Tu código</p>
                    <p style="margin:0;font-size:48px;font-weight:bold;color:#667eea;letter-spacing:8px;font-family:'Courier New',monospace;">${code}</p>
                  </td></tr></table>
                  <p style="margin:30px 0 0;font-size:14px;color:#6b7280;">⏱ Expira en <strong>15 minutos</strong>.</p>
                  <p style="margin:20px 0 0;font-size:14px;color:#6b7280;">Si no solicitaste este código, ignora este email.</p>
                </td></tr>
                <tr>
                  <td style="padding:30px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;">© 2025 FOMO. Todos los derechos reservados.</p>
                    <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">Email automático – no responder.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body></html>`
      })
    })

    const data = await resendResp.json()

    if (!resendResp.ok) {
      console.error('❌ Error de Resend:', resendResp.status, data)
      return json({ success: false, error: data }, resendResp.status)
    }

    console.log('✅ Email enviado correctamente')
    return json({ success: true, data }, 200)

  } catch (err: any) {
    console.error('❌ Error inesperado:', err)
    return json({ success: false, error: err?.message || 'Error desconocido' }, 400)
  }
})
