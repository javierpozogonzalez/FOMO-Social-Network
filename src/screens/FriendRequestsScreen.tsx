"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ScrollView } from "react-native"
import { supabase } from "../lib/supabase"
import type { Friendship, User } from "../types/database.types"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { useFocusEffect } from "@react-navigation/native"
import React from "react"

type FriendshipWithUser = Friendship & { users: User }

export default function FriendRequestsScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [receivedRequests, setReceivedRequests] = useState<FriendshipWithUser[]>([])
  const [sentRequests, setSentRequests] = useState<FriendshipWithUser[]>([])
  const [loading, setLoading] = useState(false)

  useFocusEffect(
    React.useCallback(() => {
      loadRequests()
    }, [])
  )

  const loadRequests = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Solicitudes recibidas (otros me enviaron)
    const { data: received } = await supabase
      .from("friendships")
      .select("*, users!friendships_user_id_fkey(*)")
      .eq("friend_id", user.id)
      .eq("status", "pending")

    // Solicitudes enviadas (yo envié)
    const { data: sent } = await supabase
      .from("friendships")
      .select("*, users!friendships_friend_id_fkey(*)")
      .eq("user_id", user.id)
      .eq("status", "pending")

    setReceivedRequests(received || [])
    setSentRequests(sent || [])
  }

  const handleAccept = async (requestId: string, userId: string) => {
    setLoading(true)
    // Actualizar localmente primero para feedback inmediato
    setReceivedRequests((prev) => prev.filter((r) => r.id !== requestId))

    // Usar la función SECURITY DEFINER para aceptar la solicitud
    const { error } = await supabase.rpc('accept_friendship_request', {
      request_id: requestId,
      sender_id: userId
    })

    if (error) {
      Alert.alert("Error", "No se pudo aceptar la solicitud")
      console.error('Error aceptando amistad:', error)
      setLoading(false)
      loadRequests() // Recargar en caso de error
      return
    }

    setLoading(false)
  }

  const handleReject = async (requestId: string) => {
    setLoading(true)
    // Actualizar localmente primero para feedback inmediato
    setReceivedRequests((prev) => prev.filter((r) => r.id !== requestId))

    const { error } = await supabase.from("friendships").delete().eq("id", requestId)
    if (error) {
      Alert.alert("Error", error.message)
      loadRequests() // Recargar en caso de error
    }
    setLoading(false)
  }

  const handleCancelSent = async (requestId: string) => {
    setLoading(true)
    // Actualizar localmente primero para feedback inmediato
    setSentRequests((prev) => prev.filter((r) => r.id !== requestId))

    const { error } = await supabase.from("friendships").delete().eq("id", requestId)
    if (error) {
      Alert.alert("Error", error.message)
      loadRequests() // Recargar en caso de error
    }
    setLoading(false)
  }

  const renderReceivedItem = ({ item }: { item: FriendshipWithUser }) => (
    <View style={[styles.row, theme.shadow]}>
      {item.users.avatar_url ? (
        <Image source={{ uri: item.users.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{item.users.full_name?.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{item.users.full_name}</Text>
        <Text style={styles.subtext}>Te ha enviado una solicitud</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAccept(item.id, item.user_id)}
          disabled={loading}
        >
          <Ionicons name="checkmark" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReject(item.id)}
          disabled={loading}
        >
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderSentItem = ({ item }: { item: FriendshipWithUser }) => (
    <View style={[styles.row, theme.shadow]}>
      {item.users.avatar_url ? (
        <Image source={{ uri: item.users.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{item.users.full_name?.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{item.users.full_name}</Text>
        <View style={styles.pendingRow}>
          <Ionicons name="time-outline" size={16} color={theme.colors.muted} style={{ marginRight: 4 }} />
          <Text style={styles.pendingText}>Pendiente</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.actionButton, styles.rejectButton]}
        onPress={() => handleCancelSent(item.id)}
        disabled={loading}
      >
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 16 }}>
      <Text style={styles.sectionTitle}>Recibidas ({receivedRequests.length})</Text>
      {receivedRequests.length > 0 ? (
        <>
          {receivedRequests.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.listContent}>
              {renderReceivedItem({ item })}
            </View>
          ))}
          {receivedRequests.length > 3 && (
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={() => navigation.navigate("AllRequests", {
                requests: receivedRequests,
                type: "received",
                onAccept: handleAccept,
                onReject: handleReject,
                onCancel: handleCancelSent,
              })}
            >
              <Text style={styles.seeAllText}>Ver recibidas</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View style={styles.emptySection}>
          <Ionicons name="mail-outline" size={40} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No tienes solicitudes recibidas</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Enviadas ({sentRequests.length})</Text>
      {sentRequests.length > 0 ? (
        <>
          {sentRequests.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.listContent}>
              {renderSentItem({ item })}
            </View>
          ))}
          {sentRequests.length > 3 && (
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={() => navigation.navigate("AllRequests", {
                requests: sentRequests,
                type: "sent",
                onAccept: handleAccept,
                onReject: handleReject,
                onCancel: handleCancelSent,
              })}
            >
              <Text style={styles.seeAllText}>Ver enviadas</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View style={styles.emptySection}>
          <Ionicons name="send-outline" size={40} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No has enviado solicitudes</Text>
        </View>
      )}
    </ScrollView>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
  seeAllButton: {
    alignSelf: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  seeAllText: {
    color: theme.colors.primary,
    fontWeight: "600",
    fontSize: 15,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  pendingText: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  container: { flex: 1, backgroundColor: theme.colors.background, padding: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 12,
    marginBottom: 12,
  },
  listContent: { paddingBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarPlaceholder: {
    backgroundColor: theme.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  avatarInitial: { color: theme.colors.primary, fontWeight: "700", fontSize: 18 },
  info: { flex: 1 },
  name: { color: theme.colors.text, fontWeight: "600", fontSize: 16, marginBottom: 4 },
  subtext: { color: theme.colors.muted, fontSize: 12 },
  actions: { flexDirection: "row", gap: 8 },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButton: { backgroundColor: theme.colors.success },
  rejectButton: { backgroundColor: theme.colors.danger },
  cancelButton: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  cancelText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  emptySection: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: { color: theme.colors.muted, marginTop: 8, fontSize: 14 },
  })
}
