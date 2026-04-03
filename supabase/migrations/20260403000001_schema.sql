-- =============================================================================
-- Migration: 20260403000001_schema.sql
-- Tenmeal — Canonical schema (consolidates all prior migrations)
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
-- Migrating auth later only requires updating public.profile_id().
CREATE TABLE auth_identities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL CHECK (provider IN ('supabase', 'custom')),
  provider_uid  TEXT NOT NULL,                    -- auth.users.id for supabase
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_uid)
);

ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_identities: owner read"
  ON auth_identities FOR SELECT
  USING (provider_uid = auth.uid()::TEXT AND provider = 'supabase');

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

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: owner all"
  ON profiles FOR ALL
  USING (id = profile_id())
  WITH CHECK (id = profile_id());

-- ---------------------------------------------------------------------------
-- Kids (children per parent)
-- ---------------------------------------------------------------------------

CREATE TABLE kids (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  class_name     TEXT,
  school_name    TEXT,
  school_address TEXT,
  emoji_avatar   TEXT NOT NULL DEFAULT '🧒',
  notes          TEXT,
  sort_order     SMALLINT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

SELECT attach_updated_at('kids');
CREATE INDEX idx_kids_profile_id ON kids(profile_id);

ALTER TABLE kids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids: owner all"
  ON kids FOR ALL
  USING (profile_id = profile_id())
  WITH CHECK (profile_id = profile_id());

-- ---------------------------------------------------------------------------
-- Dietary tags (lookup)
-- ---------------------------------------------------------------------------

CREATE TABLE dietary_tags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  label_he     TEXT NOT NULL,
  label_en     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dietary_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dietary_tags: authenticated read"
  ON dietary_tags FOR SELECT
  TO authenticated
  USING (true);

-- Junction: kids ↔ dietary_tags
CREATE TABLE kid_dietary_restrictions (
  kid_id         UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  dietary_tag_id UUID NOT NULL REFERENCES dietary_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (kid_id, dietary_tag_id)
);

CREATE INDEX idx_kid_dietary_kid_id ON kid_dietary_restrictions(kid_id);

ALTER TABLE kid_dietary_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kid_dietary_restrictions: owner all"
  ON kid_dietary_restrictions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = kid_dietary_restrictions.kid_id
        AND kids.profile_id = profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = kid_dietary_restrictions.kid_id
        AND kids.profile_id = profile_id()
    )
  );

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

ALTER TABLE meal_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_categories: authenticated read"
  ON meal_categories FOR SELECT
  TO authenticated
  USING (true);

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

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_items: authenticated read"
  ON menu_items FOR SELECT
  TO authenticated
  USING (true);

-- Junction: menu_items ↔ dietary_tags
CREATE TABLE menu_item_dietary_tags (
  menu_item_id   UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  dietary_tag_id UUID NOT NULL REFERENCES dietary_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, dietary_tag_id)
);

CREATE INDEX idx_menu_item_dietary_tags_item ON menu_item_dietary_tags(menu_item_id);

ALTER TABLE menu_item_dietary_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_item_dietary_tags: authenticated read"
  ON menu_item_dietary_tags FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Ingredient options & default components
-- ---------------------------------------------------------------------------

CREATE TABLE ingredient_options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ingredient_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredient_options: authenticated read"
  ON ingredient_options FOR SELECT
  TO authenticated
  USING (true);

-- Default ingredients per menu item (used for customization UI)
CREATE TABLE menu_item_components (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id         UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_option_id UUID NOT NULL REFERENCES ingredient_options(id) ON DELETE CASCADE,
  is_removable         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order           SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (menu_item_id, ingredient_option_id)
);

CREATE INDEX idx_menu_item_components_item ON menu_item_components(menu_item_id);

ALTER TABLE menu_item_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_item_components: authenticated read"
  ON menu_item_components FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Subscription plans & subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE subscription_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he      TEXT NOT NULL,
  meals_count  SMALLINT NOT NULL CHECK (meals_count > 0),
  price_agorot INTEGER NOT NULL CHECK (price_agorot >= 0),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at('subscription_plans');

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_plans: authenticated read"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id         UUID NOT NULL REFERENCES subscription_plans(id),
  meals_remaining SMALLINT NOT NULL CHECK (meals_remaining >= 0),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  auto_renew      BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at('subscriptions');
CREATE INDEX idx_subscriptions_profile_id ON subscriptions(profile_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions: owner all"
  ON subscriptions FOR ALL
  USING (profile_id = profile_id())
  WITH CHECK (profile_id = profile_id());

-- Trigger: auto-renew subscription when meals_remaining hits 0
CREATE OR REPLACE FUNCTION auto_renew_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_meals_count INT;
BEGIN
  IF NEW.meals_remaining = 0
     AND NEW.auto_renew = TRUE
     AND OLD.meals_remaining > 0
  THEN
    SELECT meals_count INTO v_meals_count
    FROM subscription_plans
    WHERE id = NEW.plan_id AND is_active = TRUE;

    IF FOUND THEN
      INSERT INTO subscriptions (profile_id, plan_id, meals_remaining, status, auto_renew)
      VALUES (NEW.profile_id, NEW.plan_id, v_meals_count, 'active', TRUE);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_renew_subscription
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION auto_renew_subscription();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'
);

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kid_id          UUID REFERENCES kids(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  status          order_status NOT NULL DEFAULT 'pending',
  delivery_date   DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

SELECT attach_updated_at('orders');
CREATE INDEX idx_orders_profile_id    ON orders(profile_id);
CREATE INDEX idx_orders_kid_id        ON orders(kid_id);
CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders: owner all"
  ON orders FOR ALL
  USING (profile_id = profile_id())
  WITH CHECK (profile_id = profile_id());

CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id      UUID NOT NULL REFERENCES menu_items(id),
  quantity          SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_agorot INTEGER NOT NULL CHECK (unit_price_agorot >= 0), -- snapshot at time of order
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items: owner all"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.profile_id = profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.profile_id = profile_id()
    )
  );

CREATE TYPE customization_action AS ENUM ('add', 'remove');

CREATE TABLE order_item_customizations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id        UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  ingredient_option_id UUID NOT NULL REFERENCES ingredient_options(id),
  action               customization_action NOT NULL,
  UNIQUE (order_item_id, ingredient_option_id, action)
);

CREATE INDEX idx_order_item_customizations_item ON order_item_customizations(order_item_id);

ALTER TABLE order_item_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_item_customizations: owner all"
  ON order_item_customizations FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_customizations.order_item_id
        AND o.profile_id = profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_customizations.order_item_id
        AND o.profile_id = profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Saved orders (templates for quick reuse)
-- ---------------------------------------------------------------------------

CREATE TABLE saved_orders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name_he    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at('saved_orders');
CREATE INDEX idx_saved_orders_profile_id ON saved_orders(profile_id);

ALTER TABLE saved_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_orders: owner all"
  ON saved_orders FOR ALL
  USING (profile_id = profile_id())
  WITH CHECK (profile_id = profile_id());

CREATE TABLE saved_order_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_order_id UUID NOT NULL REFERENCES saved_orders(id) ON DELETE CASCADE,
  menu_item_id   UUID NOT NULL REFERENCES menu_items(id),
  quantity       SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE INDEX idx_saved_order_items_saved_order ON saved_order_items(saved_order_id);

ALTER TABLE saved_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_order_items: owner all"
  ON saved_order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM saved_orders
      WHERE saved_orders.id = saved_order_items.saved_order_id
        AND saved_orders.profile_id = profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM saved_orders
      WHERE saved_orders.id = saved_order_items.saved_order_id
        AND saved_orders.profile_id = profile_id()
    )
  );

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

ALTER TABLE favorite_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorite_meals: owner all"
  ON favorite_meals FOR ALL
  USING (profile_id = profile_id())
  WITH CHECK (profile_id = profile_id());

-- ---------------------------------------------------------------------------
-- Supabase Auth integration trigger
-- Auto-creates auth_identities + profiles rows on first Google OAuth login.
-- SET search_path = public prevents "Database error saving new user" on OAuth.
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
