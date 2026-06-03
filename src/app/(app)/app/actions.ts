'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SANDWICH_CATEGORY_RULES } from './types'
import type {
  CustomSandwich,
  CustomSandwichIngredientJoinRow,
  CustomSandwichOwnershipRow,
  CustomSandwichWithIngredientsRow,
  IngredientCategory,
  Kid,
  KidDietaryRequirementRow,
  KidFavorite,
  KidInput,
  MainSelection,
  SandwichConfigSnapshot,
  SandwichPresetRow,
  Subscription,
} from './types'

const PHONE_RE = /^0[2-9]\d{7,8}$/

function isValidPhone(phone: string) {
  return PHONE_RE.test(phone.replace(/-/g, '').replace(/\s/g, ''))
}

const KID_SELECT_WITH_RELATIONS =
  'id, name, last_name, class_name, phone, emoji_avatar, sort_order, school_id, ' +
  'school:schools(id, name_he, address), ' +
  'kid_dietary_restrictions(dietary_tag_id, dietary_tags(id, slug, label_he))'

type SupabaseServerClient = ReturnType<typeof createClient>

async function getProfileId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: identity } = await supabase
    .from('auth_identities').select('id')
    .eq('provider', 'supabase').eq('provider_uid', user.id).single()
  if (!identity) return null
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('identity_id', identity.id).single()
  return profile?.id ?? null
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function updatePhone(phone: string): Promise<{ success: true } | { error: string }> {
  if (!isValidPhone(phone)) {
    return { error: 'מספר טלפון לא תקין. יש להזין מספר ישראלי תקני.' }
  }

  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ phone })
    .eq('id', profileId)

  if (updateError) return { error: 'שגיאה בשמירת הטלפון. נסה שוב.' }
  return { success: true }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

const SUBSCRIPTION_SELECT =
  'id, meals_remaining, starts_at, expires_at, auto_renew, ' +
  'subscription_plans(id, name_he, meals_count, price_agorot)'

export async function purchaseSubscription(
  planId: string
): Promise<{ subscription: Subscription } | { error: string }> {
  if (!planId) return { error: 'נדרש מזהה חבילה.' }

  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: plan, error: planError } = await supabase
    .from('subscription_plans').select('id, meals_count')
    .eq('id', planId).eq('is_active', true).single()
  if (planError || !plan) return { error: 'חבילה לא נמצאה.' }

  const { data: newSub, error: insertError } = await supabase
    .from('subscriptions')
    .insert({ profile_id: profileId, plan_id: planId, meals_remaining: plan.meals_count, status: 'active' })
    .select(SUBSCRIPTION_SELECT)
    .single()
    .returns<Subscription>()

  if (insertError || !newSub) return { error: 'שגיאה ברכישת המנוי. נסה שוב.' }
  return { subscription: newSub }
}

export async function toggleAutoRenew(
  subscriptionId: string,
  value: boolean
): Promise<{ success: true } | { error: string }> {
  if (!subscriptionId) return { error: 'נדרש מזהה מנוי.' }

  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: sub, error: subError } = await supabase
    .from('subscriptions').select('id').eq('id', subscriptionId).eq('profile_id', profileId).single()
  if (subError || !sub) return { error: 'מנוי לא נמצא.' }

  const { error: updateError } = await supabase
    .from('subscriptions').update({ auto_renew: value }).eq('id', subscriptionId)
  if (updateError) return { error: 'שגיאה בעדכון המנוי. נסה שוב.' }

  return { success: true }
}

// ─── Kid CRUD ────────────────────────────────────────────────────────────────

export async function addKid(data: KidInput): Promise<{ kid: Kid } | { error: string }> {
  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { count } = await supabase
    .from('kids').select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId).is('deleted_at', null)

  const { data: kidRow, error: kidError } = await supabase
    .from('kids')
    .insert({
      profile_id: profileId,
      name: data.name.trim(),
      last_name: data.last_name?.trim() || null,
      class_name: data.class_name?.trim() || null,
      phone: data.phone?.trim() || null,
      emoji_avatar: data.emoji_avatar,
      school_id: data.school_id || null,
      sort_order: count ?? 0,
    })
    .select('id')
    .single()

  if (kidError || !kidRow) return { error: 'שגיאה בהוספת הילד. נסה שוב.' }

  if (data.dietary_tag_ids.length > 0) {
    await supabase.from('kid_dietary_restrictions').insert(
      data.dietary_tag_ids.map((tagId) => ({ kid_id: kidRow.id, dietary_tag_id: tagId }))
    )
  }

  const { data: full } = await supabase
    .from('kids')
    .select(KID_SELECT_WITH_RELATIONS)
    .eq('id', kidRow.id)
    .single()
    .returns<Kid>()

  if (!full) return { error: 'שגיאה בטעינת נתוני הילד.' }
  return { kid: full }
}

export async function updateKid(kidId: string, data: KidInput): Promise<{ success: true } | { error: string }> {
  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: kid } = await supabase
    .from('kids').select('id').eq('id', kidId).eq('profile_id', profileId).is('deleted_at', null).single()
  if (!kid) return { error: 'ילד לא נמצא.' }

  const { error: updateError } = await supabase
    .from('kids')
    .update({
      name: data.name.trim(),
      last_name: data.last_name?.trim() || null,
      class_name: data.class_name?.trim() || null,
      phone: data.phone?.trim() || null,
      emoji_avatar: data.emoji_avatar,
      school_id: data.school_id || null,
    })
    .eq('id', kidId)

  if (updateError) return { error: 'שגיאה בעדכון הילד. נסה שוב.' }

  await supabase.from('kid_dietary_restrictions').delete().eq('kid_id', kidId)
  if (data.dietary_tag_ids.length > 0) {
    await supabase.from('kid_dietary_restrictions').insert(
      data.dietary_tag_ids.map((tagId) => ({ kid_id: kidId, dietary_tag_id: tagId }))
    )
  }

  return { success: true }
}

export async function removeKid(kidId: string): Promise<{ success: true } | { error: string }> {
  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: kid } = await supabase
    .from('kids').select('id').eq('id', kidId).eq('profile_id', profileId).is('deleted_at', null).single()
  if (!kid) return { error: 'ילד לא נמצא.' }

  const { error } = await supabase
    .from('kids').update({ deleted_at: new Date().toISOString() }).eq('id', kidId)
  if (error) return { error: 'שגיאה במחיקת הילד. נסה שוב.' }

  return { success: true }
}

// ─── Single-day order auto-save (3-slot meal model) ──────────────────────────
//
// A subscription meal = 1 main + 1 side veg + 1 side fruit. The picker UI lets
// the parent pick the main; the side veg + side fruit default to the first
// available option for the meal's date (respecting seasonality). The kid can
// later swap them when an extended picker is added.

interface SaveDayInput {
  kidId: string
  profileId: string
  date: string
  main: MainSelection | null   // null = cancel/clear the day
  sideVegId?: string | null    // optional override; auto-pick if absent
  sideFruitId?: string | null
  notes: string
}

interface ActiveSubscriptionForRefund {
  id: string
  meals_remaining: number
  subscription_plans: { meals_count: number } | null
}

export async function saveDayOrder(
  input: SaveDayInput
): Promise<{ success: true; mealsUsed: number } | { error: string }> {
  const supabase = createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (input.date <= todayKey) return { error: 'ניתן לשנות ארוחות רק מיום מחר והלאה.' }

  // Look up kid for school_id snapshot
  const { data: kidRow } = await supabase
    .from('kids')
    .select('id, school_id')
    .eq('id', input.kidId)
    .eq('profile_id', input.profileId)
    .is('deleted_at', null)
    .single()
  if (!kidRow) return { error: 'ילד לא נמצא.' }

  // Find existing active order for this kid + date
  const { data: existingOrders } = await supabase
    .from('orders')
    .select('id, status')
    .eq('profile_id', input.profileId)
    .eq('kid_id', input.kidId)
    .eq('delivery_date', input.date)
    .is('deleted_at', null)
    .limit(1)

  const existing = existingOrders?.[0] ?? null

  // ── CANCEL path ────────────────────────────────────────────────────────────
  if (input.main === null) {
    if (!existing) return { success: true, mealsUsed: 0 }

    await supabase.from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', existing.id)

    // FIFO refund 1 meal — find the oldest sub with capacity to absorb it.
    const now = new Date().toISOString()
    const { data: activeSubs } = await supabase
      .from('subscriptions')
      .select('id, meals_remaining, subscription_plans(meals_count)')
      .eq('profile_id', input.profileId)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('starts_at', { ascending: true })
      .returns<ActiveSubscriptionForRefund[]>()

    for (const sub of activeSubs ?? []) {
      const cap = sub.subscription_plans?.meals_count ?? Infinity
      const space = Math.max(0, cap - sub.meals_remaining)
      if (space > 0) {
        await supabase.from('subscriptions').update({ meals_remaining: sub.meals_remaining + 1 }).eq('id', sub.id)
        return { success: true, mealsUsed: -1 }
      }
    }
    return { success: true, mealsUsed: -1 }
  }

  // ── CREATE / UPDATE path ───────────────────────────────────────────────────
  // Build the main first so a sandwich_preset can supply its default side veg.
  // Use a placeholder order id; we'll patch it onto the row before insert.
  const builtMain = await buildMainOrderItem(supabase, '__pending__', input.main)
  if ('error' in builtMain) return builtMain

  const month = parseInt(input.date.slice(5, 7), 10)
  const sideVegId =
    input.sideVegId ??
    builtMain.defaultSideVegId ??
    (await pickDefaultSide(supabase, 'side_vegetable', month))
  const sideFruitId = input.sideFruitId ?? (await pickDefaultSide(supabase, 'side_fruit', month))
  if (!sideVegId || !sideFruitId) {
    return { error: 'אין ירק או פרי זמינים לתאריך זה.' }
  }

  // Resolve display names for snapshots
  const ingredientIds = [sideVegId, sideFruitId]
  const { data: ingredientRows } = await supabase
    .from('ingredient_options').select('id, name_he').in('id', ingredientIds)
  const ingredientNameById = new Map<string, string>(
    (ingredientRows ?? []).map((r) => [r.id, r.name_he])
  )

  if (!existing) {
    // CREATE — new order + 3 items
    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert({
        profile_id: input.profileId,
        kid_id: input.kidId,
        school_id: kidRow.school_id,
        delivery_date: input.date,
        notes: input.notes || null,
        status: 'pending',
      })
      .select('id')
      .single()
    if (orderErr || !newOrder) return { error: 'שגיאה ביצירת הזמנה. נסה שוב.' }

    const mainRow = { ...builtMain.row, order_id: newOrder.id }

    const items = [
      mainRow,
      {
        order_id: newOrder.id,
        slot: 'side_veg',
        ingredient_option_id: sideVegId,
        name_he_snapshot: ingredientNameById.get(sideVegId) ?? '',
        quantity: 2,
      },
      {
        order_id: newOrder.id,
        slot: 'side_fruit',
        ingredient_option_id: sideFruitId,
        name_he_snapshot: ingredientNameById.get(sideFruitId) ?? '',
      },
    ]

    const { error: itemErr } = await supabase.from('order_items').insert(items)
    if (itemErr) {
      // Rollback the order so we don't leave a half-built tray
      await supabase.from('orders').delete().eq('id', newOrder.id)
      return { error: 'שגיאה בהוספת פריטים להזמנה.' }
    }

    // FIFO debit 1 meal
    const now = new Date().toISOString()
    const { data: activeSubs } = await supabase
      .from('subscriptions')
      .select('id, meals_remaining')
      .eq('profile_id', input.profileId)
      .eq('status', 'active')
      .gt('meals_remaining', 0)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('starts_at', { ascending: true })
      .limit(1)

    const sub = activeSubs?.[0]
    if (sub) {
      await supabase.from('subscriptions').update({ meals_remaining: sub.meals_remaining - 1 }).eq('id', sub.id)
    }

    return { success: true, mealsUsed: 1 }
  }

  // UPDATE — replace main item, keep sides (or replace them too if requested)
  const mainRow = { ...builtMain.row, order_id: existing.id }

  // Update notes
  await supabase.from('orders').update({ notes: input.notes || null }).eq('id', existing.id)

  // Replace main row (delete-then-insert keyed by (order_id, slot) UNIQUE)
  await supabase.from('order_items').delete().eq('order_id', existing.id).eq('slot', 'main')
  const { error: insertMainErr } = await supabase.from('order_items').insert(mainRow)
  if (insertMainErr) return { error: 'שגיאה בעדכון פריט הארוחה.' }

  // Replace side rows only if explicit override provided
  if (input.sideVegId !== undefined) {
    await supabase.from('order_items').delete().eq('order_id', existing.id).eq('slot', 'side_veg')
    await supabase.from('order_items').insert({
      order_id: existing.id,
      slot: 'side_veg',
      ingredient_option_id: sideVegId,
      name_he_snapshot: ingredientNameById.get(sideVegId) ?? '',
      quantity: 2,
    })
  }
  if (input.sideFruitId !== undefined) {
    await supabase.from('order_items').delete().eq('order_id', existing.id).eq('slot', 'side_fruit')
    await supabase.from('order_items').insert({
      order_id: existing.id,
      slot: 'side_fruit',
      ingredient_option_id: sideFruitId,
      name_he_snapshot: ingredientNameById.get(sideFruitId) ?? '',
    })
  }

  return { success: true, mealsUsed: 0 }
}

interface SeasonalIngredientRow {
  id: string
  seasonal_months: number[] | null
}

async function pickDefaultSide(
  supabase: SupabaseServerClient,
  category: 'side_vegetable' | 'side_fruit',
  monthOfDelivery: number
): Promise<string | null> {
  const { data } = await supabase
    .from('ingredient_options')
    .select('id, seasonal_months')
    .eq('category', category)
    .eq('available', true)
    .order('sort_order')
    .returns<SeasonalIngredientRow[]>()

  if (!data || data.length === 0) return null

  for (const row of data) {
    const months = row.seasonal_months
    if (!months || months.length === 0 || months.includes(monthOfDelivery)) {
      return row.id
    }
  }
  return null
}

interface BuiltMainItem {
  row: Record<string, unknown>
  defaultSideVegId?: string
}

async function buildMainOrderItem(
  supabase: SupabaseServerClient,
  orderId: string,
  main: MainSelection
): Promise<BuiltMainItem | { error: string }> {
  const base = {
    order_id: orderId,
    slot: 'main',
    name_he_snapshot: main.display_name,
  }

  if (main.kind === 'menu_item') {
    if (!main.menu_item_id) return { error: 'בחירה לא תקינה.' }
    return { row: { ...base, menu_item_id: main.menu_item_id } }
  }

  if (main.kind === 'sandwich_preset') {
    if (!main.sandwich_preset_id) return { error: 'בחירה לא תקינה.' }
    // Snapshot from DB: caller's sandwich_config is ignored — server is source of truth.
    const { data: preset } = await supabase
      .from('sandwich_presets')
      .select(`
        id, name_he, default_side_veg_id,
        bread:bread_id(id, name_he),
        sandwich_preset_fillings(sort_order, ingredient_options(id, name_he)),
        sandwich_preset_vegetables(sort_order, ingredient_options(id, name_he))
      `)
      .eq('id', main.sandwich_preset_id)
      .is('deleted_at', null)
      .eq('is_active', true)
      .single()
      .returns<SandwichPresetRow>()
    if (!preset) return { error: 'הכריך לא נמצא.' }

    const fillings = preset.sandwich_preset_fillings
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({ id: r.ingredient_options.id, name: r.ingredient_options.name_he }))
    const vegetables = preset.sandwich_preset_vegetables
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({ id: r.ingredient_options.id, name: r.ingredient_options.name_he }))
    const summary = `כריך ${preset.bread.name_he}${fillings.length > 0 ? ' עם ' + fillings.map((f) => f.name).join(' + ') : ''}`
    const config: SandwichConfigSnapshot = {
      bread_id: preset.bread.id,
      bread: preset.bread.name_he,
      fillings,
      vegetables,
      summary,
      preset_id: preset.id,
    }
    return {
      row: { ...base, sandwich_config: config, name_he_snapshot: preset.name_he },
      defaultSideVegId: preset.default_side_veg_id,
    }
  }

  if (main.kind === 'custom_sandwich') {
    if (!main.custom_sandwich_id) return { error: 'בחירה לא תקינה.' }
    // Snapshot the sandwich's ingredients into sandwich_config so renames don't
    // rewrite history. Verify ownership at the same time.
    const { data: sandwich } = await supabase
      .from('kid_custom_sandwiches')
      .select('id, kid_id, name_he, kid_custom_sandwich_ingredients(ingredient_option_id, ingredient_options(id, name_he, category))')
      .eq('id', main.custom_sandwich_id)
      .is('deleted_at', null)
      .single()
      .returns<CustomSandwichWithIngredientsRow>()
    if (!sandwich) return { error: 'הכריך השמור לא נמצא.' }

    const config = buildSandwichConfigFromIngredients(
      sandwich.kid_custom_sandwich_ingredients.map((r) => r.ingredient_options)
    )
    if (!config) return { error: 'הכריך השמור פגום.' }
    return {
      row: {
        ...base,
        custom_sandwich_id: main.custom_sandwich_id,
        sandwich_config: config,
        name_he_snapshot: sandwich.name_he,
      },
    }
  }

  // ad_hoc_sandwich
  if (!main.sandwich_config) return { error: 'בחירה לא תקינה.' }
  return { row: { ...base, sandwich_config: main.sandwich_config } }
}

function buildSandwichConfigFromIngredients(
  ingredients: { id: string; name_he: string; category: IngredientCategory }[]
): SandwichConfigSnapshot | null {
  const bread = ingredients.find((i) => i.category === 'bread')
  if (!bread) return null
  const fillings = ingredients.filter((i) => i.category === 'filling').map((i) => ({ id: i.id, name: i.name_he }))
  const vegetables = ingredients.filter((i) => i.category === 'sandwich_vegetable').map((i) => ({ id: i.id, name: i.name_he }))
  const summary = `כריך ${bread.name_he}${fillings.length > 0 ? ' עם ' + fillings.map((f) => f.name).join(' + ') : ''}`
  return { bread_id: bread.id, bread: bread.name_he, fillings, vegetables, summary }
}

// ─── Account deletion ─────────────────────────────────────────────────────────

export async function deleteAccount(): Promise<{ success: true } | { error: string }> {
  const supabase = createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: identity, error: identityError } = await supabase
    .from('auth_identities').select('id')
    .eq('provider', 'supabase').eq('provider_uid', user.id).single()
  if (identityError || !identity) return { error: 'שגיאה בזיהוי המשתמש.' }

  const admin = createAdminClient()

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteAuthError) return { error: 'שגיאה במחיקת החשבון. נסה שוב.' }

  // Cascades to: profiles → kids, subscriptions, orders, kid_custom_sandwiches.
  await admin.from('auth_identities').delete().eq('id', identity.id)

  await supabase.auth.signOut()
  return { success: true }
}

// ─── Custom sandwiches ────────────────────────────────────────────────────────

const SANDWICH_NAME_MAX = 60

const RULE_ERROR_HE: Record<IngredientCategory, string> = {
  bread:              'יש לבחור לחם אחד.',
  filling:            'יש לבחור לפחות מילוי אחד.',
  sandwich_vegetable: 'בחירה לא תקינה בירקות הכריך.',
  side_vegetable:     'בחירה לא תקינה.',
  side_fruit:         'בחירה לא תקינה.',
}

const SANDWICH_BUILDER_CATEGORIES: IngredientCategory[] = ['bread', 'filling', 'sandwich_vegetable']

async function loadIngredientCategories(
  supabase: SupabaseServerClient,
  ids: string[]
): Promise<{ id: string; category: IngredientCategory }[] | null> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('ingredient_options')
    .select('id, category')
    .in('id', ids)
    .returns<{ id: string; category: IngredientCategory | null }[]>()
  if (error || !data) return null
  if (data.some((r) => !r.category)) return null
  return data as { id: string; category: IngredientCategory }[]
}

async function validateIngredientsAgainstKidTags(
  supabase: SupabaseServerClient,
  kidId: string,
  ingredientIds: string[]
): Promise<string | null> {
  const { data: required } = await supabase
    .from('kid_dietary_restrictions')
    .select('dietary_tag_id, dietary_tags(label_he)')
    .eq('kid_id', kidId)
    .returns<KidDietaryRequirementRow[]>()
  if (!required || required.length === 0) return null

  const { data: ingTagRows } = await supabase
    .from('ingredient_dietary_tags')
    .select('ingredient_option_id, dietary_tag_id')
    .in('ingredient_option_id', ingredientIds)
    .returns<{ ingredient_option_id: string; dietary_tag_id: string }[]>()

  const tagsByIng = new Map<string, Set<string>>()
  for (const row of ingTagRows ?? []) {
    let set = tagsByIng.get(row.ingredient_option_id)
    if (!set) { set = new Set(); tagsByIng.set(row.ingredient_option_id, set) }
    set.add(row.dietary_tag_id)
  }

  for (const ingId of ingredientIds) {
    const carriedTags = tagsByIng.get(ingId) ?? new Set<string>()
    for (const r of required) {
      if (!carriedTags.has(r.dietary_tag_id)) {
        const { data: ing } = await supabase
          .from('ingredient_options')
          .select('name_he')
          .eq('id', ingId)
          .single()
        const ingName = ing?.name_he ?? ''
        const tagLabel = r.dietary_tags?.label_he ?? 'הגבלת תזונה'
        return `המרכיב "${ingName}" אינו תואם את ההגבלה "${tagLabel}".`
      }
    }
  }
  return null
}

function validateSandwichSelection(
  rows: { id: string; category: IngredientCategory }[],
  ingredientIds: string[]
): string | null {
  if (rows.length !== ingredientIds.length) return 'אחד או יותר מהמרכיבים שנבחרו אינו תקין.'

  const counts: Record<IngredientCategory, number> = {
    bread: 0, filling: 0, sandwich_vegetable: 0, side_vegetable: 0, side_fruit: 0,
  }
  for (const r of rows) {
    if (!SANDWICH_BUILDER_CATEGORIES.includes(r.category)) {
      return 'הכריך יכול להכיל רק לחם, מילוי וירקות בכריך.'
    }
    counts[r.category]++
  }

  for (const cat of SANDWICH_BUILDER_CATEGORIES) {
    const rule = SANDWICH_CATEGORY_RULES[cat]
    const c = counts[cat]
    if (c < rule.min) return RULE_ERROR_HE[cat]
    if (rule.max !== null && c > rule.max) return RULE_ERROR_HE[cat]
  }
  return null
}

async function loadFullSandwich(
  supabase: SupabaseServerClient,
  sandwichId: string
): Promise<CustomSandwich | null> {
  const { data } = await supabase
    .from('kid_custom_sandwiches')
    .select('id, kid_id, name_he, kid_custom_sandwich_ingredients(ingredient_option_id)')
    .eq('id', sandwichId)
    .is('deleted_at', null)
    .single()
    .returns<{
      id: string
      kid_id: string
      name_he: string
      kid_custom_sandwich_ingredients: Pick<CustomSandwichIngredientJoinRow, 'ingredient_option_id'>[]
    }>()
  if (!data) return null
  return {
    id: data.id,
    kid_id: data.kid_id,
    name_he: data.name_he,
    ingredient_ids: data.kid_custom_sandwich_ingredients.map((r) => r.ingredient_option_id),
  }
}

export async function createCustomSandwich(
  kidId: string,
  name: string,
  ingredientIds: string[]
): Promise<{ sandwich: CustomSandwich } | { error: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'יש להזין שם לכריך.' }
  if (trimmed.length > SANDWICH_NAME_MAX) return { error: `שם הכריך ארוך מדי (עד ${SANDWICH_NAME_MAX} תווים).` }
  if (!Array.isArray(ingredientIds) || ingredientIds.length === 0) return { error: 'יש לבחור לפחות לחם אחד.' }

  const uniqueIds = Array.from(new Set(ingredientIds))
  if (uniqueIds.length !== ingredientIds.length) return { error: 'מרכיב נבחר יותר מפעם אחת.' }

  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: kid } = await supabase
    .from('kids').select('id').eq('id', kidId).eq('profile_id', profileId).is('deleted_at', null).single()
  if (!kid) return { error: 'ילד לא נמצא.' }

  const rows = await loadIngredientCategories(supabase, uniqueIds)
  if (!rows) return { error: 'אחד או יותר מהמרכיבים שנבחרו אינו תקין.' }

  const validationError = validateSandwichSelection(rows, uniqueIds)
  if (validationError) return { error: validationError }

  const tagError = await validateIngredientsAgainstKidTags(supabase, kidId, uniqueIds)
  if (tagError) return { error: tagError }

  const { data: inserted, error: insertError } = await supabase
    .from('kid_custom_sandwiches')
    .insert({ kid_id: kidId, name_he: trimmed })
    .select('id')
    .single()
  if (insertError || !inserted) return { error: 'שגיאה בשמירת הכריך. נסה שוב.' }

  const { error: linkError } = await supabase
    .from('kid_custom_sandwich_ingredients')
    .insert(uniqueIds.map((ingredient_option_id) => ({ sandwich_id: inserted.id, ingredient_option_id })))
  if (linkError) {
    await supabase.from('kid_custom_sandwiches').update({ deleted_at: new Date().toISOString() }).eq('id', inserted.id)
    return { error: 'שגיאה בשמירת מרכיבי הכריך. נסה שוב.' }
  }

  const full = await loadFullSandwich(supabase, inserted.id)
  if (!full) return { error: 'שגיאה בטעינת הכריך השמור.' }
  return { sandwich: full }
}

export async function updateCustomSandwich(
  sandwichId: string,
  name: string,
  ingredientIds: string[]
): Promise<{ sandwich: CustomSandwich } | { error: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'יש להזין שם לכריך.' }
  if (trimmed.length > SANDWICH_NAME_MAX) return { error: `שם הכריך ארוך מדי (עד ${SANDWICH_NAME_MAX} תווים).` }
  if (!Array.isArray(ingredientIds) || ingredientIds.length === 0) return { error: 'יש לבחור לפחות לחם אחד.' }

  const uniqueIds = Array.from(new Set(ingredientIds))
  if (uniqueIds.length !== ingredientIds.length) return { error: 'מרכיב נבחר יותר מפעם אחת.' }

  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: existing } = await supabase
    .from('kid_custom_sandwiches')
    .select('id, kid_id, kids!inner(profile_id, deleted_at)')
    .eq('id', sandwichId)
    .is('deleted_at', null)
    .single()
    .returns<CustomSandwichOwnershipRow>()
  if (!existing || existing.kids?.profile_id !== profileId || existing.kids.deleted_at) {
    return { error: 'כריך לא נמצא.' }
  }

  const rows = await loadIngredientCategories(supabase, uniqueIds)
  if (!rows) return { error: 'אחד או יותר מהמרכיבים שנבחרו אינו תקין.' }

  const validationError = validateSandwichSelection(rows, uniqueIds)
  if (validationError) return { error: validationError }

  const tagError = await validateIngredientsAgainstKidTags(supabase, existing.kid_id, uniqueIds)
  if (tagError) return { error: tagError }

  const { error: updateError } = await supabase
    .from('kid_custom_sandwiches').update({ name_he: trimmed }).eq('id', sandwichId)
  if (updateError) return { error: 'שגיאה בעדכון הכריך. נסה שוב.' }

  await supabase.from('kid_custom_sandwich_ingredients').delete().eq('sandwich_id', sandwichId)
  const { error: linkError } = await supabase
    .from('kid_custom_sandwich_ingredients')
    .insert(uniqueIds.map((ingredient_option_id) => ({ sandwich_id: sandwichId, ingredient_option_id })))
  if (linkError) return { error: 'שגיאה בעדכון מרכיבי הכריך. נסה שוב.' }

  const full = await loadFullSandwich(supabase, sandwichId)
  if (!full) return { error: 'שגיאה בטעינת הכריך המעודכן.' }
  return { sandwich: full }
}

export async function removeCustomSandwich(
  sandwichId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: existing } = await supabase
    .from('kid_custom_sandwiches')
    .select('id, kid_id, kids!inner(profile_id, deleted_at)')
    .eq('id', sandwichId)
    .is('deleted_at', null)
    .single()
    .returns<CustomSandwichOwnershipRow>()
  if (!existing || existing.kids?.profile_id !== profileId) {
    return { error: 'כריך לא נמצא.' }
  }

  const { error } = await supabase
    .from('kid_custom_sandwiches')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', sandwichId)
  if (error) return { error: 'שגיאה במחיקת הכריך. נסה שוב.' }

  return { success: true }
}

// ─── Kid favorites ────────────────────────────────────────────────────────────

type FavoriteTarget =
  | { menu_item_id: string; preset_id?: undefined }
  | { preset_id: string; menu_item_id?: undefined }

export async function toggleKidFavorite(
  kidId: string,
  target: FavoriteTarget,
  desired: boolean
): Promise<{ favorite: KidFavorite | null } | { error: string }> {
  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: kid } = await supabase
    .from('kids').select('id').eq('id', kidId).eq('profile_id', profileId).is('deleted_at', null).single()
  if (!kid) return { error: 'ילד לא נמצא.' }

  const isMenu = 'menu_item_id' in target && !!target.menu_item_id
  const isPreset = 'preset_id' in target && !!target.preset_id
  if (isMenu === isPreset) return { error: 'בחירה לא תקינה.' }

  const targetCol = isMenu ? 'menu_item_id' : 'preset_id'
  const targetVal = isMenu ? target.menu_item_id! : target.preset_id!

  if (!desired) {
    const { error } = await supabase
      .from('kid_favorite_meals')
      .delete()
      .eq('kid_id', kidId)
      .eq(targetCol, targetVal)
    if (error) return { error: `שגיאה בעדכון המועדפים: ${error.message}` }
    return { favorite: null }
  }

  const insert: Record<string, unknown> = { kid_id: kidId, [targetCol]: targetVal }

  const { data, error } = await supabase
    .from('kid_favorite_meals')
    .insert(insert)
    .select('id, kid_id, menu_item_id, preset_id')
    .single()
    .returns<KidFavorite>()
  if (error || !data) {
    // Duplicate-key from concurrent insert: treat as already-favorited and refetch.
    if (error?.code === '23505') {
      const { data: existing } = await supabase
        .from('kid_favorite_meals')
        .select('id, kid_id, menu_item_id, preset_id')
        .eq('kid_id', kidId)
        .eq(targetCol, targetVal)
        .maybeSingle()
        .returns<KidFavorite>()
      if (existing) return { favorite: existing }
    }
    return { error: `שגיאה בעדכון המועדפים: ${error?.message ?? 'unknown'}` }
  }
  return { favorite: data }
}
