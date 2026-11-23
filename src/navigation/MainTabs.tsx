import EditVenueProfileScreen from "../screens/EditVenueProfileScreen"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../theme/ThemeProvider"
import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { TouchableOpacity } from "react-native"

// Screens
import HomeScreen from "../screens/HomeScreen"
import EventDetailScreen from "../screens/EventDetailScreen"
import ProfileScreen from "../screens/ProfileScreen"
import VenueProfileScreen from "../screens/VenueProfileScreen"
import CreateEventScreen from "../screens/CreateEventScreen"
import ProfileSwitcher from "../screens/ProfileSwitcher"
import EditProfileScreen from "../screens/EditProfileScreen"
import FriendsScreen from "../screens/FriendsScreen"
import ChatScreen from "../screens/ChatScreen"
import AttendeesScreen from "../screens/AttendeesScreen"
import FriendRequestsScreen from "../screens/FriendRequestsScreen"
import UserProfileScreen from "../screens/UserProfileScreen"
import AllRequestsScreen from "../screens/AllRequestsScreen"
import AllSuggestionsScreen from "../screens/AllSuggestionsScreen"
import VenueEventsScreen from "../screens/VenueEventsScreen"
import SubscriptionPlansScreen from "../screens/SubscriptionPlansScreen"
import NotificationsScreen from "../screens/NotificationsScreen"
import AppearanceScreen from "../screens/AppearanceScreen"
import FAQScreen from "../screens/FAQScreen"
import ContactoSoporteScreen from "../screens/ContactoSoporteScreen"
import AcercaDeFomoScreen from "../screens/AcercaDeFomoScreen"
import TerminosPrivacidadScreen from "../screens/TerminosPrivacidadScreen"
import PlanCheckoutScreen from "../screens/PlanCheckoutScreen"
import PrivacidadSeguridadScreen from "../screens/PrivacidadSeguridadScreen"
import VenueApplicationScreen from "../screens/VenueApplicationScreen"
import ManageAttendanceScreen from "../screens/ManageAttendanceScreen"
import EditEventScreen from "../screens/EditEventScreen"

const Tab = createBottomTabNavigator()
const HomeStack = createNativeStackNavigator()
const FriendsStack = createNativeStackNavigator()
const ProfileStack = createNativeStackNavigator()

function HomeStackScreen() {
  const { theme } = useTheme()
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
      }}
    >
      <HomeStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Detalles del Evento",
        }}
      />
      <HomeStack.Screen
        name="Attendees"
        component={AttendeesScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Asistentes",
        }}
      />
      <HomeStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Chat del Evento",
        }}
      />
      <HomeStack.Screen
        name="FriendRequests"
        component={FriendRequestsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Solicitudes de Amistad",
        }}
      />
      <HomeStack.Screen
        name="AllRequests"
        component={AllRequestsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Todas las solicitudes",
        }}
      />
      <HomeStack.Screen
        name="AllSuggestions"
        component={AllSuggestionsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Sugerencias de Amistad",
        }}
      />
      <HomeStack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <HomeStack.Screen
        name="EditEvent"
        component={EditEventScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Editar evento",
        }}
      />
    </HomeStack.Navigator>
  )
}

function FriendsStackScreen() {
  const { theme } = useTheme()
  return (
    <FriendsStack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
      }}
    >
      <FriendsStack.Screen
        name="FriendsList"
        component={FriendsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Amigos",
        }}
      />
      <FriendsStack.Screen
        name="FriendRequests"
        component={FriendRequestsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Solicitudes de Amistad",
        }}
      />
      <FriendsStack.Screen
        name="AllRequests"
        component={AllRequestsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Todas las solicitudes",
        }}
      />
      <FriendsStack.Screen
        name="AllSuggestions"
        component={AllSuggestionsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Sugerencias de Amistad",
        }}
      />
      <FriendsStack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <FriendsStack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Detalles del Evento",
        }}
      />
      <FriendsStack.Screen
        name="Attendees"
        component={AttendeesScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Asistentes",
        }}
      />
      <FriendsStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Chat del Evento",
        }}
      />
      <FriendsStack.Screen
        name="EditEvent"
        component={EditEventScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Editar evento",
        }}
      />
    </FriendsStack.Navigator>
  )
}

function ProfileStackScreen() {
  const { theme } = useTheme()
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
      }}
    >
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileSwitcher}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="FAQ"
        component={FAQScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Ayuda y FAQ",
        }}
      />
      <ProfileStack.Screen
        name="ContactoSoporte"
        component={ContactoSoporteScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Contacto y Soporte",
        }}
      />
      <ProfileStack.Screen
        name="AcercaDeFomo"
        component={AcercaDeFomoScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Acerca de FOMO",
        }}
      />
      <ProfileStack.Screen
        name="TerminosPrivacidad"
        component={TerminosPrivacidadScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Términos y Privacidad",
        }}
      />
      <ProfileStack.Screen
        name="PrivacidadSeguridad"
        component={PrivacidadSeguridadScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Privacidad y Seguridad",
        }}
      />
      {/* Aseguramos que toda la navegación de eventos desde Perfil permanezca en este stack */}
      <ProfileStack.Screen
        name="VenueEvents"
        component={VenueEventsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Eventos del local",
        }}
      />
        <ProfileStack.Screen
          name="SubscriptionPlans"
          component={SubscriptionPlansScreen}
          options={{
            headerShown: false,
          }}
        />
        <ProfileStack.Screen
          name="PlanCheckout"
          component={PlanCheckoutScreen}
          options={{
            headerShown: false,
          }}
        />
      <ProfileStack.Screen
        name="CreateEvent"
        component={CreateEventScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Publicar evento",
        }}
      />
      <ProfileStack.Screen
        name="EditEvent"
        component={EditEventScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Editar evento",
        }}
      />
      <ProfileStack.Screen
        name="ManageAttendance"
        component={ManageAttendanceScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Gestionar asistencias",
        }}
      />
      <ProfileStack.Screen
        name="EditVenueProfile"
        component={EditVenueProfileScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Editar perfil del local",
        }}
      />
      <ProfileStack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Detalles del Evento",
        }}
      />
      <ProfileStack.Screen
        name="Attendees"
        component={AttendeesScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Asistentes",
        }}
      />
      <ProfileStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Chat del Evento",
        }}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Editar Perfil",
        }}
      />
      <ProfileStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Notificaciones",
        }}
      />
      <ProfileStack.Screen
        name="Appearance"
        component={AppearanceScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Apariencia",
        }}
      />
      <ProfileStack.Screen
        name="VenueApplication"
        component={VenueApplicationScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
          headerTintColor: theme.colors.text,
          headerTitle: "Cuenta profesional",
        }}
      />
    </ProfileStack.Navigator>
  )
}

export default function MainTabs() {
  const { theme } = useTheme()
  const activeColor = "#2D3748" // Negro mate
  const inactiveColor = "#CBD5E0" // Gris claro
  
  const [isVenue, setIsVenue] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAccountType = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        if (!auth.user) return

        const { data: userRow } = await supabase
          .from("users")
          .select("account_type")
          .eq("id", auth.user.id)
          .single()

        console.log("🔍 MainTabs - User account type:", userRow?.account_type)

        if (userRow?.account_type?.startsWith("venue")) {
          setIsVenue(true)
          console.log("✅ MainTabs - Setting isVenue to TRUE")
        } else {
          console.log("❌ MainTabs - User is NOT a venue")
        }
      } catch (e) {
        console.error("Error checking account type:", e)
      } finally {
        setLoading(false)
      }
    }

    checkAccountType()
  }, [])

  if (loading) {
    return null // O un spinner si prefieres
  }
  
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          paddingBottom: 20,
          paddingTop: 8,
          height: 75,
        },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={28} 
              color={focused ? activeColor : inactiveColor} 
            />
          ),
        }}
      />
      {!isVenue && (
        <Tab.Screen
          name="Friends"
          component={FriendsStackScreen}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons 
                name={focused ? "people" : "people-outline"} 
                size={28} 
                color={focused ? activeColor : inactiveColor} 
              />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileStackScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? "person" : "person-outline"} 
              size={28} 
              color={focused ? activeColor : inactiveColor} 
            />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
