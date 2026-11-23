"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Image } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { supabase } from "../lib/supabase"
import * as ImagePicker from "expo-image-picker"

export default function EditVenueProfileScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState({
    venueName: "",
    businessAddress: "",
    city: "",
    description: "",
    instagramHandle: "",
    website: "",
    venueLogo: "",
  })
  const [logoUri, setLogoUri] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth.user
        if (!user) return
        const { data: userRow } = await supabase.from("users").select("venue_id").eq("id", user.id).single()
        if (userRow?.venue_id) {
          const { data: appRow } = await supabase
            .from("venue_applications")
            .select("venue_name, business_address, city, description, instagram_handle, website, venue_logo")
            .eq("id", userRow.venue_id)
            .single()
          setFields({
            venueName: appRow?.venue_name || "",
            businessAddress: appRow?.business_address || "",
            city: appRow?.city || "",
            description: appRow?.description || "",
            instagramHandle: appRow?.instagram_handle || "",
            website: appRow?.website || "",
            venueLogo: appRow?.venue_logo || "",
          })
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

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
      // Usar la misma estructura que EditProfileScreen: venue_{userId}_{timestamp}
      const filePath = `venue_${userId}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          upsert: true,
        })
      if (uploadError) {
        console.error("Error subiendo logo:", uploadError)
        throw uploadError
      }
      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath)
      console.log("✅ Logo subido exitosamente:", publicData.publicUrl)
      return publicData.publicUrl
    } catch (e: any) {
      console.error("Error en uploadLogo:", e)
      Alert.alert("Error", e?.message || "No se pudo subir el logo")
      return null
    } finally {
      setLogoUploading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) return
      const { data: userRow } = await supabase.from("users").select("venue_id").eq("id", user.id).single()
      if (!userRow?.venue_id) return
      
      let logoUrl: string = fields.venueLogo || ""
      if (logoUri) {
        const uploaded = await uploadLogo(user.id)
        if (uploaded) logoUrl = uploaded
      }
      
      const newVenueName = fields.venueName.trim()
      const newCity = fields.city.trim()
      
      // Actualizar el perfil del venue
      const { error } = await supabase
        .from("venue_applications")
        .update({
          venue_name: newVenueName,
          business_address: fields.businessAddress.trim(),
          city: newCity,
          description: fields.description.trim() || null,
          instagram_handle: fields.instagramHandle.trim() || null,
          website: fields.website.trim() || null,
          venue_logo: logoUrl,
        })
        .eq("id", userRow.venue_id)
      
      if (error) throw error
      
      // ✅ YA NO ES NECESARIO actualizar eventos porque usamos venue_id (inmutable)
      // Los eventos siguen vinculados correctamente aunque cambie el nombre o ciudad
      console.log("✅ Perfil actualizado. Eventos siguen vinculados por venue_id")
      
      Alert.alert("Guardado", "Perfil actualizado", [{ text: "OK", onPress: () => navigation.goBack() }])
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo guardar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Título eliminado para evitar repetición con el header de navegación */}
      <View style={styles.group}>
        <Text style={styles.label}>Nombre del local</Text>
        <TextInput
          style={styles.input}
          value={fields.venueName}
          onChangeText={(text) => setFields({ ...fields, venueName: text })}
        />
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>Dirección</Text>
        <TextInput
          style={styles.input}
          value={fields.businessAddress}
          onChangeText={(text) => setFields({ ...fields, businessAddress: text })}
        />
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>Ciudad</Text>
        <TextInput
          style={styles.input}
          value={fields.city}
          onChangeText={(text) => setFields({ ...fields, city: text })}
        />
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={fields.description}
          onChangeText={(text) => setFields({ ...fields, description: text })}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>Instagram</Text>
        <TextInput
          style={styles.input}
          value={fields.instagramHandle}
          onChangeText={(text) => setFields({ ...fields, instagramHandle: text })}
        />
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>Web</Text>
        <TextInput
          style={styles.input}
          value={fields.website}
          onChangeText={(text) => setFields({ ...fields, website: text })}
        />
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>Icono / logo</Text>
        <TouchableOpacity style={styles.logoPicker} onPress={pickLogo} disabled={logoUploading} activeOpacity={0.8}>
          {logoUri ? (
            <View style={styles.logoPreview}><Ionicons name="image" size={24} color={theme.colors.primary} /><Text style={styles.logoText}>Logo seleccionado</Text></View>
          ) : fields.venueLogo ? (
            <Image source={{ uri: fields.venueLogo }} style={styles.logoImg} />
          ) : (
            <View style={styles.logoPreview}><Ionicons name="add" size={24} color={theme.colors.muted} /><Text style={styles.logoText}>Seleccionar imagen</Text></View>
          )}
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.save, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
        <Ionicons name="save" size={18} color="#FFFFFF" />
        <Text style={styles.saveText}>{loading ? "Guardando..." : "Guardar cambios"}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: 20 },
  // title eliminado (se usaba un H1 redundante con el header del stack)
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
    textarea: { minHeight: 100, paddingTop: 12 },
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
    logoText: { fontSize: 15, color: theme.colors.text },
    logoImg: { width: 60, height: 60, borderRadius: 30 },
    save: {
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
    saveText: { color: "#FFFFFF", fontWeight: "800" },
  })
}
