"use client"

import { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import * as ImagePicker from "expo-image-picker"
import { decode } from "base64-arraybuffer"

type AttendanceRecord = {
  id: string
  user_id: string
  event_id: string
  attendance_method: "qr_scan" | "external_proof"
  payment_proof_url: string | null
  verified_at: string
  users: {
    full_name: string
    avatar_url: string | null
  }
}

export default function ManageAttendanceScreen({ route, navigation }: any) {
  const { eventId, eventTitle } = route.params
  const { theme } = useTheme()
  const styles = getStyles(theme)

  const [loading, setLoading] = useState(true)
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([])
  const [venueId, setVenueId] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [uploadingProof, setUploadingProof] = useState(false)

  useEffect(() => {
    navigation.setOptions({
      headerTitle: "Gestionar Asistencias",
    })
    loadVenueAndAttendances()
  }, [])

  const loadVenueAndAttendances = async () => {
    try {
      setLoading(true)

      // Obtener venue_id del usuario actual
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: userData } = await supabase
        .from("users")
        .select("venue_id")
        .eq("id", authUser.id)
        .single()

      if (!userData?.venue_id) {
        Alert.alert("Error", "No tienes un local asociado")
        navigation.goBack()
        return
      }

      setVenueId(userData.venue_id)

      // Cargar asistencias del evento
      const { data: attendancesData, error } = await supabase
        .from("external_attendances")
        .select(
          `
          id,
          user_id,
          event_id,
          attendance_method,
          payment_proof_url,
          verified_at,
          users!inner(
            full_name,
            avatar_url
          )
        `
        )
        .eq("event_id", eventId)
        .order("verified_at", { ascending: false })

      if (error) throw error

      setAttendances((attendancesData as any) || [])
    } catch (error: any) {
      console.error("Error loading attendances:", error)
      Alert.alert("Error", error.message)
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async (query: string) => {
    setUserSearch(query)

    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, avatar_url, email")
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .eq("account_type", "user") // Solo usuarios normales, no venues
        .limit(10)

      if (error) throw error

      setSearchResults(data || [])
    } catch (error: any) {
      console.error("Error searching users:", error)
    }
  }

  const selectUser = (user: any) => {
    setSelectedUser(user)
    setUserSearch(user.full_name)
    setSearchResults([])
  }

  const handleUploadProof = async () => {
    if (!selectedUser) {
      Alert.alert("Error", "Debes seleccionar un usuario primero")
      return
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permissionResult.granted) {
        Alert.alert("Permiso requerido", "Necesitas dar permiso para acceder a la galería")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      })

      if (result.canceled || !result.assets[0]) return

      setUploadingProof(true)

      const asset = result.assets[0]
      const fileUri = asset.uri
      const fileExt = fileUri.split(".").pop()
      const fileName = `${venueId}/${eventId}/${selectedUser.id}_${Date.now()}.${fileExt}`

      // Convertir a base64
      const response = await fetch(fileUri)
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      // Subir a Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("attendance-proofs")
        .upload(fileName, decode(base64), {
          contentType: `image/${fileExt}`,
        })

      if (uploadError) throw uploadError

      // Obtener URL pública
      const {
        data: { publicUrl },
      } = supabase.storage.from("attendance-proofs").getPublicUrl(fileName)

      // Registrar asistencia en la BD
      const { error: insertError } = await supabase.from("external_attendances").insert({
        event_id: eventId,
        user_id: selectedUser.id,
        venue_id: venueId,
        attendance_method: "external_proof",
        payment_proof_url: publicUrl,
        verified_at: new Date().toISOString(),
      })

      if (insertError) throw insertError

      Alert.alert("¡Éxito!", "Asistencia registrada correctamente")
      setSelectedUser(null)
      setUserSearch("")
      loadVenueAndAttendances()
    } catch (error: any) {
      console.error("Error uploading proof:", error)
      Alert.alert("Error", error.message || "No se pudo subir el comprobante")
    } finally {
      setUploadingProof(false)
    }
  }

  const handleScanQR = async () => {
    Alert.alert(
      "Escanear QR",
      "La función de escaneo QR se implementará próximamente con expo-camera",
      [{ text: "OK" }]
    )
  }

  const handleDeleteAttendance = async (attendanceId: string) => {
    Alert.alert(
      "Eliminar asistencia",
      "¿Estás seguro de que quieres eliminar este registro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("external_attendances")
                .delete()
                .eq("id", attendanceId)

              if (error) throw error

              Alert.alert("Eliminado", "Registro eliminado correctamente")
              loadVenueAndAttendances()
            } catch (error: any) {
              Alert.alert("Error", error.message)
            }
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header del evento */}
      <View style={styles.eventHeader}>
        <Ionicons name="calendar" size={24} color={theme.colors.primary} />
        <Text style={styles.eventTitle}>{eventTitle}</Text>
      </View>

      {/* Estadísticas */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{attendances.length}</Text>
          <Text style={styles.statLabel}>Asistencias registradas</Text>
        </View>
      </View>

      {/* Sección: Agregar nueva asistencia */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Registrar nueva asistencia</Text>

        {/* Búsqueda de usuario */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar usuario por nombre o email..."
            placeholderTextColor={theme.colors.muted}
            value={userSearch}
            onChangeText={searchUsers}
          />
          {userSearch.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setUserSearch("")
                setSearchResults([])
                setSelectedUser(null)
              }}
            >
              <Ionicons name="close-circle" size={20} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Resultados de búsqueda */}
        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.searchResultItem}
                onPress={() => selectUser(user)}
              >
                <Image
                  source={{ uri: user.avatar_url || "https://via.placeholder.com/40" }}
                  style={styles.searchResultAvatar}
                />
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultName}>{user.full_name}</Text>
                  <Text style={styles.searchResultEmail}>{user.email}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Usuario seleccionado */}
        {selectedUser && (
          <View style={styles.selectedUserCard}>
            <Image
              source={{ uri: selectedUser.avatar_url || "https://via.placeholder.com/50" }}
              style={styles.selectedUserAvatar}
            />
            <View style={styles.selectedUserInfo}>
              <Text style={styles.selectedUserName}>{selectedUser.full_name}</Text>
              <Text style={styles.selectedUserEmail}>{selectedUser.email}</Text>
            </View>
          </View>
        )}

        {/* Botones de acción */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.scanButton]}
            onPress={handleScanQR}
            disabled={!selectedUser}
          >
            <Ionicons name="qr-code" size={24} color="#FFF" />
            <Text style={styles.actionButtonText}>Escanear QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.uploadButton, uploadingProof && styles.buttonDisabled]}
            onPress={handleUploadProof}
            disabled={uploadingProof || !selectedUser}
          >
            {uploadingProof ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="image" size={24} color="#FFF" />
                <Text style={styles.actionButtonText}>Subir comprobante</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de asistencias registradas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Asistencias registradas ({attendances.length})</Text>

        {attendances.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={theme.colors.muted} />
            <Text style={styles.emptyStateText}>No hay asistencias registradas aún</Text>
          </View>
        ) : (
          attendances.map((attendance) => (
            <View key={attendance.id} style={styles.attendanceCard}>
              <Image
                source={{
                  uri: attendance.users.avatar_url || "https://via.placeholder.com/50",
                }}
                style={styles.attendanceAvatar}
              />
              <View style={styles.attendanceInfo}>
                <Text style={styles.attendanceName}>{attendance.users.full_name}</Text>
                <View style={styles.attendanceMeta}>
                  <Ionicons
                    name={attendance.attendance_method === "qr_scan" ? "qr-code" : "image"}
                    size={14}
                    color={theme.colors.muted}
                  />
                  <Text style={styles.attendanceMethod}>
                    {attendance.attendance_method === "qr_scan" ? "QR escaneado" : "Comprobante"}
                  </Text>
                </View>
                <Text style={styles.attendanceDate}>
                  {new Date(attendance.verified_at).toLocaleString("es-ES", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </Text>
              </View>

              {attendance.payment_proof_url && (
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert("Comprobante", "URL: " + attendance.payment_proof_url, [
                      { text: "OK" },
                    ])
                  }
                >
                  <Ionicons name="eye" size={24} color={theme.colors.primary} />
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => handleDeleteAttendance(attendance.id)}>
                <Ionicons name="trash" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
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
    eventHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 20,
    },
    eventTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      flex: 1,
    },
    statsCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statItem: {
      alignItems: "center",
    },
    statNumber: {
      fontSize: 32,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    statLabel: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: 4,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 12,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 8,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    searchResults: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 12,
      maxHeight: 200,
    },
    searchResultItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    searchResultAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    searchResultInfo: {
      flex: 1,
    },
    searchResultName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    searchResultEmail: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: 2,
    },
    selectedUserCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      marginBottom: 16,
    },
    selectedUserAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginRight: 12,
    },
    selectedUserInfo: {
      flex: 1,
    },
    selectedUserName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    selectedUserEmail: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: 2,
    },
    actionButtons: {
      flexDirection: "row",
      gap: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
    },
    scanButton: {
      backgroundColor: theme.colors.primary,
    },
    uploadButton: {
      backgroundColor: "#10B981",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    actionButtonText: {
      color: "#FFF",
      fontSize: 16,
      fontWeight: "600",
    },
    attendanceCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    attendanceAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginRight: 12,
    },
    attendanceInfo: {
      flex: 1,
    },
    attendanceName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    attendanceMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    attendanceMethod: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    attendanceDate: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    emptyState: {
      alignItems: "center",
      padding: 40,
    },
    emptyStateText: {
      fontSize: 16,
      color: theme.colors.muted,
      marginTop: 12,
      textAlign: "center",
    },
  })
