"use client"

import { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import * as ImagePicker from "expo-image-picker"
import { supabase } from "../lib/supabase"
import type { User } from "../types/database.types"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { useFocusEffect } from "@react-navigation/native"

type VenueStat = {
  venue_id?: string // Foreign key to venue_applications
  venue_name: string
  city: string
  category: "frequent" | "favorite" | "recent"
  events_attended: number
  is_following: boolean
  is_favorite: boolean
  next_event_id: string | null
  next_event_name: string | null
  next_event_date: string | null
  friends_following_count: number
  venue_logo: string | null
  upcoming_count?: number
}

type UpcomingEvent = {
  event_id: string
  event_name: string
  event_date: string
  venue_name: string
  friends_going: number
}

type VenueTab = "frequent" | "favorite" | "recent"

export default function ProfileScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [user, setUser] = useState<User | null>(null)
  const [friendCount, setFriendCount] = useState(0)
  const [venuesCount, setVenuesCount] = useState(0)
  const [venues, setVenues] = useState<VenueStat[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [selectedTab, setSelectedTab] = useState<VenueTab>("favorite")
  const [menuVisible, setMenuVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  useEffect(() => {
    loadAllData()
  }, [])

  // Suscripción en tiempo real a cambios en el propio usuario (para reflejar aprobación al instante)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    const subscribe = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) return

      channel = supabase
        .channel("users-self-updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "users",
            filter: `id=eq.${authUser.id}`,
          },
          (payload: any) => {
            try {
              setUser(payload.new as any)
            } catch (e) {
              // noop
            }
          }
        )
        .subscribe()
    }
    subscribe()
    return () => {
      try {
        if (channel) supabase.removeChannel(channel)
      } catch {}
    }
  }, [])

  // Refresco automático al volver a la pantalla
  useFocusEffect(
    useCallback(() => {
      loadAllData()
      return () => {}
    }, [])
  )

  const loadAllData = async () => {
    await Promise.all([loadUserData(), loadFriendCount(), loadVenues(), loadUpcomingEvents()])
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadAllData()
    setRefreshing(false)
  }

  const loadUserData = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (authUser) {
      const { data: userData } = await supabase.from("users").select("*").eq("id", authUser.id).single()
      setUser(userData)
    }
  }

  const loadFriendCount = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) return

    const { data, error } = await supabase.rpc("get_users_friend_counts", {
      user_ids_param: [authUser.id],
    })

    if (!error && data && data.length > 0) {
      setFriendCount(data[0].friend_count || 0)
    }
  }

  const loadVenues = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) return

    console.log("🏢 [ProfileScreen] Cargando venues...")

    // Cargar venues directamente desde eventos donde el usuario ha asistido
    const { data: attendances, error } = await supabase
      .from("event_attendees")
      .select(
        `
        event_id,
        events!inner (
          venue_name,
          city,
          event_date,
          venue_logo
        )
      `
      )
      .eq("user_id", authUser.id)
      .eq("status", "going")

    console.log("🏢 Query error:", error)
    console.log("🏢 Attendances data:", JSON.stringify(attendances, null, 2))

    if (!error && attendances) {
      // Agrupar por venue y contar eventos
      const venueMap = new Map<string, VenueStat>()

      attendances.forEach((att: any) => {
        const venue = att.events
        if (!venue) return

        const key = `${venue.venue_name}-${venue.city}`
        const eventDate = new Date(venue.event_date)
        const now = new Date()
        const daysDiff = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24))

        if (venueMap.has(key)) {
          const existing = venueMap.get(key)!
          existing.events_attended += 1
        } else {
          // Determinar categoría
          let category: "frequent" | "favorite" | "recent" = "recent"
          if (daysDiff <= 30) {
            category = "recent"
          }

          venueMap.set(key, {
            venue_name: venue.venue_name,
            city: venue.city,
            category,
            events_attended: 1,
            is_following: false,
            is_favorite: false,
            next_event_id: null,
            next_event_name: null,
            next_event_date: null,
            friends_following_count: 0,
            venue_logo: venue.venue_logo || null,
          })
        }
      })

      // Actualizar categorías basadas en conteo
      const venuesArray = Array.from(venueMap.values())
      venuesArray.forEach((venue) => {
        if (venue.events_attended >= 3) {
          venue.category = "frequent"
        }
      })

      // Cargar venues que el usuario sigue manualmente (incluyendo los que nunca visitó)
      const { data: followedVenues, error: followError, status: followStatus } = await supabase
        .from("venue_followers")
        .select(`
          venue_id,
          is_favorite,
          venue_applications!inner(id, venue_name, city, venue_logo)
        `)
        .eq("user_id", authUser.id)

      console.log("🏢 Followed venues status:", followStatus)
      console.log("🏢 Followed venues query error:", followError)
      console.log("🏢 Followed venues raw:", JSON.stringify(followedVenues, null, 2))

      let effectiveFollowed = followedVenues || []

      // Fallback si join inner devuelve vacío (posible RLS o no aprobado) intentar sin join
      if (!followError && effectiveFollowed.length === 0) {
        const { data: simpleFollows, error: simpleError } = await supabase
          .from("venue_followers")
          .select("venue_id, is_favorite")
          .eq("user_id", authUser.id)
        console.log("🏢 Simple follows fallback error:", simpleError)
        console.log("🏢 Simple follows fallback data:", simpleFollows)
        if (!simpleError && simpleFollows?.length) {
          // Recuperar datos de venues aprobados
          const venueIds = simpleFollows.map(v => v.venue_id)
          const { data: venuesData, error: venuesError } = await supabase
            .from("venue_applications")
            .select("id, venue_name, city, venue_logo, status")
            .in("id", venueIds)
          console.log("🏢 Venues data error:", venuesError)
          console.log("🏢 Venues data:", venuesData)
          if (!venuesError && venuesData) {
            effectiveFollowed = simpleFollows.map(f => {
              const match = venuesData.find(v => v.id === f.venue_id)
              return match ? {
                venue_id: f.venue_id,
                is_favorite: f.is_favorite,
                venue_applications: match
              } : null
            }).filter(Boolean) as any[]
            console.log("🏢 Effective followed after fallback:", effectiveFollowed)
          }
        }
      }

      if (effectiveFollowed) {
        effectiveFollowed.forEach((fv: any) => {
          const venueApp = fv.venue_applications
          if (!venueApp) return
          
          const key = `${venueApp.venue_name}-${venueApp.city}`
          if (venueMap.has(key)) {
            // Venue ya existe (ha asistido a eventos aquí)
            const existing = venueMap.get(key)!
            existing.is_following = true
            existing.venue_id = fv.venue_id
            if (fv.is_favorite) {
              existing.is_favorite = true
              existing.category = "favorite"
            }
          } else {
            // Venue seguido pero nunca visitado - agregarlo como "recent" con estrella
            venueMap.set(key, {
              venue_id: fv.venue_id,
              venue_name: venueApp.venue_name,
              city: venueApp.city,
              category: fv.is_favorite ? "favorite" : "recent",
              events_attended: 0,
              is_following: true,
              is_favorite: fv.is_favorite,
              next_event_id: null,
              next_event_name: null,
              next_event_date: null,
              friends_following_count: 0,
              venue_logo: venueApp.venue_logo || null,
              upcoming_count: 0,
            })
          }
        })
      }

      // Completar logos faltantes y contar eventos futuros por venue
      const todayStr = new Date().toISOString().split("T")[0]
      const venueNames = Array.from(new Set(Array.from(venueMap.values()).map((v) => v.venue_name)))
      const { data: logoRows } = await supabase
        .from("events")
        .select("venue_name, city, venue_logo, event_date")
        .in("venue_name", venueNames)
        .gte("event_date", todayStr)

      if (logoRows) {
        const upcomingCounter = new Map<string, number>()
        logoRows.forEach((row: any) => {
          const key = `${row.venue_name}-${row.city}`
          // Contador de próximos eventos
          upcomingCounter.set(key, (upcomingCounter.get(key) || 0) + 1)
          // Asignar logo si no existe aún
          const v = venueMap.get(key)
          if (v && !v.venue_logo && row.venue_logo) {
            v.venue_logo = row.venue_logo
          }
        })
        // Volcar contadores
        upcomingCounter.forEach((count, key) => {
          const v = venueMap.get(key)
          if (v) v.upcoming_count = count
        })
      }

      const finalVenues = Array.from(venueMap.values())
      const favCount = finalVenues.filter((v) => v.is_favorite).length
      console.log("🏢 Venues procesados:", finalVenues.length)
      console.log("🏢 Venues favoritos:", favCount)
      setVenues(finalVenues)
      setVenuesCount(favCount)
    } else {
      console.log("🏢 Error o sin datos")
    }
  }

  const loadUpcomingEvents = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) return

    console.log("📅 [ProfileScreen] Cargando eventos futuros...")

    // Query eventos futuros donde el usuario va (comparando solo fechas)
    const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD
    console.log("📅 Hoy es:", today)

    const { data: attendances, error } = await supabase
      .from("event_attendees")
      .select(
        `
        event_id,
        events!inner (
          id,
          title,
          event_date,
          venue_name
        )
      `
      )
      .eq("user_id", authUser.id)
      .eq("status", "going")
      .gte("events.event_date", today)
      .order("event_date", { ascending: true, foreignTable: "events" })
      .limit(10)

    console.log("📅 Query error:", error)
    console.log("📅 Attendances raw:", JSON.stringify(attendances, null, 2))

    if (attendances) {
      const eventsWithFriends = await Promise.all(
        attendances.map(async (att: any) => {
          console.log("📅 Procesando evento:", att.events?.title || att.events?.id)
          
          // Contar amigos que van al mismo evento
          const { data: attendeesData } = await supabase
            .from("event_attendees")
            .select("user_id")
            .eq("event_id", att.event_id)
            .eq("status", "going")
            .neq("user_id", authUser.id)

          if (!attendeesData || attendeesData.length === 0) {
            return {
              event_id: att.events.id,
              event_name: att.events.title,
              event_date: att.events.event_date,
              venue_name: att.events.venue_name,
              friends_going: 0,
            }
          }

          const attendeeIds = attendeesData.map((a) => a.user_id)

          // Contar cuántos de esos asistentes son amigos
          let friendsCount = 0
          for (const attendeeId of attendeeIds) {
            // Verificar si es amigo (bidireccional)
            const { data: friendship } = await supabase
              .from("friendships")
              .select("id")
              .eq("user_id", authUser.id)
              .eq("friend_id", attendeeId)
              .eq("status", "accepted")
              .single()

            if (friendship) {
              // Verificar la otra dirección
              const { data: reverseFriendship } = await supabase
                .from("friendships")
                .select("id")
                .eq("user_id", attendeeId)
                .eq("friend_id", authUser.id)
                .eq("status", "accepted")
                .single()

              if (reverseFriendship) {
                friendsCount++
              }
            }
          }

          return {
            event_id: att.events.id,
            event_name: att.events.title,
            event_date: att.events.event_date,
            venue_name: att.events.venue_name,
            friends_going: friendsCount,
          }
        })
      )

      console.log("📅 Eventos procesados:", eventsWithFriends.length)
      console.log("📅 Eventos:", JSON.stringify(eventsWithFriends, null, 2))
      setUpcomingEvents(eventsWithFriends)
    }
  }

  const pickAndUploadAvatar = async () => {
    try {
      // Solicitar permisos de manera más explícita
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
        // En React Native usamos arrayBuffer en vez de blob para compatibilidad
        const response = await fetch(asset.uri)
        const arrayBuffer = await response.arrayBuffer()
        const fileExt = asset.uri.split(".").pop() || "jpg"
        const filePath = `${user.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, arrayBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          })
        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath)
        const publicUrl = publicData.publicUrl

        const { error: updateError } = await supabase
          .from("users")
          .update({ avatar_url: publicUrl })
          .eq("id", user.id)

        if (updateError) throw updateError

        setUser({ ...user, avatar_url: publicUrl })
        Alert.alert("✓ Listo", "Tu foto de perfil se actualizó correctamente")
        await loadUserData()
      } catch (e: any) {
        console.error("Upload error:", e)
        Alert.alert("Error", e?.message || "No se pudo subir la imagen. Verifica que el bucket 'avatars' exista en Supabase Storage.")
      }
    } catch (error: any) {
      console.error("Permission error:", error)
      Alert.alert("Error", "No se pudieron solicitar los permisos")
    }
  }

  const handleLogout = async () => {
    Alert.alert("Cerrar Sesión", "¿Estás seguro que quieres cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar Sesión",
        style: "destructive",
        onPress: async () => {
          setMenuVisible(false)
          await supabase.auth.signOut()
        },
      },
    ])
  }

  const calculateAge = (birthdate: string | null) => {
    if (!birthdate) return null
    const today = new Date()
    const birth = new Date(birthdate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  // Función para renderizar el calendario
  const renderCalendar = () => {
    const today = new Date()

    // Obtener primer y último día del mes actual seleccionado
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()
    const startDayOfWeek = firstDayOfMonth.getDay() // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    
    // Ajustar para que la semana empiece en Lunes
    // Si es Domingo (0), debe ir al final (posición 6)
    // Si es Lunes (1), debe ir al inicio (posición 0)
    const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1

  // Crear array de días (incluyendo huecos iniciales) y normalizar a semanas completas (7 columnas)
  const days: (number | null)[] = []

    // Días vacíos al inicio
    for (let i = 0; i < adjustedStartDay; i++) {
      days.push(null)
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    // Rellenar huecos al final para completar la última fila a múltiplos de 7
    const totalCells = Math.ceil(days.length / 7) * 7
    while (days.length < totalCells) {
      days.push(null)
    }

    // Crear un mapa de días con eventos (YYYY-MM-DD -> evento)
    const eventsMap: { [key: string]: typeof upcomingEvents[0] } = {}
    upcomingEvents.forEach((event) => {
      const eventDate = event.event_date.split("T")[0] // YYYY-MM-DD
      eventsMap[eventDate] = event
    })

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    const dayNames = ["L", "M", "X", "J", "V", "S", "D"] // Lunes a Domingo

    const goToPreviousMonth = () => {
      if (currentMonth === 0) {
        setCurrentMonth(11)
        setCurrentYear(currentYear - 1)
      } else {
        setCurrentMonth(currentMonth - 1)
      }
    }

    const goToNextMonth = () => {
      if (currentMonth === 11) {
        setCurrentMonth(0)
        setCurrentYear(currentYear + 1)
      } else {
        setCurrentMonth(currentMonth + 1)
      }
    }

    return (
      <View style={styles.calendarContainer}>
        {/* Header con navegación */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.calendarNavButton}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
          </TouchableOpacity>

          <Text style={styles.calendarMonth}>
            {monthNames[currentMonth]} {currentYear}
          </Text>

          <TouchableOpacity onPress={goToNextMonth} style={styles.calendarNavButton}>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Días de la semana */}
        <View style={styles.calendarWeekDays}>
          {dayNames.map((dayName, index) => (
            <Text key={index} style={styles.calendarWeekDay}>
              {dayName}
            </Text>
          ))}
        </View>

        {/* Grid de días en filas de 7 para garantizar alineación exacta con L-M-...-D */}
        <View style={styles.calendarGrid}>
          {Array.from({ length: days.length / 7 }).map((_, weekIndex) => {
            const week = days.slice(weekIndex * 7, weekIndex * 7 + 7)
            return (
              <View key={`week-${weekIndex}`} style={styles.calendarWeekRow}>
                {week.map((day, dayIndex) => {
                  if (day === null) {
                    return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.calendarDay} />
                  }

                  const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  const hasEvent = !!eventsMap[dateStr]
                  const isToday =
                    day === today.getDate() &&
                    currentMonth === today.getMonth() &&
                    currentYear === today.getFullYear()

                  return (
                    <TouchableOpacity
                      key={`day-${weekIndex}-${dayIndex}`}
                      style={[styles.calendarDay, isToday && styles.calendarDayToday]}
                      onPress={() => {
                        if (hasEvent) {
                          Alert.alert(
                            eventsMap[dateStr].event_name,
                            `📍 ${eventsMap[dateStr].venue_name}\n🕐 ${formatEventDate(eventsMap[dateStr].event_date)}\n${
                              eventsMap[dateStr].friends_going > 0
                                ? `👥 ${eventsMap[dateStr].friends_going} amigos van`
                                : ""
                            }`
                          )
                        }
                      }}
                    >
                      <Text style={[styles.calendarDayText, isToday && styles.calendarDayTextToday]}>{day}</Text>
                      {hasEvent && <View style={styles.calendarDot} />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            )
          })}
        </View>
      </View>
    )
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
  }

  const filteredVenues = venues.filter((v) => v.category === selectedTab)

  // Derivar estado de cuenta profesional de forma segura
  const isVenue = (user as any)?.account_type?.startsWith("venue") || false
  const subscriptionStatus: string = (user as any)?.subscription_status ?? "inactive"
  const trialEndsAtStr: string | null = (user as any)?.trial_ends_at ?? null
  const trialEndsAt = trialEndsAtStr ? new Date(trialEndsAtStr) : null
  const now = new Date()
  const trialActive = subscriptionStatus === "trial" && !!trialEndsAt && trialEndsAt > now
  const trialDaysLeft = trialActive
    ? Math.max(0, Math.ceil((trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    )
  }

  const age = calculateAge(user.birth_date || null)

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      {/* Header con menú hamburguesa */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{user.full_name}</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton}>
          <Ionicons name="menu" size={28} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Perfil Instagram Style */}
      <View style={styles.profileSection}>
        <View style={styles.profileRow}>
          {/* Avatar */}
          <TouchableOpacity onPress={pickAndUploadAvatar} activeOpacity={0.8}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{friendCount}</Text>
              <Text style={styles.statLabel}>amigos</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{venuesCount}</Text>
              <Text style={styles.statLabel}>locales</Text>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <Text style={styles.fullName}>{user.full_name}</Text>
          {isVenue && (
            <View style={styles.venueBadgeRow}>
              <View style={styles.venuePill}>
                <Ionicons name="business" size={14} color={theme.colors.primary} />
                <Text style={styles.venuePillText}>Cuenta profesional</Text>
              </View>
              {trialActive && (
                <View style={styles.trialPill}>
                  <Ionicons name="flash" size={14} color="#B45309" />
                  <Text style={styles.trialPillText}>Prueba PRO: {trialDaysLeft} días</Text>
                </View>
              )}
            </View>
          )}
          <View style={styles.detailsRow}>
            {user.city && (
              <View style={styles.detail}>
                <Ionicons name="location" size={14} color={theme.colors.muted} />
                <Text style={styles.detailText}>{user.city}</Text>
              </View>
            )}
            {age && (
              <View style={styles.detail}>
                <Ionicons name="calendar" size={14} color={theme.colors.muted} />
                <Text style={styles.detailText}>{age} años</Text>
              </View>
            )}
          </View>
        </View>

        {/* Botón Editar Perfil */}
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => navigation.navigate("EditProfile")} 
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={18} color={theme.colors.text} />
          <Text style={styles.editButtonText}>Editar perfil</Text>
        </TouchableOpacity>

        {isVenue && (
          <TouchableOpacity
            style={styles.businessButton}
            onPress={() => navigation.navigate("VenueEvents")}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar" size={18} color="#FFFFFF" />
            <Text style={styles.businessButtonText}>Ir al panel del local</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mis Sitios */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mis Sitios</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === "favorite" && styles.tabActive]}
            onPress={() => setSelectedTab("favorite")}
          >
            <Ionicons
              name="star"
              size={16}
              color={selectedTab === "favorite" ? theme.colors.primary : theme.colors.muted}
            />
            <Text style={[styles.tabText, selectedTab === "favorite" && styles.tabTextActive]}>Favoritos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, selectedTab === "frequent" && styles.tabActive]}
            onPress={() => setSelectedTab("frequent")}
          >
            <Ionicons
              name="flame"
              size={16}
              color={selectedTab === "frequent" ? theme.colors.primary : theme.colors.muted}
            />
            <Text style={[styles.tabText, selectedTab === "frequent" && styles.tabTextActive]}>Frecuentes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, selectedTab === "recent" && styles.tabActive]}
            onPress={() => setSelectedTab("recent")}
          >
            <Ionicons
              name="time"
              size={16}
              color={selectedTab === "recent" ? theme.colors.primary : theme.colors.muted}
            />
            <Text style={[styles.tabText, selectedTab === "recent" && styles.tabTextActive]}>Recientes</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de venues */}
        {filteredVenues.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color={theme.colors.muted} />
            <Text style={styles.emptyText}>
              {selectedTab === "favorite"
                ? "Marca tus locales favoritos"
                : selectedTab === "frequent"
                ? "Visita más de 3 veces un local"
                : "Visita locales en los últimos 30 días"}
            </Text>
          </View>
        ) : (
          filteredVenues.map((venue) => (
            <TouchableOpacity
              key={`${venue.venue_name}-${venue.city}`}
              style={styles.venueCard}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate("VenueEvents", {
                  venueName: venue.venue_name,
                  city: venue.city,
                })
              }
            >
              {venue.venue_logo ? (
                <Image source={{ uri: venue.venue_logo }} style={styles.venueLogo} />
              ) : (
                <View style={styles.venueLogoPlaceholder}>
                  <Ionicons name="business" size={28} color={theme.colors.primary} />
                </View>
              )}
              <View style={styles.venueInfo}>
                <Text style={styles.venueName}>{venue.venue_name}</Text>
                <Text style={styles.venueCity}>
                  <Ionicons name="location" size={12} color={theme.colors.muted} /> {venue.city}
                </Text>
                <View style={styles.venueStats}>
                  <Text style={styles.venueStatsText}>
                    <Ionicons name="checkmark-circle" size={12} color={theme.colors.success} /> {venue.events_attended}{" "}
                    {venue.events_attended === 1 ? "evento" : "eventos"}
                  </Text>
                  {!!venue.upcoming_count && (
                    <Text style={[styles.venueStatsText, { marginLeft: 8 }]}>
                      <Ionicons name="calendar" size={12} color={theme.colors.primary} /> {venue.upcoming_count}{" "}
                      {venue.upcoming_count === 1 ? "próximo" : "próximos"}
                    </Text>
                  )}
                </View>
              </View>
              {venue.is_following && (
                <TouchableOpacity
                  style={styles.venueFavoriteButton}
                  onPress={async () => {
                    const {
                      data: { user: authUser },
                    } = await supabase.auth.getUser()
                    if (!authUser) return

                    if (venue.is_favorite) {
                      Alert.alert(
                        "Quitar de favoritos",
                        `¿Quieres quitar ${venue.venue_name} de tus favoritos?`,
                        [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: "Eliminar",
                            style: "destructive",
                            onPress: async () => {
                              if (!venue.venue_id) return
                              const { error } = await supabase
                                .from("venue_followers")
                                .update({ is_favorite: false })
                                .eq("user_id", authUser.id)
                                .eq("venue_id", venue.venue_id)
                              if (!error) await loadVenues()
                            },
                          },
                        ]
                      )
                    } else {
                      if (!venue.venue_id) return
                      const { error } = await supabase
                        .from("venue_followers")
                        .update({ is_favorite: true })
                        .eq("user_id", authUser.id)
                        .eq("venue_id", venue.venue_id)
                      if (!error) await loadVenues()
                    }
                  }}
                >
                  <Ionicons
                    name={venue.is_favorite ? "trash-outline" : "star-outline"}
                    size={24}
                    color={venue.is_favorite ? "#EF4444" : theme.colors.muted}
                  />
                </TouchableOpacity>
              )}
              {venue.category !== "favorite" && (
                <LinearGradient colors={theme.gradients.primarySoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.venueBadge}>
                  <Ionicons name={venue.category === "frequent" ? "flame" : "time"} size={20} color={theme.colors.primary} />
                </LinearGradient>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Calendario Personal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mi Calendario</Text>

        {/* Calendario con navegación de meses */}
        {renderCalendar()}
      </View>

      {/* Modal del Menú Hamburguesa */}
      <Modal visible={menuVisible} animationType="slide" transparent onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Menú</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* ScrollView para el contenido del menú */}
            <ScrollView
              style={styles.menuContent}
              contentContainerStyle={styles.menuContentContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* Opción de negocio: cambia según sea venue o no */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  navigation.navigate("EditProfile")
                }}
              >
                <Ionicons name="create-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Editar Perfil</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {isVenue ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false)
                    navigation.navigate("VenueEvents")
                  }}
                >
                  <Ionicons name="business-outline" size={24} color={theme.colors.text} />
                  <Text style={styles.menuItemText}>Panel del local</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false)
                    navigation.navigate("VenueApplication")
                  }}
                >
                  <Ionicons name="business-outline" size={24} color={theme.colors.text} />
                  <Text style={styles.menuItemText}>Cuenta profesional</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
                </TouchableOpacity>
              )}

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  navigation.navigate("Notifications")
                }}
              >
                <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Notificaciones</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  navigation.navigate("Appearance")
                }}
              >
                <Ionicons name="color-palette-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Apariencia</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  navigation.navigate("PrivacidadSeguridad")
                }}
              >
                <Ionicons name="lock-closed-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Privacidad y Seguridad</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  navigation.navigate("FAQ")
                }}
              >
                <Ionicons name="help-circle-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Ayuda y FAQ</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  navigation.navigate("ContactoSoporte")
                }}
              >
                <Ionicons name="mail-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Contacto / Soporte</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  navigation.navigate("AcercaDeFomo")
                }}
              >
                <Ionicons name="information-circle-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Acerca de FOMO</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false)
                  navigation.navigate("TerminosPrivacidad")
                }}
              >
                <Ionicons name="document-text-outline" size={24} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Términos y Privacidad</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color={theme.colors.danger} />
                <Text style={[styles.menuItemText, styles.menuItemDanger]}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  )
}

// legacy StyleSheet removed; styles are generated by getStyles(theme)

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      color: theme.colors.muted,
      textAlign: "center",
      marginTop: 50,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    menuButton: {
      padding: 4,
    },
    profileSection: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      marginRight: 24,
    },
    avatarPlaceholder: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.colors.primarySoft,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.colors.primary,
      marginRight: 24,
    },
    statsContainer: {
      flexDirection: "row",
      flex: 1,
      justifyContent: "space-around",
    },
    stat: {
      alignItems: "center",
    },
    statNumber: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: 2,
    },
    infoSection: {
      marginBottom: 12,
    },
    fullName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    detailsRow: {
      flexDirection: "row",
      gap: 16,
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
    venueBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    venuePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    venuePillText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    trialPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "#FEF3C7",
      borderWidth: 1,
      borderColor: "#F59E0B",
    },
    trialPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#B45309",
    },
    editButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      paddingVertical: 12,
    },
    editButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    businessButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      paddingVertical: 12,
      marginTop: 10,
      ...theme.shadow,
    },
    businessButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    section: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 8,
      borderTopColor: theme.colors.surface,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 16,
    },
    tabs: {
      flexDirection: "row",
      marginBottom: 16,
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
    tabActive: {
      backgroundColor: theme.colors.card,
      ...theme.shadow,
    },
    tabText: {
      fontSize: 13,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    tabTextActive: {
      color: theme.colors.primary,
      fontWeight: "700",
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: 12,
      textAlign: "center",
    },
    venueCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
      ...theme.shadow,
    },
    venueLogoPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: theme.colors.primary + "15",
      justifyContent: "center",
      alignItems: "center",
    },
    venueLogo: {
      width: 56,
      height: 56,
      borderRadius: 12,
    },
    venueInfo: {
      flex: 1,
    },
    venueName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 4,
    },
    venueCity: {
      fontSize: 13,
      color: theme.colors.muted,
      marginBottom: 6,
    },
    venueStats: {
      flexDirection: "row",
      gap: 12,
    },
    venueStatsText: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: "500",
    },
    venueFavoriteButton: {
      padding: 8,
    },
    venueBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    eventCard: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    eventDate: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      justifyContent: "center",
      alignItems: "center",
      minWidth: 70,
    },
    eventDateText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#fff",
      textAlign: "center",
    },
    eventInfo: {
      flex: 1,
      justifyContent: "center",
    },
    eventName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    eventVenue: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    eventVenueName: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    eventFriends: {
      fontSize: 12,
      color: theme.colors.primary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
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
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    menuTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    menuContent: {
      paddingVertical: 12,
    },
    menuContentContainer: {
      paddingBottom: 36, // margen inferior extra para separar "Cerrar Sesión" del borde
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 16,
    },
    menuItemText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    menuItemDanger: {
      color: theme.colors.danger,
    },
    menuDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 8,
    },
    // Estilos del calendario
    calendarContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      ...theme.shadow,
    },
    calendarHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    calendarNavButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.primary + "15",
    },
    calendarMonth: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text,
      flex: 1,
      textAlign: "center",
    },
    calendarWeekDays: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    calendarWeekDay: {
      width: 40,
      textAlign: "center",
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    calendarGrid: {
      flexDirection: "column",
    },
    calendarWeekRow: {
      flexDirection: "row",
    },
    calendarDay: {
      width: "14.285714%",
      aspectRatio: 1,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      borderRadius: 10,
    },
    calendarDayToday: {
      backgroundColor: theme.colors.primary + "25",
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    calendarDayText: {
      fontSize: 15,
      color: theme.colors.text,
      fontWeight: "500",
    },
    calendarDayTextToday: {
      color: theme.colors.primary,
      fontWeight: "bold",
    },
    calendarDot: {
      position: "absolute",
      bottom: 8,
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.colors.primary,
    },
  })
}
