"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform, Image } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import * as ImagePicker from "expo-image-picker"
import { uploadEventImage } from "../lib/storage"

export default function CreateEventScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)

  const [title, setTitle] = useState("")
  const now = new Date()
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  const [dateStr, setDateStr] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
  const [timeStr, setTimeStr] = useState(`${pad(now.getHours())}:${pad(now.getMinutes())}`)
  const [venueName, setVenueName] = useState("")
  const [venueId, setVenueId] = useState("")
  const [venueLogo, setVenueLogo] = useState<string>("")
  const [city, setCity] = useState("")
  const [address, setAddress] = useState("")
  const [musicGenre, setMusicGenre] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth.user
        if (!user) return
        
        // Usar la misma lógica robusta que EditVenueProfileScreen
        const { data: userRow } = await supabase
          .from("users")
          .select("venue_id")
          .eq("id", user.id)
          .single()
        
        if (userRow?.venue_id) {
          setVenueId(userRow.venue_id) // 🔑 Guardar el venue_id
          
          const { data: appRow } = await supabase
            .from("venue_applications")
            .select("venue_name, venue_logo, city, business_address, description")
            .eq("id", userRow.venue_id)
            .single()
          
          if (appRow) {
            setVenueName(appRow.venue_name || "")
            setVenueLogo(appRow.venue_logo || "")
            setCity(appRow.city || "")
            setAddress(appRow.business_address || "")
          }
        }
      } catch (e) {
        console.error("Error loading venue data:", e)
      }
    }
    loadDefaults()
  }, [])

  const parseDateTime = () => {
    // Construye un Date desde YYYY-MM-DD y HH:mm; si falla, usa now
    try {
      const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10))
      const [hh, mm] = timeStr.split(":" ).map((s) => parseInt(s, 10))
      const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0)
      if (isNaN(dt.getTime())) return new Date()
      return dt
    } catch {
      return new Date()
    }
  }

  const handleCreate = async () => {
    if (!title.trim()) return Alert.alert("Falta título", "Pon un título para el evento")
  if (!venueName.trim() || !city.trim()) return Alert.alert("Datos del local", "Falta nombre del local y ciudad")
  if (!address.trim()) return Alert.alert("Dirección requerida", "Tu perfil de local no tiene dirección. Por favor edítalo en \"Editar perfil\" antes de publicar.")

    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) throw new Error("No autenticado")

      // Validar límite usando la nueva RPC self
      const { data: can } = await supabase.rpc("can_create_event_self")
      if (can === false) {
        Alert.alert(
          "Límite alcanzado",
          "Has llegado al máximo de eventos para tu plan.",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Ver planes", onPress: () => navigation.navigate("SubscriptionPlans") },
          ]
        )
        return
      }

      // Preparar fecha y hora según schema (DATE y TIME)
      const selected = parseDateTime()
      const y = selected.getFullYear()
      const m = pad(selected.getMonth() + 1)
      const d = pad(selected.getDate())
      const hh = pad(selected.getHours())
      const mm = pad(selected.getMinutes())
      const event_date = `${y}-${m}-${d}` // DATE
      const start_time = `${hh}:${mm}:00` // TIME

      // Regla 1: no publicar en el pasado
      if (selected.getTime() < Date.now()) {
        Alert.alert("Fecha inválida", "No puedes publicar eventos en el pasado.")
        return
      }

      // Regla 2: no más de 1 evento por día (por local)
      const { count: sameDayCount } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .eq("event_date", event_date)
      if ((sameDayCount || 0) > 0) {
        Alert.alert("Límite por día", "Ya tienes un evento publicado para ese día.")
        return
      }

      // Si hay imagen, subirla primero
      let image_url: string | null = null
      if (imageUri) {
        try {
          setUploadingImage(true)
          image_url = await uploadEventImage(imageUri, venueId)
        } catch (e: any) {
          console.warn("No se pudo subir la imagen del evento:", e?.message || e)
          // No bloqueamos la creación del evento por fallo de imagen
        } finally {
          setUploadingImage(false)
        }
      }

      const { error } = await supabase.from("events").insert({
        title: title.trim(),
        event_date, // DATE
        start_time, // TIME NOT NULL
        venue_id: venueId, // 🔑 Usar venue_id en lugar de venue_name
        venue_name: venueName.trim(), // Mantener por compatibilidad
        venue_logo: venueLogo || null,
        address: address.trim(),
        city: city.trim(),
        music_genre: musicGenre.trim() || null,
        description: description.trim() || null,
        image_url: image_url,
        created_by: user.id,
      })
      if (error) throw error
      // Navegar sin alertas: volver al perfil del local y que aparezca en Próximos
      // Al estar en el ProfileStack, hacer popToTop nos lleva a ProfileMain (ProfileSwitcher) → VenueProfile
      navigation.popToTop()
    } catch (e: any) {
      const msg: string = e?.message || "No se pudo crear el evento"
      // Mensaje más claro si es una política RLS
      if (msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("rls")) {
        Alert.alert(
          "Permisos insuficientes",
          "Tu cuenta de local no tiene permisos para crear eventos todavía. Asegúrate de que tu solicitud de local está aprobada y que las políticas de seguridad están actualizadas."
        )
      } else {
        Alert.alert("Error", msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Título eliminado para evitar duplicación con el header */}

      <View style={styles.group}>
        <Text style={styles.label}>Título</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Noche electrónica"
          placeholderTextColor={theme.colors.placeholder}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="2025-11-03"
          placeholderTextColor={theme.colors.placeholder}
          value={dateStr}
          onChangeText={setDateStr}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Hora (HH:mm)</Text>
        <TextInput
          style={styles.input}
          placeholder="22:30"
          placeholderTextColor={theme.colors.placeholder}
          value={timeStr}
          onChangeText={setTimeStr}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Nombre del local</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          placeholder="Mi Local"
          placeholderTextColor={theme.colors.placeholder}
          value={venueName}
          editable={false}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Ciudad</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          placeholder="Madrid"
          placeholderTextColor={theme.colors.placeholder}
          value={city}
          editable={false}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Dirección</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          placeholder="C. de Barceló, 11"
          placeholderTextColor={theme.colors.placeholder}
          value={address}
          editable={false}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Género musical</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Techno, Pop, Reggaetón"
          placeholderTextColor={theme.colors.placeholder}
          value={musicGenre}
          onChangeText={setMusicGenre}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Descripción (opcional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Detalles del evento, DJ, dress code, etc."
          placeholderTextColor={theme.colors.placeholder}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Imagen del evento */}
      <View style={styles.group}>
        <Text style={styles.label}>Imagen del evento (opcional)</Text>
        {imageUri ? (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <View style={styles.imageButtonsRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => setImageUri(null)}
                activeOpacity={0.85}
              >
                <Ionicons name="trash" size={16} color={theme.colors.text} />
                <Text style={styles.secondaryButtonText}>Quitar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={async () => {
                  try {
                    const res = await pickImage()
                    if (res) setImageUri(res)
                  } catch (e) {}
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="images" size={16} color={theme.colors.text} />
                <Text style={styles.secondaryButtonText}>Cambiar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={async () => {
              try {
                const res = await pickImage()
                if (res) setImageUri(res)
              } catch (e) {}
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="images" size={18} color={theme.colors.text} />
            <Text style={styles.secondaryButtonText}>Seleccionar imagen</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.submit, loading && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Ionicons name="send" size={18} color="#FFFFFF" />
        <Text style={styles.submitText}>
          {loading ? (uploadingImage ? "Subiendo imagen..." : "Publicando...") : "Publicar"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: 20 },
    // title eliminado (se mostraba un H1 redundante)
    group: { marginBottom: 16, gap: 8 },
    label: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
    input: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      color: theme.colors.text,
    },
    inputDisabled: {
      opacity: 0.55,
    },
    
    textarea: { minHeight: 100, paddingTop: 12 },
    imagePreviewWrap: {
      gap: 10,
    },
    imagePreview: {
      width: "100%",
      height: 180,
      borderRadius: 12,
      backgroundColor: theme.colors.border,
    },
    imageButtonsRow: {
      flexDirection: "row",
      gap: 10,
    },
    secondaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingVertical: 12,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
    },
    submit: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      marginTop: 8,
      ...theme.shadow,
    },
    submitText: { color: "#FFFFFF", fontWeight: "800" },
  })
}

// Helpers
async function pickImage(): Promise<string | null> {
  // Pedir permisos si son necesarios
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== "granted") {
    Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería para seleccionar una imagen.")
    return null
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
    aspect: [4, 3],
  })
  if (result.canceled) return null
  const asset = result.assets?.[0]
  return asset?.uri || null
}
