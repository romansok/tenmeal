// Typed Supabase query wrappers used by loadDashboard.
// Each function owns a single SELECT and returns rows in the shape that the
// matching mapper in ./mappers.ts expects.

import type { createClient } from '@/lib/supabase/server'
import type {
  DietaryTag,
  ExistingOrder,
  Kid,
  KidFavorite,
  School,
  Subscription,
  SubscriptionHistoryItem,
  SubscriptionPlan,
} from '../types'
import type {
  CustomSandwichListRow,
  IngredientDietaryTagRow,
  IngredientOptionListRow,
  MenuItemListRow,
  SandwichPresetListRow,
} from './mappers'

type SupabaseServerClient = ReturnType<typeof createClient>

export function fetchKids(supabase: SupabaseServerClient, profileId: string) {
  return supabase
    .from('kids')
    .select(
      'id, name, last_name, class_name, phone, emoji_avatar, sort_order, school_id, ' +
        'school:schools(id, name_he, address), ' +
        'kid_dietary_restrictions(dietary_tag_id, dietary_tags(id, slug, label_he))'
    )
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .order('sort_order')
    .returns<Kid[]>()
}

export function fetchActiveSubscriptions(
  supabase: SupabaseServerClient,
  profileId: string,
  nowIso: string
) {
  return supabase
    .from('subscriptions')
    .select(
      'id, meals_remaining, starts_at, expires_at, auto_renew, ' +
        'subscription_plans(id, name_he, meals_count, price_agorot)'
    )
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .gt('meals_remaining', 0)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('starts_at', { ascending: false })
    .returns<Subscription[]>()
}

export function fetchSubscriptionHistory(
  supabase: SupabaseServerClient,
  profileId: string
) {
  return supabase
    .from('subscriptions')
    .select(
      'id, meals_remaining, starts_at, expires_at, status, auto_renew, ' +
        'subscription_plans(id, name_he, meals_count, price_agorot)'
    )
    .eq('profile_id', profileId)
    .order('starts_at', { ascending: false })
    .limit(20)
    .returns<SubscriptionHistoryItem[]>()
}

export function fetchPlans(supabase: SupabaseServerClient) {
  return supabase
    .from('subscription_plans')
    .select('id, name_he, meals_count, price_agorot')
    .eq('is_active', true)
    .order('meals_count', { ascending: true })
    .returns<SubscriptionPlan[]>()
}

export function fetchMenuItems(supabase: SupabaseServerClient) {
  return supabase
    .from('menu_items')
    .select('id, name_he, description_he, image_url, menu_item_dietary_tags(dietary_tag_id)')
    .is('deleted_at', null)
    .eq('is_available', true)
    .order('sort_order')
    .returns<MenuItemListRow[]>()
}

export function fetchWeekOrders(
  supabase: SupabaseServerClient,
  profileId: string,
  weekStart: string,
  weekEnd: string
) {
  return supabase
    .from('orders')
    .select(
      'id, kid_id, delivery_date, notes, status, ' +
        'order_items(id, slot, menu_item_id, custom_sandwich_id, ingredient_option_id, name_he_snapshot, sandwich_config)'
    )
    .eq('profile_id', profileId)
    .gte('delivery_date', weekStart)
    .lte('delivery_date', weekEnd)
    .is('deleted_at', null)
    .returns<ExistingOrder[]>()
}

export function fetchDietaryTags(supabase: SupabaseServerClient) {
  return supabase
    .from('dietary_tags')
    .select('id, slug, label_he')
    .order('label_he')
    .returns<DietaryTag[]>()
}

export function fetchIngredients(supabase: SupabaseServerClient) {
  return supabase
    .from('ingredient_options')
    .select('id, name_he, category, sort_order, available, seasonal_months')
    .eq('available', true)
    .order('category')
    .order('sort_order')
    .order('name_he')
    .returns<IngredientOptionListRow[]>()
}

export function fetchIngredientTags(supabase: SupabaseServerClient) {
  return supabase
    .from('ingredient_dietary_tags')
    .select('ingredient_option_id, dietary_tag_id')
    .returns<IngredientDietaryTagRow[]>()
}

export function fetchCustomSandwiches(
  supabase: SupabaseServerClient,
  kidIds: string[]
) {
  if (kidIds.length === 0) {
    return Promise.resolve({ data: [] as CustomSandwichListRow[], error: null })
  }
  return supabase
    .from('kid_custom_sandwiches')
    .select('id, kid_id, name_he, kid_custom_sandwich_ingredients(ingredient_option_id)')
    .in('kid_id', kidIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<CustomSandwichListRow[]>()
}

export function fetchSchools(supabase: SupabaseServerClient) {
  return supabase
    .from('schools')
    .select('id, name_he, address')
    .eq('active', true)
    .order('name_he')
    .returns<School[]>()
}

export function fetchFavorites(supabase: SupabaseServerClient, kidIds: string[]) {
  if (kidIds.length === 0) {
    return Promise.resolve({ data: [] as KidFavorite[], error: null })
  }
  return supabase
    .from('kid_favorite_meals')
    .select('id, kid_id, menu_item_id, preset_id')
    .in('kid_id', kidIds)
    .returns<KidFavorite[]>()
}

export function fetchSandwichPresets(supabase: SupabaseServerClient) {
  return supabase
    .from('sandwich_presets')
    .select(`
      id, slug, name_he, description_he, bread_id, default_side_veg_id, sort_order,
      bread:bread_id(id, name_he),
      default_side_veg:default_side_veg_id(id, name_he),
      sandwich_preset_fillings(sort_order, ingredient_options(id, name_he)),
      sandwich_preset_vegetables(sort_order, ingredient_options(id, name_he))
    `)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('sort_order')
    .returns<SandwichPresetListRow[]>()
}
