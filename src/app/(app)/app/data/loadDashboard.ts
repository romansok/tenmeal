// Single entrypoint for all SSR data the /app dashboard needs.
// page.tsx calls this, hands the result straight to <ProfileView />.

import type { createClient } from '@/lib/supabase/server'
import type {
  CustomSandwich,
  DietaryTag,
  ExistingOrder,
  IngredientOption,
  Kid,
  KidFavorite,
  MenuItemWithTags,
  Profile,
  SandwichPreset,
  School,
  Subscription,
  SubscriptionHistoryItem,
  SubscriptionPlan,
} from '../types'
import { getOrderableDates, getWeekStart, toDateKey } from '../lib/week'
import {
  buildSlugById,
  buildTagsByIngredient,
  mapCustomSandwich,
  mapIngredientOption,
  mapMenuItemWithTags,
  mapSandwichPreset,
} from './mappers'
import {
  fetchActiveSubscriptions,
  fetchCustomSandwiches,
  fetchDietaryTags,
  fetchFavorites,
  fetchIngredients,
  fetchIngredientTags,
  fetchKids,
  fetchMenuItems,
  fetchPlans,
  fetchSandwichPresets,
  fetchSchools,
  fetchSubscriptionHistory,
  fetchWeekOrders,
} from './queries'

type SupabaseServerClient = ReturnType<typeof createClient>

export interface DashboardData {
  profile: Profile
  kids: Kid[]
  subscription: Subscription | null
  initialMealsRemaining: number
  mealsTotal: number
  plans: SubscriptionPlan[]
  subscriptionHistory: SubscriptionHistoryItem[]
  dietaryTags: DietaryTag[]
  schools: School[]
  menuItemsWithTags: MenuItemWithTags[]
  ingredients: IngredientOption[]
  customSandwiches: CustomSandwich[]
  favorites: KidFavorite[]
  sandwichPresets: SandwichPreset[]
  initialWeekOrders: ExistingOrder[]
  initialWeekStart: string
}

function getCurrentWeekRange(): { weekStart: string; weekEnd: string } {
  const ws = getWeekStart(0)
  const dates = getOrderableDates(ws)
  // Original window was Sun→Thu (i.e. dates[0] to dates[4]). Keep that to avoid
  // pulling Friday's orders into the current-week initial render.
  return { weekStart: toDateKey(dates[0]), weekEnd: toDateKey(dates[4]) }
}

export async function loadDashboard(
  supabase: SupabaseServerClient,
  profile: Profile
): Promise<DashboardData> {
  const nowIso = new Date().toISOString()
  const { weekStart, weekEnd } = getCurrentWeekRange()

  const kidsResult = await fetchKids(supabase, profile.id)
  const kids = kidsResult.data ?? []
  const kidIds = kids.map((k) => k.id)

  const [
    activeSubsResult,
    menuItemsResult,
    weekOrdersResult,
    plansResult,
    historyResult,
    dietaryTagsResult,
    ingredientsResult,
    customSandwichesResult,
    schoolsResult,
    favoritesResult,
    presetsResult,
    ingredientTagsResult,
  ] = await Promise.all([
    fetchActiveSubscriptions(supabase, profile.id, nowIso),
    fetchMenuItems(supabase),
    fetchWeekOrders(supabase, profile.id, weekStart, weekEnd),
    fetchPlans(supabase),
    fetchSubscriptionHistory(supabase, profile.id),
    fetchDietaryTags(supabase),
    fetchIngredients(supabase),
    fetchCustomSandwiches(supabase, kidIds),
    fetchSchools(supabase),
    fetchFavorites(supabase, kidIds),
    fetchSandwichPresets(supabase),
    fetchIngredientTags(supabase),
  ])

  const activeSubscriptions = activeSubsResult.data ?? []
  const subscription = activeSubscriptions[0] ?? null
  const initialMealsRemaining = activeSubscriptions.reduce((sum, s) => sum + s.meals_remaining, 0)
  const mealsTotal = activeSubscriptions.reduce(
    (sum, s) => sum + (s.subscription_plans?.meals_count ?? 0),
    0
  )

  const dietaryTags = dietaryTagsResult.data ?? []
  const slugById = buildSlugById(dietaryTags)
  const tagsByIngredient = buildTagsByIngredient(ingredientTagsResult.data ?? [], slugById)

  return {
    profile,
    kids,
    subscription,
    initialMealsRemaining,
    mealsTotal,
    plans: plansResult.data ?? [],
    subscriptionHistory: historyResult.data ?? [],
    dietaryTags,
    schools: schoolsResult.data ?? [],
    menuItemsWithTags: (menuItemsResult.data ?? []).map(mapMenuItemWithTags),
    ingredients: (ingredientsResult.data ?? []).map((row) => mapIngredientOption(row, tagsByIngredient)),
    customSandwiches: (customSandwichesResult.data ?? []).map(mapCustomSandwich),
    favorites: favoritesResult.data ?? [],
    sandwichPresets: (presetsResult.data ?? []).map((row) => mapSandwichPreset(row, tagsByIngredient)),
    initialWeekOrders: weekOrdersResult.data ?? [],
    initialWeekStart: weekStart,
  }
}
