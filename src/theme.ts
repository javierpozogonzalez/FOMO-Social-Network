// Tema clásico (actual)
export const theme = {
  colors: {
    background: "#FFFFFF",
    surface: "#F8FAFC", // light subtle background
    card: "#FFFFFF",
    text: "#111827", // gray-900
    muted: "#6B7280", // gray-500
    border: "#E5E7EB", // gray-200
    primary: "#7C3AED", // violet-600
    primarySoft: "#EDE9FE", // violet-100
    success: "#10B981", // green-500
    danger: "#EF4444",
    placeholder: "#9CA3AF", // gray-400
  },
  gradients: {
    primary: ["#7C3AED", "#6D28D9"] as [string, string],
    primarySoft: ["#EDE9FE", "#F5F3FF"] as [string, string],
    electric: ["#3B82F6", "#8B5CF6", "#6366F1"] as [string, string, string],
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
}

export type Theme = typeof theme

// Tema moderno v2 (solo claro aquí; el oscuro v2 se define en ThemeProvider para usar mismos tipos)
export const themeV2: Theme = {
  colors: {
    background: "#F7F8FC", // más limpio con tinte sutil
    surface: "#F2F4F8", // paneles suaves
    card: "#FFFFFF",
    text: "#0B1220",
    muted: "#667085",
    border: "#E6E8EC",
    primary: "#8B5CF6", // violet-500 más vivo
    primarySoft: "#F3E8FF", // violet-100
    success: "#10B981",
    danger: "#EF4444",
    placeholder: "#98A2B3",
  },
  gradients: {
    primary: ["#8B5CF6", "#6D28D9"],
    primarySoft: ["#F3E8FF", "#EDE9FE"],
    electric: ["#3B82F6", "#8B5CF6", "#6366F1"],
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
  },
  shadow: {
    shadowColor: "#0B1220",
    shadowOpacity: 0.08,
    shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
}
