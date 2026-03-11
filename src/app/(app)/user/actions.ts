'use server'

import { createClient } from '@/lib/supabase/server'

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
  class_name: string | null
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
      class_name: data.class_name?.trim() || null,
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
    .select('id, name, class_name, emoji_avatar, sort_order, kid_dietary_restrictions(dietary_tag_id, dietary_tags(id, label_he))')
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
      class_name: data.class_name?.trim() || null,
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

// ─────────────────────────────────────────────────────────────────────────────

interface DayInput { date: string; menuItemId: string | null; notes: string }
interface SaveInput { kidId: string; profileId: string; days: DayInput[] }
type SaveResult = { success: true; mealsUsed: number } | { error: string }

export async function saveWeekOrders(input: SaveInput): Promise<SaveResult> {
  const supabase = createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return { error: 'לא מחובר. נסה להתחבר מחדש.' }

  let mealsUsed = 0

  for (const day of input.days) {
    // Find existing order for this kid + date
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('id, order_items(id, menu_item_id)')
      .eq('profile_id', input.profileId)
      .eq('kid_id', input.kidId)
      .eq('delivery_date', day.date)
      .is('deleted_at', null)
      .limit(1)

    const existing = existingOrders?.[0] ?? null

    if (day.menuItemId) {
      if (!existing) {
        // Insert new order + order_item
        const { data: newOrder, error: orderErr } = await supabase
          .from('orders')
          .insert({
            profile_id: input.profileId,
            kid_id: input.kidId,
            delivery_date: day.date,
            notes: day.notes || null,
            status: 'pending',
          })
          .select('id')
          .single()

        if (orderErr || !newOrder) return { error: 'שגיאה ביצירת הזמנה. נסה שוב.' }

        const { error: itemErr } = await supabase
          .from('order_items')
          .insert({ order_id: newOrder.id, menu_item_id: day.menuItemId, quantity: 1 })

        if (itemErr) return { error: 'שגיאה בהוספת פריט להזמנה.' }

        mealsUsed++
      } else {
        const existingItemMenuId = (existing.order_items as any[])?.[0]?.menu_item_id ?? null
        if (existingItemMenuId === day.menuItemId) {
          // Same item — update notes only
          await supabase
            .from('orders')
            .update({ notes: day.notes || null })
            .eq('id', existing.id)
        } else {
          // Different item — update notes + swap order_item
          await supabase
            .from('orders')
            .update({ notes: day.notes || null })
            .eq('id', existing.id)

          await supabase
            .from('order_items')
            .delete()
            .eq('order_id', existing.id)

          await supabase
            .from('order_items')
            .insert({ order_id: existing.id, menu_item_id: day.menuItemId, quantity: 1 })
        }
      }
    } else {
      // menuItemId is null — soft-delete existing order if present
      if (existing) {
        await supabase
          .from('orders')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', existing.id)
      }
    }
  }

  // FIFO decrement: deplete oldest active subscription first
  if (mealsUsed > 0) {
    const now = new Date().toISOString()
    const { data: activeSubs } = await supabase
      .from('subscriptions')
      .select('id, meals_remaining')
      .eq('profile_id', input.profileId)
      .eq('status', 'active')
      .gt('meals_remaining', 0)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('starts_at', { ascending: true })

    let toDeduct = mealsUsed
    for (const sub of activeSubs ?? []) {
      if (toDeduct <= 0) break
      const use = Math.min(toDeduct, sub.meals_remaining)
      await supabase
        .from('subscriptions')
        .update({ meals_remaining: sub.meals_remaining - use })
        .eq('id', sub.id)
      toDeduct -= use
    }
  }

  return { success: true, mealsUsed }
}
