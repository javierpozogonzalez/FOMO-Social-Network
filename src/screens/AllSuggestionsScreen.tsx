"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator, Modal } from "react-native"
import { supabase } from "../lib/supabase"
import type { User } from "../types/database.types"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { useFocusEffect } from "@react-navigation/native"
import React from "react"

type FriendSuggestion = { id: string; full_name: string; avatar_url: string | null; city: string | null; mutual_count: number }

export default function AllSuggestionsScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)
  const [pendingRequestsMap, setPendingRequestsMap] = useState<Record<string, string>>({})
  const [incomingRequestsMap, setIncomingRequestsMap] = useState<Record<string, string>>({})
  const [showMutualsModal, setShowMutualsModal] = useState(false)
  const [selectedMutuals, setSelectedMutuals] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    React.useCallback(() => {
      loadData()
    }, [])
  )

  const loadData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    // Cargar sugerencias
    const { data: suggestionsData } = await supabase.rpc('get_friend_suggestions', {
      p_user: user.id,
      limit_param: 50,
    })
    setSuggestions((suggestionsData as FriendSuggestion[]) || [])

    // Cargar solicitudes pendientes enviadas
    const { data: pending } = await supabase
      .from("friendships")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")

    const pendingMap: Record<string, string> = {}
    ;(pending || []).forEach((p: any) => {
      pendingMap[p.friend_id] = p.id
    })
    setPendingRequestsMap(pendingMap)

    // Cargar solicitudes entrantes
    const { data: incoming } = await supabase
      .from("friendships")
      .select("id,user_id")
      .eq("friend_id", user.id)
      .eq("status", "pending")
    const incomingMap: Record<string, string> = {}
    ;(incoming || []).forEach((r: any) => {
      incomingMap[r.user_id] = r.id
    })
    setIncomingRequestsMap(incomingMap)

    setLoading(false)
  }

  const sendFriendRequest = async (friendId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSendingRequest(friendId)

    const { error } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_id: friendId,
      status: "pending",
    })

    if (error) {
      Alert.alert("Error", error.message)
    } else {
      Alert.alert("Éxito", "Solicitud de amistad enviada")
      loadData()
    }

    setSendingRequest(null)
  }

  const handleCancelRequest = async (friendshipId: string) => {
    setSendingRequest(friendshipId)
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId)
    if (error) {
      Alert.alert("Error", error.message)
    } else {
      loadData()
    }
    setSendingRequest(null)
  }

  const handleAcceptIncoming = async (requestId: string, otherUserId: string) => {
    setSendingRequest(requestId)
    
    // Usar la función SECURITY DEFINER para aceptar la solicitud
    const { error } = await supabase.rpc('accept_friendship_request', {
      request_id: requestId,
      sender_id: otherUserId
    })
    
    if (error) {
      Alert.alert("Error", "No se pudo aceptar la solicitud")
      console.error('Error aceptando amistad:', error)
    }
    
    setSendingRequest(null)
    loadData()
  }

  const handleRejectIncoming = async (requestId: string) => {
    setSendingRequest(requestId)
    const { error } = await supabase.from("friendships").delete().eq("id", requestId)
    if (error) {
      Alert.alert("Error", error.message)
    }
    setSendingRequest(null)
    loadData()
  }

  const renderSuggestion = ({ item }: { item: FriendSuggestion }) => {
    const isPending = !!pendingRequestsMap[item.id]
    const pendingId = pendingRequestsMap[item.id]
    const incomingId = incomingRequestsMap[item.id]

    return (
      <View style={[styles.card, theme.shadow]}>
        <View style={styles.avatar}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.full_name}</Text>
          {item.city && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={theme.colors.muted} />
              <Text style={styles.city}>{item.city}</Text>
            </View>
          )}
          {item.mutual_count > 0 && (
            <TouchableOpacity
              style={styles.mutualBadge}
              onPress={async () => {
                const { data: mutuals } = await supabase.rpc('get_mutual_friends', {
                  user_a: currentUserId,
                  user_b: item.id,
                  limit_param: 25,
                })
                setSelectedMutuals((mutuals as User[]) || [])
                setShowMutualsModal(true)
              }}
            >
              <Ionicons name="people" size={12} color={theme.colors.primary} />
              <Text style={styles.mutualText}>
                {item.mutual_count === 1 ? `1 amigo en común` : `${item.mutual_count} amigos en común`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {incomingId ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={[styles.actionButtonSm, styles.acceptButton]}
              onPress={() => handleAcceptIncoming(incomingId, item.id)}
              disabled={sendingRequest === incomingId}
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonSm, styles.rejectButton]}
              onPress={() => handleRejectIncoming(incomingId)}
              disabled={sendingRequest === incomingId}
            >
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : isPending ? (
          <TouchableOpacity
            style={styles.pendingBadge}
            onPress={() => handleCancelRequest(pendingId)}
            disabled={sendingRequest === pendingId}
          >
            {sendingRequest === pendingId ? (
              <ActivityIndicator size="small" color={theme.colors.muted} />
            ) : (
              <>
                <Ionicons name="time-outline" size={14} color={theme.colors.muted} />
                <Text style={styles.pendingText}>Pendiente</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => sendFriendRequest(item.id)}
            disabled={sendingRequest === item.id}
          >
            {sendingRequest === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="person-add" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={suggestions}
        renderItem={renderSuggestion}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={theme.colors.muted} />
            <Text style={styles.emptyText}>No hay sugerencias disponibles</Text>
            <Text style={styles.emptySubtext}>Agrega más amigos para obtener sugerencias</Text>
          </View>
        }
      />

      {/* Modal de amigos en común */}
      <Modal visible={showMutualsModal} transparent animationType="fade" onRequestClose={() => setShowMutualsModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMutualsModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Amigos en común ({selectedMutuals.length})</Text>
              <TouchableOpacity onPress={() => setShowMutualsModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={selectedMutuals}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.mutualItem}
                  onPress={() => {
                    setShowMutualsModal(false)
                    navigation.navigate("UserProfile", { userId: item.id })
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
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    centered: { justifyContent: "center", alignItems: "center" },
    listContent: { padding: 16 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12, overflow: "hidden" },
    avatarImage: { width: 56, height: 56, borderRadius: 28 },
    avatarPlaceholder: {
      width: 56,
      height: 56,
      backgroundColor: theme.colors.primarySoft,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: 28,
    },
    avatarText: { color: theme.colors.primary, fontSize: 24, fontWeight: "600" },
    info: { flex: 1 },
    name: { fontSize: 18, fontWeight: "600", color: theme.colors.text, marginBottom: 4 },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
    city: { fontSize: 14, color: theme.colors.muted },
    mutualBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginTop: 4,
      alignSelf: "flex-start",
    },
    mutualText: {
      fontSize: 11,
      color: theme.colors.primary,
      fontWeight: "600",
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
      elevation: 2,
    },
    pendingBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    pendingText: { color: theme.colors.muted, fontSize: 12, fontWeight: "600" },
    actionButtonSm: { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center" },
    acceptButton: { backgroundColor: theme.colors.success },
    rejectButton: { backgroundColor: theme.colors.danger },
    emptyContainer: { alignItems: "center", paddingTop: 100 },
    emptyText: { fontSize: 18, color: theme.colors.muted, marginTop: 16 },
    emptySubtext: { fontSize: 14, color: theme.colors.muted, marginTop: 8 },

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
  })
}
