'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface KidInput {
  name: string
  class_name: string
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
    return { error: 'שגיאה בזיהוי המשתמש. נסה שוב.' }
  }

  // 3. Look up profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('identity_id', identityRow.id)
    .single()

  if (profileError || !profile) {
    return { error: 'פרופיל לא נמצא. נסה שוב.' }
  }

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
        name: kid.name,
        class_name: kid.class_name || null,
        emoji_avatar: kid.emoji_avatar,
        sort_order: i,
      })
      .select('id')
      .single()

    if (kidError || !kidRow) {
      return { error: `שגיאה בשמירת פרטי ${kid.name}. נסה שוב.` }
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
        return { error: `שגיאה בשמירת העדפות תזונה של ${kid.name}. נסה שוב.` }
      }
    }
  }

  redirect('/user')
}
