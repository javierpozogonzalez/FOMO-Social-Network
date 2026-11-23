"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Modal } from "react-native"
import { supabase } from "../lib/supabase"
import type { User, Friendship } from "../types/database.types"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { useFocusEffect } from "@react-navigation/native"
import React from "react"

type FriendWithUser = Friendship & { friend: User }
type FriendSuggestion = { id: string; full_name: string; avatar_url: string | null; city: string | null; mutual_count: number }

export default function FriendsScreen({ navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [friends, setFriends] = useState<FriendWithUser[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)
  const [pendingRequestsMap, setPendingRequestsMap] = useState<Record<string, string>>({})
  const [pendingReceivedCount, setPendingReceivedCount] = useState(0)
  const [incomingRequestsMap, setIncomingRequestsMap] = useState<Record<string, string>>({})
  const [mutualFriendsMap, setMutualFriendsMap] = useState<Record<string, User[]>>({})
  const [mutualCountMap, setMutualCountMap] = useState<Record<string, number>>({})
  const [showMutualsModal, setShowMutualsModal] = useState(false)
  const [selectedMutuals, setSelectedMutuals] = useState<User[]>([])
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([])

  useFocusEffect(
    React.useCallback(() => {
      loadFriends()
      getCurrentUser()
      
      // Configurar botón de solicitudes en header con badge
      navigation.setOptions({
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.background },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        headerTitle: "Amigos",
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate("FriendRequests")}
            style={{ paddingHorizontal: 16 }}
          >
            <View>
              <Ionicons name="notifications-outline" size={24} color={theme.colors.primary} />
              {pendingReceivedCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{pendingReceivedCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ),
      })
    }, [navigation, theme])
  )

  // Actualiza el header cuando cambie el número de pendientes recibidas
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("FriendRequests")}
          style={{ paddingHorizontal: 16 }}
        >
          <View>
            <Ionicons name="notifications-outline" size={24} color={theme.colors.primary} />
            {pendingReceivedCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{pendingReceivedCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ),
    })
  }, [navigation, pendingReceivedCount])

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
    }
  }

  // Cargar sugerencias cuando tengamos el user id
  useEffect(() => {
    if (currentUserId) {
      loadSuggestions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  const loadSuggestions = async () => {
    if (!currentUserId) return
    const { data } = await supabase.rpc('get_friend_suggestions', {
      p_user: currentUserId,
      limit_param: 15,
    })
    setSuggestions((data as FriendSuggestion[]) || [])
  }

  const loadFriends = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("friendships")
      .select("*, friend:users!friendships_friend_id_fkey(*)")
      .eq("user_id", user.id)
      .eq("status", "accepted")

    setFriends(data || [])

    // Cargar solicitudes pendientes que he enviado
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

    // Cargar solicitudes pendientes recibidas
    const { data: receivedPending } = await supabase
      .from("friendships")
      .select("id")
      .eq("friend_id", user.id)
      .eq("status", "pending")
    setPendingReceivedCount(receivedPending ? receivedPending.length : 0)

    // Mapa de solicitudes entrantes (key: user_id que me envió)
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
  }

  const searchUsers = async (query: string) => {
    setSearchQuery(query)

    if (query.length < 2) {
      setSearchResults([])
      setMutualFriendsMap({})
      setMutualCountMap({})
      return
    }

    const { data } = await supabase
      .from("users")
      .select("*")
      .ilike("full_name", `%${query}%`)
      .neq("id", currentUserId)
      .limit(10)

    const results = data || []
    setSearchResults(results)

    // Cargar amigos en común para cada resultado
    if (results.length > 0 && currentUserId) {
      const mutualMap: Record<string, User[]> = {}
      const countMap: Record<string, number> = {}

      for (const user of results) {
        const { data: mutuals } = await supabase.rpc("get_mutual_friends", {
          user_a: currentUserId,
          user_b: user.id,
          limit_param: 25,
        })

        if (mutuals && mutuals.length > 0) {
          mutualMap[user.id] = mutuals
          countMap[user.id] = mutuals.length
        }
      }

      setMutualFriendsMap(mutualMap)
      setMutualCountMap(countMap)
    }
  }

  const sendFriendRequest = async (friendId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSendingRequest(friendId)

    const { data: existing } = await supabase
      .from("friendships")
      .select("*")
      .eq("user_id", user.id)
      .eq("friend_id", friendId)
      .single()

    if (existing) {
      Alert.alert("Info", "Ya has enviado una solicitud a este usuario")
      setSendingRequest(null)
      return
    }

    const { error } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_id: friendId,
      status: "pending",
    })

    if (error) {
      Alert.alert("Error", error.message)
    } else {
      Alert.alert("Éxito", "Solicitud de amistad enviada")
      loadFriends()
      loadSuggestions()
    }

    setSendingRequest(null)
  }

  const handleCancelRequest = async (friendshipId: string) => {
    setSendingRequest(friendshipId)
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId)
    if (error) {
      Alert.alert("Error", error.message)
    } else {
      loadFriends()
    }
    setSendingRequest(null)
  }

  const renderSearchResult = ({ item }: { item: User }) => {
    const isPending = !!pendingRequestsMap[item.id]
    const pendingId = pendingRequestsMap[item.id]
    const incomingId = incomingRequestsMap[item.id]
    const mutuals = mutualFriendsMap[item.id] || []
    const mutualCount = mutualCountMap[item.id] || 0

    return (
      <View style={[styles.searchResultCard, theme.shadow]}>
        <View style={styles.friendAvatar}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.full_name}</Text>
          {item.city && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={theme.colors.muted} />
              <Text style={styles.friendCity}>{item.city}</Text>
            </View>
          )}
          {mutualCount > 0 && (
            <TouchableOpacity
              style={styles.mutualBadge}
              onPress={() => {
                setSelectedMutuals(mutuals)
                setShowMutualsModal(true)
              }}
            >
              <Ionicons name="people" size={12} color={theme.colors.primary} />
              <Text style={styles.mutualText}>
                {mutualCount === 1
                  ? `1 amigo en común`
                  : `${mutualCount} amigos en común`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {incomingId ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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
    loadFriends()
  }

  const handleRejectIncoming = async (requestId: string) => {
    setSendingRequest(requestId)
    const { error } = await supabase.from("friendships").delete().eq("id", requestId)
    if (error) {
      Alert.alert("Error", error.message)
    }
    setSendingRequest(null)
    loadFriends()
  }

  return (
    <>
    <View style={styles.container}>
      <View style={[styles.searchContainer, theme.shadow]}>
        <Ionicons name="search" size={20} color={theme.colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar usuarios..."
          placeholderTextColor={theme.colors.placeholder}
          value={searchQuery}
          onChangeText={searchUsers}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]) }}>
            <Ionicons name="close-circle" size={20} color={theme.colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {searchResults.length > 0 ? (
        <FlatList
          key="search-list"
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          key="grid-3"
          data={friends}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => navigation.navigate("UserProfile", { userId: item.friend_id })}
            >
              <View style={styles.gridAvatarWrap}>
                {item.friend.avatar_url ? (
                  <Image source={{ uri: item.friend.avatar_url }} style={styles.gridAvatar} />
                ) : (
                  <View style={styles.gridAvatarPlaceholder}>
                    <Text style={styles.gridAvatarText}>{item.friend.full_name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text
                style={styles.gridName}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                ellipsizeMode="tail"
              >
                {item.friend.full_name}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          ListFooterComponent={
            suggestions.length === 0 ? null : (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Quizás conozcas</Text>
                {suggestions.slice(0, 6).map((sug) => {
                  const isPending = !!pendingRequestsMap[sug.id]
                  const pendingId = pendingRequestsMap[sug.id]
                  const incomingId = incomingRequestsMap[sug.id]
                  return (
                    <View key={sug.id} style={styles.suggestionCard}>
                      <View style={styles.suggestionAvatar}>
                        {sug.avatar_url ? (
                          <Image source={{ uri: sug.avatar_url }} style={styles.suggestionAvatarImage} />
                        ) : (
                          <View style={styles.suggestionAvatarPlaceholder}>
                            <Text style={styles.suggestionAvatarText}>{sug.full_name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionName}>{sug.full_name}</Text>
                        {sug.mutual_count > 0 && (
                          <TouchableOpacity
                            style={styles.suggestionMutualBadge}
                            onPress={async () => {
                              const { data: mutuals } = await supabase.rpc('get_mutual_friends', {
                                user_a: currentUserId,
                                user_b: sug.id,
                                limit_param: 25,
                              })
                              setSelectedMutuals((mutuals as User[]) || [])
                              setShowMutualsModal(true)
                            }}
                          >
                            <Ionicons name="people" size={10} color={theme.colors.primary} />
                            <Text style={styles.suggestionMutual}>
                              {sug.mutual_count} {sug.mutual_count === 1 ? 'amigo' : 'amigos'} en común
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {incomingId ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.suggestionAcceptButton}
                            onPress={() => handleAcceptIncoming(incomingId, sug.id)}
                            disabled={sendingRequest === incomingId}
                          >
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.suggestionRejectButton}
                            onPress={() => handleRejectIncoming(incomingId)}
                            disabled={sendingRequest === incomingId}
                          >
                            <Ionicons name="close" size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ) : isPending ? (
                        <View style={styles.suggestionPendingBadge}>
                          <Ionicons name="time-outline" size={12} color={theme.colors.muted} />
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.suggestionAddButton}
                          onPress={() => sendFriendRequest(sug.id)}
                          disabled={sendingRequest === sug.id}
                        >
                          {sendingRequest === sug.id ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                          ) : (
                            <Ionicons name="person-add-outline" size={18} color={theme.colors.primary} />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
                {suggestions.length > 6 && (
                  <TouchableOpacity
                    style={styles.seeMoreButton}
                    onPress={() => navigation.navigate('AllSuggestions')}
                  >
                    <Text style={styles.seeMoreText}>Ver más sugerencias</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={theme.colors.muted} />
              <Text style={styles.emptyText}>No tienes amigos aún</Text>
              <Text style={styles.emptySubtext}>Busca usuarios para agregar</Text>
            </View>
          }
        />
      )}

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
    </>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
  // Grid de amigos (3 por fila)
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  gridItem: {
    flexBasis: "33.333%",
    maxWidth: "33.333%",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  gridAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gridAvatar: { width: 56, height: 56, borderRadius: 28 },
  gridAvatarPlaceholder: {
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  gridAvatarText: { color: theme.colors.primary, fontSize: 24, fontWeight: "700" },
  gridName: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 2,
    marginTop: 2,
    width: "100%",
  },

  // Badge de la campana
  badgeContainer: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: theme.colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: theme.colors.background,
    zIndex: 2,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "bold", textAlign: "center" },

  // Contenedor y buscador
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 16 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: theme.colors.text },
  listContent: { padding: 20, paddingTop: 0 },

  // Tarjetas de resultados de búsqueda y estilos comunes
  searchResultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  friendAvatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12, overflow: "hidden" },
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
  friendInfo: { flex: 1 },
  friendName: { fontSize: 18, fontWeight: "600", color: theme.colors.text, marginBottom: 4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  friendCity: { fontSize: 14, color: theme.colors.muted },
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

  // Badge de amigos en común
  mutualBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  mutualText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: "600",
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

  // Sugerencias (discretas al final)
  suggestionsContainer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.muted,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    overflow: "hidden",
  },
  suggestionAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  suggestionAvatarPlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  suggestionAvatarText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 2,
  },
  suggestionMutualBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignSelf: "flex-start",
  },
  suggestionMutual: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: "500",
  },
  suggestionAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  suggestionAcceptButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.success,
    justifyContent: "center",
    alignItems: "center",
  },
  suggestionRejectButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.danger,
    justifyContent: "center",
    alignItems: "center",
  },
  suggestionPendingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  seeMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  })
}
