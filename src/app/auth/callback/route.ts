import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/user'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

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
    const { data: identityRow } = await supabase
      .from('auth_identities')
      .select('id')
      .eq('provider', 'supabase')
      .eq('provider_uid', user.id)
      .single()

    if (identityRow) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_done')
        .eq('identity_id', identityRow.id)
        .single()

      if (profile && !profile.onboarding_done) {
        return NextResponse.redirect(`${origin}/onboard`)
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
