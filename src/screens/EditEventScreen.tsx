"use client"

import { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import * as ImagePicker from "expo-image-picker"
import { uploadEventImage } from "../lib/storage"

export default function EditEventScreen({ route, navigation }: any) {
  const { eventId } = route.params
  const { theme } = useTheme()
  const styles = getStyles(theme)

  const [title, setTitle] = useState("")
  const [dateStr, setDateStr] = useState("")
  const [timeStr, setTimeStr] = useState("")
  const [endTimeStr, setEndTimeStr] = useState("")
  const [venueName, setVenueName] = useState("")
  const [city, setCity] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [localImageUri, setLocalImageUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadEvent()
  }, [])

  const loadEvent = async () => {
    try {
      setLoadingData(true)
      const { data: event, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single()

      if (error) throw error

      if (event) {
        setTitle(event.title)
        setDateStr(event.event_date)
        setTimeStr(event.start_time)
        setEndTimeStr(event.end_time || "")
        setVenueName(event.venue_name)
        setCity(event.city)
        setDescription(event.description || "")
        setImageUrl(event.image_url || null)
      }
    } catch (error: any) {
      Alert.alert("Error", error.message)
      navigation.goBack()
    } finally {
      setLoadingData(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !dateStr || !timeStr) {
      Alert.alert("Error", "Por favor completa todos los campos obligatorios")
      return
    }

    try {
      setLoading(true)

      // Si el usuario seleccionó una nueva imagen local, súbela primero
      let finalImageUrl = imageUrl
      if (localImageUri) {
        try {
          setUploading(true)
          // necesitamos venue_id; lo traemos del evento actual
          const { data: ev } = await supabase.from("events").select("venue_id").eq("id", eventId).single()
          const venueId = (ev as any)?.venue_id || ""
          if (!venueId) throw new Error("No se encontró el venue_id del evento")
          finalImageUrl = await uploadEventImage(localImageUri, venueId)
        } finally {
          setUploading(false)
        }
      }

      const { error } = await supabase
        .from("events")
        .update({
          title: title.trim(),
          event_date: dateStr,
          start_time: timeStr,
          end_time: endTimeStr || null,
          description: description.trim() || null,
          image_url: finalImageUrl || null,
        })
        .eq("id", eventId)

      if (error) throw error

      Alert.alert("¡Listo!", "Evento actualizado correctamente", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ])
    } catch (error: any) {
      Alert.alert("Error", error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    Alert.alert(
      "Eliminar evento",
      "¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true)

              const { error } = await supabase.from("events").delete().eq("id", eventId)

              if (error) throw error

              Alert.alert("Eliminado", "El evento ha sido eliminado", [
                {
                  text: "OK",
                  onPress: () => navigation.navigate("VenueEvents", { venueName, city }),
                },
              ])
            } catch (error: any) {
              Alert.alert("Error", error.message)
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  async function pickImage(): Promise<string | null> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar una imagen.')
      return null
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4,3],
      quality: 0.85,
    })
    if (result.canceled) return null
    const asset = result.assets?.[0]
    return asset?.uri || null
  }

  if (loadingData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando evento...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.section}>
        <Text style={styles.label}>Título del evento *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Noche de Rock"
          placeholderTextColor={theme.colors.muted}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Fecha *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.muted}
          value={dateStr}
          onChangeText={setDateStr}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Hora inicio *</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM"
            placeholderTextColor={theme.colors.muted}
            value={timeStr}
            onChangeText={setTimeStr}
          />
        </View>

        <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Hora fin (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM"
            placeholderTextColor={theme.colors.muted}
            value={endTimeStr}
            onChangeText={setEndTimeStr}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Nombre del local *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Sala Apollo"
          placeholderTextColor={theme.colors.muted}
          value={venueName}
          onChangeText={setVenueName}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Ciudad *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Madrid"
          placeholderTextColor={theme.colors.muted}
          value={city}
          onChangeText={setCity}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Descripción (opcional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe el evento..."
          placeholderTextColor={theme.colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Imagen del evento */}
      <View style={styles.section}>
        <Text style={styles.label}>Imagen del evento</Text>
        {imageUrl && !localImageUri && (
          <View style={styles.imageWrap}>
            <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
            <TouchableOpacity
              style={styles.imageButton}
              onPress={async () => {
                const picked = await pickImage()
                if (picked) setLocalImageUri(picked)
              }}
            >
              <Ionicons name="images" size={18} color={theme.colors.text} />
              <Text style={styles.imageButtonText}>Cambiar imagen</Text>
            </TouchableOpacity>
          </View>
        )}
        {localImageUri && (
          <View style={styles.imageWrap}>
            <Image source={{ uri: localImageUri }} style={styles.imagePreview} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={[styles.imageButton, { flex: 1 }]}
                onPress={() => setLocalImageUri(null)}
              >
                <Ionicons name="trash" size={18} color={theme.colors.text} />
                <Text style={styles.imageButtonText}>Quitar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageButton, { flex: 1 }]}
                onPress={async () => {
                  const picked = await pickImage()
                  if (picked) setLocalImageUri(picked)
                }}
              >
                <Ionicons name="images" size={18} color={theme.colors.text} />
                <Text style={styles.imageButtonText}>Cambiar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {!imageUrl && !localImageUri && (
          <TouchableOpacity
            style={styles.imageButton}
            onPress={async () => {
              const picked = await pickImage()
              if (picked) setLocalImageUri(picked)
            }}
          >
            <Ionicons name="images" size={18} color={theme.colors.text} />
            <Text style={styles.imageButtonText}>Seleccionar imagen</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.helperText}>
          {uploading ? "Subiendo imagen..." : "Formatos: JPG/JPEG. Se recorta 4:3."}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, (loading || uploading) && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={loading || uploading}
      >
        <Text style={styles.saveButtonText}>
          {loading || uploading ? "Guardando..." : "Guardar cambios"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.deleteButton, (loading || uploading) && styles.buttonDisabled]}
        onPress={handleDelete}
        disabled={loading || uploading}
      >
        <Ionicons name="trash" size={20} color="#FFF" />
        <Text style={styles.deleteButtonText}>Eliminar evento</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    section: {
      marginBottom: 20,
    },
    row: {
      flexDirection: "row",
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 14,
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      marginBottom: 12,
    },
    saveButtonText: {
      color: "#FFF",
      fontSize: 16,
      fontWeight: "600",
    },
    deleteButton: {
      backgroundColor: "#EF4444",
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    deleteButtonText: {
      color: "#FFF",
      fontSize: 16,
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    imageWrap: {
      gap: 12,
      marginBottom: 12,
    },
    imagePreview: {
      width: '100%',
      height: 180,
      borderRadius: 12,
      backgroundColor: theme.colors.border,
    },
    imageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    imageButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    helperText: {
      marginTop: 6,
      fontSize: 12,
      color: theme.colors.muted,
      fontStyle: 'italic',
    },
  })
