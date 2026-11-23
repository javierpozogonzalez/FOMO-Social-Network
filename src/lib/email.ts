/**
 * Email Service - Integración con Resend vía Supabase Edge Function
 */

import { supabase } from './supabase'

export interface SendVerificationEmailParams {
  email: string
  code: string
  fullName?: string
}

/**
 * Envía email de verificación llamando a la Edge Function de Supabase
 */
export async function sendVerificationEmail({ 
  email, 
  code, 
  fullName 
}: SendVerificationEmailParams): Promise<boolean> {
  try {
    console.log('🔄 Invocando Edge Function para enviar email a:', email)
    
    const { data, error } = await supabase.functions.invoke('send-verification-email', {
      body: {
        email,
        code,
        fullName: fullName || 'Usuario',
      },
    })

    if (error) {
      console.error('❌ Error invocando Edge Function:', error)
      // Intentar leer el cuerpo de la respuesta de la Edge Function si está disponible
      // @ts-ignore - supabase-js expone un Response en error.context
      const ctx: any = (error as any)?.context
      if (ctx && typeof ctx.text === 'function') {
        try {
          const raw = await ctx.text()
          console.error('Detalles del error (body):', raw)
        } catch (e) {
          // Ignorar errores al leer el body
        }
      } else {
        console.error('Detalles del error (obj):', JSON.stringify(error, null, 2))
      }
      return false
    }

    if (!data || !data.success) {
      console.error('❌ Respuesta de Edge Function sin success:', data)
      return false
    }

    console.log('✅ Email enviado exitosamente a:', email)
    return true
  } catch (error) {
    console.error('❌ Excepción en sendVerificationEmail:', error)
    return false
  }
}
