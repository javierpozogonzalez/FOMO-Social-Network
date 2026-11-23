"use client"

import { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native"
import { supabase } from "../lib/supabase"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"

export default function LoginScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Por favor completa todos los campos")
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Traducir errores comunes al español
      if (error.message.includes("Invalid login credentials")) {
        Alert.alert("Error", "Credenciales incorrectas. Verifica tu email y contraseña.")
      } else if (error.message.includes("Email not confirmed")) {
        Alert.alert("Error", "Debes verificar tu email antes de iniciar sesión.")
      } else if (error.message.includes("User not found")) {
        Alert.alert("Usuario no existe", "Este usuario aún no existe. Por favor regístrate antes.")
      } else {
        Alert.alert("Error", "No se pudo iniciar sesión. Verifica tus credenciales.")
      }
    }
    setLoading(false)
  }

  return (
    <View style={styles.backgroundImage}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <View style={styles.content}>
          <Image source={require("../../assets/fomoLogoGrande.png")} style={styles.logoImage} resizeMode="contain" />

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? "Cargando..." : "Iniciar Sesión"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Register")} style={styles.linkButton}>
              <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    backgroundImage: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      padding: 24,
    },
    logoImage: {
      width: 300,
      height: 300,
      alignSelf: "center",
      marginBottom: 60,
    },
    form: {
      gap: 16,
    },
    input: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      marginTop: 8,
      ...theme.shadow,
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    linkButton: {
      padding: 8,
      alignItems: "center",
    },
    linkText: {
      color: theme.colors.primary,
      fontSize: 14,
    },
  })
}
