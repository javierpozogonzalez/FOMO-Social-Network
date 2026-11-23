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
  ScrollView,
  Image,
} from "react-native"
import { supabase } from "../lib/supabase"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"

type ValidationResult = {
  isValid: boolean
  message: string
}

const validateEmail = (email: string): ValidationResult => {
  if (!email) return { isValid: false, message: "El email es obligatorio" }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { isValid: false, message: "Formato de email inválido" }
  }
  return { isValid: true, message: "" }
}

const validatePassword = (password: string): ValidationResult => {
  if (!password) return { isValid: false, message: "La contraseña es obligatoria" }
  if (password.length < 8) {
    return { isValid: false, message: "Mínimo 8 caracteres" }
  }
  const hasNumber = /\d/.test(password)
  const hasLetter = /[a-zA-Z]/.test(password)
  if (!hasNumber || !hasLetter) {
    return { isValid: false, message: "Debe contener letras y números" }
  }
  return { isValid: true, message: "" }
}

const validateFullName = (name: string): ValidationResult => {
  if (!name) return { isValid: false, message: "El nombre es obligatorio" }
  if (name.length < 2) {
    return { isValid: false, message: "Nombre demasiado corto" }
  }
  if (name.length > 50) {
    return { isValid: false, message: "Nombre demasiado largo (máx 50 caracteres)" }
  }
  return { isValid: true, message: "" }
}

const validateAge = (ageStr: string): ValidationResult => {
  if (!ageStr) return { isValid: true, message: "" }
  const age = Number.parseInt(ageStr)
  if (Number.isNaN(age)) {
    return { isValid: false, message: "Edad inválida" }
  }
  if (age < 16) {
    return { isValid: false, message: "Debes tener al menos 16 años" }
  }
  if (age > 120) {
    return { isValid: false, message: "Edad no válida" }
  }
  return { isValid: true, message: "" }
}

export default function RegisterScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [city, setCity] = useState("")
  const [age, setAge] = useState("")
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [touched, setTouched] = useState({
    email: false,
    password: false,
    fullName: false,
    age: false,
  })

  const emailValidation = validateEmail(email)
  const passwordValidation = validatePassword(password)
  const fullNameValidation = validateFullName(fullName)
  const ageValidation = validateAge(age)

  const handleRegister = async () => {
    setTouched({
      email: true,
      password: true,
      fullName: true,
      age: true,
    })

    if (!acceptedTerms) {
      Alert.alert("Debes Aceptar", "Acepta los Términos y la Política de Privacidad para continuar")
      return
    }

    if (!(emailValidation.isValid && passwordValidation.isValid && fullNameValidation.isValid && ageValidation.isValid)) {
      Alert.alert("Error", "Por favor corrige los errores en el formulario")
      return
    }

    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
        },
      })

      if (authError) {
        Alert.alert("Error de registro", authError.message)
        setLoading(false)
        return
      }

      if (authData.user) {
        if (authData.user.identities && authData.user.identities.length === 0) {
          Alert.alert("Email ya registrado", "Este email ya está en uso")
          setLoading(false)
          return
        }

        const { error: profileError } = await supabase.from("users").insert({
          id: authData.user.id,
          email,
          full_name: fullName,
          city: city || null,
          age: age ? Number.parseInt(age) : null,
          email_verified: false,
        })

        if (profileError) {
          console.log("❌ Error al crear perfil:", profileError)
        } else {
          console.log("✅ Perfil creado con email_verified: false")
        }

        await new Promise(resolve => setTimeout(resolve, 500))
        setLoading(false)
        console.log('🔐 Registro completo. App.tsx debe renderizar VerifyEmailScreen')
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Ocurrió un error inesperado")
      setLoading(false)
    }
  }

  return (
    <View style={styles.backgroundImage}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Image source={require("../../assets/fomoLogoGrande.png")} style={styles.logoImage} resizeMode="contain" />
          <View style={styles.form}>
            {/* Grupo 1: Nombre, Email, Contraseña */}
            <View style={styles.group}>
              <View>
                <TextInput
                  style={[styles.input, touched.fullName && !fullNameValidation.isValid && styles.inputError]}
                  placeholder="Nombre completo *"
                  placeholderTextColor="#9CA3AF"
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text)
                    setTouched((prev) => ({ ...prev, fullName: true }))
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, fullName: true }))}
                />
                {touched.fullName && !fullNameValidation.isValid && fullNameValidation.message && (
                  <Text style={[styles.validationText, styles.validationError]}>{fullNameValidation.message}</Text>
                )}
              </View>

              <View>
                <TextInput
                  style={[styles.input, touched.email && !emailValidation.isValid && styles.inputError]}
                  placeholder="Email *"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text)
                    setTouched((prev) => ({ ...prev, email: true }))
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                {touched.email && !emailValidation.isValid && emailValidation.message && (
                  <Text style={[styles.validationText, styles.validationError]}>{emailValidation.message}</Text>
                )}
              </View>

              <View>
                <TextInput
                  style={[styles.input, touched.password && !passwordValidation.isValid && styles.inputError]}
                  placeholder="Contraseña *"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text)
                    setTouched((prev) => ({ ...prev, password: true }))
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                  secureTextEntry
                />
                {touched.password && !passwordValidation.isValid && passwordValidation.message && (
                  <Text style={[styles.validationText, styles.validationError]}>{passwordValidation.message}</Text>
                )}
              </View>
            </View>

            {/* Grupo 2: Ciudad, Edad */}
            <View style={styles.group}>
              <TextInput
                style={styles.input}
                placeholder="Ciudad"
                placeholderTextColor="#9CA3AF"
                value={city}
                onChangeText={setCity}
              />

              <View>
                <TextInput
                  style={[styles.input, touched.age && !ageValidation.isValid && styles.inputError]}
                  placeholder="Edad"
                  placeholderTextColor="#9CA3AF"
                  value={age}
                  onChangeText={(text) => {
                    setAge(text)
                    if (text) setTouched((prev) => ({ ...prev, age: true }))
                  }}
                  onBlur={() => {
                    if (age) setTouched((prev) => ({ ...prev, age: true }))
                  }}
                  keyboardType="numeric"
                />
                {touched.age && !ageValidation.isValid && ageValidation.message && (
                  <Text style={[styles.validationText, styles.validationError]}>{ageValidation.message}</Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 2 }}
              onPress={() => setAcceptedTerms((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: acceptedTerms ? theme.colors.primary : theme.colors.border,
                  backgroundColor: acceptedTerms ? theme.colors.primary : "#fff",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 8,
                }}
              >
                {acceptedTerms && (
                  <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>✓</Text>
                )}
              </View>
              <Text style={styles.termsText} numberOfLines={1}>
                Acepto los <Text style={styles.termsLink}>Términos</Text> y la <Text style={styles.termsLink}>Política de Privacidad</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading || !acceptedTerms}>
              <Text style={styles.buttonText}>{loading ? "Cargando..." : "Registrarse"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.linkButton}>
              <Text style={styles.linkText}>¿Ya tienes cuenta? Inicia sesión</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    scrollContent: {
      flexGrow: 1,
      justifyContent: "flex-start",
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 16,
    },
    logoImage: {
      width: 280,
      height: 280,
      alignSelf: "center",
      marginBottom: 8,
    },
    form: {
      gap: 12,
    },
    group: {
      gap: 12,
    },
    termsText: {
      color: theme.colors.text,
      fontSize: 13,
      lineHeight: 18,
      flexShrink: 1,
      flex: 1,
    },
    termsLink: {
      color: theme.colors.primary,
      textDecorationLine: 'underline',
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
    inputError: {
      borderColor: "#EF4444",
      borderWidth: 2,
    },
    validationText: {
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
    },
    validationError: {
      color: "#EF4444",
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
