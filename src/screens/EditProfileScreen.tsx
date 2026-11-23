"use client"

import { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native"
import * as ImagePicker from "expo-image-picker"
import { supabase } from "../lib/supabase"
import type { User } from "../types/database.types"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"

export default function EditProfileScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [user, setUser] = useState<User | null>(null)
  const [fullName, setFullName] = useState("")
  const [city, setCity] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    setLoading(true)
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (authUser) {
      const { data: userData } = await supabase.from("users").select("*").eq("id", authUser.id).single()

      if (userData) {
        setUser(userData)
        setFullName(userData.full_name || "")
        setCity(userData.city || "")
        setBirthDate(userData.birth_date || "")
      }
    }
    setLoading(false)
  }

  const saveProfile = async () => {
    if (!user) return

    if (!fullName.trim()) {
      Alert.alert("Error", "El nombre no puede estar vacío")
      return
    }

    setSaving(true)

    const updates: Partial<User> = {
      full_name: fullName.trim(),
      city: city.trim() || undefined,
      birth_date: birthDate.trim() || undefined,
    }

    const { error } = await supabase.from("users").update(updates).eq("id", user.id)

    setSaving(false)

    if (error) {
      Alert.alert("Error", error.message)
    } else {
      Alert.alert("✓ Guardado", "Tu perfil se actualizó correctamente")
      navigation.goBack()
    }
  }

  const pickAndUploadAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status !== "granted") {
        Alert.alert(
          "Permiso necesario",
          "Por favor, permite el acceso a tu galería en Configuración > FOMO > Fotos",
          [{ text: "OK" }]
        )
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      })

      if (result.canceled || !result.assets?.length || !user) return

      const asset = result.assets[0]

      try {
        const response = await fetch(asset.uri)
        const arrayBuffer = await response.arrayBuffer()
        const fileExt = asset.uri.split(".").pop() || "jpg"
        const filePath = `${user.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        })
        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath)
        const publicUrl = publicData.publicUrl

        const { error: updateError } = await supabase.from("users").update({ avatar_url: publicUrl }).eq("id", user.id)

        if (updateError) throw updateError

        setUser({ ...user, avatar_url: publicUrl })
        Alert.alert("✓ Listo", "Tu foto de perfil se actualizó correctamente")
        await loadUserData()
      } catch (e: any) {
        console.error("Upload error:", e)
        Alert.alert(
          "Error",
          e?.message || "No se pudo subir la imagen. Verifica que el bucket 'avatars' exista en Supabase Storage."
        )
      }
    } catch (error: any) {
      console.error("Permission error:", error)
      Alert.alert("Error", "No se pudieron solicitar los permisos")
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    )
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se pudo cargar el perfil</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={pickAndUploadAvatar} activeOpacity={0.8}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={48} color="#fff" />
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.changePhotoText}>Toca para cambiar foto</Text>
      </View>

      {/* Formulario */}
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre completo *</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Tu nombre"
            placeholderTextColor={theme.colors.placeholder}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ciudad</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Madrid, Barcelona, Valencia..."
            placeholderTextColor={theme.colors.placeholder}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fecha de nacimiento</Text>
          <TextInput
            style={styles.input}
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={theme.colors.placeholder}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={styles.hint}>Formato: 1995-06-15</Text>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
          <Text style={styles.infoText}>
            Tu email ({user.email}) no puede cambiarse desde aquí. Contacta con soporte si necesitas modificarlo.
          </Text>
        </View>
      </View>

      {/* Botones */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Guardar cambios</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
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
    contentContainer: {
      padding: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.colors.muted,
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.danger,
    },
    avatarSection: {
      alignItems: "center",
      paddingVertical: 24,
    },
    avatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
    },
    avatarPlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.primarySoft,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: theme.colors.primary,
    },
    cameraBadge: {
      position: "absolute",
      bottom: 4,
      right: 4,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: theme.colors.background,
    },
    changePhotoText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.colors.muted,
    },
    form: {
      gap: 20,
    },
    inputGroup: {
      gap: 8,
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text,
    },
    hint: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 4,
    },
    infoBox: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
    },
    buttons: {
      marginTop: 32,
      gap: 12,
    },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 16,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#fff",
    },
    cancelButton: {
      alignItems: "center",
      padding: 16,
    },
    cancelButtonText: {
      fontSize: 16,
      color: theme.colors.muted,
    },
  })
}
