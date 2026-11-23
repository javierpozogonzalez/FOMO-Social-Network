"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList } from "react-native"
import { supabase } from "../lib/supabase"
import type { User, Event, EventAttendee } from "../types/database.types"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function UserProfileScreen({ route, navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const { userId } = route.params
  const [user, setUser] = useState<User | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [pastEvents, setPastEvents] = useState<Event[]>([])
  const [sharedEvents, setSharedEvents] = useState<Event[]>([])
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "shared">("upcoming")
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [mutualFriends, setMutualFriends] = useState<User[]>([])
  const [showMutualsModal, setShowMutualsModal] = useState(false)
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  useEffect(() => {
    loadUserProfile()
  }, [userId])

  const loadUserProfile = async () => {
    setLoading(true)

    // Usuario actual
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()
    setCurrentUserId(currentUser?.id || null)

    // Usuario del perfil
    const { data: userData } = await supabase.from("users").select("*").eq("id", userId).single()
    setUser(userData)

    // Cargar amigos en común si hay usuario actual
    if (currentUser) {
      const { data: mutuals } = await supabase.rpc("get_mutual_friends", {
        user_a: currentUser.id,
        user_b: userId,
        limit_param: 25,
      })
      setMutualFriends(mutuals || [])
    }

    const today = new Date().toISOString().split("T")[0]

    // Eventos futuros a los que se ha apuntado
    const { data: upcomingAttendees } = await supabase
      .from("event_attendees")
      .select("*, events(*)")
      .eq("user_id", userId)
      .eq("status", "going")
      .gte("events.event_date", today)

    const upcoming = (upcomingAttendees || []).map((a: any) => a.events).filter(Boolean)
    setUpcomingEvents(upcoming)

    // Eventos pasados a los que asistió
    const { data: pastAttendees } = await supabase
      .from("event_attendees")
      .select("*, events(*)")
      .eq("user_id", userId)
      .eq("status", "going")
      .lt("events.event_date", today)

    const past = (pastAttendees || []).map((a: any) => a.events).filter(Boolean)
    setPastEvents(past)

    // Eventos compartidos (donde ambos están apuntados)
    if (currentUser) {
      const { data: myAttendees } = await supabase
        .from("event_attendees")
        .select("event_id")
        .eq("user_id", currentUser.id)
        .eq("status", "going")

      const myEventIds = (myAttendees || []).map((a) => a.event_id)

      if (myEventIds.length > 0) {
        const { data: sharedAttendees } = await supabase
          .from("event_attendees")
          .select("*, events(*)")
          .eq("user_id", userId)
          .eq("status", "going")
          .in("event_id", myEventIds)

        const shared = (sharedAttendees || []).map((a: any) => a.events).filter(Boolean)
        setSharedEvents(shared)
      }
    }

    setLoading(false)
  }

  const handleDeleteFriend = () => {
    setShowMenuModal(false)
    Alert.alert(
      "Eliminar amigo",
      `¿Estás seguro que quieres eliminar a ${user?.full_name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aceptar",
          style: "destructive",
          onPress: async () => {
            if (!currentUserId) return
            // Eliminar amistad en ambas direcciones mediante RPC con SECURITY DEFINER
            const { error } = await supabase.rpc("delete_friendship_bidirectional", {
              user_a: currentUserId,
              user_b: userId,
            })

            if (error) {
              Alert.alert("Error", error.message || "No se pudo eliminar la amistad")
              return
            }

            navigation.goBack()
          },
        },
      ]
    )
  }

  const handleReportUser = () => {
    setShowMenuModal(false)
    setShowReportModal(true)
  }

  const submitReport = async (reason: string) => {
    if (!currentUserId) return

    setShowReportModal(false)

    // Aquí podrías insertar en una tabla de reportes en Supabase
    // Por ahora mostramos confirmación
      // Mapear razones locales a enumeración existente de la tabla reports
      const reasonMap: Record<string,string> = {
        inappropriate_behavior: 'harassment',
        spam_fraud: 'spam',
        offensive_content: 'inappropriate_content',
        impersonation: 'fake_profile',
      }
      const mapped = reasonMap[reason] || 'other'
      try {
        const { error } = await supabase.from('reports').insert({
          reporter_id: currentUserId,
          reported_type: 'user',
          reported_id: userId,
          reason: mapped,
          description: null,
        })
        if (error) throw error
        Alert.alert('Reporte enviado', 'Gracias por tu reporte. Nuestro equipo lo revisará.', [{ text: 'OK' }])
      } catch (e:any) {
        Alert.alert('Error', e?.message || 'No se pudo enviar el reporte')
      }
  }

  if (loading || !user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header superior con botones */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil de Usuario</Text>
        <TouchableOpacity onPress={() => setShowMenuModal(true)} style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView>
      {/* Info del usuario */}
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{user.full_name?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.name}>{user.full_name}</Text>
        {user.city && (
          <View style={styles.infoRow}>
            <Ionicons name="location" size={16} color={theme.colors.muted} />
            <Text style={styles.infoText}>{user.city}</Text>
          </View>
        )}
        {mutualFriends.length > 0 && (
          <TouchableOpacity
            style={styles.mutualBadge}
            onPress={() => setShowMutualsModal(true)}
          >
            <Ionicons name="people" size={14} color={theme.colors.primary} />
            <Text style={styles.mutualText}>
              {mutualFriends.length === 1
                ? `1 amigo en común`
                : `${mutualFriends.length} amigos en común`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Label "Eventos" */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Eventos</Text>
      </View>

      {/* Tabs estilo ProfileScreen */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "upcoming" && styles.activeTab]}
            onPress={() => setActiveTab("upcoming")}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={activeTab === "upcoming" ? theme.colors.primary : theme.colors.muted}
            />
            <Text style={[styles.tabText, activeTab === "upcoming" && styles.activeTabText]}>Próximos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "past" && styles.activeTab]}
            onPress={() => setActiveTab("past")}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={activeTab === "past" ? theme.colors.primary : theme.colors.muted}
            />
            <Text style={[styles.tabText, activeTab === "past" && styles.activeTabText]}>Pasados</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "shared" && styles.activeTab]}
            onPress={() => setActiveTab("shared")}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={activeTab === "shared" ? theme.colors.primary : theme.colors.muted}
            />
            <Text style={[styles.tabText, activeTab === "shared" && styles.activeTabText]}>Compartidos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido del tab activo - Cards estilo HomeScreen */}
      <View style={styles.tabContent}>
        {activeTab === "upcoming" && (
          <>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCardWrapper}
                  onPress={() => navigation.push("EventDetail", { eventId: event.id })}
                  activeOpacity={0.92}
                >
                  <View style={styles.eventCard}>
                    {/* Logo circular del venue */}
                    <View style={styles.venueLogoCircular}>
                      {event.venue_logo ? (
                        <Image source={{ uri: event.venue_logo }} style={styles.venueLogoImage} />
                      ) : (
                        <View style={styles.venueLogoPlaceholder}>
                          <Ionicons name="business" size={28} color={theme.colors.muted} />
                        </View>
                      )}
                    </View>

                    <View style={styles.eventInfo}>
                      {/* Nombre del venue MUY VISIBLE */}
                      <Text style={styles.venueNameBold} numberOfLines={1}>{event.venue_name}</Text>
                      
                      {/* Fecha y género */}
                      <View style={styles.eventMeta}>
                        <Ionicons name="calendar-outline" size={14} color={theme.colors.muted} />
                        <Text style={styles.eventMetaText}>{format(new Date(event.event_date), "dd MMM", { locale: es })}</Text>
                        {event.music_genre && (
                          <>
                            <View style={styles.metaDivider} />
                            <Ionicons name="musical-note" size={14} color={theme.colors.muted} />
                            <Text style={styles.eventMetaText}>{event.music_genre}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptySection}>
                <Ionicons name="calendar-outline" size={40} color={theme.colors.muted} />
                <Text style={styles.emptyText}>No tiene eventos próximos</Text>
              </View>
            )}
          </>
        )}

        {activeTab === "past" && (
          <>
            {pastEvents.length > 0 ? (
              pastEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCardWrapper}
                  onPress={() => navigation.push("EventDetail", { eventId: event.id })}
                  activeOpacity={0.92}
                >
                  <View style={[styles.eventCard, styles.pastEventCard]}>
                    <View style={styles.venueLogoCircular}>
                      {event.venue_logo ? (
                        <Image source={{ uri: event.venue_logo }} style={styles.venueLogoImage} />
                      ) : (
                        <View style={styles.venueLogoPlaceholder}>
                          <Ionicons name="business" size={28} color={theme.colors.muted} />
                        </View>
                      )}
                    </View>

                    <View style={styles.eventInfo}>
                      <Text style={styles.venueNameBold} numberOfLines={1}>{event.venue_name}</Text>
                      
                      <View style={styles.eventMeta}>
                        <Ionicons name="calendar-outline" size={14} color={theme.colors.muted} />
                        <Text style={styles.eventMetaText}>{format(new Date(event.event_date), "dd MMM", { locale: es })}</Text>
                        {event.music_genre && (
                          <>
                            <View style={styles.metaDivider} />
                            <Ionicons name="musical-note" size={14} color={theme.colors.muted} />
                            <Text style={styles.eventMetaText}>{event.music_genre}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptySection}>
                <Ionicons name="time-outline" size={40} color={theme.colors.muted} />
                <Text style={styles.emptyText}>No ha asistido a eventos pasados</Text>
              </View>
            )}
          </>
        )}

        {activeTab === "shared" && (
          <>
            {sharedEvents.length > 0 ? (
              sharedEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCardWrapper}
                  onPress={() => navigation.push("EventDetail", { eventId: event.id })}
                  activeOpacity={0.92}
                >
                  <View style={styles.eventCard}>
                    <View style={styles.venueLogoCircular}>
                      {event.venue_logo ? (
                        <Image source={{ uri: event.venue_logo }} style={styles.venueLogoImage} />
                      ) : (
                        <View style={styles.venueLogoPlaceholder}>
                          <Ionicons name="business" size={28} color={theme.colors.muted} />
                        </View>
                      )}
                    </View>

                    <View style={styles.eventInfo}>
                      <Text style={styles.venueNameBold} numberOfLines={1}>{event.venue_name}</Text>
                      
                      <View style={styles.eventMeta}>
                        <Ionicons name="calendar-outline" size={14} color={theme.colors.muted} />
                        <Text style={styles.eventMetaText}>{format(new Date(event.event_date), "dd MMM", { locale: es })}</Text>
                        {event.music_genre && (
                          <>
                            <View style={styles.metaDivider} />
                            <Ionicons name="musical-note" size={14} color={theme.colors.muted} />
                            <Text style={styles.eventMetaText}>{event.music_genre}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptySection}>
                <Ionicons name="people-outline" size={40} color={theme.colors.muted} />
                <Text style={styles.emptyText}>No tienen eventos compartidos</Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>

    {/* Modal del menú (tres puntos) */}
    <Modal visible={showMenuModal} transparent animationType="slide" onRequestClose={() => setShowMenuModal(false)}>
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenuModal(false)}>
        <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Opciones</Text>
            <TouchableOpacity onPress={() => setShowMenuModal(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={handleDeleteFriend}>
            <Ionicons name="person-remove-outline" size={24} color={theme.colors.danger} />
            <Text style={[styles.menuItemText, { color: theme.colors.danger }]}>Eliminar amigo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleReportUser}>
            <Ionicons name="flag-outline" size={24} color="#F59E0B" />
            <Text style={[styles.menuItemText, { color: "#F59E0B" }]}>Reportar usuario</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>

    {/* Modal de amigos en común */}
    <Modal visible={showMutualsModal} transparent animationType="fade" onRequestClose={() => setShowMutualsModal(false)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMutualsModal(false)}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Amigos en común ({mutualFriends.length})</Text>
            <TouchableOpacity onPress={() => setShowMutualsModal(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={mutualFriends}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.mutualItem}
                onPress={() => {
                  setShowMutualsModal(false)
                  navigation.push("UserProfile", { userId: item.id })
                }}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.mutualAvatar} />
                ) : (
                  <View style={styles.mutualAvatarPlaceholder}>
                    <Text style={styles.mutualAvatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.mutualName}>{item.full_name}</Text>
                  {item.city && (
                    <View style={styles.locationRow}>
                      <Ionicons name="location" size={12} color={theme.colors.muted} />
                      <Text style={styles.mutualCity}>{item.city}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>

    {/* Modal de reporte */}
    <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
      <TouchableOpacity style={styles.reportOverlay} activeOpacity={1} onPress={() => setShowReportModal(false)}>
        <View style={styles.reportContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.reportHeader}>
            <Ionicons name="flag" size={28} color="#F59E0B" />
            <Text style={styles.reportTitle}>Reportar usuario</Text>
            <Text style={styles.reportSubtitle}>¿Qué problema has encontrado con {user?.full_name}?</Text>
          </View>

          <TouchableOpacity 
            style={styles.reportOption}
            onPress={() => submitReport("inappropriate_behavior")}
          >
            <Ionicons name="warning-outline" size={22} color="#EF4444" />
            <Text style={styles.reportOptionText}>Comportamiento inapropiado</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.reportOption}
            onPress={() => submitReport("spam_fraud")}
          >
            <Ionicons name="mail-outline" size={22} color="#F59E0B" />
            <Text style={styles.reportOptionText}>Spam o fraude</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.reportOption}
            onPress={() => submitReport("offensive_content")}
          >
            <Ionicons name="alert-circle-outline" size={22} color="#EF4444" />
            <Text style={styles.reportOptionText}>Contenido ofensivo</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.reportOption}
            onPress={() => submitReport("impersonation")}
          >
            <Ionicons name="person-outline" size={22} color="#F59E0B" />
            <Text style={styles.reportOptionText}>Suplantación de identidad</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.reportCancelButton}
            onPress={() => setShowReportModal(false)}
          >
            <Text style={styles.reportCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    centered: { justifyContent: "center", alignItems: "center" },
    
    // Header superior con botones
    topHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 50,
      paddingBottom: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      flex: 1,
      textAlign: "center",
    },
    menuButton: {
      padding: 4,
    },

    // Info del usuario centrada
    userInfo: {
      alignItems: "center",
      paddingVertical: 24,
      paddingHorizontal: 20,
      backgroundColor: theme.colors.card,
    },
    avatarContainer: {
      marginBottom: 16,
    },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarPlaceholder: {
      backgroundColor: theme.colors.primarySoft,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    avatarInitial: { color: theme.colors.primary, fontWeight: "700", fontSize: 36 },
    name: { fontSize: 20, fontWeight: "700", color: theme.colors.text, marginBottom: 6 },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
    infoText: { fontSize: 14, color: theme.colors.muted },

    // Badge de amigos en común
    mutualBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginTop: 6,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    mutualText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: "600",
    },

    // Label "Eventos" encima de los tabs
    sectionHeader: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: theme.colors.background,
    },
    sectionLabel: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
    },

    // Tabs estilo ProfileScreen
    tabsWrapper: {
      paddingHorizontal: 16,
      backgroundColor: theme.colors.background,
      marginBottom: 16,
    },
    tabsContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: 4,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
    },
    activeTab: {
      backgroundColor: theme.colors.card,
      ...theme.shadow,
    },
    tabText: {
      fontSize: 13,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    activeTabText: {
      color: theme.colors.primary,
      fontWeight: "700",
    },

    tabContent: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },

    // Cards estilo HomeScreen
    eventCardWrapper: {
      marginBottom: 16,
    },
    eventCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 90,
      ...theme.shadow,
    },
    pastEventCard: {
      opacity: 0.7,
    },
    venueLogoCircular: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: "#FFFFFF",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadow,
    },
    venueLogoImage: {
      width: 70,
      height: 70,
      borderRadius: 35,
    },
    venueLogoPlaceholder: {
      justifyContent: "center",
      alignItems: "center",
    },
    eventInfo: {
      flex: 1,
      justifyContent: "center",
      gap: 6,
    },
    venueNameBold: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    eventMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaDivider: {
      width: 1,
      height: 12,
      backgroundColor: theme.colors.border,
      marginHorizontal: 6,
    },
    eventMetaText: {
      fontSize: 12,
      color: theme.colors.muted,
    },

    emptySection: { alignItems: "center", paddingVertical: 40 },
    emptyText: { color: theme.colors.muted, marginTop: 12, fontSize: 14 },

    // Modal del menú
    menuOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    menuContainer: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
    },
    menuHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    menuTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    menuItemText: {
      fontSize: 16,
      fontWeight: "500",
    },

    // Modal de amigos en común
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      width: "100%",
      maxHeight: "80%",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    mutualItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    mutualAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 12,
    },
    mutualAvatarPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.primarySoft,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    mutualAvatarText: {
      color: theme.colors.primary,
      fontSize: 18,
      fontWeight: "600",
    },
    mutualName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    mutualCity: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },

    // Modal de reporte
    reportOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    reportContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      width: "100%",
      maxWidth: 400,
      overflow: "hidden",
    },
    reportHeader: {
      alignItems: "center",
      padding: 24,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    reportTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text,
      marginTop: 12,
      marginBottom: 8,
    },
    reportSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
    },
    reportOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    reportOptionText: {
      flex: 1,
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text,
    },
    reportCancelButton: {
      padding: 18,
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    reportCancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.primary,
    },
  })
}
