"use client"

import { useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native"
import { supabase } from "../lib/supabase"
import type { User } from "../types/database.types"
import { format } from "date-fns"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import type { RealtimeChannel } from "@supabase/supabase-js"

// Tipos para el sistema de avisos (anuncios del organizador)
type Announcement = {
  id: string
  event_id: string
  organizer_id: string
  content: string
  created_at: string
  updated_at: string
  is_pinned: boolean
  users: User
}

export default function ChatScreen({ route, navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const { eventId, eventTitle } = route.params

  // Estados
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [announcementLimit, setAnnouncementLimit] = useState<number | null>(null)
  const [announcementCount, setAnnouncementCount] = useState(0)
  const [event, setEvent] = useState<any>(null)

  const pollingIntervalRef = useRef<any>(null)

  // Obtener datos del evento para saber si está finalizado
  useEffect(() => {
    const fetchEvent = async () => {
      const { data } = await supabase.from("events").select("*").eq("id", eventId).single()
      setEvent(data)
    }
    fetchEvent()
  }, [eventId])

  const isPast = event && new Date(event.event_date) < new Date()
  
  // Título del header como "Avisos"
  useEffect(() => {
    navigation.setOptions({ headerTitle: "Avisos" })
  }, [navigation])

  useEffect(() => {
    let announcementsChannel: RealtimeChannel | null = null

    const loadAnnouncements = async () => {
      const { data } = await supabase
        .from("event_announcements")
        .select("*, users(*)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true })

      if (data) {
        setAnnouncements(data)
        setAnnouncementCount(data.length)
      }
    }

    const checkPermissions = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      // Verificar si el usuario es organizador del evento
      const { data: eventRow } = await supabase
        .from("events")
        .select("venue_id")
        .eq("id", eventId)
        .single()

      if (eventRow) {
        const { data: userData } = await supabase
          .from("users")
          .select("venue_id")
          .eq("id", user.id)
          .single()

        const isOrg = !!(userData?.venue_id && userData.venue_id === eventRow.venue_id)
        setIsOrganizer(isOrg)

        if (isOrg) {
          const { data: planData } = await supabase.rpc("get_effective_venue_plan", {
            p_user_id: user.id,
          })
          if (planData && planData.length > 0) {
            const plan = planData[0].visual_plan
            const limit = plan === "premium" ? null : plan === "pro" ? 6 : 2
            setAnnouncementLimit(limit)
          }
        }
      }
    }

    const init = async () => {
      await checkPermissions()
      await loadAnnouncements()

      // Polling de respaldo
      pollingIntervalRef.current = setInterval(loadAnnouncements, 5000)

      // Realtime para anuncios
      announcementsChannel = supabase
        .channel(`announcements:${eventId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "event_announcements", filter: `event_id=eq.${eventId}` },
          async () => { await loadAnnouncements() }
        )
        .subscribe()
    }

    init()

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
      if (announcementsChannel) supabase.removeChannel(announcementsChannel)
    }
  }, [eventId])

  const [announcementText, setAnnouncementText] = useState("")
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false)

  const createAnnouncement = async () => {
    if (!isOrganizer || !announcementText.trim()) return

    // Verificar límite
    if (announcementLimit !== null && announcementCount >= announcementLimit) {
      Alert.alert(
        "Límite alcanzado",
        `Has alcanzado el límite de ${announcementLimit} anuncios para este evento. Actualiza tu plan para más anuncios.`
      )
      return
    }

    const content = announcementText.trim()
    setAnnouncementText("")
    setSendingAnnouncement(true)

    try {
      const { error } = await supabase.rpc("post_announcement", {
        p_event_id: eventId,
        p_content: content,
      })
      if (error) throw error
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo publicar el anuncio")
      setAnnouncementText(content)
    } finally {
      setSendingAnnouncement(false)
    }
  }

  const deleteAnnouncement = async (announcementId: string) => {
    Alert.alert("Eliminar anuncio", "¿Estás seguro de que quieres eliminar este anuncio?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.rpc("delete_announcement", {
              p_announcement_id: announcementId,
            })

            if (error) throw error
          } catch (e: any) {
            Alert.alert("Error", e?.message || "No se pudo eliminar el anuncio")
          }
        },
      },
    ])
  }

  const renderAnnouncement = ({ item }: { item: Announcement }) => (
    <View style={styles.announcementCard}>
      <View style={styles.announcementHeader}>
        <View style={styles.announcementBadge}>
          <Ionicons name="megaphone" size={14} color="#fff" />
          <Text style={styles.announcementBadgeText}>ANUNCIO</Text>
        </View>
        {isOrganizer && (
          <TouchableOpacity onPress={() => deleteAnnouncement(item.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.announcementContent}>{item.content}</Text>
      <View style={styles.announcementFooter}>
        <Text style={styles.announcementTime}>
          {format(new Date(item.created_at), "dd/MM/yyyy HH:mm")}
        </Text>
      </View>
    </View>
  )

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Sección de avisos del organizador */}
      <View style={styles.announcementsSection}>
        <View style={styles.announcementsSectionHeader}>
          <Ionicons name="megaphone" size={18} color={theme.colors.primary} />
          <Text style={styles.announcementsSectionTitle}>
            Avisos del organizador {announcements.length > 0 ? `(${announcements.length})` : ""}
          </Text>
        </View>
        {announcements.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.announcementsScroll}
          >
            {announcements.map((announcement) => (
              <View key={announcement.id} style={{ width: 280 }}>
                {renderAnnouncement({ item: announcement })}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="information-circle-outline" size={48} color={theme.colors.muted} />
            <Text style={styles.emptyText}>El organizador aún no ha publicado avisos.</Text>
          </View>
        )}
      </View>

      {/* Barra de creación de avisos (solo organizador) */}
      {isOrganizer && !isPast && (
        <View style={styles.announcementInputSection}>
          <View style={styles.announcementInputHeader}>
            <Ionicons name="megaphone" size={20} color={theme.colors.primary} />
            <Text style={styles.announcementInputTitle}>
              Crear Alerta del Organizador
            </Text>
            {announcementLimit !== null && (
              <Text style={styles.announcementLimitBadge}>
                {announcementCount}/{announcementLimit}
              </Text>
            )}
          </View>
          <View style={styles.announcementInputRow}>
            <TextInput
              style={styles.announcementInput}
              placeholder="Escribe para crear una alerta que vean todos los asistentes"
              placeholderTextColor={theme.colors.placeholder}
              value={announcementText}
              onChangeText={(text) => text.length <= 2000 && setAnnouncementText(text)}
              multiline
              maxLength={2000}
              editable={!sendingAnnouncement}
            />
            <TouchableOpacity
              style={[
                styles.announcementSendButton,
                (!announcementText.trim() || sendingAnnouncement) && styles.announcementSendButtonDisabled,
              ]}
              onPress={createAnnouncement}
              disabled={!announcementText.trim() || sendingAnnouncement}
            >
              <Ionicons
                name={sendingAnnouncement ? "hourglass-outline" : "send"}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.announcementHelperText}>
            {announcementText.length}/2000 caracteres
            {announcementLimit !== null &&
              ` • ${announcementLimit - announcementCount} anuncios disponibles`}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    // Sección de anuncios
    announcementsSection: {
      backgroundColor: theme.colors.card,
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.primary + "20",
      paddingVertical: 12,
    },
    announcementsSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    announcementsSectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    announcementsScroll: {
      paddingHorizontal: 16,
      gap: 12,
    },
    announcementCard: {
      backgroundColor: theme.colors.primary + "10",
      borderRadius: 12,
      padding: 14,
      borderWidth: 2,
      borderColor: theme.colors.primary + "40",
      ...theme.shadow,
      shadowOpacity: 0.15,
    },
    announcementHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    announcementBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    announcementBadgeText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.5,
    },
    announcementContent: {
      fontSize: 15,
      color: theme.colors.text,
      lineHeight: 22,
      marginBottom: 10,
    },
    announcementFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    announcementAuthor: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    announcementTime: {
      fontSize: 11,
      color: theme.colors.muted,
    },
    deleteButton: {
      padding: 4,
    },
    // Barra crear anuncio (organizador) - diseño destacado y jerarquía visual - ABAJO como input
    announcementInputSection: {
      backgroundColor: theme.colors.primary + "08",
      borderTopWidth: 3,
      borderTopColor: theme.colors.primary + "30",
      paddingVertical: 12,
      paddingHorizontal: 16,
      ...theme.shadow,
      shadowOpacity: 0.15,
      elevation: 4,
    },
    announcementInputHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    announcementInputTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.primary,
      flex: 1,
    },
    announcementLimitBadge: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.primary,
      backgroundColor: theme.colors.primary + "20",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    announcementInputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 12,
    },
    announcementInput: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.colors.text,
      maxHeight: 120,
      borderWidth: 2,
      borderColor: theme.colors.primary + "40",
      ...theme.shadow,
      shadowOpacity: 0.1,
    },
    announcementSendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      ...theme.shadow,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.4,
      elevation: 6,
    },
    announcementSendButtonDisabled: {
      backgroundColor: "#d1d5db",
      shadowOpacity: 0.1,
      elevation: 2,
    },
    announcementHelperText: {
      fontSize: 11,
      color: theme.colors.muted,
      marginTop: 6,
      fontStyle: "italic",
    },
    // Empty state / sin avisos
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 18,
      color: theme.colors.muted,
      marginTop: 16,
      fontWeight: "600",
    },
  })
}
