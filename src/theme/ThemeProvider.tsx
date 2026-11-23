import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { Appearance, ColorSchemeName } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { Theme } from "../theme"
import { theme as lightThemeBase, themeV2 } from "../theme"

export type ThemeMode = "system" | "light" | "dark"
export type ThemeVariant = "classic" | "modern"

export const lightTheme: Theme = {
  ...lightThemeBase,
}

export const darkTheme: Theme = {
  colors: {
    background: "#0B0F14",
    surface: "#121826",
    card: "#0F172A",
    text: "#E5E7EB",
    muted: "#9CA3AF",
    border: "#1F2937",
    primary: "#7C3AED",
    primarySoft: "#2A2142",
    success: "#10B981",
    danger: "#EF4444",
    placeholder: "#9CA3AF",
  },
  gradients: {
    primary: [lightThemeBase.colors.primary, "#5421B0"],
    primarySoft: ["#2A2142", "#1B1630"],
     electric: ["#3B82F6", "#8B5CF6", "#6366F1"],
  },
  radius: { ...lightThemeBase.radius },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
}

// Tema moderno (oscuro) alineado con tokens v2
export const darkThemeV2: Theme = {
  colors: {
    background: "#0B0F14",
    surface: "#121826",
    card: "#0F172A",
    text: "#E6EAF2",
    muted: "#9AA3B2",
    border: "#1F2A37",
    primary: themeV2.colors.primary,
    primarySoft: "#1F1840",
    success: "#10B981",
    danger: "#EF4444",
    placeholder: "#9AA3B2",
  },
  gradients: {
    primary: [themeV2.colors.primary, "#4C1D95"],
    primarySoft: ["#1F1840", "#1A1533"],
     electric: ["#3B82F6", "#8B5CF6", "#6366F1"],
  },
  radius: { ...themeV2.radius },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
}

const STORAGE_KEY_MODE = "@fomo:themeMode"
const STORAGE_KEY_VARIANT = "@fomo:themeVariant"

type ThemeContextValue = {
  theme: Theme
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  isDark: boolean
  variant: ThemeVariant
  setVariant: (v: ThemeVariant) => void
  navigationTheme: {
    dark: boolean
    colors: {
      primary: string
      background: string
      card: string
      text: string
      border: string
      notification: string
    }
  }
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("system")
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme())
  const [variant, setVariant] = useState<ThemeVariant>("modern")

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_MODE).then((val) => {
      if (val === "light" || val === "dark" || val === "system") setMode(val)
    })
    AsyncStorage.getItem(STORAGE_KEY_VARIANT).then((v) => {
      if (v === "classic" || v === "modern") setVariant(v)
    })
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_MODE, mode).catch(() => {})
  }, [mode])

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_VARIANT, variant).catch(() => {})
  }, [variant])

  const isDark = mode === "dark" || (mode === "system" && systemScheme === "dark")
  // Selección del tema según variante + modo
  const theme = isDark
    ? variant === "modern"
      ? darkThemeV2
      : darkTheme
    : variant === "modern"
    ? (themeV2 as Theme)
    : lightTheme

  const navigationTheme = useMemo(
    () => ({
      dark: isDark,
      colors: {
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.card,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.primary,
      },
    }),
    [isDark, theme]
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode, setMode, isDark, variant, setVariant, navigationTheme }),
    [theme, mode, isDark, variant, navigationTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
