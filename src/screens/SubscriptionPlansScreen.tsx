import React, { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import { theme } from "../theme"

const { width } = Dimensions.get("window")

type PlanType = "free" | "pro" | "premium"

interface UserSubscription {
  account_type: string
  subscription_status: string
  trial_ends_at: string | null
  current_period_end: string | null
}

interface VenueUsage {
  events_created: number
  events_featured: number
  notifications_sent: number
}

export default function SubscriptionPlansScreen({ navigation, route }: any) {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [usage, setUsage] = useState<VenueUsage>({ events_created: 0, events_featured: 0, notifications_sent: 0 })
  const [currentPlan, setCurrentPlan] = useState<PlanType>("free")

  useEffect(() => {
    loadSubscriptionData()
  }, [])

  // Recargar cuando se recibe un parámetro refresh desde PlanCheckout
  useEffect(() => {
    if (route?.params?.refresh) {
      loadSubscriptionData()
    }
  }, [route?.params?.refresh])

  const loadSubscriptionData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get subscription info
      const { data: userData } = await supabase
        .from("users")
        .select("account_type, subscription_status, trial_ends_at, current_period_end")
        .eq("id", user.id)
        .single()

      if (userData) {
        setSubscription(userData)
        
        // Determine current plan (nota: si está en trial mostrarmos PRO como plan actual visualmente)
        if (userData.account_type === "venue_premium") {
          setCurrentPlan("premium")
        } else if (userData.account_type === "venue_pro") {
          setCurrentPlan("pro")
        } else {
          setCurrentPlan("free")
        }
      }

      // Get current month usage
      const currentMonth = new Date().getMonth() + 1
      const currentYear = new Date().getFullYear()

      const { data: usageData } = await supabase
        .from("venue_usage")
        .select("events_created, events_featured, notifications_sent")
        .eq("user_id", user.id)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .single()

      if (usageData) {
        setUsage(usageData)
      }
    } catch (error) {
      console.error("Error loading subscription:", error)
    } finally {
      setLoading(false)
    }
  }

  const getPlanLimits = (plan: PlanType) => {
    switch (plan) {
      case "free":
        return { events: 4, featured: 0, externalBatches: false, deduplication: false }
      case "pro":
        return { events: 10, featured: 2, externalBatches: true, deduplication: false }
      case "premium":
        return { events: 999, featured: 999, externalBatches: true, deduplication: true }
    }
  }

  const isTrialActive = () => {
    if (!subscription?.trial_ends_at) return false
    return new Date(subscription.trial_ends_at) > new Date()
  }

  const getTrialDaysRemaining = () => {
    if (!subscription?.trial_ends_at) return 0
    const diff = new Date(subscription.trial_ends_at).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const getTrialProgressPct = () => {
    const total = 30 // asunción razonable: 30 días de trial
    const remaining = getTrialDaysRemaining()
    const consumed = Math.max(0, Math.min(total, total - remaining))
    return Math.round((consumed / total) * 100)
  }

  const PlanCard = ({ 
    plan, 
    title, 
    price, 
    features, 
    highlighted = false 
  }: { 
    plan: PlanType
    title: string
    price: string
    features: string[]
    highlighted?: boolean 
  }) => {
    // Si está en trial, el plan "visual actual" es PRO
    const visualCurrentPlan: PlanType = isTrialActive() ? "pro" : currentPlan
    const isCurrentPlan = visualCurrentPlan === plan
    const limits = getPlanLimits(plan)

    return (
      <View style={[
        styles.planCard,
        highlighted && styles.planCardHighlighted,
        isCurrentPlan && styles.planCardCurrent
      ]}>
        {highlighted && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>MÁS POPULAR</Text>
          </View>
        )}

        {isCurrentPlan && (
          <View style={[
            styles.currentBadge,
            isTrialActive() && styles.trialBadge
          ]}>
            <Ionicons name={isTrialActive() ? "time-outline" : "checkmark-circle"} size={16} color="#fff" />
            <Text style={styles.currentBadgeText}>{isTrialActive() ? "En prueba" : "Plan Actual"}</Text>
          </View>
        )}

        <Text style={styles.planTitle}>{title}</Text>
        <View style={styles.priceContainer}>
          <Text style={styles.planPrice}>{price}</Text>
          {price !== "Gratis" && <Text style={styles.planPeriod}>/mes</Text>}
        </View>

        {/* Trial info dentro de la tarjeta PRO */}
        {plan === "pro" && isTrialActive() && (
          <View style={styles.trialCardContainer}>
            <View style={styles.trialCardHeader}>
              <View style={styles.trialPill}>
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.trialPillText}>Prueba PRO activa</Text>
              </View>
              <Text style={styles.trialDaysText}>{getTrialDaysRemaining()} días restantes</Text>
            </View>
            <View style={styles.trialProgressBar}>
              <View style={[styles.trialProgressFill, { width: `${getTrialProgressPct()}%` }]} />
            </View>
          </View>
        )}

        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons 
                name={feature.startsWith("✗") ? "close-circle" : "checkmark-circle"} 
                size={20} 
                color={feature.startsWith("✗") ? theme.colors.muted : theme.colors.primary} 
              />
              <Text style={[
                styles.featureText,
                feature.startsWith("✗") && styles.featureTextDisabled
              ]}>
                {feature.replace("✓ ", "").replace("✗ ", "")}
              </Text>
            </View>
          ))}
        </View>

        {/* Usage meter for current plan */}
        {isCurrentPlan && limits.events < 999 && (
          <View style={styles.usageMeter}>
            <View style={styles.usageMeterHeader}>
              <Text style={styles.usageMeterLabel}>Eventos este mes</Text>
              <Text style={styles.usageMeterValue}>{usage.events_created}/{limits.events}</Text>
            </View>
            <View style={styles.usageMeterBar}>
              <View 
                style={[
                  styles.usageMeterFill,
                  { width: `${Math.min((usage.events_created / limits.events) * 100, 100)}%` }
                ]} 
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.planButton,
            highlighted && styles.planButtonHighlighted,
            isCurrentPlan && styles.planButtonCurrent
          ]}
          disabled={isCurrentPlan}
          onPress={() => handleSelectPlan(plan)}
        >
          <Text style={[
            styles.planButtonText,
            highlighted && styles.planButtonTextHighlighted,
            isCurrentPlan && styles.planButtonTextCurrent
          ]}>
            {isCurrentPlan ? "Plan Actual" : plan === "free" ? "Cambiar a FREE" : "Suscribirme"}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  const handleSelectPlan = async (plan: PlanType) => {
    // Si el usuario elige FREE, aplicamos el plan directamente sin pasar por checkout
    if (plan === 'free') {
      try {
        await supabase.rpc('set_venue_plan_for_self', { p_plan: 'free', p_status: 'free' })
        Alert.alert('Listo', 'Tu plan ahora es FREE.')
        // Refrescar datos de suscripción para actualizar el UI
        await loadSubscriptionData()
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'No se pudo cambiar al plan FREE')
      }
      return
    }

    // Para PRO y PREMIUM abrimos la pantalla de checkout temporal
    const price = plan === 'pro' ? 39 : plan === 'premium' ? 99 : 0
    navigation.navigate('PlanCheckout', { plan, price })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1a1a2e", "#16213e"]}
        style={styles.header}
      >
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Pro del Local</Text>
        <Text style={styles.headerSubtitle}>Elige el plan que mejor se adapte a tu negocio</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <PlanCard
          plan="free"
          title="FREE"
          price="Gratis"
          features={[
            "✓ 4 eventos por mes",
            "✓ Perfil verificado",
            "✓ Gestión básica asistentes",
            "✗ Lotes externos",
            "✗ Analytics"
          ]}
        />

        <PlanCard
          plan="pro"
          title="PRO"
          price="39€"
          features={[
            "✓ 10 eventos por mes",
            "✓ Lotes externos (sin dedup.)",
            "✓ Destacar 2 eventos",
            "✓ Exportar CSV",
            "✓ Push (5000/mes)"
          ]}
          highlighted
        />

        <PlanCard
          plan="premium"
          title="PREMIUM"
          price="99€"
          features={[
            "✓ Eventos ilimitados",
            "✓ Lotes deduplicación",
            "✓ Destacar ilimitado",
            "✓ Push ilimitadas",
            "✓ API + manager"
          ]}
        />
        <View style={{ height: 4 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backButton: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
  },
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 10,
  },
  trialBannerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: { padding: 16, paddingTop: 8 },
  planCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  planCardHighlighted: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  planCardCurrent: { borderColor: "#4CAF50", backgroundColor: "rgba(76,175,80,0.08)" },
  popularBadge: { position: "absolute", top: -10, right: 16, backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  popularBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#4CAF50",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    gap: 4,
  },
  trialBadge: {
    backgroundColor: "#FF9800",
  },
  currentBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  planTitle: { fontSize: 22, fontWeight: "700", color: theme.colors.text, marginBottom: 6 },
  priceContainer: { flexDirection: "row", alignItems: "baseline", marginBottom: 14 },
  planPrice: { fontSize: 34, fontWeight: "800", color: theme.colors.primary },
  planPeriod: { fontSize: 14, color: theme.colors.muted, marginLeft: 4 },
  featuresContainer: { gap: 8, marginBottom: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 14, color: theme.colors.text, flex: 1 },
  featureTextDisabled: {
    color: theme.colors.muted,
    textDecorationLine: "line-through",
  },
  // Trial widgets dentro de la card PRO
  trialCardContainer: {
    backgroundColor: "rgba(255, 152, 0, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 152, 0, 0.35)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  trialCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  trialPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF9800",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  trialPillText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  trialDaysText: {
    color: theme.colors.text,
    fontWeight: "700",
  },
  trialProgressBar: {
    height: 8,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 999,
    overflow: "hidden",
  },
  trialProgressFill: {
    height: "100%",
    backgroundColor: "#FF9800",
  },
  usageMeter: { marginTop: 12, marginBottom: 12, padding: 10, backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 12 },
  usageMeterHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  usageMeterLabel: { fontSize: 12, color: theme.colors.text, fontWeight: "600" },
  usageMeterValue: { fontSize: 12, color: theme.colors.primary, fontWeight: "700" },
  usageMeterBar: {
    height: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  usageMeterFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  planButton: { backgroundColor: theme.colors.border, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  planButtonHighlighted: {
    backgroundColor: theme.colors.primary,
  },
  planButtonCurrent: {
    backgroundColor: "#4CAF50",
    opacity: 0.6,
  },
  planButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  planButtonTextHighlighted: {
    color: "#fff",
  },
  planButtonTextCurrent: {
    color: "#fff",
  },
  faqSection: {
    marginTop: 32,
    marginBottom: 20,
  },
  faqTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 20,
  },
  faqItem: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  faqContent: {
    flex: 1,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: "center",
  },
})
