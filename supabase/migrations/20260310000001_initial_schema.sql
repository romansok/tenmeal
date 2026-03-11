-- =============================================================================
-- Migration: 20260310000001_initial_schema.sql
-- Tenmeal — Initial PostgreSQL schema
-- All prices stored in agorot (integer) to avoid floating-point errors.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared: updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: attach the updated_at trigger to any table
CREATE OR REPLACE FUNCTION attach_updated_at(tbl TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER set_updated_at
     BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
    tbl
  );
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Auth abstraction layer
-- ---------------------------------------------------------------------------

-- auth_identities: bridges any auth provider to business tables.
-- Migrating auth later only requires updating auth.profile_id().
CREATE TABLE auth_identities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL CHECK (provider IN ('supabase', 'custom')),
  provider_uid  TEXT NOT NULL,                    -- auth.users.id for supabase
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_uid)
);

-- ---------------------------------------------------------------------------
-- Profiles (parent accounts)
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id      UUID NOT NULL REFERENCES auth_identities(id) ON DELETE CASCADE,
  full_name        TEXT,
  phone            TEXT,
  avatar_url       TEXT,
  onboarding_done  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE (identity_id)
);

SELECT attach_updated_at('profiles');

-- SQL function: returns profiles.id for the current authenticated user.
-- All RLS policies call only this function — swap internals here to migrate auth providers.
CREATE OR REPLACE FUNCTION public.profile_id()
RETURNS UUID AS $$
  SELECT p.id
  FROM profiles p
  JOIN auth_identities ai ON ai.id = p.identity_id
  WHERE ai.provider = 'supabase'
    AND ai.provider_uid = auth.uid()::TEXT
    AND p.deleted_at IS NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Kids (children per parent)
-- ---------------------------------------------------------------------------

CREATE TABLE kids (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  class_name   TEXT,                              -- Hebrew: כיתה
  emoji_avatar TEXT NOT NULL DEFAULT '🧒',
  notes        TEXT,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

SELECT attach_updated_at('kids');
CREATE INDEX idx_kids_profile_id ON kids(profile_id);

-- ---------------------------------------------------------------------------
-- Dietary tags (lookup)
-- ---------------------------------------------------------------------------

CREATE TABLE dietary_tags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,              -- machine-readable, ASCII
  label_he     TEXT NOT NULL,                     -- Hebrew display label
  label_en     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction: kids ↔ dietary_tags
CREATE TABLE kid_dietary_restrictions (
  kid_id        UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  dietary_tag_id UUID NOT NULL REFERENCES dietary_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (kid_id, dietary_tag_id)
);

CREATE INDEX idx_kid_dietary_kid_id ON kid_dietary_restrictions(kid_id);

-- ---------------------------------------------------------------------------
-- Meal catalog
-- ---------------------------------------------------------------------------

CREATE TABLE meal_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he      TEXT NOT NULL,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at('meal_categories');

CREATE TABLE menu_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID NOT NULL REFERENCES meal_categories(id),
  name_he         TEXT NOT NULL,
  description_he  TEXT,
  image_url       TEXT,
  price_agorot    INTEGER NOT NULL CHECK (price_agorot >= 0),
  is_customizable BOOLEAN NOT NULL DEFAULT FALSE,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

SELECT attach_updated_at('menu_items');
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);

-- Junction: menu_items ↔ dietary_tags
CREATE TABLE menu_item_dietary_tags (
  menu_item_id   UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  dietary_tag_id UUID NOT NULL REFERENCES dietary_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, dietary_tag_id)
);

CREATE INDEX idx_menu_item_dietary_tags_item ON menu_item_dietary_tags(menu_item_id);

-- ---------------------------------------------------------------------------
-- Ingredient options & default components
-- ---------------------------------------------------------------------------

CREATE TABLE ingredient_options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default ingredients per menu item (used for customization UI)
CREATE TABLE menu_item_components (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id        UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_option_id UUID NOT NULL REFERENCES ingredient_options(id) ON DELETE CASCADE,
  is_removable        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (menu_item_id, ingredient_option_id)
);

CREATE INDEX idx_menu_item_components_item ON menu_item_components(menu_item_id);

-- ---------------------------------------------------------------------------
-- Subscription plans & subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE subscription_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he         TEXT NOT NULL,
  meals_count     SMALLINT NOT NULL CHECK (meals_count > 0),
  price_agorot    INTEGER NOT NULL CHECK (price_agorot >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at('subscription_plans');

CREATE TABLE subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id              UUID NOT NULL REFERENCES subscription_plans(id),
  meals_remaining      SMALLINT NOT NULL CHECK (meals_remaining >= 0),
  starts_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at('subscriptions');
CREATE INDEX idx_subscriptions_profile_id ON subscriptions(profile_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'
);

CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kid_id           UUID REFERENCES kids(id) ON DELETE SET NULL,
  subscription_id  UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  status           order_status NOT NULL DEFAULT 'pending',
  delivery_date    DATE NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

SELECT attach_updated_at('orders');
CREATE INDEX idx_orders_profile_id    ON orders(profile_id);
CREATE INDEX idx_orders_kid_id        ON orders(kid_id);
CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);

CREATE TABLE order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity     SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_agorot INTEGER NOT NULL CHECK (unit_price_agorot >= 0), -- snapshot at time of order
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE TYPE customization_action AS ENUM ('add', 'remove');

CREATE TABLE order_item_customizations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id        UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  ingredient_option_id UUID NOT NULL REFERENCES ingredient_options(id),
  action               customization_action NOT NULL,
  UNIQUE (order_item_id, ingredient_option_id, action)
);

CREATE INDEX idx_order_item_customizations_item ON order_item_customizations(order_item_id);

-- ---------------------------------------------------------------------------
-- Saved orders (templates for quick reuse)
-- ---------------------------------------------------------------------------

CREATE TABLE saved_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name_he      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at('saved_orders');
CREATE INDEX idx_saved_orders_profile_id ON saved_orders(profile_id);

CREATE TABLE saved_order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_order_id UUID NOT NULL REFERENCES saved_orders(id) ON DELETE CASCADE,
  menu_item_id   UUID NOT NULL REFERENCES menu_items(id),
  quantity       SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE INDEX idx_saved_order_items_saved_order ON saved_order_items(saved_order_id);

-- ---------------------------------------------------------------------------
-- Favorite meals
-- ---------------------------------------------------------------------------

CREATE TABLE favorite_meals (
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, menu_item_id)
);

CREATE INDEX idx_favorite_meals_profile ON favorite_meals(profile_id);

-- ---------------------------------------------------------------------------
-- Supabase Auth integration trigger
-- Auto-creates auth_identities + profiles rows on first Google OAuth login.
-- ---------------------------------------------------------------------------

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
