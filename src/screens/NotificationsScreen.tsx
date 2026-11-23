"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from "react-native"
import { supabase } from "../lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { useFocusEffect } from "@react-navigation/native"
import React from "react"

type NotificationSettings = {
  notif_friend_requests: boolean
  notif_friend_accepted: boolean
  notif_friend_event: boolean
  notif_venue_new_event: boolean
  notif_venue_reminder: boolean
  notif_event_chat: boolean
  notif_event_reminder: boolean
}

export default function NotificationsScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [settings, setSettings] = useState<NotificationSettings>({
    notif_friend_requests: false,
    notif_friend_accepted: false,
    notif_friend_event: false,
    notif_venue_new_event: false,
    notif_venue_reminder: false,
    notif_event_chat: false,
    notif_event_reminder: false,
  })
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    React.useCallback(() => {
      loadSettings()
    }, [])
  )

  const loadSettings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setUserId(user.id)

    // Cargar configuración actual
    const { data, error } = await supabase
      .from("user_settings")
      .select("notif_friend_requests, notif_friend_accepted, notif_friend_event, notif_venue_new_event, notif_venue_reminder, notif_event_chat, notif_event_reminder")
      .eq("user_id", user.id)
      .single()

    if (error && error.code !== "PGRST116") {
      console.error("Error cargando settings:", error)
    }

    if (data) {
      setSettings({
        notif_friend_requests: data.notif_friend_requests ?? false,
        notif_friend_accepted: data.notif_friend_accepted ?? false,
        notif_friend_event: data.notif_friend_event ?? false,
        notif_venue_new_event: data.notif_venue_new_event ?? false,
        notif_venue_reminder: data.notif_venue_reminder ?? false,
        notif_event_chat: data.notif_event_chat ?? false,
        notif_event_reminder: data.notif_event_reminder ?? false,
      })
    }

    setLoading(false)
  }

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    if (!userId) return

    // Actualizar localmente de inmediato para UX fluida
    setSettings((prev) => ({ ...prev, [key]: value }))

    // Actualizar en base de datos
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, [key]: value }, { onConflict: "user_id" })

    if (error) {
      console.error("Error guardando setting:", error)
      Alert.alert("Error", "No se pudo guardar la configuración")
      // Revertir cambio local
      setSettings((prev) => ({ ...prev, [key]: !value }))
    }
  }

  const testNotification = async () => {
    try {
      const { sendTestPushToSelf, registerForPushNotifications } = await import("../lib/notifications")
      // Asegura token registrado
      await registerForPushNotifications()
      const res = await sendTestPushToSelf("🔔 FOMO", "Esta es una notificación de prueba")
      if (res.ok) {
        Alert.alert("✓ Enviada", "Revisa tu dispositivo, debería llegarte en segundos.")
      } else {
        Alert.alert("No se pudo enviar", `${res.error || "Intenta de nuevo en unos segundos"}`)
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo enviar la notificación")
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando configuración...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="notifications" size={48} color={theme.colors.primary} />
        <Text style={styles.headerTitle}>Notificaciones Push</Text>
        <Text style={styles.headerSubtitle}>
          Elige qué notificaciones quieres recibir en tu móvil
        </Text>
        <TouchableOpacity
          style={styles.activateButton}
          onPress={async () => {
            const { registerForPushNotifications } = await import("../lib/notifications")
            const token = await registerForPushNotifications()
            if (token) Alert.alert("✓ Listo", "Notificaciones push activadas en este dispositivo")
          }}
        >
          <Ionicons name="notifications-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.activateButtonText}>Activar en este dispositivo</Text>
        </TouchableOpacity>
      </View>

      {/* SOCIALES */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={20} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Sociales</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Solicitudes de amistad</Text>
            <Text style={styles.settingDescription}>Te avisa cuando alguien te envía solicitud</Text>
          </View>
          <Switch
            value={settings.notif_friend_requests}
            onValueChange={(val) => updateSetting("notif_friend_requests", val)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + "50" }}
            thumbColor={settings.notif_friend_requests ? theme.colors.primary : theme.colors.muted}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Solicitud aceptada</Text>
            <Text style={styles.settingDescription}>Te avisa cuando aceptan tu solicitud</Text>
          </View>
          <Switch
            value={settings.notif_friend_accepted}
            onValueChange={(val) => updateSetting("notif_friend_accepted", val)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + "50" }}
            thumbColor={settings.notif_friend_accepted ? theme.colors.primary : theme.colors.muted}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Amigo se apunta a evento</Text>
            <Text style={styles.settingDescription}>Te avisa cuando un amigo va a un evento</Text>
          </View>
          <Switch
            value={settings.notif_friend_event}
            onValueChange={(val) => updateSetting("notif_friend_event", val)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + "50" }}
            thumbColor={settings.notif_friend_event ? theme.colors.primary : theme.colors.muted}
          />
        </View>
      </View>

      {/* LOCALES FAVORITOS */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="star" size={20} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Locales Favoritos</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Nuevos eventos publicados</Text>
            <Text style={styles.settingDescription}>Te avisa cuando tu local favorito publica evento</Text>
          </View>
          <Switch
            value={settings.notif_venue_new_event}
            onValueChange={(val) => updateSetting("notif_venue_new_event", val)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + "50" }}
            thumbColor={settings.notif_venue_new_event ? theme.colors.primary : theme.colors.muted}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Recordatorios de eventos</Text>
            <Text style={styles.settingDescription}>Recordatorio 24h antes de evento en local favorito</Text>
          </View>
          <Switch
            value={settings.notif_venue_reminder}
            onValueChange={(val) => updateSetting("notif_venue_reminder", val)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + "50" }}
            thumbColor={settings.notif_venue_reminder ? theme.colors.primary : theme.colors.muted}
          />
        </View>
      </View>

      {/* EVENTOS */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar" size={20} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Eventos</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Nuevos mensajes en chat</Text>
            <Text style={styles.settingDescription}>Te avisa de mensajes en chats de tus eventos</Text>
          </View>
          <Switch
            value={settings.notif_event_chat}
            onValueChange={(val) => updateSetting("notif_event_chat", val)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + "50" }}
            thumbColor={settings.notif_event_chat ? theme.colors.primary : theme.colors.muted}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Recordatorio 24h antes</Text>
            <Text style={styles.settingDescription}>Te recuerda tus eventos con 24h de antelación</Text>
          </View>
          <Switch
            value={settings.notif_event_reminder}
            onValueChange={(val) => updateSetting("notif_event_reminder", val)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary + "50" }}
            thumbColor={settings.notif_event_reminder ? theme.colors.primary : theme.colors.muted}
          />
        </View>
      </View>

      {/* Botón de prueba */}
      <View style={styles.testSection}>
        <TouchableOpacity style={styles.testButton} onPress={testNotification}>
          <Ionicons name="notifications-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.testButtonText}>Probar notificación</Text>
        </TouchableOpacity>
        <Text style={styles.testNote}>
          💡 Usa el botón de arriba para enviar una notificación remota de prueba a este dispositivo.
        </Text>
      </View>
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
    header: {
      alignItems: "center",
      paddingVertical: 32,
      paddingHorizontal: 20,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.text,
      marginTop: 12,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      marginTop: 8,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 20,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    settingInfo: {
      flex: 1,
      marginRight: 16,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
    },
    testSection: {
      marginTop: 32,
      marginBottom: 40,
      paddingHorizontal: 20,
      alignItems: "center",
    },
    activateButton: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    activateButtonText: {
      color: theme.colors.primary,
      fontWeight: "700",
    },
    testButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 24,
    },
    testButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    testNote: {
      fontSize: 13,
      color: theme.colors.muted,
      textAlign: "center",
      marginTop: 16,
      lineHeight: 18,
    },
  })
}
