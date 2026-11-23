import React, { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { supabase } from "../lib/supabase"

export default function PrivacidadSeguridadScreen() {
  const { theme } = useTheme()
  const styles = getStyles(theme)

  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")

  // Exportar datos
  const [showExportData, setShowExportData] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<string | null>(null)
  const [emailSending, setEmailSending] = useState(false)

  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserEmail(user?.email ?? null)
    })()
  }, [])

  const verifyPassword = async (password: string) => {
    if (!userEmail) {
      Alert.alert(
        "Cuenta sin email",
        "No pudimos verificar tu contraseña porque tu sesión no tiene email asociado (posible login social). Por favor establece un email/contraseña desde Editar Perfil o contacta a soporte."
      )
      return false
    }
    const { error } = await supabase.auth.signInWithPassword({ email: userEmail, password })
    if (error) {
      Alert.alert("Contraseña incorrecta", "La contraseña actual no es válida. Inténtalo de nuevo.")
      return false
    }
    return true
  }

  const handleChangePassword = async () => {
    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Por favor completa todos los campos")
      return
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "La nueva contraseña debe tener al menos 6 caracteres")
      return
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Las contraseñas no coinciden")
      return
    }

    // Verificar contraseña actual
    setChangingPassword(true)

    const ok = await verifyPassword(currentPassword)
    if (!ok) {
      setChangingPassword(false)
      return
    }

    try {
      // Supabase permite cambiar contraseña directamente
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      Alert.alert("✓ Contraseña actualizada", "Tu contraseña ha sido cambiada correctamente", [
        {
          text: "OK",
          onPress: () => {
            setShowChangePassword(false)
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
          },
        },
      ])
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo cambiar la contraseña")
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      Alert.alert("Error", "Debes ingresar tu contraseña actual para continuar")
      return
    }

    const ok = await verifyPassword(deletePassword)
    if (!ok) return

    if (deleteConfirmation.toLowerCase() !== "eliminar") {
      Alert.alert("Error", 'Debes escribir "ELIMINAR" para confirmar')
      return
    }

    Alert.alert(
      "⚠️ Confirmación final",
      "Esta acción es IRREVERSIBLE. Se eliminarán:\n\n• Tu perfil y datos personales\n• Tus amigos y conexiones\n• Tu asistencia a eventos\n• Todas tus fotos\n\n¿Estás completamente seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, eliminar mi cuenta",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true)

            try {
              const {
                data: { user },
              } = await supabase.auth.getUser()
              if (!user) throw new Error("No se pudo obtener el usuario")

              // 1. Eliminar datos relacionados (en orden para evitar errores de foreign key)
              console.log('Eliminando datos relacionados...')
              
              // Primero las tablas que dependen de otras
              await supabase.from("external_attendance_batches").delete().eq("created_by", user.id)
              await supabase.from("notification_tokens").delete().eq("user_id", user.id)
              await supabase.from("user_settings").delete().eq("user_id", user.id)
              await supabase.from("venue_applications").delete().eq("user_id", user.id)
              await supabase.from("venue_followers").delete().eq("user_id", user.id)
              await supabase.from("event_attendees").delete().eq("user_id", user.id)
              await supabase.from("friendships").delete().or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
              
              // Eventos creados por el usuario
              await supabase.from("events").delete().eq("creator_id", user.id)

              // 2. (Nuevo) Eliminar completamente la cuenta vía RPC SECURITY DEFINER
              // Esto borra: relaciones + perfil + auth.users (si ejecutaste el script 34)
              console.log('Invocando RPC delete_account_completely(p_user_id)...')
              const { error: rpcError } = await supabase.rpc('delete_account_completely', { p_user_id: user.id })
              if (rpcError) {
                console.error('Error RPC delete_account_completely:', rpcError)
                // Fallback si la función aún no está en el schema cache o falla
                if (rpcError.code === 'PGRST202') {
                  console.warn('Fallback a borrado directo users + signOut (RPC no encontrada)')
                  const { error: deleteUserError } = await supabase.from('users').delete().eq('id', user.id)
                  if (deleteUserError) throw deleteUserError
                } else {
                  throw rpcError
                }
              }

              // 3. Cerrar sesión (puede que ya esté invalidada, hacemos signOut defensivo)
              console.log('Cerrando sesión...')
              await supabase.auth.signOut()

              Alert.alert(
                "Cuenta eliminada",
                "Tu cuenta ha sido eliminada correctamente. Esperamos verte de nuevo pronto.",
                [{ text: "OK" }]
              )
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "No se pudo eliminar la cuenta. Por favor contacta a soporte."
              )
            } finally {
              setDeletingAccount(false)
              setShowDeleteAccount(false)
              setDeleteConfirmation("")
              setDeletePassword("")
            }
          },
        },
      ]
    )
  }

  const handleExportData = async () => {
    setExportResult(null)
    setExporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { data, error } = await supabase.functions.invoke('export-user-data', { body: { userId: user.id } })
      if (error || !data?.success) throw new Error(error?.message || 'Error exportando datos')
      const jsonPretty = JSON.stringify(data.data, null, 2)
      setExportResult(jsonPretty)
      Alert.alert('Exportación lista', 'Se generó tu archivo de datos. Puedes copiarlo o enviarlo por email.')
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo exportar')
    } finally { setExporting(false) }
  }

  const handleEmailExport = async () => {
    if (emailSending) return
    setEmailSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.email) throw new Error('No email disponible')
      const { data, error } = await supabase.functions.invoke('export-user-data', { body: { userId: user.id, sendEmail: true, email: user.email } })
      if (error || !data?.success) throw new Error(error?.message || 'Error enviando email')
      Alert.alert('Email enviado', 'Tu exportación ha sido enviada a tu correo.')
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo enviar el email')
    } finally { setEmailSending(false) }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Privacidad y Seguridad</Text>
      <Text style={styles.headerSubtitle}>Gestiona la seguridad de tu cuenta y tus datos personales</Text>

      {/* Sección: Seguridad de la Cuenta */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Seguridad de la Cuenta</Text>

        {/* Cambiar Contraseña */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => setShowChangePassword(!showChangePassword)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="lock-closed" size={24} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Cambiar Contraseña</Text>
            </View>
            <Ionicons
              name={showChangePassword ? "chevron-up" : "chevron-down"}
              size={24}
              color={theme.colors.muted}
            />
          </View>
        </TouchableOpacity>

        {showChangePassword && (
          <View style={styles.cardContent}>
            <Text style={styles.label}>Contraseña actual</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu contraseña actual"
              placeholderTextColor={theme.colors.placeholder}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.label}>Nueva contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={theme.colors.placeholder}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.label}>Confirmar contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="Repite la nueva contraseña"
              placeholderTextColor={theme.colors.placeholder}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.button, changingPassword && styles.buttonDisabled]}
              onPress={handleChangePassword}
              disabled={changingPassword}
            >
              <Text style={styles.buttonText}>
                {changingPassword ? "Cambiando..." : "Guardar nueva contraseña"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Sección: Datos y Cuenta */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos y Cuenta</Text>

        {/* Exportar Datos */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => setShowExportData(!showExportData)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="download" size={24} color={theme.colors.primary} />
              <Text style={styles.cardTitle}>Exportar mis datos</Text>
            </View>
            <Ionicons
              name={showExportData ? "chevron-up" : "chevron-down"}
              size={24}
              color={theme.colors.muted}
            />
          </View>
        </TouchableOpacity>
        {showExportData && (
          <View style={styles.cardContent}>
            <Text style={styles.infoTextExport}>
              Genera un archivo JSON con toda la información asociada a tu cuenta según el GDPR.
            </Text>
            
            <TouchableOpacity
              style={[styles.button, exporting && styles.buttonDisabled]}
              onPress={handleExportData}
              disabled={exporting}
            >
              {exporting ? <ActivityIndicator color="#fff" /> : (
                <View style={styles.buttonContent}>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Exportar datos localmente</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.buttonEmail, emailSending && styles.buttonDisabled]}
              onPress={handleEmailExport}
              disabled={emailSending}
            >
              {emailSending ? <ActivityIndicator color="#fff" /> : (
                <View style={styles.buttonContent}>
                  <Ionicons name="mail-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Enviar exportación por email</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {exportResult && (
              <View style={styles.exportBox}>
                <Text style={styles.label}>Resultado (JSON)</Text>
                <ScrollView style={styles.exportScroll} nestedScrollEnabled>
                  <Text style={styles.exportText}>{exportResult}</Text>
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Eliminar Cuenta */}
        <TouchableOpacity
          style={[styles.card, styles.cardDanger]}
          onPress={() => setShowDeleteAccount(!showDeleteAccount)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="trash" size={24} color={theme.colors.danger} />
              <Text style={[styles.cardTitle, styles.cardTitleDanger]}>Eliminar Cuenta</Text>
            </View>
            <Ionicons
              name={showDeleteAccount ? "chevron-up" : "chevron-down"}
              size={24}
              color={theme.colors.muted}
            />
          </View>
        </TouchableOpacity>

        {showDeleteAccount && (
          <View style={styles.cardContent}>
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={32} color={theme.colors.danger} />
              <Text style={styles.warningTitle}>¡Atención! Esta acción es irreversible</Text>
              <Text style={styles.warningText}>
                Al eliminar tu cuenta se borrarán permanentemente:
              </Text>
              <Text style={styles.warningBullet}>• Tu perfil y datos personales</Text>
              <Text style={styles.warningBullet}>• Todas tus conexiones y amigos</Text>
              <Text style={styles.warningBullet}>• Tu historial de eventos</Text>
              <Text style={styles.warningBullet}>• Fotos y contenido subido</Text>
            </View>

            <Text style={styles.label}>Contraseña actual</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu contraseña actual"
              placeholderTextColor={theme.colors.placeholder}
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.label}>
              Escribe <Text style={styles.boldText}>ELIMINAR</Text> para confirmar
            </Text>
            <TextInput
              style={styles.input}
              placeholder="ELIMINAR"
              placeholderTextColor={theme.colors.placeholder}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[styles.buttonDanger, deletingAccount && styles.buttonDisabled]}
              onPress={handleDeleteAccount}
              disabled={deletingAccount}
            >
              <Text style={styles.buttonText}>
                {deletingAccount ? "Eliminando..." : "Eliminar mi cuenta permanentemente"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Información adicional */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
        <Text style={styles.infoText}>
          Si tienes problemas de seguridad o necesitas ayuda, contacta con nosotros en{" "}
          <Text style={styles.emailText}>seguridad@fomoapp.com</Text>
        </Text>
      </View>
    </ScrollView>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 20,
      paddingTop: Platform.OS === "ios" ? 60 : 30,
      paddingBottom: 40,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 15,
      color: theme.colors.muted,
      marginBottom: 24,
    },
    section: {
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 12,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadow,
    },
    cardDanger: {
      borderColor: theme.colors.danger + "30",
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    cardTitleDanger: {
      color: theme.colors.danger,
    },
    cardContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginTop: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
      marginTop: 8,
      ...theme.shadow,
    },
    buttonDanger: {
      backgroundColor: theme.colors.danger,
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
      marginTop: 8,
      ...theme.shadow,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    warningBox: {
      backgroundColor: theme.colors.danger + "10",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.danger + "30",
      alignItems: "center",
    },
    warningTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.colors.danger,
      marginTop: 8,
      marginBottom: 12,
      textAlign: "center",
    },
    warningText: {
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: "center",
    },
    warningBullet: {
      fontSize: 14,
      color: theme.colors.muted,
      marginVertical: 2,
      alignSelf: "flex-start",
    },
    boldText: {
      fontWeight: "bold",
      color: theme.colors.text,
    },
    infoBox: {
      flexDirection: "row",
      backgroundColor: theme.colors.primary + "10",
      borderRadius: 12,
      padding: 16,
      gap: 12,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: theme.colors.primary + "30",
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.text,
      flex: 1,
      lineHeight: 20,
    },
    emailText: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    buttonEmail: {
      backgroundColor: '#059669',
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
      marginTop: 12,
      ...theme.shadow,
    },
    infoTextExport: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: 16,
      lineHeight: 20,
    },
    exportBox: {
      marginTop: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: theme.colors.card,
    },
    exportScroll: {
      maxHeight: 200,
      marginTop: 8,
    },
    exportText: {
      fontSize: 12,
      color: theme.colors.muted,
    },
  })
}
