import React, { useMemo, useState } from "react"
import { View, Text, StyleSheet, FlatList, TextInput, Image, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"
import type { Friendship, User } from "../types/database.types"

export default function AllRequestsScreen({ route, navigation }: any) {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const { requests, type, onAccept, onReject, onCancel } = route.params // type: "received" | "sent"
  const [search, setSearch] = useState("")
  // Copia local para actualizar al instante tras aceptar/rechazar/cancelar
  const [list, setList] = useState<any[]>(requests || [])
  const [processingId, setProcessingId] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      (list || []).filter((r: any) =>
        r.users.full_name.toLowerCase().includes(search.toLowerCase())
      ),
    [list, search]
  )

  // Acciones con actualización local inmediata
  const handleAccept = async (id: string, userId: string) => {
    setProcessingId(id)
    await onAccept(id, userId)
    setList((prev) => prev.filter((x) => x.id !== id))
    setProcessingId(null)
  }

  const handleReject = async (id: string) => {
    setProcessingId(id)
    await onReject(id)
    setList((prev) => prev.filter((x) => x.id !== id))
    setProcessingId(null)
  }

  const handleCancel = async (id: string) => {
    setProcessingId(id)
    await onCancel(id)
    setList((prev) => prev.filter((x) => x.id !== id))
    setProcessingId(null)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{type === "received" ? "Solicitudes recibidas" : "Solicitudes enviadas"}</Text>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color={theme.colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre..."
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatarWrapper}>
              {item.users.avatar_url ? (
                <Image source={{ uri: item.users.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{item.users.full_name?.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              {type === "sent" && (
                <View style={styles.pendingBadge}>
                  <Ionicons name="time-outline" size={12} color={theme.colors.muted} />
                </View>
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.users.full_name}</Text>
            </View>
            {type === "sent" ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton, processingId === item.id ? { opacity: 0.6 } : null]}
                onPress={() => handleCancel(item.id)}
                disabled={processingId === item.id}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton, processingId === item.id ? { opacity: 0.6 } : null]}
                  onPress={() => handleAccept(item.id, item.user_id)}
                  disabled={processingId === item.id}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton, processingId === item.id ? { opacity: 0.6 } : null]}
                  onPress={() => handleReject(item.id)}
                  disabled={processingId === item.id}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No hay solicitudes</Text>}
      />
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, padding: 16 },
    title: { fontSize: 20, fontWeight: "700", marginBottom: 12, color: theme.colors.text },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      paddingHorizontal: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchInput: { flex: 1, fontSize: 16, color: theme.colors.text, marginLeft: 8, paddingVertical: 8 },
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
    avatarWrapper: { position: "relative", marginRight: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: {
      backgroundColor: theme.colors.primarySoft,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    avatarInitial: { color: theme.colors.primary, fontWeight: "700", fontSize: 18 },
    info: { flex: 1 },
    name: { color: theme.colors.text, fontWeight: "600", fontSize: 16 },
    pendingRow: { flexDirection: "row", alignItems: "center" },
    pendingText: { color: theme.colors.muted, fontSize: 14, fontWeight: "600" },
    emptyText: { color: theme.colors.muted, fontSize: 16, textAlign: "center", marginTop: 32 },
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
    pendingBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
  })
}
