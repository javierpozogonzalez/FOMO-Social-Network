import { Platform, Alert } from "react-native"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { supabase } from "./supabase"

// Config básica de comportamiento en foreground (opcional)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Requiere dispositivo físico para push fiables
    if (!Device.isDevice) {
      Alert.alert("Aviso", "Las notificaciones push requieren un dispositivo físico")
      return null
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      Alert.alert("Sesión requerida", "Inicia sesión para activar notificaciones")
      return null
    }

    // Configurar canal Android (requerido para mostrar notificaciones)
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Notificaciones",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
        enableLights: true,
        lightColor: "#FF7A00",
      })
    }

    // Pedir permisos
    const existing = await Notifications.getPermissionsAsync()
    let finalStatus = existing.status
    if (finalStatus !== "granted") {
      const req = await Notifications.requestPermissionsAsync()
      finalStatus = req.status
    }
    if (finalStatus !== "granted") {
      Alert.alert("Permiso denegado", "Actívalo en Ajustes del sistema si quieres recibir notificaciones")
      return null
    }

    // Obtener token Expo
  const expoTokenResp = await Notifications.getExpoPushTokenAsync()
    const token = expoTokenResp.data

    // Guardar en Supabase
    await supabase.from("notification_tokens").upsert({
      user_id: user.id,
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      enabled: true,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "token" })

    return token
  } catch (e: any) {
    console.error("registerForPushNotifications error:", e)
    Alert.alert("Error", e?.message || "No se pudo activar las notificaciones push")
    return null
  }
}

export async function disablePushToken(token?: string | null) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !token) return
    await supabase
      .from("notification_tokens")
      .update({ enabled: false })
      .eq("token", token)
      .eq("user_id", user.id)
  } catch (e) {
    console.warn("disablePushToken error", e)
  }
}

// Envío de prueba remoto vía servicio de Expo (para desarrollo)
export async function sendTestPushToSelf(title = "FOMO", body = "Notificación de prueba") {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "no-user" }

    const { data: rows } = await supabase
      .from("notification_tokens")
      .select("token")
      .eq("user_id", user.id)
      .eq("enabled", true)
      .limit(1)

    const token = rows?.[0]?.token
    if (!token) return { ok: false, error: "no-token" }

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: "default",
        priority: "high",
      }),
    })
    const json = await res.json()
    return { ok: res.ok, response: json }
  } catch (e) {
    console.warn("sendTestPushToSelf error", e)
    return { ok: false, error: String(e) }
  }
}
