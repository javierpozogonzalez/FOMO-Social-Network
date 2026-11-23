"use client"

import React from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native"
import { useTheme, ThemeMode, ThemeVariant } from "../theme/ThemeProvider"
import { Ionicons } from "@expo/vector-icons"

export default function AppearanceScreen() {
  const { theme, mode, setMode, variant, setVariant } = useTheme()

  const Option = ({ value, label, description }: { value: ThemeMode; label: string; description: string }) => {
    const selected = mode === value
    return (
      <TouchableOpacity
        onPress={() => setMode(value)}
        style={[styles.option, { borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: theme.colors.card }]}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{label}</Text>
          <Text style={[styles.optionDesc, { color: theme.colors.muted }]}>{description}</Text>
        </View>
        <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? theme.colors.primary : theme.colors.muted} />
      </TouchableOpacity>
    )
  }

  const VariantOption = ({ value, label, description }: { value: ThemeVariant; label: string; description: string }) => {
    const selected = variant === value
    return (
      <TouchableOpacity
        onPress={() => setVariant(value)}
        style={[styles.option, { borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: theme.colors.card }]}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{label}</Text>
          <Text style={[styles.optionDesc, { color: theme.colors.muted }]}>{description}</Text>
        </View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? theme.colors.primary : theme.colors.muted} />
      </TouchableOpacity>
    )
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>      
      <View style={styles.section}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Apariencia</Text>
        <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Elige cómo quieres que se vea FOMO</Text>
      </View>

      <View style={styles.section}>
        <Option value="system" label="Según el sistema" description="Se adapta automáticamente al modo del dispositivo" />
        <Option value="light" label="Claro" description="Colores brillantes y fondos claros" />
        <Option value="dark" label="Oscuro" description="Ideal para ambientes con poca luz" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.previewTitle, { color: theme.colors.text }]}>Estilo de UI</Text>
        <VariantOption value="classic" label="Clásico" description="Look actual, seguro y neutro" />
        <VariantOption value="modern" label="Moderno (v2)" description="Más personalidad y acabado social" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.previewTitle, { color: theme.colors.text }]}>Vista previa</Text>
        <View style={[styles.previewCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>          
          <Text style={[styles.previewTextTitle, { color: theme.colors.text }]}>Evento de ejemplo</Text>
          <Text style={[styles.previewText, { color: theme.colors.muted }]}>Centro · 22:30</Text>
          <View style={[styles.previewBadge, { backgroundColor: theme.colors.primary + "33", borderColor: theme.colors.primary }]}>
            <Ionicons name="sparkles" color={theme.colors.primary} size={14} />
            <Text style={[styles.previewBadgeText, { color: theme.colors.primary }]}>FOMO Ready</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 6 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  optionLabel: { fontSize: 16, fontWeight: "700" },
  optionDesc: { fontSize: 13 },
  previewTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  previewCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  previewTextTitle: { fontSize: 16, fontWeight: "700" },
  previewText: { fontSize: 13, marginTop: 4 },
  previewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  previewBadgeText: { fontSize: 12, fontWeight: "800" },
})
