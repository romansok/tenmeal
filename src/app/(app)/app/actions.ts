'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PHONE_RE = /^0[2-9]\d{7,8}$/

function isValidPhone(phone: string) {
  return PHONE_RE.test(phone.replace(/-/g, '').replace(/\s/g, ''))
}

export async function updatePhone(phone: string): Promise<{ success: true } | { error: string }> {
  if (!isValidPhone(phone)) {
    return { error: 'מספר טלפון לא תקין. יש להזין מספר ישראלי תקני.' }
  }

  const supabase = createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'לא מחובר. נסה להתחבר מחדש.' }
  }

  const { data: identityRow, error: identityError } = await supabase
    .from('auth_identities')
    .select('id')
    .eq('provider', 'supabase')
    .eq('provider_uid', user.id)
    .single()

  if (identityError || !identityRow) {
    return { error: 'שגיאה בזיהוי המשתמש. נסה שוב.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('identity_id', identityRow.id)
    .single()

  if (profileError || !profile) {
    return { error: 'פרופיל לא נמצא. נסה שוב.' }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ phone })
    .eq('id', profile.id)

  if (updateError) {
    return { error: 'שגיאה בשמירת הטלפון. נסה שוב.' }
  }

  return { success: true }
}

interface SubscriptionPlanBrief { id: string; name_he: string; meals_count: number; price_agorot: number }
interface SubscriptionRow { id: string; meals_remaining: number; starts_at: string; expires_at: string | null; auto_renew: boolean; subscription_plans: SubscriptionPlanBrief | null }

export async function purchaseSubscription(
  planId: string
): Promise<{ subscription: SubscriptionRow } | { error: string }> {
  if (!planId) return { error: 'נדרש מזהה חבילה.' }

  const supabase = createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: identityRow, error: identityError } = await supabase
    .from('auth_identities').select('id')
    .eq('provider', 'supabase').eq('provider_uid', user.id).single()
  if (identityError || !identityRow) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('id').eq('identity_id', identityRow.id).single()
  if (profileError || !profile) return { error: 'פרופיל לא נמצא.' }

  const { data: plan, error: planError } = await supabase
    .from('subscription_plans').select('id, meals_count')
    .eq('id', planId).eq('is_active', true).single()
  if (planError || !plan) return { error: 'חבילה לא נמצאה.' }

  const { data: newSub, error: insertError } = await supabase
    .from('subscriptions')
    .insert({ profile_id: profile.id, plan_id: planId, meals_remaining: plan.meals_count, status: 'active' })
    .select('id, meals_remaining, starts_at, expires_at, auto_renew, subscription_plans(id, name_he, meals_count, price_agorot)')
    .single()

  if (insertError || !newSub) return { error: 'שגיאה ברכישת המנוי. נסה שוב.' }
  return { subscription: newSub as unknown as SubscriptionRow }
}

export async function toggleAutoRenew(
  subscriptionId: string,
  value: boolean
): Promise<{ success: true } | { error: string }> {
  if (!subscriptionId) return { error: 'נדרש מזהה מנוי.' }

  const supabase = createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  const { data: identityRow, error: identityError } = await supabase
    .from('auth_identities').select('id')
    .eq('provider', 'supabase').eq('provider_uid', user.id).single()
  if (identityError || !identityRow) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('id').eq('identity_id', identityRow.id).single()
  if (profileError || !profile) return { error: 'פרופיל לא נמצא.' }

  // Verify subscription belongs to this profile
  const { data: sub, error: subError } = await supabase
    .from('subscriptions').select('id').eq('id', subscriptionId).eq('profile_id', profile.id).single()
  if (subError || !sub) return { error: 'מנוי לא נמצא.' }

  const { error: updateError } = await supabase
    .from('subscriptions').update({ auto_renew: value }).eq('id', subscriptionId)
  if (updateError) return { error: 'שגיאה בעדכון המנוי. נסה שוב.' }

  return { success: true }
}

// ─── Kid CRUD ────────────────────────────────────────────────────────────────

async function getProfileId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
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

interface KidData {
  name: string
  last_name: string | null
  class_name: string | null
  phone: string | null
  emoji_avatar: string
  school_name: string | null
  school_address: string | null
  dietary_tag_ids: string[]
}

interface KidRow {
  id: string
  name: string
  class_name: string | null
  emoji_avatar: string
  sort_order: number
  kid_dietary_restrictions: { dietary_tag_id: string; dietary_tags: { id: string; label_he: string } | null }[]
}

export async function addKid(data: KidData): Promise<{ kid: KidRow } | { error: string }> {
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
      school_name: data.school_name?.trim() || null,
      school_address: data.school_address?.trim() || null,
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
    .select('id, name, last_name, class_name, phone, emoji_avatar, sort_order, kid_dietary_restrictions(dietary_tag_id, dietary_tags(id, label_he))')
    .eq('id', kidRow.id)
    .single()

  if (!full) return { error: 'שגיאה בטעינת נתוני הילד.' }
  return { kid: full as unknown as KidRow }
}

export async function updateKid(kidId: string, data: KidData): Promise<{ success: true } | { error: string }> {
  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  // Verify kid belongs to this profile
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
      school_name: data.school_name?.trim() || null,
      school_address: data.school_address?.trim() || null,
    })
    .eq('id', kidId)

  if (updateError) return { error: 'שגיאה בעדכון הילד. נסה שוב.' }

  // Replace dietary restrictions
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

// ─── Single-day auto-save ────────────────────────────────────────────────────

interface SaveDayInput {
  kidId: string
  profileId: string
  date: string
  menuItemId: string | null
  notes: string
}

export async function saveDayOrder(
  input: SaveDayInput
): Promise<{ success: true; mealsUsed: number } | { error: string }> {
  const supabase = createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  // Server-side date guard: only allow tomorrow+
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (input.date <= todayKey) return { error: 'ניתן לשנות ארוחות רק מיום מחר והלאה.' }

  // Find existing order for this kid + date
  const { data: existingOrders } = await supabase
    .from('orders')
    .select('id, order_items(id, menu_item_id)')
    .eq('profile_id', input.profileId)
    .eq('kid_id', input.kidId)
    .eq('delivery_date', input.date)
    .is('deleted_at', null)
    .limit(1)

  const existing = existingOrders?.[0] ?? null

  if (input.menuItemId) {
    // Fetch price for menu item
    const { data: menuItem } = await supabase
      .from('menu_items')
      .select('id, price_agorot')
      .eq('id', input.menuItemId)
      .single()
    const price = menuItem?.price_agorot ?? 0

    if (!existing) {
      // New meal — insert order + order_item
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          profile_id: input.profileId,
          kid_id: input.kidId,
          delivery_date: input.date,
          notes: input.notes || null,
          status: 'pending',
        })
        .select('id')
        .single()
      if (orderErr || !newOrder) return { error: 'שגיאה ביצירת הזמנה. נסה שוב.' }

      const { error: itemErr } = await supabase
        .from('order_items')
        .insert({ order_id: newOrder.id, menu_item_id: input.menuItemId, quantity: 1, unit_price_agorot: price })
      if (itemErr) return { error: 'שגיאה בהוספת פריט להזמנה.' }

      // FIFO deplete 1 meal
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
        await supabase
          .from('subscriptions')
          .update({ meals_remaining: sub.meals_remaining - 1 })
          .eq('id', sub.id)
      }

      return { success: true, mealsUsed: 1 }
    } else {
      const existingItemMenuId = (existing.order_items as any[])?.[0]?.menu_item_id ?? null
      if (existingItemMenuId === input.menuItemId) {
        // Same item — update notes only
        await supabase.from('orders').update({ notes: input.notes || null }).eq('id', existing.id)
      } else {
        // Swap meal — update notes + replace order_item
        await supabase.from('orders').update({ notes: input.notes || null }).eq('id', existing.id)
        await supabase.from('order_items').delete().eq('order_id', existing.id)
        const { error: swapErr } = await supabase
          .from('order_items')
          .insert({ order_id: existing.id, menu_item_id: input.menuItemId, quantity: 1, unit_price_agorot: price })
        if (swapErr) return { error: 'שגיאה בעדכון פריט בהזמנה.' }
      }
      return { success: true, mealsUsed: 0 }
    }
  } else {
    // Cancel — soft-delete existing order if present
    if (existing) {
      const hadMeal = (existing.order_items as any[])?.length > 0
      await supabase.from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', existing.id)

      if (hadMeal) {
        // FIFO refund 1 meal
        const now = new Date().toISOString()
        const { data: activeSubs } = await supabase
          .from('subscriptions')
          .select('id, meals_remaining, subscription_plans(meals_count)')
          .eq('profile_id', input.profileId)
          .eq('status', 'active')
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('starts_at', { ascending: true })

        for (const sub of (activeSubs ?? []) as any[]) {
          const cap: number = sub.subscription_plans?.meals_count ?? Infinity
          const space = Math.max(0, cap - sub.meals_remaining)
          if (space > 0) {
            await supabase
              .from('subscriptions')
              .update({ meals_remaining: sub.meals_remaining + 1 })
              .eq('id', sub.id)
            break
          }
        }
        return { success: true, mealsUsed: -1 }
      }
    }
    return { success: true, mealsUsed: 0 }
  }
}

// ─── Kid favorites ────────────────────────────────────────────────────────────

export async function toggleKidFavorite(
  kidId: string,
  menuItemId: string,
  isFavorite: boolean
): Promise<{ success: true } | { error: string }> {
  if (!kidId || !menuItemId) return { error: 'נתונים חסרים.' }

  const supabase = createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  // Verify kid belongs to this profile (defense-in-depth; RLS also enforces)
  const { data: kid } = await supabase
    .from('kids')
    .select('id')
    .eq('id', kidId)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .single()
  if (!kid) return { error: 'ילד לא נמצא.' }

  if (isFavorite) {
    const { error } = await supabase
      .from('kid_favorite_meals')
      .insert({ kid_id: kidId, menu_item_id: menuItemId })
    if (error && error.code !== '23505') return { error: 'שגיאה בשמירת המועדפים. נסה שוב.' }
  } else {
    const { error } = await supabase
      .from('kid_favorite_meals')
      .delete()
      .eq('kid_id', kidId)
      .eq('menu_item_id', menuItemId)
    if (error) return { error: 'שגיאה בהסרת המועדפים. נסה שוב.' }
  }

  return { success: true }
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

  // Delete auth.users — must happen before removing auth_identities so the
  // session stays valid long enough to sign out cleanly.
  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteAuthError) return { error: 'שגיאה במחיקת החשבון. נסה שוב.' }

  // Delete auth_identities via admin client (no DELETE RLS policy for the user role).
  // Cascades to: profiles → kids, subscriptions, orders, saved_orders, favorite_meals.
  await admin.from('auth_identities').delete().eq('id', identity.id)

  await supabase.auth.signOut()
  return { success: true }
}
