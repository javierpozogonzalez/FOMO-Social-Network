import React, { useState } from "react"
import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet, Platform } from "react-native"
import { useTheme } from "../theme/ThemeProvider"
import type { Theme } from "../theme"

const FAQ_DATA = [
  {
    category: "Cuenta y acceso",
    questions: [
      {
        q: "¿Cómo recupero mi contraseña?",
        a: "En la pantalla de inicio de sesión, pulsa en '¿Olvidaste tu contraseña?' y sigue las instrucciones para recibir un email de recuperación."
      },
      {
        q: "¿Cómo elimino mi cuenta?",
        a: "Ve a 'Privacidad y Seguridad' en el menú y selecciona 'Eliminar cuenta'. Sigue los pasos para confirmar."
      },
      {
        q: "¿Cómo edito mi perfil?",
        a: "En el menú principal, pulsa 'Editar Perfil' para cambiar tu nombre, ciudad o foto de perfil."
      }
    ]
  },
  {
    category: "Eventos y asistencia",
    questions: [
      {
        q: "¿Cómo me apunto a un evento?",
        a: "En la pantalla de detalles del evento, pulsa el botón FOMO para apuntarte."
      },
      {
        q: "¿Por qué no puedo apuntarme a dos eventos el mismo día?",
        a: "Por ahora, solo puedes asistir a un evento por día para evitar solapamientos y mejorar la experiencia."
      },
      {
        q: "¿Cómo cancelo mi asistencia?",
        a: "En el evento al que te apuntaste, pulsa de nuevo el botón FOMO para cancelar tu asistencia."
      }
    ]
  },
  {
    category: "Amigos y comunidad",
    questions: [
      {
        q: "¿Cómo agrego amigos?",
        a: "Busca usuarios en la pantalla de amigos y pulsa el icono para enviarles una solicitud."
      },
      {
        q: "¿Qué son las sugerencias de amistad?",
        a: "Son recomendaciones de personas que podrías conocer, basadas en amigos en común y actividad."
      },
      {
        q: "¿Qué significa 'amigos en común'?",
        a: "Son personas que tú y otro usuario tienen como amigos en la app."
      }
    ]
  },
  {
    category: "App y soporte",
    questions: [
      {
        q: "¿La app es gratuita?",
        a: "Sí, FOMO es completamente gratuita para todos los usuarios."
      },
      {
        q: "¿Cómo contacto con soporte?",
        a: "En el menú principal, pulsa 'Contacto / Soporte' para enviar tu consulta o reporte."
      },
      {
        q: "¿Cómo reporto un problema o bug?",
        a: "Usa la opción de soporte para describir el problema y nuestro equipo lo revisará lo antes posible."
      }
    ]
  }
]

export default function FAQScreen() {
  const { theme } = useTheme()
  const styles = getStyles(theme)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({})

  // Filtrar preguntas por búsqueda
  const filteredData = FAQ_DATA.map(section => ({
    ...section,
    questions: section.questions.filter(q =>
      q.q.toLowerCase().includes(search.toLowerCase()) ||
      q.a.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(section => section.questions.length > 0)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ayuda y Preguntas Frecuentes</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar..."
        placeholderTextColor={theme.colors.placeholder}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filteredData}
        keyExtractor={item => item.category}
        renderItem={({ item }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{item.category}</Text>
            {item.questions.map((q, idx) => {
              const key = item.category + idx
              const isOpen = expanded[key]
              return (
                <View key={key} style={styles.questionBlock}>
                  <TouchableOpacity onPress={() => setExpanded(e => ({ ...e, [key]: !isOpen }))} style={styles.questionRow}>
                    <Text style={styles.questionText}>{q.q}</Text>
                    <Text style={styles.arrow}>{isOpen ? "▲" : "▼"}</Text>
                  </TouchableOpacity>
                  {isOpen && (
                    <Text style={styles.answerText}>{q.a}</Text>
                  )}
                </View>
              )
            })}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron resultados.</Text>}
      />
    </View>
  )
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 20,
      paddingTop: Platform.OS === "ios" ? 60 : 30,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 18,
      textAlign: "center",
    },
    searchInput: {
      backgroundColor: theme.colors.card,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 18,
    },
    section: {
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.primary,
      marginBottom: 10,
    },
    questionBlock: {
      marginBottom: 10,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadow,
    },
    questionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 14,
    },
    questionText: {
      fontSize: 15,
      color: theme.colors.text,
      flex: 1,
      fontWeight: "500",
    },
    arrow: {
      fontSize: 16,
      color: theme.colors.muted,
      marginLeft: 10,
    },
    answerText: {
      fontSize: 14,
      color: theme.colors.muted,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    emptyText: {
      color: theme.colors.muted,
      fontSize: 16,
      textAlign: "center",
      marginTop: 40,
    },
  })
}
