import { useState, useEffect, useRef } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import { sendVerificationEmail } from "../lib/email"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"

export default function VerifyEmailScreen({ route, navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const { userId: paramUserId, email: paramEmail, fullName: paramFullName } = route.params || {}
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const hasInitRef = useRef(false) // Anti doble montaje (StrictMode / doble render dev)
  const mountCountRef = useRef(0)
  const [displayEmail, setDisplayEmail] = useState(paramEmail || "")

  // Countdown para reenvío
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Generar código al montar (solo una vez)
  useEffect(() => {
    mountCountRef.current += 1
    console.log('📲 VerifyEmailScreen mount count:', mountCountRef.current)
    if (hasInitRef.current) {
      console.log('⚠️ Segunda monta detectada: se evita regenerar código')
      return
    }
    if (initialized) return

    const init = async () => {
      try {
        // Validar sesión antes de continuar
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          console.warn('No hay sesión activa, redirigiendo a Login.')
          navigation.replace('Login')
          return
        }
        
        const currentUserId = paramUserId || session.user.id
        const currentEmail = paramEmail || session.user.email
        
        // Actualizar email para display
        if (currentEmail) {
          setDisplayEmail(currentEmail)
        }
        
        if (!currentUserId || !currentEmail) {
          console.warn('Faltan parámetros para VerifyEmail. Redirigiendo a Login.')
          navigation.replace('Login')
          return
        }
        
        // Obtener datos del usuario desde la BD (incluyendo full_name)
        const { data: userRow } = await supabase
          .from('users')
          .select('id, email, full_name')
          .eq('id', currentUserId)
          .single()
        
        if (!userRow) {
          console.warn('Fila en users faltante. Creando de forma automática.')
          await supabase.from('users').insert({ 
            id: currentUserId, 
            email: currentEmail, 
            email_verified: false 
          })
        }
        
        // Generar y enviar código
        await generateAndSendCode(currentUserId, currentEmail, userRow?.full_name || paramFullName)
        hasInitRef.current = true
        setInitialized(true)
      } catch (error) {
        console.error('Error inicializando VerifyEmailScreen:', error)
      }
    }
    
    init()
  }, []) // Solo ejecutar una vez al montar

  const generateAndSendCode = async (currentUserId?: string, currentEmail?: string, currentFullName?: string) => {
    try {
      setResending(true)
      
      // Usar session si no se pasan parámetros
      const { data: { session } } = await supabase.auth.getSession()
      const finalUserId = currentUserId || paramUserId || session?.user?.id
      const finalEmail = currentEmail || paramEmail || session?.user?.email
      const finalFullName = currentFullName || paramFullName
      
      if (!finalUserId || !finalEmail) {
        throw new Error('No se pudo obtener el ID o email del usuario')
      }
      
      const { data: verificationCode, error } = await supabase.rpc("generate_verification_code", {
        p_user_id: finalUserId,
        p_email: finalEmail,
      })

      if (error) throw error

      console.log("📧 Código de verificación generado:", verificationCode)
      
      // Enviar email con el código
      const emailSent = await sendVerificationEmail({
        email: finalEmail,
        code: verificationCode,
        fullName: finalFullName || 'Usuario',
      })

      if (emailSent) {
        console.log("✅ Email de verificación enviado correctamente")
      } else {
        Alert.alert(
          "Error enviando email",
          "No pudimos enviar el código. Por favor verifica que tu email sea correcto e intenta nuevamente.",
          [{ text: "Reintentar", onPress: () => generateAndSendCode() }]
        )
      }
      
      setCountdown(60)
    } catch (error: any) {
      console.error("Error generando código:", error)
      Alert.alert("Error", error?.message || "No pudimos enviar el código. Inténtalo de nuevo.")
    } finally {
      setResending(false)
    }
  }

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      Alert.alert("Error", "Por favor ingresa el código de 6 dígitos")
      return
    }

    setLoading(true)
    try {
      console.log("🔐 Verificando código:", code)
      
      const { data: isValid, error } = await supabase.rpc("verify_email_code", {
        p_code: code,
      })

      console.log("📋 Resultado verificación:", { isValid, error })

      if (error) {
        console.error("❌ Error en verify_email_code:", error)
        throw error
      }

      if (isValid) {
        console.log("✅ Código válido!")

        // Pequeño margen para que la BD termine la transacción
        await new Promise(resolve => setTimeout(resolve, 300))

        // Forzar refresh de sesión para disparar App.tsx onAuthStateChange
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.error("⚠️ Error refrescando sesión:", refreshError)
        } else {
          console.log("🔄 Sesión refrescada")
        }

        // Releer email_verified con hasta 3 reintentos rápidos
        const { data: { session } } = await supabase.auth.getSession()
        let verified = false
        if (session?.user?.id) {
          for (let i = 0; i < 3; i++) {
            const { data: userData } = await supabase
              .from('users')
              .select('email_verified')
              .eq('id', session.user.id)
              .single()
            verified = userData?.email_verified === true
            console.log(`🔎 Reintento ${i+1} email_verified=`, userData?.email_verified)
            if (verified) break
            await new Promise(r => setTimeout(r, 250))
          }
          // Si aún no está verificado, forzar update redundante (defensa ante race/replicación)
          if (!verified) {
            console.log('🛠 Forzando update email_verified=true (redundante)')
            const { error: forceError } = await supabase
              .from('users')
              .update({ email_verified: true })
              .eq('id', session.user.id)
            if (forceError) {
              console.error('⚠️ Error en update forzado:', forceError)
            } else {
              // Releer tras update forzado
              const { data: forcedUser } = await supabase
                .from('users')
                .select('email_verified')
                .eq('id', session.user.id)
                .single()
              verified = forcedUser?.email_verified === true
              console.log('🔁 Resultado update forzado email_verified=', forcedUser?.email_verified)
            }
          }
        }

        console.log("✅ Estado final email_verified:", verified)

        // Fallback UX: si ya está true, navega directo a MainTabs
        if (verified) {
    // La navegación a MainTabs la controla App.tsx tras refrescar la sesión
    // Solo mostramos el alert y dejamos que App.tsx redirija automáticamente
        } else {
          // Si por cualquier motivo no reflejó aún, dejamos que App.tsx gobierne
          console.log("⏳ Cambio aún no visible. App.tsx debería conmutar en breve…")
        }
      } else {
        console.log("❌ Código incorrecto o expirado")
        Alert.alert(
          "Código incorrecto", 
          "El código es incorrecto o ha expirado. Intenta de nuevo.",
          [{ text: "OK" }]
        )
        setCode("")
      }
    } catch (err: any) {
      console.error("💥 Error verificando código:", err)
      Alert.alert("Error", err.message || "Ocurrió un error inesperado")
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = () => {
    generateAndSendCode()
  }

  const handleSkip = async () => {
    // Obtener userId actual
    const { data: { session } } = await supabase.auth.getSession()
    const currentUserId = paramUserId || session?.user?.id
    
    if (!currentUserId) return
    
    Alert.alert(
      "Verificar más tarde",
      "⚠️ Recomendamos verificar tu email para acceder a todas las funciones.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Verificar después",
          style: "default",
          onPress: async () => {
            // Marcar email como verificado temporalmente
            await supabase
              .from('users')
              .update({ email_verified: true })
              .eq('id', currentUserId)
            
            // Refrescar sesión
            await supabase.auth.refreshSession()
            
            // App.tsx detectará el cambio y mostrará MainTabs
          },
        },
      ]
    )
  }

  const handleDevLogout = async () => {
    try {
      await supabase.auth.signOut()
      navigation.replace('Login')
    } catch (e) {
      console.warn('Error al cerrar sesión:', e)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="mail-outline" size={70} color={theme.colors.primary} />
        <Text style={styles.title}>Verifica tu email</Text>
        <Text style={styles.subtitle}>
          Hemos enviado un código de verificación a{"\n"}
          <Text style={styles.email}>{displayEmail || "tu correo"}</Text>
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="000000"
          placeholderTextColor={theme.colors.placeholder}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          editable={!loading}
        />

        <TouchableOpacity 
          style={[styles.button, (loading || code.length !== 6) && styles.buttonDisabled]} 
          onPress={handleVerify} 
          disabled={loading || code.length !== 6}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Verificar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleResendCode} 
          style={styles.linkButton} 
          disabled={resending || countdown > 0}
        >
          {resending ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : countdown > 0 ? (
            <Text style={styles.linkTextDisabled}>Reenviar en {countdown}s</Text>
          ) : (
            <Text style={styles.linkText}>¿No recibiste el código? Reenviar</Text>
          )}
        </TouchableOpacity>

        {__DEV__ && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Verificar más tarde</Text>
          </TouchableOpacity>
        )}

        {__DEV__ && (
          <TouchableOpacity onPress={handleDevLogout} style={styles.devLogoutButton}>
            <Text style={styles.devLogoutText}>Cerrar sesión (modo dev)</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.muted} />
        <Text style={styles.footerText}>
          La verificación protege tu cuenta
        </Text>
      </View>
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 24,
      justifyContent: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: 40,
    },
    title: {
      fontSize: 26,
      fontWeight: "bold",
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 22,
    },
    email: {
      fontWeight: "600",
      color: theme.colors.primary,
    },
    form: {
      marginBottom: 30,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 22,
      fontWeight: "bold",
      color: theme.colors.text,
      textAlign: "center",
      letterSpacing: 6,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      marginBottom: 16,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },
    linkButton: {
      padding: 12,
      alignItems: "center",
      marginBottom: 8,
    },
    linkText: {
      color: theme.colors.primary,
      fontSize: 14,
    },
    linkTextDisabled: {
      color: theme.colors.muted,
      fontSize: 14,
    },
    skipButton: {
      padding: 12,
      alignItems: "center",
    },
    skipText: {
      color: theme.colors.muted,
      fontSize: 14,
    },
    devLogoutButton: {
      padding: 8,
      alignItems: 'center',
      marginTop: 6,
    },
    devLogoutText: {
      color: theme.colors.muted,
      fontSize: 12,
      textDecorationLine: 'underline',
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 20,
    },
    footerText: {
      fontSize: 12,
      color: theme.colors.muted,
    },
  })
}
