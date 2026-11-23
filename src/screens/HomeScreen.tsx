"use client"

import { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useFocusEffect } from "@react-navigation/native"
import { supabase } from "../lib/supabase"
import type { Event, User, EventAttendee } from "../types/database.types"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import React from "react"
import { Chip } from "../components/ui/Chip"
import { Card } from "../components/ui/Card"
import { Button } from "../components/ui/Button"

// Subcomponente separado para cumplir las reglas de Hooks
function EventCard({ 
  item, 
  user, 
  navigation, 
  refreshKey, 
  friendsCount = 0, 
  friendIds = [],
  isFollowingVenue = false,
  isVenue = false
}: { 
  item: Event; 
  user: User | null; 
  navigation: any; 
  refreshKey?: number; 
  friendsCount?: number; 
  friendIds?: string[];
  isFollowingVenue?: boolean;
  isVenue?: boolean;
}) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [averageAge, setAverageAge] = useState(0)
  const [topPeople, setTopPeople] = useState<{ uri?: string; name?: string; userId?: string }[]>([])
  const [isAttending, setIsAttending] = useState(false)
  const [loadingAttend, setLoadingAttend] = useState(false)

  const fetchSummary = async () => {
    let total = 0
    let avgAge = 0
    let people: { uri?: string; name?: string; userId?: string }[] = []

    // Obtener todos los asistentes con sus datos
    const { data: attendeesData } = await supabase
      .from("event_attendees")
      .select("users!inner(id, full_name, avatar_url)")
      .eq("event_id", item.id)
      .eq("status", "going")
      .eq("is_visible", true)

    if (attendeesData && attendeesData.length > 0) {
      total = attendeesData.length
      
      // Mapear a nuestro formato
      const allPeople = attendeesData.map((row: any) => ({
        uri: row.users?.avatar_url || undefined,
        name: row.users?.full_name,
        userId: row.users?.id,
      }))

      // Separar amigos y no amigos
      const friends = allPeople.filter(p => friendIds.includes(p.userId || ''))
      const nonFriends = allPeople.filter(p => !friendIds.includes(p.userId || ''))
      
      // Priorizar amigos primero, luego los demás
      people = [...friends, ...nonFriends].slice(0, 4)
    } else {
      total = 0
    }

    // Sumar asistentes externos (lotes) y construir avatares anónimos W/T/O
    const { data: batches } = await supabase
      .from("external_attendance_batches")
      .select("source, quantity")
      .eq("event_id", item.id)

    const externalTotal = (batches || []).reduce((sum, b: any) => sum + (Number(b.quantity) || 0), 0)
    total += externalTotal

    // Añadir placeholders anónimos hasta completar 4 avatares visibles
    const remaining = Math.max(0, 4 - people.length)
    if (remaining > 0 && batches && batches.length > 0) {
      // Agrupar por origen (normalizando sinónimos y abreviaturas)
      const sums: Record<string, number> = { web: 0, taquilla: 0, otros: 0 }
      for (const b of batches as any[]) {
        const s = (b.source || "otros").toString().toLowerCase().trim()
        let src: "web" | "taquilla" | "otros"
        if (["taquilla", "box_office", "ticket_office", "door", "puerta", "caja"].includes(s)) src = "taquilla"
        else if (["web", "online", "site", "website"].includes(s)) src = "web"
        else src = "otros"
        if (src === "web") sums.web += Number(b.quantity) || 0
        else if (src === "taquilla") sums.taquilla += Number(b.quantity) || 0
        else sums.otros += Number(b.quantity) || 0
      }

      const placeholders: { uri?: string; name?: string; userId?: string }[] = []
      let slots = remaining
      const pushMany = (label: string, count: number) => {
        if (slots <= 0 || count <= 0) return
        const n = Math.min(slots, count)
        for (let i = 0; i < n; i++) placeholders.push({ name: label })
        slots -= n
      }

      // Prioridad: mostrar presencia proporcional por origen con letras iniciales
      pushMany("W", sums.web)
      pushMany("T", sums.taquilla)
      pushMany("O", sums.otros)

      people = [...people, ...placeholders]
    }

    setAttendeeCount(total)
    setAverageAge(avgAge)
    setTopPeople(people)
  }

  useEffect(() => {
    const load = async () => {
      // Resumen de asistentes + top avatares (ordenados por nº de amigos)
      await fetchSummary()

      if (user) {
        const { data } = await supabase
          .from("event_attendees")
          .select("*")
          .eq("event_id", item.id)
          .eq("user_id", user.id)
          .single()
        setIsAttending(!!data)
      }
    }
    load()
  }, [item.id, user?.id, refreshKey])

  const handleAttend = async () => {
    if (!user || loadingAttend) return
    setLoadingAttend(true)
    if (isAttending) {
      await supabase.from("event_attendees").delete().eq("event_id", item.id).eq("user_id", user.id)
      setIsAttending(false)
      setAttendeeCount((prev) => Math.max(0, prev - 1))
      // Recargar la lista de avatares inmediatamente
      await fetchSummary()
    } else {
      // Validación de solapamiento
      const { data: myEvents } = await supabase
        .from("event_attendees")
        .select("event_id, events(*)")
        .eq("user_id", user.id)
        .eq("status", "going")
        .neq("event_id", item.id)
      const thisDate = item.event_date
      const thisStart = item.start_time
      const thisEnd = item.end_time || "23:59"
      const timeToMinutes = (t: string): number => {
        const [h, m] = t.split(":").map(Number)
        return h * 60 + m
      }
      const thisStartMin = timeToMinutes(thisStart)
      const thisEndMin = timeToMinutes(thisEnd)
      let overlapping: Event | null = null
      for (const e of myEvents || []) {
        const evRaw = e.events
        const ev: Event | null = Array.isArray(evRaw) ? (evRaw[0] as Event) : (evRaw as Event)
        if (!ev) continue
        if (ev.event_date !== thisDate) continue
        const evStart = ev.start_time
        const evEnd = ev.end_time || "23:59"
        const evStartMin = timeToMinutes(evStart)
        const evEndMin = timeToMinutes(evEnd)
        if (
          (thisStartMin < evEndMin && thisEndMin > evStartMin)
        ) {
          overlapping = ev
          break
        }
      }
      if (overlapping) {
        Alert.alert(
          "Solapamiento de eventos",
          `No puedes apuntarte a este evento porque ya estás apuntado a ${overlapping.title} (${overlapping.venue_name})`
        )
        setLoadingAttend(false)
        return
      }
      // Si no hay solapamiento, inscribir
      const { error } = await supabase
        .from("event_attendees")
        .insert({ event_id: item.id, user_id: user.id, status: "going", is_visible: true })
      if (error) {
        Alert.alert("No puedes apuntarte", error.message)
      } else {
        setIsAttending(true)
        setAttendeeCount((prev) => prev + 1)
        await fetchSummary()
      }
    }
    setLoadingAttend(false)
  }

  const displayCountLabel = attendeeCount > 300 ? "+300" : String(attendeeCount)

  return (
    <View style={styles.eventCardWrapper}>
      <TouchableOpacity 
        onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
        activeOpacity={0.92}
        style={styles.eventCard}
      >
        <LinearGradient
          colors={isAttending ? ["#ECFDF5", "#F0FDF4", "#FFFFFF"] : ["#F9FAFB", "#F3F4F6", "#FFFFFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.eventCardGradient}
        >
                    {/* Logo de la discoteca - CIRCULAR con indicador de seguimiento */}
          <View style={[
            styles.venueLogo,
            isFollowingVenue && styles.venueLogoFollowed
          ]}>
            {item.venue_logo ? (
              <Image source={{ uri: item.venue_logo }} style={styles.venueLogoImage} />
            ) : (
              <View style={styles.venueLogoPlaceholder}>
                <Ionicons name="business" size={28} color={theme.colors.muted} />
              </View>
            )}
            {/* Estrella flotante para venues seguidos */}
            {isFollowingVenue && (
              <View style={styles.venueFollowBadge}>
                <Ionicons name="star" size={16} color="#F59E0B" />
              </View>
            )}
          </View>

        <View style={styles.eventInfo}>
          {/* Nombre de la discoteca - MUY VISIBLE */}
          <Text style={styles.venueName} numberOfLines={1}>{item.venue_name}</Text>
          
          {/* Fecha y género en una línea */}
          <View style={styles.eventMeta}>
            <Ionicons name="calendar-outline" size={14} color={theme.colors.muted} />
            <Text style={styles.eventMetaText}>{format(new Date(item.event_date), "dd MMM", { locale: es })}</Text>
            {item.music_genre && (
              <>
                <View style={styles.metaDivider} />
                <Ionicons name="musical-note" size={14} color={theme.colors.muted} />
                <Text style={styles.eventMetaText}>{item.music_genre}</Text>
              </>
            )}
          </View>
          
          {/* Asistentes */}
          <View style={styles.attendeeSection}>
            {topPeople.length > 0 && (
              <View style={styles.avatarRow}>
                {topPeople.map((p, idx) => {
                  const isFriend = friendIds.includes(p.userId || '')
                  const src = p.name === 'W' ? 'web' : p.name === 'T' ? 'taquilla' : p.name === 'O' ? 'otros' : null
                  return (
                  <View key={(p.uri || p.name || "") + idx} style={[styles.avatarBubbleWrap, idx > 0 && styles.avatarOverlap]}>
                    <View style={[styles.avatarBubble, isFriend && styles.friendAvatarBorder]}>
                      {p.uri ? (
                        <Image source={{ uri: p.uri }} style={styles.avatarImageSmall} />
                      ) : (
                        <View style={[
                          styles.avatarImageSmall,
                          styles.avatarFallback,
                          src === 'web' && styles.anonWeb,
                          src === 'taquilla' && styles.anonTaquilla,
                          src === 'otros' && styles.anonOtros,
                        ]}>
                          <Text style={styles.avatarInitial}>{(p.name || "?").charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    {isFriend && (
                      <View style={styles.friendHeartOutsideSmall}>
                        <Ionicons name="heart" size={11} color="#EF4444" />
                      </View>
                    )}
                  </View>
                )})}
              </View>
            )}
            <Text style={styles.attendeeCount}>
              {displayCountLabel} apuntado{attendeeCount !== 1 ? 's' : ''}
              {friendsCount > 0 && ` (${friendsCount} ${friendsCount === 1 ? 'amigo' : 'amigos'})`}
            </Text>
          </View>
        </View>
        </LinearGradient>
      </TouchableOpacity>
      
      {/* Botón "Voy" - Solo visible para usuarios normales, NO para venues */}
      {!isVenue && (
        <View style={styles.attendButtonCorner}>
          <LinearGradient
            colors={isAttending ? ["#10B981", "#059669"] : ["#3B82F6", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.attendButtonGradient}
          >
            <TouchableOpacity 
              style={styles.attendButtonInner}
              onPress={(e) => {
                e.stopPropagation();
                handleAttend();
              }} 
              disabled={loadingAttend}
              activeOpacity={0.7}
            >
              <Ionicons name={isAttending ? "checkmark-circle" : "add-circle"} size={18} color="#fff" />
              <Text style={styles.attendButtonText}>
                Voy
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}
    </View>
  )
}

export default function HomeScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [user, setUser] = useState<User | null>(null)
  const [isVenue, setIsVenue] = useState(false)
  const [venueName, setVenueName] = useState<string>("")
  const [venueLogo, setVenueLogo] = useState<string>("")
  const [events, setEvents] = useState<Event[]>([])
  const [friendsCountMap, setFriendsCountMap] = useState<Record<string, number>>({})
  const [friendIds, setFriendIds] = useState<string[]>([])
  const [followedVenues, setFollowedVenues] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCity, setSelectedCity] = useState("Madrid")
  const [cityInitialized, setCityInitialized] = useState(false) // 🔑 Flag para evitar resetear ciudad
  const [selectedAgeRange, setSelectedAgeRange] = useState<string | null>(null)
  const [selectedDateRange, setSelectedDateRange] = useState<string | null>(null)
  const [showCityFilter, setShowCityFilter] = useState(false)
  const [showAgeFilter, setShowAgeFilter] = useState(false)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [citySearch, setCitySearch] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCustomAgeModal, setShowCustomAgeModal] = useState(false)
  const [customAgeMin, setCustomAgeMin] = useState("")
  const [customAgeMax, setCustomAgeMax] = useState("")
  const [appliedCustomAgeMin, setAppliedCustomAgeMin] = useState<number | null>(null)
  const [appliedCustomAgeMax, setAppliedCustomAgeMax] = useState<number | null>(null)

  const cities = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao", "Málaga", "Zaragoza", "Alicante", "Granada", "Salamanca", "Murcia", "Palma", "Las Palmas", "Córdoba", "Valladolid", "Vigo", "Gijón", "San Sebastián", "A Coruña", "Pamplona"]
  const filteredCities = cities.filter(city => city.toLowerCase().includes(citySearch.toLowerCase()))
  
  const ageRanges = [
    { label: "Todas las edades", value: null },
    { label: "18-25 años", value: "18-25" },
    { label: "26-35 años", value: "26-35" },
    { label: "36+ años", value: "36+" },
    { label: "Personalizar...", value: "custom" },
  ]

  const dateRanges = [
    { label: "Todas las fechas", value: null },
    { label: "Hoy", value: "today" },
    { label: "Mañana", value: "tomorrow" },
    { label: "Este fin de semana", value: "weekend" },
    { label: "Esta semana", value: "week" },
    { label: "Este mes", value: "month" },
  ]

  useEffect(() => {
    loadData()
  }, [selectedCity, selectedAgeRange, selectedDateRange])

  // Recargar datos cuando vuelves a esta pantalla desde EventDetail
  useFocusEffect(
    React.useCallback(() => {
      console.log("🔄 HomeScreen recibió foco, recargando datos...")
      // Actualizar refreshKey para que las cards se re-rendericen con los datos actualizados
      setRefreshKey(prev => prev + 1)
      loadData(true)
    }, [selectedCity, selectedAgeRange, selectedDateRange, appliedCustomAgeMin, appliedCustomAgeMax])
  )

  const loadData = async (silentReload = false) => {
    if (!silentReload) {
      setLoading(true)
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (authUser) {
      const { data: userData } = await supabase.from("users").select("*").eq("id", authUser.id).single()
      setUser(userData)

      // Detectar si es un venue (local) - cualquier account_type que empiece con "venue"
      const isVenueAccount = userData?.account_type?.startsWith("venue")
      if (isVenueAccount) {
        setIsVenue(true)
        console.log("✅ HomeScreen - Usuario es un venue")
        
        // Cargar datos del venue desde venue_applications (incluyendo la ciudad)
        if (userData?.venue_id) {
          const { data: venueData } = await supabase
            .from("venue_applications")
            .select("venue_name, venue_logo, city")
            .eq("id", userData.venue_id)
            .single()
          
          if (venueData) {
            setVenueName(venueData.venue_name || "")
            setVenueLogo(venueData.venue_logo || "")
            console.log(`🏢 HomeScreen - Venue: ${venueData.venue_name}`)
            
            // Solo establecer ciudad inicial si NO ha sido inicializada
            if (venueData.city && !cityInitialized) {
              setSelectedCity(venueData.city)
              setCityInitialized(true)
              console.log(`🏙️ HomeScreen - Ciudad inicial del venue: ${venueData.city}`)
            }
          }
        }
      } else {
        setIsVenue(false)
        console.log("❌ HomeScreen - Usuario NO es un venue")
        
        // Si es usuario normal, detectar su ciudad inicial
        if (userData?.city && !cityInitialized) {
          setSelectedCity(userData.city)
          setCityInitialized(true)
          console.log(`🏙️ HomeScreen - Ciudad inicial del usuario: ${userData.city}`)
        }
      }

      // Obtener amigos aceptados (ids)
      const { data: friends } = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", authUser.id)
        .eq("status", "accepted")
      const fIds = (friends || []).map((f: any) => f.friend_id)
      setFriendIds(fIds)

      // Obtener venues que sigue el usuario (solo si NO es venue)
      if (!isVenueAccount) {
        const { data: followedVenuesData } = await supabase
          .from("venue_followers")
          .select("venue_id")
          .eq("user_id", authUser.id)
        
        const venueSet = new Set<string>()
        if (followedVenuesData) {
          followedVenuesData.forEach((v: any) => {
            // Usar venue_id directamente
            if (v.venue_id) venueSet.add(v.venue_id)
          })
        }
        setFollowedVenues(venueSet)
      }

      // Calcular rango de fechas (usando solo la fecha sin hora)
      // Calcular rango de fechas (usando solo la fecha sin hora)
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0] // Solo YYYY-MM-DD
      let startDateStr = todayStr
      let endDateStr: string | null = null

      if (selectedDateRange === "today") {
        startDateStr = todayStr
        endDateStr = todayStr
      } else if (selectedDateRange === "tomorrow") {
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]
        startDateStr = tomorrowStr
        endDateStr = tomorrowStr
      } else if (selectedDateRange === "weekend") {
        const dayOfWeek = today.getDay()
        let daysToFriday = (5 - dayOfWeek + 7) % 7
        if (daysToFriday === 0 && dayOfWeek !== 5) daysToFriday = 7
        
        const friday = new Date(today)
        friday.setDate(friday.getDate() + daysToFriday)
        const sunday = new Date(friday)
        sunday.setDate(sunday.getDate() + 2)
        
        startDateStr = friday.toISOString().split('T')[0]
        endDateStr = sunday.toISOString().split('T')[0]
      } else if (selectedDateRange === "week") {
        const nextWeek = new Date(today)
        nextWeek.setDate(nextWeek.getDate() + 7)
        endDateStr = nextWeek.toISOString().split('T')[0]
      } else if (selectedDateRange === "month") {
        const nextMonth = new Date(today)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        endDateStr = nextMonth.toISOString().split('T')[0]
      }

      let eventsQuery = supabase
        .from("events")
        .select("*")
        .eq("city", selectedCity)
        .gte("event_date", startDateStr)

      if (endDateStr) {
        eventsQuery = eventsQuery.lte("event_date", endDateStr)
      }

      const { data: eventsList } = await eventsQuery
        .order("event_date", { ascending: true })
        .limit(50)

      // Si hay amigos, contar cuántos van a cada evento y ordenar por ese criterio
      let eventsProcessed: (Event & { _friends?: number })[] = eventsList || []
      let friendCountsLocal: Record<string, number> = {}
      if (eventsProcessed.length > 0 && fIds.length > 0) {
        const counts = await Promise.all(
          eventsProcessed.map(async (ev) => {
            const { count } = await supabase
              .from("event_attendees")
              .select("*", { count: "exact", head: true })
              .eq("event_id", ev.id)
              .eq("status", "going")
              .eq("is_visible", true)
              .in("user_id", fIds)
            friendCountsLocal[ev.id] = count || 0
            return { id: ev.id, count: count || 0 }
          })
        )
        // Ordenar desc por amigos y asc por fecha como secondary key
        eventsProcessed = [...eventsProcessed].sort((a, b) => {
          const ca = friendCountsLocal[a.id] || 0
          const cb = friendCountsLocal[b.id] || 0
          if (cb !== ca) return cb - ca
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
        })
        setFriendsCountMap(friendCountsLocal)
      }

      // Si no hay filtro de edad, mostrar todos los eventos (ya ordenados por amigos si aplica)
      if (!selectedAgeRange && appliedCustomAgeMin === null) {
        setEvents(eventsProcessed.slice(0, 10) || [])
      } else {
        // Filtrar por edad
        if (eventsProcessed && eventsProcessed.length > 0) {
          const eventsWithAge = await Promise.all(
            eventsProcessed.map(async (event) => {
              const { data } = await supabase.rpc("get_event_average_age", { event_id_param: event.id })
              return { ...event, averageAge: data || 0 }
            })
          )

          console.log("Eventos con edad:", eventsWithAge.map(e => ({ title: e.title, age: e.averageAge })))

          let filteredEvents = eventsWithAge
          
          // Filtro personalizado tiene prioridad
          if (selectedAgeRange === "custom" && appliedCustomAgeMin !== null && appliedCustomAgeMax !== null) {
            filteredEvents = eventsWithAge.filter((e) => {
              return e.averageAge === 0 || (e.averageAge >= appliedCustomAgeMin && e.averageAge <= appliedCustomAgeMax)
            })
          } else if (selectedAgeRange === "18-25") {
            filteredEvents = eventsWithAge.filter((e) => {
              return e.averageAge === 0 || (e.averageAge >= 18 && e.averageAge <= 25)
            })
          } else if (selectedAgeRange === "26-35") {
            filteredEvents = eventsWithAge.filter((e) => {
              return e.averageAge === 0 || (e.averageAge >= 26 && e.averageAge <= 35)
            })
          } else if (selectedAgeRange === "36+") {
            filteredEvents = eventsWithAge.filter((e) => {
              return e.averageAge === 0 || e.averageAge >= 36
            })
          }

          console.log("Filtro seleccionado:", selectedAgeRange, "Eventos filtrados:", filteredEvents.length)
          setEvents(filteredEvents.slice(0, 10))
        } else {
          setEvents([])
        }
      }
    }

    if (!silentReload) {
      setLoading(false)
    }
  }

  const handleApplyCustomAge = () => {
    const min = parseInt(customAgeMin)
    const max = parseInt(customAgeMax)
    
    if (isNaN(min) || isNaN(max)) {
      Alert.alert("Error", "Por favor introduce edades válidas")
      return
    }
    
    if (min < 18 || max > 99) {
      Alert.alert("Error", "Las edades deben estar entre 18 y 99")
      return
    }
    
    if (min >= max) {
      Alert.alert("Error", "La edad mínima debe ser menor que la máxima")
      return
    }
    
    setAppliedCustomAgeMin(min)
    setAppliedCustomAgeMax(max)
    setSelectedAgeRange("custom")
    setShowCustomAgeModal(false)
    setShowAgeFilter(false)
  }

  const handleCancelCustomAge = () => {
    setCustomAgeMin("")
    setCustomAgeMax("")
    setShowCustomAgeModal(false)
  }

  const getAgeFilterLabel = () => {
    if (selectedAgeRange === "custom" && appliedCustomAgeMin !== null && appliedCustomAgeMax !== null) {
      return `${appliedCustomAgeMin}-${appliedCustomAgeMax}`
    }
    if (selectedAgeRange) {
      const range = ageRanges.find(r => r.value === selectedAgeRange)
      return range?.label.replace(" años", "") || "Edad"
    }
    return "Edad"
  }

  return (
    <View style={styles.container}>
      {/* Header con gradiente degradado que incluye los filtros */}
      <LinearGradient
        colors={["#1E3A8A", "#1E3A8A", "#2563EB", "#7C3AED", "#A78BFA", "#EDE9FE", "#FFFFFF"]}
        locations={[0, 0.24, 0.44, 0.64, 0.82, 0.95, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.headerWithFilters}
      >
        {/* Header superior */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={require("../../assets/fomoLogoPequeno.png")} style={styles.logoSmall} resizeMode="contain" />
            <View>
              <Text style={styles.greeting}>
                Hola, {isVenue ? (venueName || "Local") : (user?.full_name?.split(" ")[0] || "Usuario")}
              </Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={16} color="#C7D2FE" />
                <Text style={styles.location}>{selectedCity}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate("Profile")}>
            {isVenue ? (
              venueLogo ? (
                <Image source={{ uri: venueLogo }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="business" size={24} color="#fff" />
              )
            ) : (
              user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={24} color="#fff" />
              )
            )}
          </TouchableOpacity>
        </View>

        {/* Filtros integrados en el gradiente con panel suave para legibilidad */}
        <View style={styles.filtersContainer}>
          <Chip
            variant="outline"
            style={{ flex: 1, justifyContent: "center" }}
            leftIcon={<Ionicons name="location-outline" size={16} color={theme.colors.primary} />}
            rightIcon={<Ionicons name={showCityFilter ? "chevron-up" : "chevron-down"} size={14} color={theme.colors.muted} />}
            onPress={() => {
              setShowCityFilter(!showCityFilter)
              setShowAgeFilter(false)
              setShowDateFilter(false)
            }}
          >
            <Text style={styles.filterButtonText} numberOfLines={1} ellipsizeMode="tail">{selectedCity}</Text>
          </Chip>

          <Chip
            variant="outline"
            style={{ flex: 1, justifyContent: "center" }}
            leftIcon={<Ionicons name="people-outline" size={16} color={theme.colors.primary} />}
            rightIcon={<Ionicons name={showAgeFilter ? "chevron-up" : "chevron-down"} size={14} color={theme.colors.muted} />}
            onPress={() => {
              setShowAgeFilter(!showAgeFilter)
              setShowCityFilter(false)
              setShowDateFilter(false)
            }}
          >
            <Text style={styles.filterButtonText} numberOfLines={1} ellipsizeMode="tail">
              {getAgeFilterLabel()}
            </Text>
          </Chip>

          <Chip
            variant="outline"
            style={{ flex: 1, justifyContent: "center" }}
            leftIcon={<Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />}
            rightIcon={<Ionicons name={showDateFilter ? "chevron-up" : "chevron-down"} size={14} color={theme.colors.muted} />}
            onPress={() => {
              setShowDateFilter(!showDateFilter)
              setShowCityFilter(false)
              setShowAgeFilter(false)
            }}
          >
            <Text style={styles.filterButtonText} numberOfLines={1} ellipsizeMode="tail">
              {selectedDateRange ? dateRanges.find(r => r.value === selectedDateRange)?.label : "Fecha"}
            </Text>
          </Chip>
        </View>
      </LinearGradient>

      {/* Dropdown Ciudad */}
      {showCityFilter && (
        <View style={styles.filterDropdown}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={18} color={theme.colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar ciudad..."
              placeholderTextColor={theme.colors.muted}
              value={citySearch}
              onChangeText={setCitySearch}
              autoFocus={true}
            />
            {citySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCitySearch("")}>
                <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={styles.cityScrollView} nestedScrollEnabled={true}>
            {filteredCities.map((city) => (
              <TouchableOpacity
                key={city}
                style={[styles.filterOption, selectedCity === city && styles.filterOptionSelected]}
                onPress={() => {
                  setSelectedCity(city)
                  setShowCityFilter(false)
                  setCitySearch("")
                }}
              >
                <Text style={[styles.filterOptionText, selectedCity === city && styles.filterOptionTextSelected]}>
                  {city}
                </Text>
                {selectedCity === city && <Ionicons name="checkmark" size={20} color={theme.colors.primary} />}
              </TouchableOpacity>
            ))}
            {filteredCities.length === 0 && (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No se encontró la ciudad</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Dropdown Edad */}
      {showAgeFilter && (
        <View style={styles.filterDropdown}>
          {ageRanges.map((range) => (
            <TouchableOpacity
              key={range.label}
              style={[styles.filterOption, selectedAgeRange === range.value && styles.filterOptionSelected]}
              onPress={() => {
                if (range.value === "custom") {
                  setShowCustomAgeModal(true)
                  setShowAgeFilter(false)
                } else {
                  setSelectedAgeRange(range.value)
                  setAppliedCustomAgeMin(null)
                  setAppliedCustomAgeMax(null)
                  setShowAgeFilter(false)
                }
              }}
            >
              <Text style={[styles.filterOptionText, selectedAgeRange === range.value && styles.filterOptionTextSelected]}>
                {range.label}
              </Text>
              {selectedAgeRange === range.value && range.value !== "custom" && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Dropdown Fecha */}
      {showDateFilter && (
        <View style={styles.filterDropdown}>
          {dateRanges.map((range) => (
            <TouchableOpacity
              key={range.label}
              style={[styles.filterOption, selectedDateRange === range.value && styles.filterOptionSelected]}
              onPress={() => {
                setSelectedDateRange(range.value)
                setShowDateFilter(false)
              }}
            >
              <Text style={[styles.filterOptionText, selectedDateRange === range.value && styles.filterOptionTextSelected]}>
                {range.label}
              </Text>
              {selectedDateRange === range.value && <Ionicons name="checkmark" size={20} color={theme.colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Título de sección más cerca de las cards */}
      <Text style={styles.sectionTitle}>Eventos publicados</Text>

      <FlatList
        data={events}
        renderItem={({ item }) => (
          <EventCard
            item={item}
            user={user}
            navigation={navigation}
            refreshKey={refreshKey}
            friendsCount={friendsCountMap[item.id] || 0}
            friendIds={friendIds}
            isFollowingVenue={item.venue_id ? followedVenues.has(item.venue_id) : false}
            isVenue={isVenue}
          />
        )}
        keyExtractor={(item) => item.id}
  refreshControl={
    <RefreshControl 
      refreshing={refreshing} 
      onRefresh={async () => {
        setRefreshing(true)
        await loadData(false)
        setRefreshing(false)
      }} 
      tintColor={theme.colors.primary} 
    />
  }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color={theme.colors.muted} />
              <Text style={styles.emptyStateTitle}>No hay eventos</Text>
              <Text style={styles.emptyStateText}>
                {selectedAgeRange || selectedDateRange
                  ? `No encontramos eventos en ${selectedCity} con los filtros seleccionados.`
                  : `No encontramos eventos en ${selectedCity} en este momento.`}
              </Text>
              {(selectedAgeRange || selectedDateRange) && (
                <View style={{ gap: 8 }}>
                  {selectedAgeRange && (
                    <Button variant="gradient" onPress={() => {
                      setSelectedAgeRange(null)
                      setAppliedCustomAgeMin(null)
                      setAppliedCustomAgeMax(null)
                      setCustomAgeMin("")
                      setCustomAgeMax("")
                    }}>
                      Limpiar filtro de edad
                    </Button>
                  )}
                  {selectedDateRange && (
                    <Button variant="gradient" onPress={() => setSelectedDateRange(null)}>
                      Limpiar filtro de fecha
                    </Button>
                  )}
                </View>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Modal de edad personalizada */}
      <Modal
        visible={showCustomAgeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelCustomAge}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Personalizar rango de edad</Text>
            <Text style={styles.modalSubtitle}>Define la edad mínima y máxima</Text>
            
            <View style={styles.modalInputContainer}>
              <View style={styles.modalInputWrapper}>
                <Text style={styles.modalInputLabel}>Edad mínima</Text>
                <TextInput
                  style={styles.modalInput}
                  value={customAgeMin}
                  onChangeText={setCustomAgeMin}
                  keyboardType="number-pad"
                  placeholder="18"
                  placeholderTextColor={theme.colors.muted}
                  maxLength={2}
                />
              </View>
              
              <View style={styles.modalInputWrapper}>
                <Text style={styles.modalInputLabel}>Edad máxima</Text>
                <TextInput
                  style={styles.modalInput}
                  value={customAgeMax}
                  onChangeText={setCustomAgeMax}
                  keyboardType="number-pad"
                  placeholder="99"
                  placeholderTextColor={theme.colors.muted}
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={handleCancelCustomAge}>
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonApply} onPress={handleApplyCustomAge}>
                <LinearGradient
                  colors={["#3B82F6", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonApplyText}>Aplicar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  headerWithFilters: {
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  logoSmall: {
    width: 80,
    height: 80,
  },
  greeting: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  location: {
    fontSize: 12,
    color: "#E0E7FF",
    fontWeight: "500",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  filtersContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    // clave para que el contenido no se desborde
    minWidth: 0,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
    flexShrink: 1,
  },
  filterDropdown: {
    backgroundColor: theme.colors.card,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 350,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    padding: 0,
  },
  cityScrollView: {
    maxHeight: 250,
  },
  noResults: {
    paddingVertical: 20,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 14,
    color: theme.colors.muted,
  },
  filterOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterOptionSelected: {
    backgroundColor: theme.colors.primarySoft,
  },
  filterOptionText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  filterOptionTextSelected: {
    fontWeight: "600",
    color: theme.colors.primary,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  clearFilterButton: {
    marginTop: 20,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  clearFilterButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.text,
    marginTop: 12,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  eventCardWrapper: {
    marginBottom: 16,
    marginHorizontal: 16,
    position: "relative",
  },
  eventCard: {
    flexDirection: "row",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 0,
    minHeight: 110,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  eventCardGradient: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  venueLogo: {
    width: 70,
    height: 70,
    margin: 14,
    borderRadius: 35,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: "relative",
  },
  venueLogoFollowed: {
    borderWidth: 3,
    borderColor: "#F59E0B",
  },
  venueFollowBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
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
    paddingVertical: 14,
    paddingRight: 75,
    justifyContent: "center",
    gap: 7,
  },
  venueName: {
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
  attendeeSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  attendeeCount: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 4,
  },
  avatarBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: theme.colors.card,
    backgroundColor: theme.colors.surface,
  },
  avatarBubbleWrap: {
    width: 24,
    height: 24,
    position: "relative",
  },
  friendAvatarBorder: {
    borderColor: "#EF4444",
    borderWidth: 2,
  },
  friendHeartOutsideSmall: {
    position: "absolute",
    bottom: 0,
    left: -2,
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarImageSmall: {
    width: 24,
    height: 24,
  },
  avatarFallback: {
    backgroundColor: theme.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  anonWeb: {
    backgroundColor: "#0EA5E9",
  },
  anonTaquilla: {
    backgroundColor: "#10B981",
  },
  anonOtros: {
    backgroundColor: "#F59E0B",
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  avatarInitialSmall: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase'
  },
  attendButtonCorner: {
    position: "absolute",
    top: 10,
    right: 10,
    borderRadius: 999,
    overflow: "hidden",
    ...theme.shadow,
  },
  attendButtonGradient: {
    borderRadius: 999,
  },
  attendButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attendButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    ...theme.shadow,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    marginBottom: 24,
    textAlign: "center",
  },
  modalInputContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  modalInputWrapper: {
    flex: 1,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  modalButtonCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.text,
  },
  modalButtonApply: {
    flex: 1,
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
  modalButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  modalButtonApplyText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  })
}
