import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Animated, PanResponder, TextInput, Modal } from "react-native"
"use client"

import { useEffect, useState, useRef } from "react"
// (Removed duplicate import block)
import { LinearGradient } from "expo-linear-gradient"
import * as Haptics from "expo-haptics"
import { supabase } from "../lib/supabase"
import type { Event, EventAttendee, User } from "../types/database.types"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useFocusEffect } from "@react-navigation/native"
import React from "react"
import { Chip } from "../components/ui/Chip"
import { Button } from "../components/ui/Button"
import * as ImagePicker from "expo-image-picker"
import * as DocumentPicker from "expo-document-picker"
import * as FileSystem from "expo-file-system/legacy"
import { uploadAttendanceProof } from "../lib/storage"
import { resolveVenuePlanForCurrentUser } from "../lib/subscriptions"

export default function EventDetailScreen({ route, navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const { eventId } = route.params
  const [event, setEvent] = useState<Event | null>(null)
  const [attendees, setAttendees] = useState<(EventAttendee & { users: User })[]>([])
  const [userAttendance, setUserAttendance] = useState<EventAttendee | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [isVenue, setIsVenue] = useState(false)
  const [venueApplicationId, setVenueApplicationId] = useState<string | null>(null)
  const [friendIds, setFriendIds] = useState<string[]>([])
  const [showFullDesc, setShowFullDesc] = useState(false)
  const [isFollowingVenue, setIsFollowingVenue] = useState(false)
  // External attendance summary
  const [extSummary, setExtSummary] = useState<{ web: number; taquilla: number; otros: number; total: number }>({ web: 0, taquilla: 0, otros: 0, total: 0 })
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchSource, setBatchSource] = useState<"web" | "taquilla" | "otros">("web")

  // Normalización de códigos de origen (BD puede usar distintos literal)
  const normalizeSourceForSummary = (raw: string): "web" | "taquilla" | "otros" => {
    const s = (raw || "").toLowerCase().replace(/\s+/g, "_")
    if (["web", "online", "venta_web"].includes(s)) return "web"
    if (["taquilla", "box_office", "ticket_office", "caja"].includes(s)) return "taquilla"
    return "otros"
  }
  const SOURCE_INSERT_CANDIDATES: Record<"web" | "taquilla" | "otros", string[]> = {
    web: ["web", "online", "venta_web"],
    taquilla: ["taquilla", "box_office", "ticket_office"],
    otros: ["otros", "other", "other_platform"],
  }
  const [batchQty, setBatchQty] = useState<string>("")
  const [batchNotes, setBatchNotes] = useState<string>("")
  const [namesText, setNamesText] = useState<string>("")
  const [analysis, setAnalysis] = useState<{ raw: number; matched: number; newCount: number } | null>(null)
  const [analyzing, setAnalyzing] = useState<boolean>(false)
  const [batchImageUri, setBatchImageUri] = useState<string | null>(null)
  const [savingBatch, setSavingBatch] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  // Plan/rol del venue
  const [venuePlan, setVenuePlan] = useState<"free"|"pro"|"premium"|null>(null)
  const [trialActive, setTrialActive] = useState(false)
  // Permisos desde backend (RPC)
  const [canAddExternal, setCanAddExternal] = useState<boolean | null>(null)
  const [canDedup, setCanDedup] = useState<boolean | null>(null)
  // CTA state
  const [inFlight, setInFlight] = useState(false)
  // Menú y reporte de evento
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState<string>("")
  const [reportDetails, setReportDetails] = useState<string>("")
  const [submittingReport, setSubmittingReport] = useState(false)
  const iconScale = useRef(new Animated.Value(1)).current
  const going = userAttendance?.status === "going"
  // FOMO-meter
  const meterAnim = useRef(new Animated.Value(0)).current
  const friendsGoing = attendees.filter((a) => friendIds.includes(a.users.id))
  useEffect(() => {
    // Peso adicional a los amigos para subir el hype
    const bonus = friendsGoing.length * 2
    const raw = (attendees?.length || 0) + bonus
    const max = 20 // escala objetivo
    const ratio = Math.max(0, Math.min(raw / max, 1))
    Animated.timing(meterAnim, { toValue: ratio, duration: 600, useNativeDriver: false }).start()
  }, [attendees?.length, friendIds.join(",")])

  useEffect(() => {
    loadEventData()
  }, [eventId])

  // Recarga automática al recuperar foco (por si cambian asistentes o estado de follow desde otra pantalla)
  useFocusEffect(
    React.useCallback(() => {
      loadEventData()
    }, [eventId])
  )

  const loadEventData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    // Resolver plan y permisos desde backend/helper
    const info = await resolveVenuePlanForCurrentUser()
    setIsVenue(info.isVenue)
    setVenuePlan(info.plan)
    setTrialActive(info.trialActive)
    if (info.venueId) {
      setVenueApplicationId(info.venueId)
    } else if (user) {
      const { data: venueApp } = await supabase
        .from("venue_applications")
        .select("id,status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle()
      setVenueApplicationId(venueApp?.id || null)
    }

    try { console.log("[Plan] isVenue=", info.isVenue, "plan=", info.plan, "trial=", info.trialActive, "visual=", info.visualPlan) } catch {}

    if (user) {
      try {
        const { data: canBatch } = await supabase.rpc("can_add_external_batch", { p_user_id: user.id })
        if (typeof canBatch === 'boolean') setCanAddExternal(canBatch)
      } catch {}
      try {
        const { data: canD } = await supabase.rpc("can_use_dedup", { p_user_id: user.id })
        if (typeof canD === 'boolean') setCanDedup(canD)
      } catch {}
    }

    const { data: eventData } = await supabase.from("events").select("*").eq("id", eventId).single()

    // Imagen del evento: si no hay image_url, intentar último archivo del bucket del venue
    if (eventData && !eventData.image_url && (eventData as any).venue_id) {
      try {
        const venueFolder = (eventData as any).venue_id as string
        const { data: files } = await supabase.storage
          .from("event-images")
          .list(venueFolder, { limit: 1, sortBy: { column: "created_at", order: "desc" } })
        const file = files && files[0]
        if (file) {
          const path = `${venueFolder}/${file.name}`
          const { data: pub } = supabase.storage.from("event-images").getPublicUrl(path)
          if (pub?.publicUrl) setEvent({ ...(eventData as any), image_url: pub.publicUrl })
          else setEvent(eventData as any)
        } else {
          setEvent(eventData as any)
        }
      } catch {
        setEvent(eventData as any)
      }
    } else {
      setEvent(eventData as any)
    }

    // Resumen de lotes externos
    if (eventData) {
      const { data: batches } = await supabase
        .from("external_attendance_batches")
        .select("source, quantity")
        .eq("event_id", eventId)

      const sums = (batches || []).reduce(
        (acc: any, row: any) => {
          const src = normalizeSourceForSummary(row.source)
          const q = Number(row.quantity) || 0
          if (src === "web") acc.web += q
          else if (src === "taquilla") acc.taquilla += q
          else acc.otros += q
          acc.total += q
          return acc
        },
        { web: 0, taquilla: 0, otros: 0, total: 0 }
      )
      setExtSummary(sums)
    }

    const { data: attendeesData } = await supabase
      .from("event_attendees")
      .select("*, users(*)")
      .eq("event_id", eventId)
      .eq("status", "going")
      .eq("is_visible", true)

    if (user) {
      const { data: friends } = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", user.id)
        .eq("status", "accepted")
      const ids = (friends || []).map((f: any) => f.friend_id)
      setFriendIds(ids)
      const ordered = (attendeesData || []).sort((a: any, b: any) => {
        const af = ids.includes(a.user_id)
        const bf = ids.includes(b.user_id)
        if (af && !bf) return -1
        if (!af && bf) return 1
        return (a.users.full_name || "").localeCompare(b.users.full_name || "")
      })
      setAttendees(ordered)
    } else {
      setAttendees(attendeesData || [])
    }

    if (user) {
      const { data: userAttendanceData } = await supabase
        .from("event_attendees")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle()
      setUserAttendance(userAttendanceData || null)
    }

    if (user && eventData && eventData.venue_id) {
      const { data: followData } = await supabase
        .from("venue_followers")
        .select("venue_id")
        .eq("user_id", user.id)
        .eq("venue_id", eventData.venue_id)
        .maybeSingle()
       console.log("📍 Estado inicial follow:", { followData, isFollowing: !!followData })
      setIsFollowingVenue(!!followData)
    }
  }

  const toggleFollowVenue = async () => {
    if (!event || !currentUserId) {
      console.warn("⚠️ ToggleFollow abort: faltan event o currentUserId")
      return
    }
    // Resolver venue_id si falta (eventos antiguos creados antes de la migración)
    let venueIdToUse: string | null = event.venue_id || null
    if (!venueIdToUse) {
      console.log("🔧 venue_id ausente, intentando resolver por nombre+ciudad", { venue_name: (event as any).venue_name, city: (event as any).city })
      // 1) Intentar encontrar otro evento del mismo venue que sí tenga venue_id
      const { data: evtWithId, error: evtLookupError } = await supabase
        .from("events")
        .select("venue_id")
        .eq("venue_name", (event as any).venue_name)
        .eq("city", (event as any).city)
        .not("venue_id", "is", null)
        .limit(1)
        .maybeSingle()
      if (evtLookupError) console.warn("⚠️ Error buscando venue_id en otros eventos", evtLookupError)
      if (evtWithId?.venue_id) {
        venueIdToUse = evtWithId.venue_id
      } else {
        // 2) Buscar en venue_applications (solo aprobados por RLS)
        const { data: venueRow, error: venueLookupError } = await supabase
          .from("venue_applications")
          .select("id")
          .ilike("venue_name", `%${(event as any).venue_name}%`)
          .eq("city", (event as any).city)
          .maybeSingle()
        if (venueLookupError) console.warn("⚠️ Error buscando venue_id fallback en applications", venueLookupError)
        if (venueRow?.id) {
          venueIdToUse = venueRow.id
        } else {
          console.warn("❌ No se pudo resolver venue_id, abortando follow")
          return
        }
      }
    }

    console.log("🔄 Toggle Follow - Antes:", {
      isFollowingVenue,
      event_venue_id: venueIdToUse,
      currentUserId
    })

    if (isFollowingVenue) {
      // Optimista: marcar como no siguiendo antes
      setIsFollowingVenue(false)
      const { error } = await supabase
        .from("venue_followers")
        .delete()
        .eq("user_id", currentUserId)
  .eq("venue_id", venueIdToUse as string)
      console.log("❌ Dejar de seguir - Error:", error)
      if (error) {
        // Revertir si fallo
        setIsFollowingVenue(true)
        console.warn("↩️ Revirtiendo estado follow por error al eliminar")
      } else {
        console.log("✅ Dejó de seguir el venue")
      }
    } else {
      // Optimista: marcar como siguiendo
      setIsFollowingVenue(true)
      const { error } = await supabase
        .from("venue_followers")
        .upsert(
          {
            user_id: currentUserId,
            venue_id: venueIdToUse as string,
            is_favorite: true,
            notifications_enabled: true,
          },
          { onConflict: "user_id,venue_id" }
        )
      console.log("⭐ Seguir venue - Error:", error)
      if (error) {
        // Revertir si fallo
        setIsFollowingVenue(false)
        console.warn("↩️ Revirtiendo estado follow por error al insertar")
      } else {
        console.log("✅ Ahora sigue el venue")
      }
    }
  }

  // Helpers: seleccionar imagen para lote externo
  const pickBatchImage = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería para seleccionar una imagen.")
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

  const analyzeNamesList = () => {
    if (!namesText.trim()) { setAnalysis(null); return }
    setAnalyzing(true)
    try {
      // Normalizar texto
      const normalize = (s: string) => s
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu,'')
        .toLowerCase()
        .replace(/[^a-z0-9\s@._-]/g,'')
        .replace(/\s+/g,' ')
        .trim()
      
      // Crear sets de emails y nombres de asistentes actuales
      const existingEmails = new Set(
        attendees
          .map(a => a.users.email?.toLowerCase().trim())
          .filter(e => e)
      )
      const existingNames = new Set(
        attendees.map(a => normalize(a.users.full_name || ''))
      )
      
      // Parse líneas pegadas (pueden ser emails o nombres)
      const lines = namesText
        .split(/\r?\n|,/)
        .map(l => l.trim())
        .filter(l => l.length > 0)
      
      // Eliminar duplicados en la lista pegada
      const uniqueRaw: string[] = []
      const seen = new Set<string>()
      for (const l of lines) { 
        const key = l.toLowerCase()
        if (!seen.has(key)) { 
          uniqueRaw.push(l); 
          seen.add(key) 
        }
      }
      
      // Detectar duplicados: priorizar email si parece email, sino nombre
      let matched = 0
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      
      for (const raw of uniqueRaw) {
        const trimmed = raw.trim()
        const isEmail = emailRegex.test(trimmed)
        
        if (isEmail) {
          // Si es email, comparar con emails de asistentes
          if (existingEmails.has(trimmed.toLowerCase())) {
            matched++
          }
        } else {
          // Si es nombre, comparar con nombres normalizados
          const norm = normalize(trimmed)
          if (existingNames.has(norm)) {
            matched++
          }
        }
      }
      
      const rawCount = uniqueRaw.length
      const newCount = rawCount - matched
      setAnalysis({ raw: rawCount, matched, newCount })
    } finally {
      setAnalyzing(false)
    }
  }

  const pickNamesFile = async () => {
    try {
      setUploadingFile(true)
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/csv', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      })
      
      if (result.canceled) return
      
      const asset = result.assets?.[0]
      if (!asset?.uri) return
      
      // Verificar extensión
      const fileName = asset.name?.toLowerCase() || ''
      if (!(fileName.endsWith('.txt') || fileName.endsWith('.csv'))) {
        Alert.alert("Archivo no válido", "Por favor selecciona un archivo .txt o .csv")
        return
      }
      
      // Leer contenido
      const content = await FileSystem.readAsStringAsync(asset.uri)
      setNamesText(content)
      setAnalysis(null)
      Alert.alert("Archivo cargado", "Lista importada. Pulsa Analizar para verificar duplicados.")
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo leer el archivo")
    } finally {
      setUploadingFile(false)
    }
  }

  const saveExternalBatch = async () => {
    if (!event) return
    const providedQty = parseInt(batchQty, 10)
    let finalQty = providedQty
    let rawQty = providedQty
    let reconStatus: 'none' | 'reconciled' = 'none'
    if (analysis) {
      rawQty = analysis.raw
      finalQty = analysis.newCount
      reconStatus = 'reconciled'
    }
    if (!finalQty || finalQty <= 0) {
      Alert.alert("Cantidad inválida", "Indica una cantidad mayor que 0 (tras deduplicar)")
      return
    }
    if (!batchImageUri) {
      Alert.alert("Comprobante requerido", "Adjunta una imagen de comprobante")
      return
    }

    try {
      setSavingBatch(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      // Validaciones de la imagen del comprobante
      const info = await FileSystem.getInfoAsync(batchImageUri)
      if ((info as any)?.size && (info as any).size > 5 * 1024 * 1024) {
        throw new Error("La imagen supera 5MB. Comprime o elige otra más ligera.")
      }
      const lower = batchImageUri.toLowerCase()
      if (!(lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png'))) {
        throw new Error("Formato no soportado. Usa JPG o PNG.")
      }

      // Subir comprobante
      const uploaded = await uploadAttendanceProof(batchImageUri, (event as any).venue_id, event.id)

      // Construir notas extendidas con metadatos (MVP: guardamos raw info en notes)
      const extendedNotes = [batchNotes.trim(), analysis ? `raw:${rawQty};dedup:${finalQty};matched:${analysis.matched}` : null, namesText.trim() ? `names_snapshot:${namesText.trim().slice(0,500)}` : null]
        .filter(Boolean)
        .join(' | ')

      // Insertar lote - intentar con distintos literales según constraint de BD
      let inserted = false
      let lastError: any = null
      for (const candidate of SOURCE_INSERT_CANDIDATES[batchSource]) {
        const { error } = await supabase.from("external_attendance_batches").insert({
          event_id: event.id,
          venue_id: (event as any).venue_id || null,
          source: candidate,
          quantity: finalQty, // usamos la cantidad efectiva para evitar duplicaciones
          notes: extendedNotes || null,
          proof_image_url: uploaded.url || uploaded.path,
          verified: false,
        })
        if (!error) { inserted = true; break }
        lastError = error
        if (!(`${error?.message || ""}`.toLowerCase().includes("source_check"))) {
          break
        }
      }
      if (!inserted) throw lastError || new Error("No se pudo guardar el lote")

      setShowBatchModal(false)
      setBatchImageUri(null)
      setBatchNotes("")
      setBatchQty("")
      setNamesText("")
      setAnalysis(null)
      await loadEventData()
      Alert.alert("Listo", `Lote añadido. Cantidad efectiva: ${finalQty}${analysis ? ` (original ${rawQty})` : ''}`)
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo guardar el lote")
    } finally {
      setSavingBatch(false)
    }
  }

  const handleAttendance = async (status: "going" | "interested" | "not_going") => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    if (userAttendance) {
      // Si ya está apuntado, lo desapuntamos
      const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("id", userAttendance.id)

      if (error) {
        Alert.alert("Error", error.message)
      } else {
        loadEventData()
      }
    } else {
      // Si no está apuntado, lo apuntamos
      const { error } = await supabase.from("event_attendees").insert({
        event_id: eventId,
        user_id: user.id,
        status: "going",
        is_visible: true,
      })

      if (error) {
        Alert.alert("Error", error.message)
      } else {
        loadEventData()
      }
    }
  }

  // Alterna asistencia de forma idempotente y con guarda de concurrencia
  const toggleAttendanceSafely = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    if (inFlight) return
    setInFlight(true)

    // Haptics al inicio
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch {}

    // Animación de icono
    Animated.sequence([
      Animated.timing(iconScale, { toValue: 1.2, duration: 150, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, useNativeDriver: true, bounciness: 8 }),
    ]).start()

    try {
      // Comprobar estado en servidor para evitar depender de estado local
      const { data: existing, error: fetchError } = await supabase
        .from("event_attendees")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError
      }

      // Si no está inscrito, comprobar solapamiento
      if (!existing?.id && event) {
        // Obtener todos los eventos a los que el usuario está inscrito ese día
        const { data: myEvents } = await supabase
          .from("event_attendees")
          .select("event_id, events(*)")
          .eq("user_id", user.id)
          .eq("status", "going")
          .neq("event_id", eventId)
        // Filtrar por eventos en el mismo día
        const thisDate = event.event_date
        const thisStart = event.start_time
        const thisEnd = event.end_time || "23:59"
        // Convertir a minutos para comparar
        const timeToMinutes = (t: string): number => {
          const [h, m] = t.split(":").map(Number)
          return h * 60 + m
        }
        const thisStartMin = timeToMinutes(thisStart)
        const thisEndMin = timeToMinutes(thisEnd)
        let overlapping: Event | null = null
        for (const e of myEvents || []) {
          const evRaw = e.events
          // Si es array, tomar el primero; si es objeto, usarlo directamente
          const ev: Event | null = Array.isArray(evRaw) ? (evRaw[0] as Event) : (evRaw as Event)
          if (!ev) continue
          if (ev.event_date !== thisDate) continue
          const evStart = ev.start_time
          const evEnd = ev.end_time || "23:59"
          const evStartMin = timeToMinutes(evStart)
          const evEndMin = timeToMinutes(evEnd)
          // Si se solapan
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
          setInFlight(false)
          return
        }
      }

      if (existing?.id) {
        const { error: delError } = await supabase
          .from("event_attendees")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id)

        if (delError) throw delError
      } else {
        const { error: upsertError } = await supabase
          .from("event_attendees")
          .upsert(
            { event_id: eventId, user_id: user.id, status: "going", is_visible: true },
            { onConflict: "event_id,user_id" }
          )

        if (upsertError && upsertError.code !== "23505") throw upsertError
      }

      // Haptics de éxito
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } catch {}

      await loadEventData()
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo actualizar tu asistencia")
    } finally {
      setInFlight(false)
    }
  }



  // Header: Organizadores ven Avisos (megáfono) + Editar; usuarios ven menú (tres puntos)
  useEffect(() => {
    if (!event) return
    const isFuture = new Date(event.event_date) >= new Date()
    // Mostrar el lápiz SOLO si el usuario es dueño por ID del venue (no por nombre)
    const isOwner = isVenue && !!venueApplicationId && (event as any).venue_id === venueApplicationId

    const ICON_SIZE = 24

    const ownerButtons = (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => navigation.navigate("Chat", { eventId: event.id, eventTitle: event.title })}
          style={{ paddingHorizontal: 8 }}
          accessibilityLabel="Abrir avisos del evento"
        >
          <Ionicons name="megaphone-outline" size={ICON_SIZE} color={theme.colors.primary} />
        </TouchableOpacity>
        {isFuture && (
          <TouchableOpacity
            onPress={() => navigation.navigate("EditEvent", { eventId: event.id })}
            style={{ paddingHorizontal: 8, marginLeft: 10 }}
            accessibilityLabel="Editar evento"
          >
            <Ionicons name="pencil" size={ICON_SIZE} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    )

    const userMenuButton = (
      <TouchableOpacity
        onPress={() => setShowMenuModal(true)}
        style={{ paddingHorizontal: 8 }}
        accessibilityLabel="Abrir menú del evento"
      >
        <Ionicons name="ellipsis-horizontal" size={ICON_SIZE} color="#000" />
      </TouchableOpacity>
    )

    navigation.setOptions({
      headerRight: () => (isOwner ? ownerButtons : userMenuButton),
      headerTitle: "Detalles del Evento",
    })
  }, [event, theme, isVenue, venueApplicationId])

  const reasonMap: Record<string,string> = {
    spam: 'spam',
    inapropiado: 'inappropriate_content',
    falso: 'fake_profile',
    riesgo: 'violence',
  }
  const submitEventReport = async () => {
    if (!event) return
    if (!reportReason) {
      Alert.alert("Selecciona un motivo", "Elige un motivo para continuar")
      return
    }
    try {
      setSubmittingReport(true)
      const mapped = reasonMap[reportReason] || 'other'
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_type: 'event',
        reported_id: event.id,
        reason: mapped,
        description: reportDetails?.trim() || null,
      })
      if (error) throw error
      setShowReportModal(false)
      setReportReason("")
      setReportDetails("")
      Alert.alert("Gracias", "Hemos recibido tu reporte y lo revisaremos.")
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo enviar el reporte")
    } finally {
      setSubmittingReport(false)
    }
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    )
  }

  // Nota: el botón de lotes externos se muestra a cuentas de tipo "venue"

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerContainer}>
        {/* Imagen principal del evento: prioridad image_url; fallback al logo del venue; último recurso placeholder */}
        {event.image_url ? (
          <Image source={{ uri: event.image_url }} style={styles.headerImage} resizeMode="cover" />
        ) : event.venue_logo ? (
          <Image source={{ uri: event.venue_logo }} style={styles.headerImage} resizeMode="cover" />
        ) : (
          <View style={[styles.headerImage, styles.placeholderImage]}>
            <Ionicons name="musical-notes" size={80} color={theme.colors.muted} />
          </View>
        )}
        {!!event.venue_logo && (
          <View style={styles.venueLogoBadge}>
            <Image source={{ uri: event.venue_logo }} style={styles.venueLogoImage} />
          </View>
        )}
        
        {/* Botón Seguir en esquina superior derecha - Solo visible para usuarios normales */}
        {!isVenue && (
          <TouchableOpacity 
            style={[styles.followButton, isFollowingVenue && styles.followButtonActive]}
            onPress={toggleFollowVenue}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={isFollowingVenue ? "star" : "star-outline"} 
              size={18} 
              color={isFollowingVenue ? "#F59E0B" : "#FFFFFF"} 
            />
            <Text style={[styles.followButtonText, isFollowingVenue && styles.followButtonTextActive]}>
              {isFollowingVenue ? "Siguiendo" : "Seguir"}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.eventDateTimeBadge}>
          <View style={styles.dateTimeRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.dateTimeText}>
              {format(new Date(event.event_date), "EEE, dd MMM", { locale: es })}
            </Text>
          </View>
          <View style={styles.dateTimeRow}>
            <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.dateTimeText}>{event.start_time.substring(0, 5)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.venueRow}>
          <View style={styles.venueInfo}>
            <Ionicons name="location" size={16} color={theme.colors.primary} />
            <Text style={styles.venue}>{event.venue_name}</Text>
          </View>
        </View>

        {/* Eliminado infoGrid: solo se muestran nombre, venue, fecha y horas */}

        {event.description && (
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.description} numberOfLines={showFullDesc ? undefined : 3}>
              {event.description}
            </Text>
            {event.description.length > 120 && (
              <TouchableOpacity onPress={() => setShowFullDesc((v) => !v)}>
                <Text style={styles.seeMore}>{showFullDesc ? "Ver menos" : "Ver más"}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Asistencia (avatar strip) */}
        <View style={styles.attendanceSection}>
          <View style={styles.attendeesHeader}>
            <Text style={styles.sectionTitle}>
              {attendees.length + extSummary.total} {(attendees.length + extSummary.total) === 1 ? "persona va" : "personas van"}
            </Text>
            {(attendees.length + extSummary.total) > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate("Attendees", { eventId })}>
                <Text style={styles.link}>Ver todos</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {(attendees.length + extSummary.total) > 0 ? (
            <>
              <View style={styles.attendeesList}>
                {(() => {
                  // 1) Prioridad: tú -> amigos -> resto (reales)
                  const userAttendee = attendees.find(a => a.user_id === currentUserId)
                  const friendAttendees = attendees.filter(a => a.user_id !== currentUserId && friendIds.includes(a.users.id))
                  const otherAttendees = attendees.filter(a => a.user_id !== currentUserId && !friendIds.includes(a.users.id))
                  const orderedReal = [
                    ...(userAttendee ? [userAttendee] : []),
                    ...friendAttendees,
                    ...otherAttendees,
                  ]
                  const CAP = 8
                  // 2) Slots de usuarios reales limitados a capacidad
                  const realSlots = orderedReal.slice(0, CAP).map((a) => ({ type: 'user' as const, data: a }))
                  let remaining = CAP - realSlots.length
                  // 3) Añadir placeholders anónimos al final: W (web), T (taquilla), O (otros)
                  const pushAnon = (count: number, initial: 'W'|'T'|'O', keyPrefix: string) => {
                    const n = Math.min(remaining, count)
                    return Array.from({ length: n }).map((_, i) => ({ type: 'external' as const, initial, key: `${keyPrefix}-${i}` }))
                  }
                  const anonWeb = pushAnon(extSummary.web, 'W', 'web')
                  remaining -= anonWeb.length
                  const anonTaq = pushAnon(extSummary.taquilla, 'T', 'taq')
                  remaining -= anonTaq.length
                  const anonOtr = pushAnon(extSummary.otros, 'O', 'otr')
                  remaining -= anonOtr.length
                  const slots = [...realSlots, ...anonWeb, ...anonTaq, ...anonOtr]
                  const totalPeople = attendees.length + extSummary.total
                  return (
                    <>
                      {slots.map((slot, index) => {
                        const ml = index > 0 ? -12 : 0
                        const z = CAP - index
                        if (slot.type === 'user') {
                          const attendee = slot.data
                          const isFriend = friendIds.includes(attendee.users.id)
                          const isCurrentUser = attendee.user_id === currentUserId
                          return (
                            <View key={attendee.id} style={[styles.attendeeWrapper, { marginLeft: ml, zIndex: z }]}> 
                              <View style={[
                                styles.attendeeAvatar,
                                isFriend && !isCurrentUser && styles.friendRing,
                                isCurrentUser && styles.currentUserRing,
                              ]}>
                                {attendee.users.avatar_url ? (
                                  <Image source={{ uri: attendee.users.avatar_url }} style={styles.avatarImage} />
                                ) : (
                                  <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarText}>{(attendee.users.full_name || '?').charAt(0).toUpperCase()}</Text>
                                  </View>
                                )}
                              </View>
                              {isFriend && !isCurrentUser && (
                                <View style={styles.friendHeartOutside}>
                                  <Ionicons name="heart" size={12} color="#EF4444" />
                                </View>
                              )}
                              {isCurrentUser && (
                                <View style={styles.currentUserBadge}>
                                  <Ionicons name="person" size={12} color="#FFFFFF" />
                                </View>
                              )}
                            </View>
                          )
                        } else {
                          // External placeholder
                          const bg = slot.initial === 'W' ? theme.colors.primarySoft : slot.initial === 'T' ? '#FDE68A' : '#E9D5FF'
                          const fg = slot.initial === 'W' ? theme.colors.primary : slot.initial === 'T' ? '#92400E' : '#6B21A8'
                          return (
                            <View key={slot.key} style={[styles.attendeeWrapper, { marginLeft: ml, zIndex: z }]}> 
                              <View style={[styles.attendeeAvatar, { borderColor: theme.colors.background }]}> 
                                <View style={[styles.avatarPlaceholder, { backgroundColor: bg, borderColor: fg }]}> 
                                  <Text style={[styles.avatarText, { color: fg }]}>{slot.initial}</Text>
                                </View>
                              </View>
                            </View>
                          )
                        }
                      })}
                      {totalPeople > CAP && (
                        <View style={[styles.attendeeAvatar, { marginLeft: -12, zIndex: 0 }]}> 
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>+{totalPeople - CAP}</Text>
                          </View>
                        </View>
                      )}
                    </>
                  )
                })()}
              </View>
            </>
          ) : (
            (() => {
              const isOwnVenueEvent = isVenue && currentUserId && (event as any).venue_id === currentUserId
              const isVenueForeign = isVenue && !isOwnVenueEvent
              if (isOwnVenueEvent) {
                // No mostrar mensaje "Sé el primero..." para el propio local
                return null
              }
              if (isVenueForeign) {
                return <Text style={styles.noAttendeesText}>Los locales no pueden asistir a eventos</Text>
              }
              return <Text style={styles.noAttendeesText}>Sé el primero en apuntarte a este evento 🎉</Text>
            })()
          )}
        </View>

        {/* Resumen de Asistencia + botón añadir lote (según plan) */}
        <View style={styles.attSummaryCard}>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.sectionTitle}>Asistentes</Text>
            {(() => {
              const isOwner = isVenue && venueApplicationId && (event as any).venue_id === venueApplicationId
              const isPast = event && new Date(event.event_date) < new Date()
              // Si es evento finalizado del propio local, NO mostrar botón de lotes externos
              if (isOwner && isPast) return null
              if (!isOwner) return null
              const visualPlan = trialActive ? "pro" : venuePlan
              const canAddBatch = (canAddExternal ?? (visualPlan === "pro" || visualPlan === "premium"))
              if (canAddBatch) {
                return (
                  <TouchableOpacity
                    onPress={() => setShowBatchModal(true)}
                    style={styles.addBatchBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add" size={18} color={theme.colors.primary} />
                    <Text style={styles.addBatchBtnText}>Añadir lote externo</Text>
                  </TouchableOpacity>
                )
              }
              // CTA para upgrade si FREE
              return (
                <TouchableOpacity
                  onPress={() => navigation.navigate("SubscriptionPlans")}
                  style={[styles.addBatchBtn, { borderColor: theme.colors.primary, borderWidth: 1, backgroundColor: 'transparent' }]}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-up-circle" size={18} color={theme.colors.primary} />
                  <Text style={[styles.addBatchBtnText, { color: theme.colors.primary }]}>Upgrade para añadir lotes</Text>
                </TouchableOpacity>
              )
            })()}
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="phone-portrait-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.summaryLabel}>App</Text>
              <Text style={styles.summaryValue}>{attendees.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="globe-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.summaryLabel}>Web</Text>
              <Text style={styles.summaryValue}>{extSummary.web}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="pricetag-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.summaryLabel}>Taquilla</Text>
              <Text style={styles.summaryValue}>{extSummary.taquilla}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="grid-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.summaryLabel}>Otros</Text>
              <Text style={styles.summaryValue}>{extSummary.otros}</Text>
            </View>
          </View>
          <View style={[styles.summaryRow, { marginTop: 8, justifyContent: "flex-end" }]}>
            <Text style={styles.summaryTotal}>Total: {attendees.length + extSummary.total}</Text>
          </View>
        </View>

        {/* (El botón de añadir lote externo ahora está dentro de la tarjeta de asistentes) */}

        {/* FOMO Section - Swipe memorable CTA - Solo visible para usuarios normales */}
        {!isVenue && (
          <View style={styles.fomoContainer}>
            <LinearGradient
              colors={going ? ["#10B981", "#059669"] : ["#6366f1", "#8b5cf6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fomoGradient}
            >
              <View style={styles.fomoTouchable}>
              <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                <Ionicons name={going ? "checkmark-circle" : "flame"} size={40} color={going ? "#fff" : "#FFD700"} />
              </Animated.View>
              <Text style={styles.fomoTitle}>
                {going
                  ? "🔥 Ya estás dentro. Respira tranquilo."
                  : "¿Te está dando FOMO? 😏"}
              </Text>
              {!going && (
                <>
                  <Text style={styles.fomoSubtitle}>
                    {attendees.length > 0
                      ? `${attendees.length} ${attendees.length === 1 ? "persona ya se ha apuntado" : "personas ya se han apuntado"}`
                      : "¡Sé el primero en apuntarte!"}
                  </Text>
                  {/* FOMO-meter con llamas */}
                  <View style={styles.meterContainer}>
                    <View style={styles.meterHeader}>
                      <Text style={styles.meterTitle}>FOMO‑meter</Text>
                      {friendsGoing.length > 0 && (
                        <Text style={styles.meterBadge}>{friendsGoing.length} amigo{friendsGoing.length > 1 ? "s" : ""} va{friendsGoing.length > 1 ? "n" : ""}</Text>
                      )}
                    </View>
                    <View style={styles.meterTrack}>
                      <Animated.View
                        style={[
                          styles.meterFill,
                          {
                            width: meterAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.flamesContainer}>
                      {[1, 2, 3, 4, 5].map((level) => {
                        const threshold = level / 5
                        const isActive = meterAnim.interpolate({
                          inputRange: [0, threshold - 0.01, threshold],
                          outputRange: [0, 0, 1],
                          extrapolate: 'clamp'
                        })
                        return (
                          <Animated.View key={level} style={{ opacity: isActive }}>
                            <Ionicons 
                              name="flame" 
                              size={20} 
                              color={level <= 2 ? "#FCD34D" : level <= 4 ? "#FB923C" : "#EF4444"}
                            />
                          </Animated.View>
                        )
                      })}
                    </View>
                    {friendsGoing.length > 0 && (
                      <View style={styles.friendsRow}>
                        {friendsGoing.slice(0, 4).map((a) => {
                          const name = a.users.full_name || "?"
                          const initial = name.trim().slice(0, 1).toUpperCase()
                          return (
                            <View key={a.user_id} style={styles.friendAvatar}>
                              <Text style={styles.friendInitial}>{initial}</Text>
                            </View>
                          )
                        })}
                        {friendsGoing.length > 4 && (
                          <View style={[styles.friendAvatar, styles.moreFriends]}>
                            <Text style={styles.friendInitial}>+{friendsGoing.length - 4}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Botón grande táctil */}
              <Button
                variant="gradient"
                onPress={toggleAttendanceSafely}
                disabled={inFlight}
                gradientColors={going ? (["#10B981", "#059669"] as [string, string]) : undefined}
                leftIcon={<Ionicons name={going ? "close-circle" : "rocket"} size={24} color="#fff" />}
                style={{ width: "100%", marginTop: 16 }}
                textStyle={{ fontSize: 18 }}
              >
                {going ? "Cancelar asistencia" : "¡Me apunto! 🔥"}
              </Button>
            </View>
          </LinearGradient>
        </View>
        )}
      </View>
      {/* Modal Añadir lote externo */}
      {showBatchModal && (
        <View style={styles.batchOverlay}>
          <View style={styles.batchModal}>
            <View style={styles.batchHeaderRow}>
              <Text style={styles.batchTitle}>Añadir lote externo</Text>
              <TouchableOpacity onPress={() => setShowBatchModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.batchTabs}>
              {(["web","taquilla","otros"] as const).map(src => (
                <TouchableOpacity
                  key={src}
                  style={[styles.batchTab, batchSource===src && styles.batchTabActive]}
                  onPress={()=>setBatchSource(src)}
                >
                  <Text style={[styles.batchTabText, batchSource===src && styles.batchTabTextActive]}>
                    {src === 'web' ? 'Web' : src === 'taquilla' ? 'Taquilla' : 'Otros'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.batchField}>
              <Text style={styles.batchLabel}>Cantidad vendida</Text>
              <TextInput
                style={styles.batchInput}
                placeholder="Ej: 120"
                placeholderTextColor={theme.colors.muted}
                keyboardType="number-pad"
                value={batchQty}
                onChangeText={setBatchQty}
              />
            </View>
            
            <View style={styles.batchField}>
              <Text style={styles.batchLabel}>Notas (opcional)</Text>
              <TextInput
                style={[styles.batchInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Detalle o referencia"
                placeholderTextColor={theme.colors.muted}
                multiline
                value={batchNotes}
                onChangeText={setBatchNotes}
              />
            </View>

            <View style={styles.batchField}>
              <Text style={styles.batchLabel}>Lista emails/nombres (recomendado)</Text>
              <Text style={styles.batchHint}>
                Para evitar duplicados. Emails son más precisos.
              </Text>
              <TextInput
                style={[styles.batchInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder={"user@email.com\nJuan García\n..."}
                placeholderTextColor={theme.colors.muted}
                multiline
                value={namesText}
                onChangeText={(t)=>{ setNamesText(t); setAnalysis(null) }}
              />
              {(() => {
                const visualPlan = trialActive ? "pro" : venuePlan
                const hasDedup = (canDedup ?? (visualPlan === "premium"))
                if (!hasDedup) {
                  return (
                    <Text style={[styles.batchHint, { marginTop: 8 }]}>
                      La deduplicación automática es exclusiva del plan PREMIUM.
                    </Text>
                  )
                }
                return (
                  <>
                    <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
                      <TouchableOpacity 
                        style={[styles.batchSmallBtn, uploadingFile && { opacity:0.5 }]} 
                        onPress={pickNamesFile} 
                        disabled={uploadingFile}
                      >
                        <Ionicons name="document-text" size={16} color={theme.colors.primary} />
                        <Text style={styles.batchSmallBtnText}>{uploadingFile ? 'Cargando...' : 'Subir archivo'}</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.batchSmallBtn, (!namesText.trim() || analyzing) && { opacity:0.5 }]} 
                        onPress={analyzeNamesList} 
                        disabled={analyzing || !namesText.trim()}
                      >
                        <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
                        <Text style={styles.batchSmallBtnText}>{analyzing ? 'Analizando...' : 'Analizar'}</Text>
                      </TouchableOpacity>
                    </View>
                    {analysis && (
                      <View style={styles.analysisResult}>
                        <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                        <Text style={styles.analysisText}>
                          Total: {analysis.raw} · Ya en app: {analysis.matched} · Nuevos: {analysis.newCount}
                        </Text>
                      </View>
                    )}
                  </>
                )
              })()}
            </View>

            <View style={styles.batchField}>
              <Text style={styles.batchLabel}>Comprobante (obligatorio)</Text>
              {batchImageUri ? (
                <View style={{ gap: 8 }}>
                  <Image source={{ uri: batchImageUri }} style={styles.batchImagePreview} />
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <TouchableOpacity style={styles.batchSmallBtn} onPress={()=>setBatchImageUri(null)}>
                      <Ionicons name="trash" size={16} color="#EF4444" />
                      <Text style={[styles.batchSmallBtnText, { color:'#EF4444' }]}>Quitar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.batchSmallBtn} onPress={async()=>{ const uri = await pickBatchImage(); if(uri) setBatchImageUri(uri) }}>
                      <Ionicons name="images" size={16} color={theme.colors.primary} />
                      <Text style={styles.batchSmallBtnText}>Cambiar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.batchSelectBtn} onPress={async()=>{ const uri = await pickBatchImage(); if(uri) setBatchImageUri(uri) }}>
                  <Ionicons name="images" size={18} color={theme.colors.text} />
                  <Text style={styles.batchSelectText}>Seleccionar imagen</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity
              style={[styles.batchSubmitBtn, (savingBatch) && { opacity:0.6 }]}
              disabled={savingBatch}
              onPress={saveExternalBatch}
            >
              <Ionicons name="save" size={18} color="#fff" />
              <Text style={styles.batchSubmitText}>{savingBatch ? 'Guardando...' : 'Guardar lote'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* Menú (usuarios) estilo UserProfileScreen (bottom sheet) */}
      <Modal visible={showMenuModal} transparent animationType="slide" onRequestClose={() => setShowMenuModal(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenuModal(false)}>
          <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Opciones</Text>
              <TouchableOpacity onPress={() => setShowMenuModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenuModal(false)
                navigation.navigate("Chat", { eventId: event.id, eventTitle: event.title })
              }}
            >
              <Ionicons name="megaphone-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.menuItemText, { color: theme.colors.text }]}>Ver avisos del organizador</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenuModal(false)
                setShowReportModal(true)
              }}
            >
              <Ionicons name="flag-outline" size={24} color="#F59E0B" />
              <Text style={[styles.menuItemText, { color: "#F59E0B" }]}>Reportar evento</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reporte de evento - estilo UserProfileScreen */}
      <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
        <TouchableOpacity style={styles.reportOverlay} activeOpacity={1} onPress={() => setShowReportModal(false)}>
          <View style={styles.reportContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.reportHeader}>
              <Ionicons name="flag" size={28} color="#F59E0B" />
              <Text style={styles.reportTitle}>Reportar evento</Text>
              <Text style={styles.reportSubtitle}>Selecciona un motivo</Text>
            </View>

            {[
              { key: "spam", label: "Spam / fraude", icon: "alert-circle-outline" as const },
              { key: "inapropiado", label: "Contenido inapropiado", icon: "hand-left-outline" as const },
              { key: "falso", label: "Evento falso / duplicado", icon: "copy-outline" as const },
              { key: "riesgo", label: "Riesgo o seguridad", icon: "warning-outline" as const },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.reportOption}
                onPress={() => setReportReason(opt.key)}
              >
                <Ionicons name={opt.icon} size={22} color={reportReason === opt.key ? theme.colors.primary : theme.colors.muted} />
                <Text style={styles.reportOptionText}>{opt.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            ))}

            <View style={{ paddingHorizontal: 20 }}>
              <Text style={[styles.reportSubtitle, { marginTop: 8 }]}>Detalles (opcional)</Text>
              <TextInput
                style={styles.reportInput}
                placeholder="Explica brevemente el problema"
                placeholderTextColor={theme.colors.muted}
                value={reportDetails}
                onChangeText={setReportDetails}
                multiline
                maxLength={600}
              />
              <TouchableOpacity
                style={[styles.reportSubmitBtn, (!reportReason || submittingReport) && { opacity: 0.6 }]}
                disabled={!reportReason || submittingReport}
                onPress={submitEventReport}
              >
                <Ionicons name={submittingReport ? "hourglass-outline" : "flag"} size={18} color="#fff" />
                <Text style={styles.reportSubmitText}>{submittingReport ? "Enviando..." : "Enviar reporte"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportCancelButton} onPress={() => setShowReportModal(false)}>
                <Text style={styles.reportCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  )
}

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
  headerContainer: {
    position: "relative",
  },
  headerImage: {
    width: "100%",
    height: 200,
  },
  placeholderImage: {
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  venueLogoBadge: {
    position: "absolute",
    bottom: -40,
    left: 20,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  venueLogoImage: { width: 88, height: 88, borderRadius: 44 },
  followButton: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  followButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderColor: "#F59E0B",
  },
  followButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  followButtonTextActive: {
    color: "#F59E0B",
  },
  eventDateTimeBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    ...theme.shadow,
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateTimeText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  content: {
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 8,
  },
  venueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  venueInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  venue: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  followVenueButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  followingVenueButton: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  followVenueText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: "600",
  },
  followingVenueText: {
    color: theme.colors.primary,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    width: "48%",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  infoLabel: { color: theme.colors.muted, fontSize: 12 },
  infoValue: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  descriptionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: theme.colors.muted,
    lineHeight: 24,
  },
  seeMore: { color: theme.colors.primary, marginTop: 8, fontWeight: "600" },
  attendanceSection: {
    marginBottom: 24,
  },
  attSummaryCard: {
    marginBottom: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  summaryLabel: { color: theme.colors.muted, fontSize: 12 },
  summaryValue: { color: theme.colors.text, fontWeight: "800" },
  summaryTotal: { color: theme.colors.text, fontWeight: "900" },
  addBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addBatchBtnText: { color: theme.colors.primary, fontWeight: '800', fontSize: 12 },
  externalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  externalBtnText: { color: theme.colors.text, fontWeight: "700" },
  batchOverlay: {
    position:'absolute',
    top:0,left:0,right:0,bottom:0,
    backgroundColor:'rgba(0,0,0,0.4)',
    justifyContent:'center',
    alignItems:'center',
    zIndex: 9999,
  },
  batchModal:{
    width:'90%',
    maxHeight: '85%',
    backgroundColor: theme.colors.background,
    borderRadius:16,
    padding:16,
    borderWidth:1,
    borderColor: theme.colors.border,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  batchHeaderRow:{
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center',
    marginBottom:12
  },
  batchTitle:{ fontSize:18, fontWeight:'700', color: theme.colors.text },
  batchTabs:{ flexDirection:'row', marginBottom:12, gap:8 },
  batchTab:{ flex:1, paddingVertical:10, borderRadius:10, borderWidth:1, borderColor: theme.colors.border, alignItems:'center', justifyContent:'center', backgroundColor: theme.colors.card },
  batchTabActive:{ borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  batchTabText:{ fontSize:13, fontWeight:'600', color: theme.colors.text },
  batchTabTextActive:{ color: theme.colors.primary },
  batchField:{ marginBottom:14 },
  batchLabel:{ fontSize:13, fontWeight:'600', color: theme.colors.text, marginBottom:6 },
  batchHint: { fontSize:12, color: theme.colors.muted, marginBottom:6 },
  batchInput:{ backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border, borderRadius:10, padding:10, color: theme.colors.text },
  batchSelectBtn:{ flexDirection:'row', alignItems:'center', gap:8, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border, borderRadius:12, paddingVertical:12, justifyContent:'center' },
  batchSelectText:{ color: theme.colors.text, fontWeight:'700' },
  batchImagePreview:{ width:'100%', height:140, borderRadius:12, backgroundColor: theme.colors.border },
  batchSmallBtn:{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border, borderRadius:10, paddingVertical:10 },
  batchSmallBtnText:{ color: theme.colors.primary, fontWeight:'700', fontSize:12 },
  analysisResult:{ flexDirection:'row', alignItems:'center', gap:8, backgroundColor: theme.colors.primarySoft, borderWidth:1, borderColor: theme.colors.primary, borderRadius:10, padding:10, marginTop:8 },
  analysisText:{ color: theme.colors.text, fontSize:12, flex:1 },
  batchSubmitBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor: theme.colors.primary, borderRadius:12, paddingVertical:14, marginTop:4 },
  batchSubmitText:{ color:'#fff', fontWeight:'800' },
  // Overlay y estilos copiados del UserProfileScreen
  menuOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  menuContainer: { backgroundColor: theme.colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34 },
  menuHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:20, borderBottomWidth:1, borderBottomColor: theme.colors.border },
  menuTitle: { fontSize:20, fontWeight:'bold', color: theme.colors.text },
  menuItem: { flexDirection:'row', alignItems:'center', gap:16, paddingVertical:16, paddingHorizontal:20, borderBottomWidth:1, borderBottomColor: theme.colors.border },
  menuItemText: { fontSize:16, fontWeight:'500' },
  // Report modal: igual que UserProfileScreen
  reportOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center', padding:20 },
  reportContainer: { backgroundColor: theme.colors.card, borderRadius:20, width:'100%', maxWidth:400, overflow:'hidden' },
  reportHeader: { alignItems:'center', padding:24, backgroundColor: theme.colors.background, borderBottomWidth:1, borderBottomColor: theme.colors.border },
  reportTitle: { fontSize:20, fontWeight:'bold', color: theme.colors.text, marginTop:12, marginBottom:8 },
  reportSubtitle: { fontSize:14, color: theme.colors.muted, textAlign:'center' },
  reportOption: { flexDirection:'row', alignItems:'center', gap:16, paddingVertical:16, paddingHorizontal:20, borderBottomWidth:1, borderBottomColor: theme.colors.border },
  reportOptionText: { flex:1, fontSize:16, fontWeight:'500', color: theme.colors.text },
  reportInput: { marginTop:8, minHeight:80, backgroundColor: theme.colors.card, borderWidth:1, borderColor: theme.colors.border, borderRadius:10, padding:10, color: theme.colors.text, textAlignVertical:'top' },
  reportSubmitBtn: { marginTop:12, backgroundColor: theme.colors.primary, paddingVertical:12, borderRadius:12, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  reportSubmitText: { color:'#fff', fontWeight:'800' },
  reportCancelButton: { padding: 18, alignItems:'center', backgroundColor: theme.colors.background, marginTop:8 },
  reportCancelText: { fontSize:16, fontWeight:'600', color: theme.colors.primary },
  attendeesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  attendeesList: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  attendeeWrapper: {
    width: 48,
    height: 48,
    position: "relative",
  },
  attendeeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: theme.colors.background,
  },
  friendRing: {
    borderWidth: 4,
    borderColor: "#EF4444",
  },
  currentUserRing: {
    borderWidth: 4,
    borderColor: "#8B5CF6",
  },
  currentUserBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#8B5CF6",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  avatarImage: {
    width: 48,
    height: 48,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  friendHeartOutside: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#EF4444",
    zIndex: 10,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: "600",
  },
  youBadge: {
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  youBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  noAttendeesText: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 20,
  },
  fomoContainer: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: "hidden",
    ...theme.shadow,
    shadowColor: "#6366f1",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  fomoGradient: {
    borderRadius: 24,
  },
  fomoTouchable: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
  },
  fomoTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.3,
    marginTop: 4,
  },
  fomoSubtitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
  // Meter
  meterContainer: {
    width: "100%",
    marginTop: 16,
    gap: 8,
  },
  meterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  meterTitle: {
    color: "#fff",
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  meterBadge: {
    color: "#111827",
    backgroundColor: "#FCD34D",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "900",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  meterTrack: {
    height: 10,
    width: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  meterFill: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  flamesContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  friendsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  friendAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  moreFriends: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderColor: "rgba(255,255,255,0.35)",
  },
  friendInitial: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  fomoAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  fomoActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  // Botón grande táctil
  fomoButton: {
    width: "100%",
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    ...theme.shadow,
    shadowColor: "#000",
    shadowOpacity: 0.2,
  },
  fomoButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  link: { color: theme.colors.primary, fontWeight: "600" },
  })
}
