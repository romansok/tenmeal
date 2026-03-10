import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  // Check onboarding status
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: identity } = await supabase
      .from('auth_identities')
      .select('profile_id')
      .eq('provider_user_id', user.id)
      .single()

    if (identity?.profile_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_done')
        .eq('id', identity.profile_id)
        .single()

      if (profile && !profile.onboarding_done) {
        return NextResponse.redirect(`${origin}/onboard`)
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
