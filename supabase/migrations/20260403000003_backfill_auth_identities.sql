-- Backfill auth_identities + profiles for any auth.users rows that were
-- created before the on_auth_user_created trigger was in place.

DO $$
DECLARE
  u RECORD;
  v_identity_id UUID;
BEGIN
  FOR u IN
    SELECT au.id, au.raw_user_meta_data
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM public.auth_identities ai
      WHERE ai.provider = 'supabase' AND ai.provider_uid = au.id::TEXT
    )
  LOOP
    INSERT INTO public.auth_identities (provider, provider_uid)
    VALUES ('supabase', u.id::TEXT)
    ON CONFLICT (provider, provider_uid) DO NOTHING
    RETURNING id INTO v_identity_id;

    IF v_identity_id IS NULL THEN
      SELECT id INTO v_identity_id
      FROM public.auth_identities
      WHERE provider = 'supabase' AND provider_uid = u.id::TEXT;
    END IF;

    INSERT INTO public.profiles (identity_id, full_name, avatar_url)
    VALUES (
      v_identity_id,
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (identity_id) DO NOTHING;
  END LOOP;
END;
$$;
