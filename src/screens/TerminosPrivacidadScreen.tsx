import React, { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"

type TabType = "terminos" | "privacidad"

const LAST_UPDATE = "31 de octubre de 2025"

export default function TerminosPrivacidadScreen() {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [selectedTab, setSelectedTab] = useState<TabType>("terminos")

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === "terminos" && styles.tabActive]}
          onPress={() => setSelectedTab("terminos")}
        >
          <Text style={[styles.tabText, selectedTab === "terminos" && styles.tabTextActive]}>
            Términos de Servicio
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === "privacidad" && styles.tabActive]}
          onPress={() => setSelectedTab("privacidad")}
        >
          <Text style={[styles.tabText, selectedTab === "privacidad" && styles.tabTextActive]}>
            Política de Privacidad
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.lastUpdate}>Última actualización: {LAST_UPDATE}</Text>

        {selectedTab === "terminos" ? (
          <View>
            {/* Términos de Servicio */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Aceptación de Términos</Text>
              <Text style={styles.sectionText}>
                Al acceder y utilizar FOMO, aceptas estar sujeto a estos Términos de Servicio y todas las leyes y
                regulaciones aplicables. Si no estás de acuerdo con alguno de estos términos, no debes utilizar la
                aplicación.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Uso Apropiado</Text>
              <Text style={styles.sectionText}>
                Te comprometes a utilizar FOMO únicamente para fines legales y de acuerdo con estos términos. Debes:
              </Text>
              <Text style={styles.bulletText}>• Proporcionar información precisa y actualizada</Text>
              <Text style={styles.bulletText}>• Mantener la confidencialidad de tu cuenta</Text>
              <Text style={styles.bulletText}>• No compartir contenido ofensivo o ilegal</Text>
              <Text style={styles.bulletText}>• Respetar a otros usuarios y su privacidad</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Responsabilidad del Usuario</Text>
              <Text style={styles.sectionText}>
                Eres responsable de todas las actividades que ocurran bajo tu cuenta. FOMO no se hace responsable de
                pérdidas o daños derivados del uso no autorizado de tu cuenta.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. Contenido Prohibido</Text>
              <Text style={styles.sectionText}>
                Está prohibido publicar, compartir o transmitir contenido que:
              </Text>
              <Text style={styles.bulletText}>• Sea ilegal, ofensivo, difamatorio o discriminatorio</Text>
              <Text style={styles.bulletText}>• Viole derechos de propiedad intelectual</Text>
              <Text style={styles.bulletText}>• Contenga virus, malware o código malicioso</Text>
              <Text style={styles.bulletText}>• Promueva actividades ilegales o peligrosas</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>5. Suspensión de Cuentas</Text>
              <Text style={styles.sectionText}>
                FOMO se reserva el derecho de suspender o eliminar cuentas que violen estos términos, sin previo aviso
                y sin responsabilidad alguna.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>6. Modificaciones a los Términos</Text>
              <Text style={styles.sectionText}>
                Nos reservamos el derecho de modificar estos términos en cualquier momento. Te notificaremos sobre
                cambios importantes y tu uso continuado de la app constituye la aceptación de los nuevos términos.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>7. Limitación de Responsabilidad</Text>
              <Text style={styles.sectionText}>
                FOMO se proporciona "tal cual" sin garantías de ningún tipo. No nos hacemos responsables de daños
                directos, indirectos, incidentales o consecuentes que resulten del uso de la aplicación.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>8. Contacto</Text>
              <Text style={styles.sectionText}>
                Si tienes preguntas sobre estos Términos de Servicio, contáctanos en:{"\n\n"}
                <Text style={styles.emailText}>legal@fomoapp.com</Text>
              </Text>
            </View>
          </View>
        ) : (
          <View>
            {/* Política de Privacidad */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Introducción</Text>
              <Text style={styles.sectionText}>
                En FOMO, tu privacidad es importante para nosotros. Esta Política de Privacidad explica qué información
                recopilamos, cómo la usamos y tus derechos sobre ella.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Datos que Recopilamos</Text>
              <Text style={styles.sectionText}>Recopilamos la siguiente información cuando usas FOMO:</Text>
              <Text style={styles.bulletText}>• Nombre completo y correo electrónico</Text>
              <Text style={styles.bulletText}>• Foto de perfil (opcional)</Text>
              <Text style={styles.bulletText}>• Ciudad y fecha de nacimiento</Text>
              <Text style={styles.bulletText}>• Información de eventos a los que asistes</Text>
              <Text style={styles.bulletText}>• Lista de amigos y conexiones sociales</Text>
              <Text style={styles.bulletText}>• Preferencias de notificaciones</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Cómo Usamos tus Datos</Text>
              <Text style={styles.sectionText}>Utilizamos tu información para:</Text>
              <Text style={styles.bulletText}>• Proporcionarte acceso a eventos y funciones sociales</Text>
              <Text style={styles.bulletText}>• Conectarte con amigos y otros usuarios</Text>
              <Text style={styles.bulletText}>• Mejorar la experiencia de la app</Text>
              <Text style={styles.bulletText}>• Enviarte notificaciones sobre eventos y actividad social</Text>
              <Text style={styles.bulletText}>• Analizar el uso de la app para mejoras futuras</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. Compartir Información</Text>
              <Text style={styles.sectionText}>
                Tu información se comparte de las siguientes maneras:
              </Text>
              <Text style={styles.bulletText}>
                • Con otros usuarios: Tu nombre, foto y asistencia a eventos son visibles para tus amigos
              </Text>
              <Text style={styles.bulletText}>
                • Con organizadores de eventos: Pueden ver quién asiste a sus eventos
              </Text>
              <Text style={styles.bulletText}>
                • No vendemos ni compartimos tu información con terceros para marketing
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>5. Almacenamiento y Seguridad</Text>
              <Text style={styles.sectionText}>
                Tus datos se almacenan de forma segura en servidores de Supabase. Implementamos medidas de seguridad
                técnicas y organizativas para proteger tu información contra acceso no autorizado, pérdida o
                alteración.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>6. Tus Derechos</Text>
              <Text style={styles.sectionText}>Tienes derecho a:</Text>
              <Text style={styles.bulletText}>• Acceder a tus datos personales</Text>
              <Text style={styles.bulletText}>• Corregir información incorrecta</Text>
              <Text style={styles.bulletText}>• Eliminar tu cuenta y todos tus datos</Text>
              <Text style={styles.bulletText}>• Exportar tus datos en formato legible</Text>
              <Text style={styles.bulletText}>• Oponerte al procesamiento de tus datos</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>7. Cookies y Tracking</Text>
              <Text style={styles.sectionText}>
                FOMO utiliza cookies y tecnologías similares para mejorar tu experiencia, recordar tus preferencias y
                analizar el uso de la app. Puedes gestionar las preferencias de cookies en la configuración de tu
                dispositivo.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>8. Menores de Edad</Text>
              <Text style={styles.sectionText}>
                FOMO está dirigida a usuarios mayores de 18 años. No recopilamos intencionalmente información de
                menores de edad. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos de inmediato.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>9. Cambios a esta Política</Text>
              <Text style={styles.sectionText}>
                Podemos actualizar esta Política de Privacidad ocasionalmente. Te notificaremos sobre cambios
                significativos mediante la app o por correo electrónico.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>10. Contacto</Text>
              <Text style={styles.sectionText}>
                Si tienes preguntas sobre esta Política de Privacidad o quieres ejercer tus derechos, contáctanos
                en:{"\n\n"}
                <Text style={styles.emailText}>privacidad@fomoapp.com</Text>
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    tabsContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingTop: Platform.OS === "ios" ? 60 : 20,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      borderBottomColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.muted,
    },
    tabTextActive: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 20,
      paddingBottom: 40,
    },
    lastUpdate: {
      fontSize: 13,
      color: theme.colors.muted,
      textAlign: "center",
      marginBottom: 24,
      fontStyle: "italic",
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 12,
    },
    sectionText: {
      fontSize: 15,
      color: theme.colors.muted,
      lineHeight: 22,
      textAlign: "justify",
    },
    bulletText: {
      fontSize: 15,
      color: theme.colors.muted,
      lineHeight: 24,
      paddingLeft: 8,
      textAlign: "justify",
    },
    emailText: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
  })
}
