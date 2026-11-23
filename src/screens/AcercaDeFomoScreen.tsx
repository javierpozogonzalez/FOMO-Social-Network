import React from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking, Image } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"

const APP_VERSION = "1.0.0"

export default function AcercaDeFomoScreen() {
  const { theme } = useTheme()
  const styles = getStyles(theme)

  const openURL = (url: string) => {
    Linking.openURL(url).catch((err) => console.error("Error al abrir URL:", err))
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Logo y Nombre */}
      <View style={styles.header}>
        <Image 
          source={require("../../assets/fomoLogoGrande.png")} 
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.version}>Versión {APP_VERSION}</Text>
        <Text style={styles.slogan}>Conecta con amigos, descubre eventos, vive la noche</Text>
      </View>

      {/* Misión y Propósito */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nuestra Misión</Text>
        <Text style={styles.description}>
          FOMO nace para ayudarte a descubrir los mejores eventos de tu ciudad y conectar con tus amigos en tiempo
          real. Nunca más te perderás lo que está pasando en la noche.
        </Text>
      </View>

      {/* Características Principales */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Características</Text>
        <View style={styles.featuresList}>
          <View style={styles.feature}>
            <Ionicons name="calendar" size={24} color={theme.colors.primary} />
            <Text style={styles.featureText}>Descubre eventos en tu ciudad</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="people" size={24} color={theme.colors.primary} />
            <Text style={styles.featureText}>Conecta con amigos</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="star" size={24} color={theme.colors.primary} />
            <Text style={styles.featureText}>Sigue tus locales favoritos</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="eye" size={24} color={theme.colors.primary} />
            <Text style={styles.featureText}>Ve quién va a cada evento</Text>
          </View>
        </View>
      </View>

      {/* Redes Sociales */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Síguenos</Text>
        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => openURL("https://instagram.com/fomoapp")}
          >
            <Ionicons name="logo-instagram" size={28} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => openURL("https://twitter.com/fomoapp")}
          >
            <Ionicons name="logo-twitter" size={28} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => openURL("https://tiktok.com/@fomoapp")}
          >
            <Ionicons name="logo-tiktok" size={28} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Información Legal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <TouchableOpacity style={styles.linkButton} onPress={() => openURL("https://fomoapp.com/terminos")}>
          <Text style={styles.linkText}>Términos y Condiciones</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => openURL("https://fomoapp.com/privacidad")}>
          <Text style={styles.linkText}>Política de Privacidad</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Hecho con ❤️ para los noctámbulos</Text>
        <Text style={styles.copyright}>© 2024-2025 FOMO. Todos los derechos reservados.</Text>
      </View>
    </ScrollView>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 24,
      paddingTop: Platform.OS === "ios" ? 60 : 30,
    },
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
    logoImage: {
      width: 200,
      height: 200,
      marginBottom: 16,
    },
    version: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: 12,
    },
    slogan: {
      fontSize: 16,
      color: theme.colors.muted,
      textAlign: "center",
      fontStyle: "italic",
    },
    section: {
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 12,
    },
    description: {
      fontSize: 15,
      color: theme.colors.muted,
      lineHeight: 22,
      textAlign: "justify",
    },
    featuresList: {
      gap: 12,
    },
    feature: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.colors.card,
      padding: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    featureText: {
      fontSize: 15,
      color: theme.colors.text,
      flex: 1,
    },
    socialButtons: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 20,
    },
    socialButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadow,
    },
    linkButton: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      padding: 16,
      borderRadius: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    linkText: {
      fontSize: 15,
      color: theme.colors.text,
    },
    footer: {
      alignItems: "center",
      marginTop: 20,
      marginBottom: 40,
    },
    footerText: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: 8,
      fontStyle: "italic",
    },
    copyright: {
      fontSize: 12,
      color: theme.colors.muted,
      textAlign: "center",
    },
  })
}
