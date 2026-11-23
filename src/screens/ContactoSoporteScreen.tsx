import React, { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { supabase } from "../lib/supabase"
import * as Linking from "expo-linking"

export default function ContactoSoporteScreen() {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [mensaje, setMensaje] = useState("")
  const [enviando, setEnviando] = useState(false)

  // Obtener email del usuario logueado
  const [userEmail, setUserEmail] = useState("")
  React.useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setUserEmail(user.email)
    })()
  }, [])

  const handleEnviar = async () => {
    if (!mensaje.trim()) {
      Alert.alert("Error", "Por favor escribe tu mensaje antes de enviar.")
      return
    }
    setEnviando(true)
    // Construir mailto
    const destinatario = "soporte@fomoapp.com"
    const asunto = encodeURIComponent("Soporte FOMO")
    let cuerpo = encodeURIComponent(mensaje)
    if (userEmail) {
      cuerpo = encodeURIComponent(`Email usuario: ${userEmail}\n\n${mensaje}`)
    }
    const mailtoUrl = `mailto:${destinatario}?subject=${asunto}&body=${cuerpo}`
    await Linking.openURL(mailtoUrl)
    setEnviando(false)
    Alert.alert("¡Mensaje preparado!", "Solo tienes que enviarlo desde tu app de correo.")
    setMensaje("")
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contacto y Soporte</Text>
      <Text style={styles.subtitle}>¿Tienes alguna duda, sugerencia o problema? Escríbenos y te ayudaremos.</Text>
      <TextInput
        style={styles.textarea}
        placeholder="Escribe tu mensaje aquí..."
        placeholderTextColor={theme.colors.placeholder}
        value={mensaje}
        onChangeText={setMensaje}
        multiline
        numberOfLines={6}
        editable={!enviando}
      />
      <TouchableOpacity style={styles.button} onPress={handleEnviar} disabled={enviando}>
        <Text style={styles.buttonText}>{enviando ? "Preparando..." : "Enviar mensaje"}</Text>
      </TouchableOpacity>
      <Text style={styles.infoText}>El mensaje se enviará a soporte@fomoapp.com</Text>
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 24,
      paddingTop: Platform.OS === "ios" ? 60 : 30,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.muted,
      marginBottom: 18,
      textAlign: "center",
    },
    textarea: {
      backgroundColor: theme.colors.card,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 18,
      minHeight: 120,
      textAlignVertical: "top",
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      padding: 16,
      alignItems: "center",
      marginBottom: 12,
      ...theme.shadow,
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    infoText: {
      color: theme.colors.muted,
      fontSize: 13,
      textAlign: "center",
      marginTop: 8,
    },
  })
}
