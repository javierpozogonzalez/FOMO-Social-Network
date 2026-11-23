export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  city?: string
  age?: number
  birth_date?: string
  created_at: string
}

export interface Event {
  id: string
  title: string
  description: string
  venue_id?: string // Foreign key to venue_applications
  venue_name: string
  venue_logo?: string
  address: string
  city: string
  latitude?: number
  longitude?: number
  event_date: string
  start_time: string
  end_time?: string
  price?: number
  min_age?: number
  max_age?: number
  music_genre?: string
  image_url?: string
  is_featured: boolean
  created_by: string
  created_at: string
}

export interface EventAttendee {
  id: string
  event_id: string
  user_id: string
  status: "going" | "interested" | "not_going"
  is_visible: boolean
  created_at: string
}

export interface Friendship {
  id: string
  user_id: string
  friend_id: string
  status: "pending" | "accepted" | "rejected"
  created_at: string
}

export interface EventChat {
  id: string
  event_id: string
  user_id: string
  message: string
  created_at: string
}

export interface UserSettings {
  user_id: string
  default_visibility: boolean
  show_age: boolean
  show_location: boolean
  notifications_enabled: boolean
}
