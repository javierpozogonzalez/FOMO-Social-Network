import { useEffect, useState } from "react"
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native"
import { supabase } from "../lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { useFocusEffect } from "@react-navigation/native"
import React from "react"

export default function VenueEventsScreen({ route, navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const { venueName, city } = route.params
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: venueName,
      headerStyle: { backgroundColor: theme.colors.background },
      headerShadowVisible: false,
      headerTintColor: theme.colors.text,
    })
  }, [venueName, theme])

  const loadEvents = async () => {
    const today = new Date().toISOString().split("T")[0]
    const { data } = await supabase
      .from("events")
      .select("id, title, event_date, start_time, venue_name, city")
      .eq("venue_name", venueName)
      .eq("city", city)
      .gte("event_date", today)
      .order("event_date", { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadEvents()
  }, [venueName, city])

  // Refrescar al volver a la pantalla (por si hay nuevos eventos publicados)
  useFocusEffect(
    React.useCallback(() => {
      loadEvents()
    }, [venueName, city])
  )

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.eventItem}
      onPress={() => navigation.push("EventDetail", { eventId: item.id })}
    >
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
        <Text style={styles.dateText}>{new Date(item.event_date).toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.row}>
        <Ionicons name="time-outline" size={16} color={theme.colors.muted} />
        <Text style={styles.timeText}>{item.start_time}</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      {loading ? (
        <Text style={styles.loading}>Cargando…</Text>
      ) : events.length === 0 ? (
        <Text style={styles.empty}>No hay eventos futuros publicados en {venueName}</Text>
      ) : (
        <FlatList data={events} keyExtractor={(e) => e.id} renderItem={renderItem} contentContainerStyle={{ padding: 16, gap: 12 }} />
      )}
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    loading: { color: theme.colors.muted, textAlign: "center", marginTop: 24 },
    empty: { color: theme.colors.muted, textAlign: "center", marginTop: 24 },
    eventItem: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 6,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 6 },
    dateText: { color: theme.colors.text, fontWeight: "600" },
    title: { color: theme.colors.text, fontWeight: "800", fontSize: 16 },
    timeText: { color: theme.colors.muted },
  })
}
