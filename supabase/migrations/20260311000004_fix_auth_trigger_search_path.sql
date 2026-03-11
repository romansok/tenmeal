-- =============================================================================
-- Migration: 20260311000004_fix_auth_trigger_search_path.sql
-- Description: Fix handle_new_auth_user trigger function missing SET search_path = public,
--              which caused "Database error saving new user" on Google OAuth signup
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_identity_id UUID;
BEGIN
  -- Upsert identity row (idempotent on re-login)
  INSERT INTO auth_identities (provider, provider_uid)
  VALUES ('supabase', NEW.id::TEXT)
  ON CONFLICT (provider, provider_uid) DO NOTHING
  RETURNING id INTO v_identity_id;

  -- If already existed, look it up
  IF v_identity_id IS NULL THEN
    SELECT id INTO v_identity_id
    FROM auth_identities
    WHERE provider = 'supabase' AND provider_uid = NEW.id::TEXT;
  END IF;

  -- Create profile if it doesn't exist yet
  INSERT INTO profiles (identity_id, full_name, avatar_url)
  VALUES (
    v_identity_id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (identity_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
