import { useEffect, useState, useCallback } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { useFocusEffect } from "@react-navigation/native"

type TabType = "upcoming" | "past"

export default function VenueProfileScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  
  const [loading, setLoading] = useState(false)
  const [venueName, setVenueName] = useState<string>("")
  const [venueCity, setVenueCity] = useState<string>("")
  const [venueLogo, setVenueLogo] = useState<string>("")
  const [venueDescription, setVenueDescription] = useState<string>("")
  const [followerCount, setFollowerCount] = useState(0)
  const [activeTab, setActiveTab] = useState<TabType>("upcoming")
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [pastEvents, setPastEvents] = useState<any[]>([])
  const [menuVisible, setMenuVisible] = useState(false)

  const handleLogout = async () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro de que quieres cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut()
        },
      },
    ])
  }

  const load = useCallback(async () => {
      setLoading(true)
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth.user
        if (!user) return

        console.log("🔍 VenueProfileScreen - User ID:", user.id)

        // Obtener datos del local directamente desde venue_applications usando user_id
        const { data: appRow, error: appError } = await supabase
          .from("venue_applications")
          .select("*")
          .eq("user_id", user.id)
          .single()
        
        console.log("🔍 VenueProfileScreen - Venue data:", appRow)
        console.log("🔍 VenueProfileScreen - Venue error:", appError)
        
        if (appRow) {
          setVenueName(appRow.venue_name || "")
          setVenueCity(appRow.city || "")
          setVenueLogo(appRow.venue_logo || "")
          setVenueDescription(appRow.description || "")

          // Contar seguidores usando RPC con SECURITY DEFINER (evita bloqueos por RLS)
          const { data: followerCountData, error: followerCountError } = await supabase
            .rpc("get_venue_follower_count", { p_venue_id: appRow.id })

          if (followerCountError) {
            console.warn("⚠️ Follower count RPC error:", followerCountError)
            // Fallback: intento de count local respetando RLS
            const { count } = await supabase
              .from("venue_followers")
              .select("*", { count: "exact", head: true })
              .eq("venue_id", appRow.id)
            setFollowerCount(count || 0)
          } else {
            setFollowerCount(followerCountData || 0)
          }

          // Cargar eventos próximos usando venue_id 🔑
          const today = new Date().toISOString().split('T')[0]
          const { data: upcoming } = await supabase
            .from("events")
            .select("*")
            .eq("venue_id", appRow.id)
            .gte("event_date", today)
            .order("event_date", { ascending: true })
            .limit(20)
          
          console.log("✅ VenueProfileScreen - Upcoming events:", upcoming?.length || 0)
          setUpcomingEvents(upcoming || [])

                    // Cargar eventos pasados usando venue_id 🔑
          const { data: past } = await supabase
            .from("events")
            .select("*")
            .eq("venue_id", appRow.id)
            .lt("event_date", today)
            .order("event_date", { ascending: false })
            .limit(20)
          
          console.log("✅ VenueProfileScreen - Past events:", past?.length || 0)
          setPastEvents(past || [])
        }
      } catch (error) {
        console.error("❌ VenueProfileScreen - Load error:", error)
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    load()
  }, [load])

  useFocusEffect(
    useCallback(() => {
      // Recargar al volver a esta pantalla
      load()
    }, [load])
  )

  const renderEventCard = ({ item }: any) => {
    const eventDate = new Date(item.event_date)
    const isPast = eventDate < new Date()
    
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
        activeOpacity={0.8}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.eventImage} />
        ) : (
          <View style={[styles.eventImage, styles.eventImagePlaceholder]}>
            <Ionicons name="calendar" size={40} color={theme.colors.muted} />
          </View>
        )}
        <View style={styles.eventCardContent}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.eventMeta}>
            <Ionicons name="calendar-outline" size={14} color={theme.colors.muted} />
            <Text style={styles.eventMetaText}>
              {eventDate.toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
          </View>
          {item.attendee_count > 0 && (
            <View style={styles.eventMeta}>
              <Ionicons name="people-outline" size={14} color={theme.colors.muted} />
              <Text style={styles.eventMetaText}>
                {item.attendee_count} {item.attendee_count === 1 ? "asistente" : "asistentes"}
              </Text>
            </View>
          )}
          {isPast && (
            <View style={styles.pastBadge}>
              <Text style={styles.pastBadgeText}>Finalizado</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const displayedEvents = activeTab === "upcoming" ? upcomingEvents : pastEvents

  return (
    <View style={styles.container}>
      {/* Header superior como en ProfileScreen */}
      <View style={styles.topHeader}>
        <Text style={styles.topHeaderTitle}>{venueName || "Mi local"}</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.topHeaderMenuButton}>
          <Ionicons name="menu" size={28} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView 
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.header}>
          <View style={styles.topRow}>
            {venueLogo ? (
              <View style={styles.logoWrapper}>
                <Image source={{ uri: venueLogo }} style={styles.logoImage} />
              </View>
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business" size={40} color={theme.colors.primary} />
              </View>
            )}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{upcomingEvents.length}</Text>
                <Text style={styles.statLabel}>Eventos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{followerCount}</Text>
                <Text style={styles.statLabel}>Seguidores</Text>
              </View>
            </View>
          </View>
          <Text style={styles.venueName}>{venueName || "Cargando..."}</Text>
          {venueCity && (
            <View style={styles.detailsRow}>
              <View style={styles.detail}>
                <Ionicons name="location" size={14} color={theme.colors.muted} />
                <Text style={styles.detailText}>{venueCity}</Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate("EditVenueProfile")}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={18} color={theme.colors.text} />
            <Text style={styles.editButtonText}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "upcoming" && styles.tabActive]}
            onPress={() => setActiveTab("upcoming")}
          >
            <Ionicons name="calendar" size={20} color={activeTab === "upcoming" ? theme.colors.text : theme.colors.muted} />
            <Text style={[styles.tabText, activeTab === "upcoming" && styles.tabTextActive]}>Próximos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "past" && styles.tabActive]}
            onPress={() => setActiveTab("past")}
          >
            <Ionicons name="time" size={20} color={activeTab === "past" ? theme.colors.text : theme.colors.muted} />
            <Text style={[styles.tabText, activeTab === "past" && styles.tabTextActive]}>Pasados</Text>
          </TouchableOpacity>
        </View>

        {displayedEvents.length > 0 ? (
          <View style={styles.eventsGrid}>
            {displayedEvents.map((event) => (
              <View key={event.id} style={styles.eventCardWrapper}>
                {renderEventCard({ item: event })}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name={activeTab === "upcoming" ? "calendar-outline" : "time-outline"} size={60} color={theme.colors.muted} />
            <Text style={styles.emptyStateTitle}>{activeTab === "upcoming" ? "No hay eventos próximos" : "No hay eventos pasados"}</Text>
            <Text style={styles.emptyStateText}>
              {activeTab === "upcoming" ? "Crea tu primer evento para que tus seguidores lo descubran" : "Los eventos pasados aparecerán aquí"}
            </Text>
          </View>
        )}
      </ScrollView>

      {activeTab === "upcoming" && (
        <View style={styles.createEventContainerFixed}>
          <TouchableOpacity style={styles.createEventButton} onPress={() => navigation.navigate("CreateEvent")} activeOpacity={0.85}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
      <Modal visible={menuVisible} animationType="slide" transparent onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Menú</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.menuContent}
              contentContainerStyle={styles.menuContentContainer}
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate("EditVenueProfile") }}>
                <Ionicons name="create-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Editar Perfil</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate("SubscriptionPlans") }}>
                <Ionicons name="business-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Plan Pro del local</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate("Notifications") }}>
                <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Notificaciones</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate("Appearance") }}>
                <Ionicons name="color-palette-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Apariencia</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate("PrivacidadSeguridad") }}>
                <Ionicons name="lock-closed-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Privacidad y Seguridad</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate("FAQ") }}>
                <Ionicons name="help-circle-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Ayuda y FAQ</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate("ContactoSoporte") }}>
                <Ionicons name="mail-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Contacto / Soporte</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate("AcercaDeFomo") }}>
                <Ionicons name="information-circle-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Acerca de FOMO</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate("TerminosPrivacidad") }}>
                <Ionicons name="document-text-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Términos y Privacidad</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
                <Text style={[styles.menuItemText, { color: "#FF3B30" }]}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    topHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
    },
    topHeaderTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    topHeaderMenuButton: {
      padding: 4,
    },
    content: {
      paddingBottom: 120,
    },
    header: {
      padding: 20,
      paddingTop: 20,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      gap: 20,
    },
    // Logo simple SIN redondel morado
    logoWrapper: {
      width: 80,
      height: 80,
      borderRadius: 40,
      overflow: "hidden",
      backgroundColor: theme.colors.card,
    },
    logoImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    logoPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    statsRow: {
      flexDirection: "row",
      flex: 1,
      justifyContent: "space-around",
      gap: 20,
    },
    statItem: {
      alignItems: "center",
    },
    statNumber: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 13,
      color: theme.colors.muted,
      marginTop: 2,
    },
    venueName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 8,
    },
    // Estilos de ubicación copiados de ProfileScreen
    detailsRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    detail: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    detailText: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    editButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      paddingVertical: 10,
      marginTop: 12,
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    tabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 14,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      borderBottomColor: theme.colors.text,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.muted,
    },
    tabTextActive: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    createEventContainerFixed: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 24,
      alignItems: "center",
      zIndex: 10,
    },
    createEventButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      ...theme.shadow,
    },
    eventsGrid: {
      paddingVertical: 8,
    },
    eventCardWrapper: {
      marginBottom: 16,
      marginHorizontal: 16,
    },
    eventCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      overflow: "hidden",
      // Borde gris claro solicitado (sustituye sombra que no se veía)
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    eventImage: {
      width: "100%",
      height: 180,
      backgroundColor: theme.colors.border,
    },
    eventImagePlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    eventCardContent: {
      padding: 14,
    },
    eventTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 8,
    },
    eventMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },
    eventMetaText: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    pastBadge: {
      alignSelf: "flex-start",
      backgroundColor: theme.colors.muted + "20",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginTop: 8,
    },
    pastBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
    // Estilos del menú (comparten look con ProfileScreen)
    menuOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    menuContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "80%",
    },
    menuHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    menuTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    menuContent: {
      padding: 20,
    },
    menuContentContainer: {
      paddingBottom: 36,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
    },
    menuItemText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    menuDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 8,
    },
  })
}
