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
interface SubscriptionRow { id: string; meals_remaining: number; starts_at: string; expires_at: string | null; subscription_plans: SubscriptionPlanBrief | null }

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
    .select('id, meals_remaining, starts_at, expires_at, subscription_plans(id, name_he, meals_count, price_agorot)')
    .single()

  if (insertError || !newSub) return { error: 'שגיאה ברכישת המנוי. נסה שוב.' }
  return { subscription: newSub as unknown as SubscriptionRow }
}

interface DayInput { date: string; menuItemId: string | null; notes: string }
interface SaveInput { kidId: string; profileId: string; subscriptionId: string | null; subscriptionMealsRemaining: number; days: DayInput[] }
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

  // Decrement subscription meals_remaining
  if (mealsUsed > 0 && input.subscriptionId) {
    await supabase
      .from('subscriptions')
      .update({ meals_remaining: Math.max(0, input.subscriptionMealsRemaining - mealsUsed) })
      .eq('id', input.subscriptionId)
  }

  return { success: true, mealsUsed }
}
