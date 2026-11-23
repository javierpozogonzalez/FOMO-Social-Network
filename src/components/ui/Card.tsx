"use client"

import React from "react"
import { StyleProp, StyleSheet, View, ViewStyle, TouchableOpacity } from "react-native"
import { useTheme } from "../../theme/ThemeProvider"

export type CardProps = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
}

export function Card({ children, style, onPress }: CardProps) {
  const { theme } = useTheme()
  const styles = getStyles()
  const content = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          ...theme.shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    )
  }
  return content
}

function getStyles() {
  return StyleSheet.create({
    base: {
      overflow: "hidden",
    },
  })
}

export default Card
