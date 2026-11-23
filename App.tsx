"use client"
import "react-native-url-polyfill/auto"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "expo-status-bar"
import { useEffect, useState, useRef } from "react"
import { theme } from "./src/theme"
import { supabase } from "./src/lib/supabase"
import type { Session } from "@supabase/supabase-js"
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider"
import analytics from '@react-native-firebase/analytics'

// Components
import SplashScreen from "./src/components/SplashScreen"

// Screens
import LoginScreen from "./src/screens/LoginScreen"
import RegisterScreen from "./src/screens/RegisterScreen"
import VerifyEmailScreen from "./src/screens/VerifyEmailScreen"
import MainTabs from "./src/navigation/MainTabs"

const Stack = createNativeStackNavigator()

function AppNavigator() {
  const { navigationTheme, isDark } = useTheme()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSplash, setShowSplash] = useState(true)
  const [emailVerified, setEmailVerified] = useState(false) // Por defecto false, forzar verificación
  const routeNameRef = useRef<string | undefined>(undefined)
  const navigationRef = useRef<any>(null)

  useEffect(() => {
    // Log evento de apertura de app
    analytics().logEvent('app_open', {
      timestamp: new Date().toISOString(),
    })
  }, [])

  useEffect(() => {
    // Mostrar splash por 2 segundos
    const splashTimer = setTimeout(() => {
      setShowSplash(false)
    }, 2000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      
      // Verificar si el email está verificado
      if (session?.user) {
        checkEmailVerified(session.user.id)
      }
      
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      
      if (session?.user) {
        checkEmailVerified(session.user.id)
      }
    })

    return () => {
      clearTimeout(splashTimer)
      subscription.unsubscribe()
    }
  }, [])

  const checkEmailVerified = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('email_verified')
        .eq('id', userId)
        .single()
      
      if (!error && data && typeof data.email_verified === 'boolean') {
        // Mantener la sesión y mostrar VerifyEmail cuando NO está verificado
        setEmailVerified(data.email_verified === true)
      } else if (!data) {
        // No existe fila en users para este auth.user. No cerrar sesión; VerifyEmailScreen la creará si falta.
        console.warn('Usuario con sesión pero sin fila en users. Continuamos y la pantalla de verificación creará la fila si falta.')
        setEmailVerified(false)
      } else {
        setEmailVerified(false)
      }
    } catch (err) {
      console.error('Error checking email verification:', err)
      setEmailVerified(false)
    }
  }

  if (showSplash || loading) {
    return <SplashScreen />
  }

  console.log('📱 App.tsx - Render state:', {
    hasSession: !!session,
    emailVerified,
    userId: session?.user?.id
  })

  return (
    <NavigationContainer 
      theme={navigationTheme}
      ref={navigationRef}
      onReady={() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name
      }}
      onStateChange={async () => {
        const previousRouteName = routeNameRef.current
        const currentRouteName = navigationRef.current?.getCurrentRoute()?.name

        if (previousRouteName !== currentRouteName) {
          // Log screen view en Firebase Analytics
          await analytics().logScreenView({
            screen_name: currentRouteName,
            screen_class: currentRouteName,
          })
        }
        routeNameRef.current = currentRouteName
      }}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          !emailVerified ? (
            <Stack.Screen
              name="VerifyEmail"
              component={VerifyEmailScreen}
              initialParams={{
                userId: session.user.id,
                email: session.user.email,
              }}
            />
          ) : (
            <Stack.Screen name="MainTabs" component={MainTabs} />
          )
        ) : (
          // Estado sin sesión: sólo Login y Register. NO incluir VerifyEmail.
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  )
}
