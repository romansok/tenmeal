import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardView from './ProfileView'

export default async function UserPage() {
  const supabase = createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect('/login')

  const { data: identityRow } = await supabase
    .from('auth_identities')
    .select('id')
    .eq('provider', 'supabase')
    .eq('provider_uid', user.id)
    .single()

  if (!identityRow) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, onboarding_done')
    .eq('identity_id', identityRow.id)
    .single()

  if (!profile) redirect('/login')
  if (!profile.onboarding_done) redirect('/onboard')

  const now = new Date().toISOString()

  // Compute current week range (Sun–Thu)
  const today = new Date()
  const weekStartDate = new Date(today)
  weekStartDate.setDate(today.getDate() - today.getDay())
  const pad = (n: number) => String(n).padStart(2, '0')
  const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const weekStartStr = toKey(weekStartDate)
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekStartDate.getDate() + 4)
  const weekEndStr = toKey(weekEndDate)

  const [kidsResult, subscriptionResult, menuItemsResult, weekOrdersResult, plansResult] = await Promise.all([
    supabase
      .from('kids')
      .select(
        'id, name, class_name, emoji_avatar, sort_order, kid_dietary_restrictions(dietary_tag_id, dietary_tags(id, label_he))'
      )
      .eq('profile_id', profile.id)
      .is('deleted_at', null)
      .order('sort_order'),

    supabase
      .from('subscriptions')
      .select(
        'id, meals_remaining, starts_at, expires_at, subscription_plans(id, name_he, meals_count, price_agorot)'
      )
      .eq('profile_id', profile.id)
      .eq('status', 'active')
      .gt('meals_remaining', 0)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('menu_items')
      .select('id, name_he, price_agorot, is_customizable, image_url')
      .is('deleted_at', null)
      .eq('is_available', true)
      .order('sort_order'),

    supabase
      .from('orders')
      .select('id, kid_id, delivery_date, notes, status, order_items(id, menu_item_id, quantity)')
      .eq('profile_id', profile.id)
      .gte('delivery_date', weekStartStr)
      .lte('delivery_date', weekEndStr)
      .is('deleted_at', null),

    supabase
      .from('subscription_plans')
      .select('id, name_he, meals_count, price_agorot')
      .eq('is_active', true)
      .order('meals_count', { ascending: true }),
  ])

  const kids = kidsResult.data ?? []
  const subscription = subscriptionResult.data ?? null
  const menuItems = menuItemsResult.data ?? []
  const weekOrders = weekOrdersResult.data ?? []
  const plans = plansResult.data ?? []

  return (
    <div
      className="min-h-screen pt-24"
      style={{ background: 'linear-gradient(135deg, #FFF8F0 0%, #FFE0CC 50%, #FFD0AA 100%)' }}
    >
      <DashboardView
        profile={profile as any}
        kids={kids as any}
        subscription={subscription as any}
        menuItems={menuItems as any}
        initialWeekOrders={weekOrders as any}
        initialWeekStart={weekStartStr}
        plans={plans as any}
      />
    </div>
  )
}
