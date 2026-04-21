import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/app'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/app'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  // Build the redirect response first so we can attach cookies directly to it
  const redirectResponse = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.headers
            .get('cookie')
            ?.split(';')
            .map((c) => {
              const [name, ...rest] = c.trim().split('=')
              return { name: name.trim(), value: rest.join('=') }
            }) ?? []
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            redirectResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

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

      // No profile (e.g. partial delete) or onboarding not done → re-onboard
      if (!profile || !profile.onboarding_done) {
        redirectResponse.headers.set('location', `${origin}/onboard`)
        return redirectResponse
      }
    } else {
      // No identity row yet — new user, send to onboarding
      redirectResponse.headers.set('location', `${origin}/onboard`)
      return redirectResponse
    }
  }

  return redirectResponse
}
