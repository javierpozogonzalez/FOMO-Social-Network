import { supabase } from "./supabase"

export type VenuePlan = "free" | "pro" | "premium"

export type ResolvedVenuePlan = {
  isVenue: boolean
  venueId: string | null
  accountType: string | null
  plan: VenuePlan | null
  subscriptionStatus: string | null
  trialEndsAt: string | null
  trialActive: boolean
  visualPlan: VenuePlan | null
}

const TRIAL_STATUSES = new Set(["trial", "trialing", "on_trial", "free_trial"]) // tolerante a distintas denominaciones

export async function resolveVenuePlanForCurrentUser(): Promise<ResolvedVenuePlan> {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) {
    return {
      isVenue: false,
      venueId: null,
      accountType: null,
      plan: null,
      subscriptionStatus: null,
      trialEndsAt: null,
      trialActive: false,
      visualPlan: null,
    }
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("account_type, subscription_status, trial_ends_at, venue_id")
    .eq("id", user.id)
    .single()

  const accountType: string | null = (userRow?.account_type as string) || null
  const subscriptionStatus: string | null = (userRow?.subscription_status as string) || null
  const trialEndsAt: string | null = (userRow?.trial_ends_at as string) || null
  const venueId: string | null = (userRow?.venue_id as string) || null

  // Determinar si es venue por account_type o por venue_id
  const isVenueByType = !!accountType && (accountType === "venue" || accountType.startsWith("venue_"))
  const isVenue = isVenueByType || !!venueId

  // Map a plan conocido
  let plan: VenuePlan | null = null
  if (accountType === "venue_premium") plan = "premium"
  else if (accountType === "venue_pro") plan = "pro"
  else if (accountType === "venue_free") plan = "free"
  else if (accountType === "venue") plan = "premium" // legacy
  else if (isVenue) plan = "free" // fallback conservador

  const trialActive = !!(
    subscriptionStatus && TRIAL_STATUSES.has(subscriptionStatus) && trialEndsAt && new Date(trialEndsAt) > new Date()
  )

  // Visual plan: durante trial nos comportamos como PRO
  const visualPlan: VenuePlan | null = trialActive ? "pro" : plan

  return { isVenue, venueId, accountType, plan, subscriptionStatus, trialEndsAt, trialActive, visualPlan }
}
