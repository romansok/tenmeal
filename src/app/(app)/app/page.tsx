import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardView from './ProfileView'
import { loadDashboard } from './data/loadDashboard'

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

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, onboarding_done')
    .eq('identity_id', identityRow.id)
    .single()

  if (!profileRow) redirect('/login')
  if (!profileRow.onboarding_done) redirect('/onboard')

  const profile = { ...profileRow, email: user.email ?? null }

  const data = await loadDashboard(supabase, profile)

  return (
    <div
      className="min-h-screen pt-24"
      style={{ background: 'linear-gradient(135deg, #FFF8F0 0%, #FFE0CC 50%, #FFD0AA 100%)' }}
    >
      <DashboardView data={data} />
    </div>
  )
}
