'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface KidInput {
  first_name: string
  last_name: string
  class_name: string
  phone: string
  school_id: string
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
    return { error: `שגיאה בזיהוי המשתמש: ${identityError?.message ?? 'שורה לא נמצאה'}` }
  }

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
      return { error: 'שגיאה ביצירת הפרופיל. נסה שוב.' }
    }
    profileId = newProfile.id
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ phone: data.phone, onboarding_done: true })
    .eq('id', profileId)

  if (updateError) {
    return { error: 'שגיאה בשמירת הפרופיל. נסה שוב.' }
  }

  for (let i = 0; i < data.kids.length; i++) {
    const kid = data.kids[i]

    const { data: kidRow, error: kidError } = await supabase
      .from('kids')
      .insert({
        profile_id: profileId,
        name: kid.first_name,
        last_name: kid.last_name || null,
        class_name: kid.class_name || null,
        phone: kid.phone || null,
        school_id: kid.school_id || null,
        emoji_avatar: kid.emoji_avatar,
        sort_order: i,
      })
      .select('id')
      .single()

    if (kidError || !kidRow) {
      return { error: `שגיאה בשמירת פרטי ${kid.first_name}. נסה שוב.` }
    }

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
