import { createClient } from '@/lib/supabase/server'
import OnboardForm from './OnboardForm'

export default async function OnboardPage() {
  const supabase = createClient()

  const [tagsResult, schoolsResult] = await Promise.all([
    supabase.from('dietary_tags').select('id, slug, label_he').order('slug'),
    supabase.from('schools').select('id, name_he, address').eq('active', true).order('name_he'),
  ])

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: 'linear-gradient(135deg, #FFF8F0 0%, #FFE8D6 50%, #FFB347 100%)' }}
    >
      <OnboardForm tags={tagsResult.data ?? []} schools={schoolsResult.data ?? []} />
    </div>
  )
}
