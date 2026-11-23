import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import { theme } from '../theme'

// Placeholder de integración: esto luego se reemplaza por Stripe Checkout/WebView
// Props esperadas via route.params: { plan: 'pro' | 'premium', price: number }

export default function PlanCheckoutScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { plan: rawPlan, price: rawPrice } = (route as any)?.params || { plan: 'pro', price: 39 }
  const plan = (rawPlan === 'pro' || rawPlan === 'premium') ? rawPlan : 'pro'
  const price = typeof rawPrice === 'number' ? rawPrice : (plan === 'premium' ? 99 : 39)
  const [loading, setLoading] = useState(false)

  const planInfo: Record<string, { title: string; description: string; bullets: string[] }> = {
    pro: {
      title: 'Suscripción PRO',
      description: 'Ideal para locales que publican eventos semanalmente y necesitan herramientas básicas de crecimiento.',
      bullets: [
        '10 eventos / mes',
        'Lotes externos (sin deduplicación)',
        'Destacar 2 eventos / mes',
        'Exportar CSV asistentes',
        'Push 5000 / mes'
      ]
    },
    premium: {
      title: 'Suscripción PREMIUM',
      description: 'Para marcas y venues con volumen alto de eventos y necesidad de automatización avanzada.',
      bullets: [
        'Eventos ilimitados',
        'Lotes externos con deduplicación',
        'Destacar eventos ilimitado',
        'Push ilimitadas',
        'API + account manager'
      ]
    }
  }

  const handleCheckout = async () => {
    setLoading(true)
    try {
      // Simulación: cambiar el plan en Supabase usando la nueva RPC
      const planMap: Record<string, string> = { free: 'free', pro: 'pro', premium: 'premium' }
      const planKey = planMap[plan] || 'free'
      const status = plan === 'free' ? 'free' : 'active'
      await supabase.rpc('set_venue_plan_for_self', { p_plan: planKey, p_status: status })
      alert('Plan cambiado correctamente. Ahora puedes probar la app con funcionalidades de ese plan.')
      
      // Navegar a la pantalla anterior con parámetro de refresh
      navigation.navigate('SubscriptionPlans', { refresh: Date.now() })
    } catch (e) {
      alert('Error cambiando el plan: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const data = planInfo[plan]

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name='arrow-back' size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>{data.title}</Text>
      <Text style={styles.subtitle}>{data.description}</Text>

      <View style={styles.box}>
        {data.bullets.map(b => (
          <View style={styles.row} key={b}>
            <Ionicons name='checkmark-circle' size={18} color={theme.colors.primary} />
            <Text style={styles.bullet}>{b}</Text>
          </View>
        ))}
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{price}€</Text>
        <Text style={styles.month}>/mes</Text>
      </View>

      <TouchableOpacity
        style={[styles.payButton, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleCheckout}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color='#fff' />
        ) : (
          <>
            <Ionicons name='card-outline' size={20} color='#fff' />
            <Text style={styles.payButtonText}>Continuar al pago seguro</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>Al continuar aceptas los Términos y la Política de Privacidad.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: 20 },
  back: { marginTop: 16, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: theme.colors.muted, marginBottom: 16 },
  box: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 16, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  bullet: { color: theme.colors.text, fontSize: 14, flexShrink: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 },
  price: { fontSize: 42, fontWeight: '800', color: theme.colors.primary },
  month: { fontSize: 16, color: theme.colors.muted, marginLeft: 4 },
  payButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: 14, marginBottom: 14 },
  payButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disclaimer: { fontSize: 11, color: theme.colors.muted, textAlign: 'center', marginTop: 4 }
})
