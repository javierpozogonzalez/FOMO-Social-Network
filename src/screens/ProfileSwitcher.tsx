"use client"

import { useEffect, useState } from "react"
import { View, ActivityIndicator } from "react-native"
import { supabase } from "../lib/supabase"
import ProfileScreen from "./ProfileScreen"
import VenueProfileScreen from "./VenueProfileScreen"
import { useTheme } from "../theme/ThemeProvider"

export default function ProfileSwitcher(props: any) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [isVenue, setIsVenue] = useState<boolean>(false)

  useEffect(() => {
    let channel: any
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        setIsVenue(false)
        setLoading(false)
        return
      }
      const { data: row } = await supabase
        .from("users")
        .select("venue_id, account_type")
        .eq("id", user.id)
        .single()
      
        // Detectar si es venue usando startsWith("venue")
        const venue = row?.account_type?.startsWith("venue")
      setIsVenue(!!venue)
      setLoading(false)

      channel = supabase
        .channel("profile-switcher-user")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${user.id}` },
          (payload: any) => {
            const r = payload.new
              const v = r?.account_type?.startsWith("venue")
            setIsVenue(!!v)
          }
        )
        .subscribe()
    }
    init()

    return () => {
      try { if (channel) supabase.removeChannel(channel) } catch {}
    }
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    )
  }

  if (isVenue) return <VenueProfileScreen {...props} />
  return <ProfileScreen {...props} />
}
