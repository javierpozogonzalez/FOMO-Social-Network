"use client"

import { useState } from "react"
import * as ImagePicker from "expo-image-picker"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { supabase } from "../lib/supabase"

export default function VenueApplicationScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)

  const [formData, setFormData] = useState({
    venueName: "",
    businessAddress: "",
    city: "",
    cifNumber: "",
    phone: "",
    email: "",
    description: "",
    instagramHandle: "",
    website: "",
  })
  const [logoUri, setLogoUri] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  const [loading, setLoading] = useState(false)

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permiso necesario", "Activa el acceso a fotos en Configuración")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets?.length) {
      setLogoUri(result.assets[0].uri)
    }
  }

  const uploadLogo = async (userId: string) => {
    if (!logoUri) return null
    setLogoUploading(true)
    try {
      const response = await fetch(logoUri)
      const arrayBuffer = await response.arrayBuffer()
      const ext = logoUri.split(".").pop() || "jpg"
      const filePath = `venue_logos/${userId}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        })
      if (uploadError) throw uploadError
      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath)
      return publicData.publicUrl
    } catch (e) {
      Alert.alert("Error", "No se pudo subir el logo")
      return null
    } finally {
      setLogoUploading(false)
    }
  }

  const handleSubmit = async () => {
    // Validaciones
    if (!formData.venueName.trim()) {
      Alert.alert("Error", "El nombre del local es obligatorio")
      return
    }
    if (!formData.businessAddress.trim()) {
      Alert.alert("Error", "La dirección es obligatoria")
      return
    }
    if (!formData.city.trim()) {
      Alert.alert("Error", "La ciudad es obligatoria")
      return
    }
    if (!formData.phone.trim()) {
      Alert.alert("Error", "El teléfono de contacto es obligatorio")
      return
    }
    if (!formData.email.trim()) {
      Alert.alert("Error", "El email es obligatorio")
      return
    }


  setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        Alert.alert("Error", "Debes estar autenticado")
        return
      }


      // Subir logo si existe
      let logoUrl = null
      if (logoUri) {
        logoUrl = await uploadLogo(user.id)
      }

      // Insertar solicitud en la base de datos
      const { error } = await supabase.from("venue_applications").insert({
        user_id: user.id,
        venue_name: formData.venueName.trim(),
        business_address: formData.businessAddress.trim(),
        city: formData.city.trim(),
        cif_number: formData.cifNumber.trim() || null,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        description: formData.description.trim() || null,
        instagram_handle: formData.instagramHandle.trim() || null,
        website: formData.website.trim() || null,
        venue_logo: logoUrl,
        status: "pending",
      })

      if (error) throw error

      Alert.alert(
        "¡Solicitud enviada!",
        "Hemos recibido tu solicitud. Te contactaremos en las próximas 24-48 horas para verificar tu negocio.\n\n📧 Recibirás un email cuando tu cuenta sea aprobada.",
        [
          {
            text: "Entendido",
            onPress: () => navigation.goBack(),
          },
        ]
      )
    } catch (error: any) {
      console.error("Error enviando solicitud:", error)
      Alert.alert("Error", "No se pudo enviar la solicitud. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="business" size={48} color={theme.colors.primary} />
          <Text style={styles.title}>Cuenta profesional</Text>
          <Text style={styles.subtitle}>
            Solicita una cuenta de negocio para publicar eventos, gestionar asistentes y promocionar tu local.
          </Text>
        </View>

        {/* Beneficios */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>✨ Incluye:</Text>
          <View style={styles.benefit}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.benefitText}>30 días de prueba gratis</Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.benefitText}>Crear y gestionar eventos ilimitados</Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.benefitText}>Analytics y estadísticas</Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.benefitText}>Notificaciones a tus seguidores</Text>
          </View>
          <View style={styles.benefit}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.benefitText}>Badge verificado en tu perfil</Text>
          </View>
          
          <View style={styles.pricingNote}>
            <Text style={styles.pricingText}>Después: desde 29€/mes</Text>
          </View>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Información del negocio</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Nombre del local <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Goya Social Club"
              placeholderTextColor={theme.colors.placeholder}
              value={formData.venueName}
              onChangeText={(text) => setFormData({ ...formData, venueName: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Icono / logo del local</Text>
            <TouchableOpacity
              style={[styles.logoPicker, logoUploading && { opacity: 0.6 }]}
              onPress={pickLogo}
              disabled={logoUploading}
              activeOpacity={0.8}
            >
              {logoUri ? (
                <View style={styles.logoPreview}><Ionicons name="image" size={24} color={theme.colors.primary} /><Text style={styles.logoText}>Logo seleccionado</Text></View>
              ) : (
                <View style={styles.logoPreview}><Ionicons name="add" size={24} color={theme.colors.muted} /><Text style={styles.logoText}>Seleccionar imagen</Text></View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Dirección completa <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Calle Goya, 5"
              placeholderTextColor={theme.colors.placeholder}
              value={formData.businessAddress}
              onChangeText={(text) => setFormData({ ...formData, businessAddress: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Ciudad <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Madrid"
              placeholderTextColor={theme.colors.placeholder}
              value={formData.city}
              onChangeText={(text) => setFormData({ ...formData, city: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CIF / NIF (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="B12345678"
              placeholderTextColor={theme.colors.placeholder}
              value={formData.cifNumber}
              onChangeText={(text) => setFormData({ ...formData, cifNumber: text })}
              autoCapitalize="characters"
            />
            <Text style={styles.hint}>Para verificación oficial (no se muestra públicamente)</Text>
          </View>

          <Text style={styles.sectionTitle}>Contacto</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Teléfono <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="+34 600 123 456"
              placeholderTextColor={theme.colors.placeholder}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Email de contacto <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="info@tulocal.com"
              placeholderTextColor={theme.colors.placeholder}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Instagram (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="@tulocal"
              placeholderTextColor={theme.colors.placeholder}
              value={formData.instagramHandle}
              onChangeText={(text) => setFormData({ ...formData, instagramHandle: text })}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Web (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://tulocal.com"
              placeholderTextColor={theme.colors.placeholder}
              value={formData.website}
              onChangeText={(text) => setFormData({ ...formData, website: text })}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Cuéntanos sobre tu local, tipo de música, capacidad, etc."
              placeholderTextColor={theme.colors.placeholder}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Info adicional */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
            <Text style={styles.infoText}>
              Revisaremos tu solicitud en 24-48 horas. Te contactaremos por email para confirmar tu identidad y
              activar tu cuenta profesional.
            </Text>
          </View>

          {/* Botón enviar */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <Text style={styles.submitButtonText}>Enviando...</Text>
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Enviar solicitud</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.text,
      marginTop: 12,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.muted,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 22,
    },
    benefitsCard: {
      backgroundColor: "#F0FDF4",
      borderWidth: 1,
      borderColor: "#86EFAC",
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
    },
    benefitsTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#065F46",
      marginBottom: 12,
    },
    benefit: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    benefitText: {
      fontSize: 14,
      color: "#065F46",
      flex: 1,
    },
    pricingNote: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: "#86EFAC",
    },
    pricingText: {
      fontSize: 13,
      color: "#065F46",
      fontWeight: "600",
      textAlign: "center",
    },
    form: {
      gap: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
      marginTop: 8,
      marginBottom: 4,
    },
    inputGroup: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    required: {
      color: theme.colors.danger,
    },
    input: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: theme.colors.text,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 14,
    },
    hint: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: -4,
    },
    infoBox: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: 12,
      padding: 14,
      marginTop: 8,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.primary,
      lineHeight: 20,
    },
    submitButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      marginTop: 12,
      ...theme.shadow,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    logoPicker: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 14,
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    logoPreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    logoText: {
      fontSize: 15,
      color: theme.colors.text,
    },
  })
}
