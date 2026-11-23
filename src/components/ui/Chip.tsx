"use client"

import React from "react"
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native"
import { useTheme } from "../../theme/ThemeProvider"

type ChipVariant = "filled" | "outline" | "soft"

export type ChipProps = {
  label?: string
  children?: React.ReactNode
  selected?: boolean
  onPress?: () => void
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  style?: StyleProp<ViewStyle>
  variant?: ChipVariant
}

export function Chip({ label, children, selected, onPress, leftIcon, rightIcon, style, variant = "soft" }: ChipProps) {
  const { theme } = useTheme()
  const styles = getStyles()

  const bg = selected
    ? theme.colors.primarySoft
    : variant === "filled"
    ? theme.colors.primary
    : variant === "outline"
    ? theme.colors.card
    : theme.colors.card

  const borderColor = selected ? theme.colors.primary : theme.colors.border
  const textColor = selected
    ? theme.colors.primary
    : variant === "filled"
    ? "#fff"
    : theme.colors.text

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderColor: variant === "outline" || selected ? borderColor : "transparent",
        },
        style,
      ]}
    >
      {leftIcon}
      <Text
        style={[styles.text, { color: textColor }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label || children}
      </Text>
      {rightIcon}
    </TouchableOpacity>
  )
}

function getStyles() {
  return StyleSheet.create({
    base: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      // Clave para permitir que el texto haga ellipsis dentro de un row
      minWidth: 0,
    },
    text: {
      fontSize: 13,
      fontWeight: "700",
      flex: 1,
      flexShrink: 1,
    },
  })
}

export default Chip
