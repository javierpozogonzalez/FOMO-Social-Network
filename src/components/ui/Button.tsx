"use client"

import React from "react"
import { ActivityIndicator, GestureResponderEvent, StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useTheme } from "../../theme/ThemeProvider"

type ButtonSize = "sm" | "md" | "lg"
type ButtonVariant = "solid" | "outline" | "ghost" | "gradient"

export type ButtonProps = {
  children: React.ReactNode
  onPress?: (event: GestureResponderEvent) => void
  disabled?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  size?: ButtonSize
  variant?: ButtonVariant
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  gradientColors?: [string, string]
}

export function Button({
  children,
  onPress,
  disabled,
  loading,
  leftIcon,
  rightIcon,
  size = "md",
  variant = "solid",
  style,
  textStyle,
  gradientColors,
}: ButtonProps) {
  const { theme } = useTheme()
  const styles = getStyles()

  const sizes = {
    sm: { padV: 8, padH: 12, font: 13, radius: theme.radius.sm },
    md: { padV: 12, padH: 16, font: 15, radius: theme.radius.md },
    lg: { padV: 16, padH: 20, font: 17, radius: theme.radius.lg },
  } as const

  const s = sizes[size]

  const content = (
    <View style={[styles.content, { gap: 8 }]}> 
      {leftIcon}
      <Text
        style={[
          styles.text,
          { fontSize: s.font },
          variant === "solid" || variant === "gradient" ? { color: "#fff" } : { color: theme.colors.text },
          variant === "outline" ? { color: theme.colors.primary } : null,
          textStyle,
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
      {rightIcon}
      {loading ? <ActivityIndicator size="small" color={variant === "solid" || variant === "gradient" ? "#fff" : theme.colors.primary} /> : null}
    </View>
  )

  const baseStyle: ViewStyle = {
    borderRadius: s.radius,
    paddingVertical: s.padV,
    paddingHorizontal: s.padH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  }

  // Variants
  if (variant === "gradient") {
    const colors = gradientColors || (theme.gradients.primary as [string, string])
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.8} style={style}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[baseStyle, styles.shadow, { opacity: disabled ? 0.6 : 1 }]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  const solidStyle: ViewStyle = {
    backgroundColor: theme.colors.primary,
  }
  const outlineStyle: ViewStyle = {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  }
  const ghostStyle: ViewStyle = {
    backgroundColor: "transparent",
  }

  const variantStyle =
    variant === "solid" ? solidStyle : variant === "outline" ? outlineStyle : ghostStyle

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[baseStyle, styles.shadow, variantStyle, { opacity: disabled ? 0.6 : 1 }, style]}
    >
      {content}
    </TouchableOpacity>
  )
}

function getStyles() {
  return StyleSheet.create({
    content: { flexDirection: "row", alignItems: "center" },
    text: { fontWeight: "700" },
    shadow: {
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
  })
}

export default Button
