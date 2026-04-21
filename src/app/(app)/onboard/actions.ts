'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface KidInput {
  first_name: string
  last_name: string
  class_name: string
  phone: string
  school_name: string
  school_address: string
  emoji_avatar: string
  tag_ids: string[]
}

interface OnboardingData {
  phone: string
  kids: KidInput[]
}

export async function completeOnboarding(
  data: OnboardingData
): Promise<{ error: string } | never> {
  const supabase = createClient()

  // 1. Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'לא מחובר. נסה להתחבר מחדש.' }
  }

  // 2. Look up auth_identities
  const { data: identityRow, error: identityError } = await supabase
    .from('auth_identities')
    .select('id')
    .eq('provider', 'supabase')
    .eq('provider_uid', user.id)
    .single()

  if (identityError || !identityRow) {
    console.error('[onboard] auth_identities lookup failed:', identityError, 'user.id:', user.id)
    return { error: `שגיאה בזיהוי המשתמש: ${identityError?.message ?? 'שורה לא נמצאה'}` }
  }

  // 3. Look up or create profile (handles re-login after partial account deletion)
  let profileId: string

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('identity_id', identityRow.id)
    .maybeSingle()

  if (existingProfile) {
    profileId = existingProfile.id
  } else {
    const admin = createAdminClient()
    const { data: newProfile, error: createError } = await admin
      .from('profiles')
      .insert({
        identity_id: identityRow.id,
        full_name: user.user_metadata?.full_name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      })
      .select('id')
      .single()

    if (createError || !newProfile) {
      console.error('[onboard] profile creation failed:', createError)
      return { error: 'שגיאה ביצירת הפרופיל. נסה שוב.' }
    }
    profileId = newProfile.id
  }

  const profile = { id: profileId }

  // 4. Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ phone: data.phone, onboarding_done: true })
    .eq('id', profile.id)

  if (updateError) {
    return { error: 'שגיאה בשמירת הפרופיל. נסה שוב.' }
  }

  // 5. Insert kids
  for (let i = 0; i < data.kids.length; i++) {
    const kid = data.kids[i]

    const { data: kidRow, error: kidError } = await supabase
      .from('kids')
      .insert({
        profile_id: profile.id,
        name: kid.first_name,
        last_name: kid.last_name || null,
        class_name: kid.class_name || null,
        phone: kid.phone || null,
        school_name: kid.school_name || null,
        school_address: kid.school_address || null,
        emoji_avatar: kid.emoji_avatar,
        sort_order: i,
      })
      .select('id')
      .single()

    if (kidError || !kidRow) {
      return { error: `שגיאה בשמירת פרטי ${kid.first_name}. נסה שוב.` }
    }

    // 6. Insert dietary restrictions for this kid
    if (kid.tag_ids.length > 0) {
      const restrictions = kid.tag_ids.map((tagId) => ({
        kid_id: kidRow.id,
        dietary_tag_id: tagId,
      }))

      const { error: tagsError } = await supabase
        .from('kid_dietary_restrictions')
        .insert(restrictions)

      if (tagsError) {
        return { error: `שגיאה בשמירת העדפות תזונה של ${kid.first_name}. נסה שוב.` }
      }
    }
  }

  redirect('/app')
}
