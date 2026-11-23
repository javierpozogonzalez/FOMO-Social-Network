"use client"

import { useEffect, useState, useMemo } from "react"
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, Modal } from "react-native"
import { supabase } from "../lib/supabase"
import type { EventAttendee, User, Friendship } from "../types/database.types"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import { useFocusEffect } from "@react-navigation/native"
import React from "react"

interface Props {
  route: any
  navigation: any
}

type AttendeeWithUser = EventAttendee & { users: User } & {
  isFriend?: boolean
  friendshipStatus?: string
  friendshipId?: string
  followersCount?: number
  mutualFriends?: User[]
}

export default function AttendeesScreen({ route, navigation }: Props) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const { eventId } = route.params
  const [attendees, setAttendees] = useState<AttendeeWithUser[]>([])
  const [friendIds, setFriendIds] = useState<string[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedMutualFriends, setSelectedMutualFriends] = useState<User[]>([])
  const [externalSummary, setExternalSummary] = useState<{ web: number; taquilla: number; otros: number; total: number }>({ web: 0, taquilla: 0, otros: 0, total: 0 })
  // Sin envío de solicitudes desde esta pantalla

  useEffect(() => {
    loadData()
    // Limpia cualquier headerRight previo (quitamos campanita)
    navigation.setOptions({ headerRight: undefined })
  }, [eventId])

  const loadData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const selfId = user?.id || ""
    if (selfId) {
      setCurrentUserId(selfId)
    }

    // Attendees visibles y con status going
    const { data: attendeesData } = await supabase
      .from("event_attendees")
      .select("*, users(*)")
      .eq("event_id", eventId)
      .eq("status", "going")
      .eq("is_visible", true)
    // Resumen de lotes externos para mostrar W/T/O
    const { data: batches } = await supabase
      .from("external_attendance_batches")
      .select("source, quantity")
      .eq("event_id", eventId)

    const sums = { web: 0, taquilla: 0, otros: 0 }
    for (const b of (batches || []) as any[]) {
      const s = (b.source || 'otros').toString().toLowerCase().trim()
      let src: 'web' | 'taquilla' | 'otros'
      if (['taquilla','box_office','ticket_office','door','puerta','caja'].includes(s)) src = 'taquilla'
      else if (['web','online','site','website'].includes(s)) src = 'web'
      else src = 'otros'
      const qty = Number(b.quantity) || 0
      if (src === 'web') sums.web += qty
      else if (src === 'taquilla') sums.taquilla += qty
      else sums.otros += qty
    }
    const totalExternal = sums.web + sums.taquilla + sums.otros
    setExternalSummary({ ...sums, total: totalExternal })

    const attendeeIds = (attendeesData || []).map((a: any) => a.user_id)

    // Mapa de seguidores/amigos por usuario (conteo total por RPC para evitar RLS)
    const followersMap: Record<string, number> = {}
    if (attendeeIds.length > 0) {
      const { data: countsRpc } = await supabase.rpc('get_users_friend_counts', { user_ids_param: attendeeIds })
      ;(countsRpc || []).forEach((row: any) => {
        followersMap[row.user_id] = row.friend_count || 0
      })
    }

    let friendIdsLocal: string[] = []
    if (selfId) {
      // Amigos aceptados
      const { data: friends } = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", selfId)
        .eq("status", "accepted")

      friendIdsLocal = (friends || []).map((f: any) => f.friend_id)
      setFriendIds(friendIdsLocal)
    }

    const enriched: AttendeeWithUser[] = (attendeesData || []).map((a: any) => {
      const followersCount = followersMap[a.user_id] ?? 0
      return {
        ...a,
        isFriend: friendIdsLocal.includes(a.user_id),
        friendshipStatus: undefined,
        friendshipId: undefined,
        followersCount,
        mutualFriends: [],
      }
    })

    // Calcular amigos en común para cada asistente
    if (selfId && friendIdsLocal.length > 0) {
      // Cargar amigos en común por RPC por cada asistente 2º/3º grado
      for (const attendee of enriched) {
        if (attendee.user_id === selfId || attendee.isFriend) continue
        const { data: mutuals } = await supabase.rpc('get_mutual_friends', {
          user_a: selfId,
          user_b: attendee.user_id,
          limit_param: 25,
        })
        attendee.mutualFriends = mutuals || []
      }
    }

    // Orden deseado:
    // 1) Tú
    // 2) Amigos directos
    // 3) Amigos de amigos (tienen mutualFriends > 0 y no son amigos directos)
    // 4) Desconocidos
    // Dentro de cada grupo: más seguidores primero y luego por nombre
    const rank = (x: AttendeeWithUser): number => {
      if (x.user_id === selfId) return 0
      if (x.isFriend) return 1
      const hasMutual = (x.mutualFriends?.length || 0) > 0
      if (hasMutual) return 2
      return 3
    }

    const ordered = enriched.sort((a, b) => {
      const rdiff = rank(a) - rank(b)
      if (rdiff !== 0) return rdiff
      const countDiff = (b.followersCount || 0) - (a.followersCount || 0)
      if (countDiff !== 0) return countDiff
      return (a.users.full_name || "").localeCompare(b.users.full_name || "")
    })

    setAttendees(ordered)
  }

  // Sin envío/cancelación de solicitudes desde esta pantalla

  // Refresco automático al recuperar foco (para reflejar cambios de amistades o asistentes)
  useFocusEffect(
    React.useCallback(() => {
      loadData()
    }, [eventId])
  )

  const filteredAttendees = useMemo(() => {
    if (!searchQuery.trim()) return attendees
    const lower = searchQuery.toLowerCase()
    return attendees.filter((a) => a.users.full_name?.toLowerCase().includes(lower))
  }, [attendees, searchQuery])

  // Construir fila extra de placeholders anónimos para representar lotes externos
  const anonymousPlaceholders = useMemo(() => {
    const arr: { key: string; label: string; color: string; count: number }[] = []
  if (externalSummary.web > 0) arr.push({ key: 'web', label: 'web', color: '#0EA5E9', count: externalSummary.web })
  if (externalSummary.taquilla > 0) arr.push({ key: 'taquilla', label: 'taquilla', color: '#10B981', count: externalSummary.taquilla })
  if (externalSummary.otros > 0) arr.push({ key: 'otros', label: 'otros', color: '#F59E0B', count: externalSummary.otros })
    return arr
  }, [externalSummary])

  const renderItem = ({ item }: { item: AttendeeWithUser }) => {
    const isCurrentUser = item.user_id === currentUserId
    const isPending = false
    const hasMutualFriends = !isCurrentUser && !item.isFriend && (item.mutualFriends?.length || 0) > 0
    const mutualCount = item.mutualFriends?.length || 0

    // Determinar color de fondo según tipo
    let backgroundColor = "#F3F4F6" // Gris claro por defecto (desconocidos/amigos de amigos)
    if (isCurrentUser) {
      backgroundColor = "#E5E7EB" // Gris para usuario
    } else if (item.isFriend) {
      backgroundColor = "#F3E8FF" // Morado claro para amigos
    }

    return (
      <TouchableOpacity
        onPress={() => {
          if (!isCurrentUser && item.isFriend) {
            navigation.navigate("UserProfile", { userId: item.user_id })
          }
        }}
        disabled={isCurrentUser || !item.isFriend}
      >
        <View style={[styles.row, theme.shadow, { backgroundColor }]}>
          {item.users.avatar_url ? (
            <Image source={{ uri: item.users.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{item.users.full_name?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.name}>{item.users.full_name}</Text>
            <View style={styles.metaRow}>
              {item.users.city && (
                <View style={styles.metaChip}>
                  <Ionicons name="location" size={14} color={theme.colors.muted} />
                  <Text style={styles.metaText}>{item.users.city}</Text>
                </View>
              )}
              {typeof item.followersCount === "number" && (
                <View style={[styles.metaChip, styles.followersChip]}>
                  <Ionicons name="people" size={14} color={theme.colors.muted} />
                  <Text style={styles.metaText}>
                    {item.followersCount} {item.followersCount === 1 ? "seguidor" : "seguidores"}
                  </Text>
                </View>
              )}
            </View>
            {hasMutualFriends && (
              <TouchableOpacity
                style={styles.mutualBadge}
                onPress={() => {
                  setSelectedMutualFriends(item.mutualFriends || [])
                  setModalVisible(true)
                }}
              >
                <Ionicons name="people" size={14} color={theme.colors.primary} />
                <Text style={styles.mutualBadgeText}>
                  Amigo de {item.mutualFriends![0].full_name?.split(" ")[0]}
                  {mutualCount > 1 && ` y ${mutualCount - 1} más`}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          {isCurrentUser && (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>Tú</Text>
            </View>
          )}
          {!isCurrentUser && item.isFriend && (
            <View style={styles.friendHeartBadge}>
              <Ionicons name="heart" size={14} color="#8B5CF6" />
              <Text style={styles.friendHeartText}>Amigo</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.searchContainer, theme.shadow]}>
        <Ionicons name="search" size={20} color={theme.colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre..."
          placeholderTextColor={theme.colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color={theme.colors.muted} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filteredAttendees}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          externalSummary.total > 0 ? (
            <View style={styles.externalHeader}>
              <Text style={styles.externalTitle}>Entradas externas</Text>
              <View style={styles.externalChipsRow}>
                {anonymousPlaceholders.map(p => (
                  <View key={p.key} style={[styles.externalChip, { backgroundColor: p.color }]}> 
                    <Text style={styles.externalChipLabel}>{p.label}</Text>
                    <Text style={styles.externalChipCount}>{p.count}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.externalTotal}>Total externos: {externalSummary.total}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={64} color={theme.colors.muted} />
            <Text style={styles.emptyText}>
              {searchQuery ? "No se encontraron asistentes" : "Aún no hay asistentes visibles"}
            </Text>
          </View>
        }
      />

      {/* Modal de amigos en común */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Amigos en común</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={selectedMutualFriends}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.mutualFriendRow}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.mutualAvatar} />
                  ) : (
                    <View style={[styles.mutualAvatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarInitial}>{item.full_name?.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.mutualInfo}>
                    <Text style={styles.mutualName}>{item.full_name}</Text>
                    {item.city && <Text style={styles.mutualCity}>{item.city}</Text>}
                  </View>
                </View>
              )}
              contentContainerStyle={styles.mutualList}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 12,
      borderRadius: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
    },
    listContent: { padding: 16, paddingTop: 0 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderWidth: 0,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      position: "relative",
      overflow: "hidden",
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
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
    followersChip: { marginLeft: 6 },
    metaText: { color: theme.colors.muted, fontSize: 12 },
    friendBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    friendBadgeText: { color: theme.colors.primary, fontSize: 12, fontWeight: "600" },
    friendHeartBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    friendHeartText: {
      fontSize: 11,
      fontWeight: "600",
      color: "#8B5CF6",
    },
    youBadge: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    youBadgeText: { color: theme.colors.muted, fontSize: 12, fontWeight: "600" },
    pendingBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    pendingText: { color: theme.colors.muted, fontSize: 12, fontWeight: "600" },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    mutualBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginTop: 6,
      alignSelf: "flex-start",
    },
    mutualBadgeText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "600",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "70%",
      paddingBottom: 20,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    mutualList: {
      padding: 20,
    },
    mutualFriendRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    mutualAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    mutualInfo: {
      flex: 1,
    },
    mutualName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    mutualCity: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    empty: { alignItems: "center", paddingTop: 80 },
    emptyText: { color: theme.colors.muted, marginTop: 12 },
    externalHeader: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    externalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    externalChipsRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    externalChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
    },
    externalChipLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    externalChipCount: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    externalTotal: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.muted,
    },
  })
}
