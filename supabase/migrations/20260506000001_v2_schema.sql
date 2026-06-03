-- =============================================================================
-- Migration: 20260506000001_v2_schema.sql
-- Tenmeal — v2 schema reset
--
-- All experimental data is wiped. New schema reflects the canonical model:
--   - 3-slot subscription meal (main + side veg + side fruit)
--   - Single dietary_tags (allergens not split for v1)
--   - Schools normalized (schools + school_closures)
--   - Subscription expiry stays nullable (carry forever)
--   - No credits / snacks (phase 2)
--   - Saved custom sandwiches per-kid; kid's menu = customs ∪ tag-compatible presets
--   - Order statuses simplified: pending | confirmed | cancelled
--
-- auth.users, auth_identities, profiles, public.profile_id(),
-- handle_new_auth_user, attach_updated_at, trigger_set_updated_at all preserved.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Reset kids columns (must drop FK to schools before dropping schools)
-- ---------------------------------------------------------------------------

ALTER TABLE kids DROP COLUMN IF EXISTS school_name;
ALTER TABLE kids DROP COLUMN IF EXISTS school_address;
ALTER TABLE kids DROP COLUMN IF EXISTS school_id;

-- ---------------------------------------------------------------------------
-- 2. Drop business tables (FK-safe reverse order). Idempotent: re-running
--    after a partial earlier apply must succeed cleanly.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS kid_custom_sandwich_ingredients CASCADE;
DROP TABLE IF EXISTS kid_custom_sandwiches CASCADE;
DROP TABLE IF EXISTS kid_favorite_meals CASCADE;
DROP TABLE IF EXISTS favorite_meals CASCADE;
DROP TABLE IF EXISTS order_item_customizations CASCADE;
DROP TABLE IF EXISTS saved_order_items CASCADE;
DROP TABLE IF EXISTS saved_orders CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS kid_dietary_restrictions CASCADE;
DROP TABLE IF EXISTS school_closures CASCADE;
DROP TABLE IF EXISTS schools CASCADE;
DROP TABLE IF EXISTS sandwich_preset_vegetables CASCADE;
DROP TABLE IF EXISTS sandwich_preset_fillings CASCADE;
DROP TABLE IF EXISTS sandwich_presets CASCADE;
DROP TABLE IF EXISTS menu_item_components CASCADE;
DROP TABLE IF EXISTS menu_item_dietary_tags CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS meal_categories CASCADE;
DROP TABLE IF EXISTS ingredient_dietary_tags CASCADE;
DROP TABLE IF EXISTS ingredient_options CASCADE;
DROP TABLE IF EXISTS dietary_tags CASCADE;

DROP FUNCTION IF EXISTS auto_renew_subscription() CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS meal_slot CASCADE;
DROP TYPE IF EXISTS customization_action CASCADE;

-- ---------------------------------------------------------------------------
-- 3. New enums
-- ---------------------------------------------------------------------------

CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE meal_slot    AS ENUM ('main', 'side_veg', 'side_fruit');

-- ---------------------------------------------------------------------------
-- 4. Schools + closures
-- ---------------------------------------------------------------------------

CREATE TABLE schools (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he               TEXT NOT NULL,
  address               TEXT NOT NULL,
  delivery_window_start TIME NOT NULL DEFAULT '07:30',
  delivery_window_end   TIME NOT NULL DEFAULT '08:30',
  contact_name          TEXT,
  contact_phone         TEXT,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at('schools');
CREATE INDEX idx_schools_active ON schools(active) WHERE active;

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schools: authenticated read active"
  ON schools FOR SELECT
  TO authenticated
  USING (active = TRUE);

CREATE TABLE school_closures (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, date)
);

CREATE INDEX idx_school_closures_school_date ON school_closures(school_id, date);

ALTER TABLE school_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_closures: authenticated read"
  ON school_closures FOR SELECT
  TO authenticated
  USING (true);

-- Add the school_id FK to kids now that schools exists
ALTER TABLE kids ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX idx_kids_school_id ON kids(school_id);

-- ---------------------------------------------------------------------------
-- 5. Dietary tags (single table — allergens + preferences merged)
-- ---------------------------------------------------------------------------

CREATE TABLE dietary_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  label_he   TEXT NOT NULL,
  label_en   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dietary_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dietary_tags: authenticated read"
  ON dietary_tags FOR SELECT
  TO authenticated
  USING (true);

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
-- 6. Ingredient catalog (unified, layer-typed)
-- ---------------------------------------------------------------------------

CREATE TABLE ingredient_options (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he         TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN (
                    'bread', 'filling', 'sandwich_vegetable',
                    'side_vegetable', 'side_fruit'
                  )),
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  available       BOOLEAN NOT NULL DEFAULT TRUE,
  seasonal_months SMALLINT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name_he, category)
);

CREATE INDEX idx_ingredient_options_category  ON ingredient_options(category);
CREATE INDEX idx_ingredient_options_available ON ingredient_options(available) WHERE available;

ALTER TABLE ingredient_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredient_options: authenticated read"
  ON ingredient_options FOR SELECT
  TO authenticated
  USING (true);

-- Junction: ingredient_options ↔ dietary_tags (positive claims)
CREATE TABLE ingredient_dietary_tags (
  ingredient_option_id UUID NOT NULL REFERENCES ingredient_options(id) ON DELETE CASCADE,
  dietary_tag_id       UUID NOT NULL REFERENCES dietary_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (ingredient_option_id, dietary_tag_id)
);

CREATE INDEX idx_ingredient_dietary_ingredient ON ingredient_dietary_tags(ingredient_option_id);

ALTER TABLE ingredient_dietary_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredient_dietary_tags: authenticated read"
  ON ingredient_dietary_tags FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 7. Preset menu items (atomic non-customizable mains: מוזלי, סלט ישראלי, …)
-- ---------------------------------------------------------------------------

CREATE TABLE meal_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he    TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  price_agorot    INTEGER CHECK (price_agorot IS NULL OR price_agorot >= 0),
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

SELECT attach_updated_at('menu_items');
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_available   ON menu_items(is_available) WHERE is_available;

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_items: authenticated read"
  ON menu_items FOR SELECT
  TO authenticated
  USING (true);

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
-- 7b. Sandwich presets (DB-managed; replaces former code constants)
--
-- A preset = bread + 1..2 fillings + 0..N veg + a default side veg. Dietary
-- tag compatibility is derived at query time as the intersection of every
-- ingredient's tags (same logic as a custom sandwich).
-- ---------------------------------------------------------------------------

CREATE TABLE sandwich_presets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL UNIQUE,
  name_he             TEXT NOT NULL,
  description_he      TEXT,
  bread_id            UUID NOT NULL REFERENCES ingredient_options(id) ON DELETE RESTRICT,
  default_side_veg_id UUID NOT NULL REFERENCES ingredient_options(id) ON DELETE RESTRICT,
  sort_order          SMALLINT NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

SELECT attach_updated_at('sandwich_presets');
CREATE INDEX idx_sandwich_presets_active
  ON sandwich_presets(is_active) WHERE is_active AND deleted_at IS NULL;

ALTER TABLE sandwich_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sandwich_presets: authenticated read"
  ON sandwich_presets FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE sandwich_preset_fillings (
  preset_id            UUID NOT NULL REFERENCES sandwich_presets(id) ON DELETE CASCADE,
  ingredient_option_id UUID NOT NULL REFERENCES ingredient_options(id) ON DELETE RESTRICT,
  sort_order           SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, ingredient_option_id)
);

CREATE INDEX idx_spf_preset ON sandwich_preset_fillings(preset_id);
ALTER TABLE sandwich_preset_fillings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sandwich_preset_fillings: authenticated read"
  ON sandwich_preset_fillings FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE sandwich_preset_vegetables (
  preset_id            UUID NOT NULL REFERENCES sandwich_presets(id) ON DELETE CASCADE,
  ingredient_option_id UUID NOT NULL REFERENCES ingredient_options(id) ON DELETE RESTRICT,
  sort_order           SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (preset_id, ingredient_option_id)
);

CREATE INDEX idx_spv_preset ON sandwich_preset_vegetables(preset_id);
ALTER TABLE sandwich_preset_vegetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sandwich_preset_vegetables: authenticated read"
  ON sandwich_preset_vegetables FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 8. Subscription plans + subscriptions
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

-- ---------------------------------------------------------------------------
-- 9. Saved custom sandwiches (per-kid)
--    Created BEFORE order_items so order_items.custom_sandwich_id FK resolves.
-- ---------------------------------------------------------------------------

CREATE TABLE kid_custom_sandwiches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id     UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  name_he    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

SELECT attach_updated_at('kid_custom_sandwiches');
CREATE INDEX idx_kid_custom_sandwiches_kid ON kid_custom_sandwiches(kid_id);

ALTER TABLE kid_custom_sandwiches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kid_custom_sandwiches: owner all"
  ON kid_custom_sandwiches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = kid_custom_sandwiches.kid_id
        AND kids.profile_id = profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = kid_custom_sandwiches.kid_id
        AND kids.profile_id = profile_id()
    )
  );

CREATE TABLE kid_custom_sandwich_ingredients (
  sandwich_id          UUID NOT NULL REFERENCES kid_custom_sandwiches(id) ON DELETE CASCADE,
  ingredient_option_id UUID NOT NULL REFERENCES ingredient_options(id) ON DELETE RESTRICT,
  PRIMARY KEY (sandwich_id, ingredient_option_id)
);

CREATE INDEX idx_kcs_ingredients_sandwich ON kid_custom_sandwich_ingredients(sandwich_id);

ALTER TABLE kid_custom_sandwich_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kid_custom_sandwich_ingredients: owner all"
  ON kid_custom_sandwich_ingredients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM kid_custom_sandwiches s
      JOIN kids k ON k.id = s.kid_id
      WHERE s.id = kid_custom_sandwich_ingredients.sandwich_id
        AND k.profile_id = profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kid_custom_sandwiches s
      JOIN kids k ON k.id = s.kid_id
      WHERE s.id = kid_custom_sandwich_ingredients.sandwich_id
        AND k.profile_id = profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 9b. Kid favorites (per-kid mark for menu_items + sandwich presets)
--     Custom sandwiches don't need favoriting — they're inherently kid-owned.
-- ---------------------------------------------------------------------------

CREATE TABLE kid_favorite_meals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id       UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  preset_id    UUID REFERENCES sandwich_presets(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kfm_one_target CHECK (
    (menu_item_id IS NOT NULL)::int + (preset_id IS NOT NULL)::int = 1
  )
);

CREATE UNIQUE INDEX uq_kfm_kid_menu
  ON kid_favorite_meals(kid_id, menu_item_id) WHERE menu_item_id IS NOT NULL;
CREATE UNIQUE INDEX uq_kfm_kid_preset
  ON kid_favorite_meals(kid_id, preset_id)    WHERE preset_id IS NOT NULL;
CREATE INDEX idx_kfm_kid ON kid_favorite_meals(kid_id);

ALTER TABLE kid_favorite_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kid_favorite_meals: owner all"
  ON kid_favorite_meals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = kid_favorite_meals.kid_id
        AND kids.profile_id = profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = kid_favorite_meals.kid_id
        AND kids.profile_id = profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 10. Orders + order_items (3-slot meal model)
-- ---------------------------------------------------------------------------

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kid_id          UUID NOT NULL REFERENCES kids(id) ON DELETE RESTRICT,
  school_id       UUID REFERENCES schools(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  status          order_status NOT NULL DEFAULT 'pending',
  delivery_date   DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

SELECT attach_updated_at('orders');
CREATE INDEX idx_orders_profile_id     ON orders(profile_id);
CREATE INDEX idx_orders_kid_date       ON orders(kid_id, delivery_date);
CREATE INDEX idx_orders_school_date    ON orders(school_id, delivery_date);
CREATE INDEX idx_orders_delivery_date  ON orders(delivery_date);
-- one tray per kid per day (active rows only)
CREATE UNIQUE INDEX idx_orders_kid_date_unique
  ON orders(kid_id, delivery_date)
  WHERE deleted_at IS NULL;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders: owner all"
  ON orders FOR ALL
  USING (profile_id = profile_id())
  WITH CHECK (profile_id = profile_id());

CREATE TABLE order_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  slot                 meal_slot NOT NULL,
  -- main slot: exactly one of menu_item_id, custom_sandwich_id, sandwich_config
  menu_item_id         UUID REFERENCES menu_items(id),
  custom_sandwich_id   UUID REFERENCES kid_custom_sandwiches(id) ON DELETE SET NULL,
  sandwich_config      JSONB,
  -- side slots: ingredient_option_id is set
  ingredient_option_id UUID REFERENCES ingredient_options(id),
  -- snapshots
  name_he_snapshot     TEXT NOT NULL,
  unit_price_agorot    INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_agorot >= 0),
  quantity             SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, slot),
  CONSTRAINT main_requires_one_source CHECK (
    slot <> 'main' OR (
      (menu_item_id IS NOT NULL)::int +
      (custom_sandwich_id IS NOT NULL)::int +
      (sandwich_config IS NOT NULL)::int = 1
    )
  ),
  CONSTRAINT side_requires_ingredient CHECK (
    slot = 'main' OR ingredient_option_id IS NOT NULL
  ),
  CONSTRAINT side_no_main_fields CHECK (
    slot = 'main' OR (menu_item_id IS NULL AND custom_sandwich_id IS NULL AND sandwich_config IS NULL)
  )
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

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

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Subscription plans (UUIDs preserved from prior seed for potential portability)
-- ---------------------------------------------------------------------------

INSERT INTO subscription_plans (id, name_he, meals_count, price_agorot, is_active) VALUES
  ('11111111-0000-0000-0000-000000000001', 'חבילת היכרות – 3 ארוחות',  3,  5500,  TRUE),
  ('11111111-0000-0000-0000-000000000002', 'חבילת שבוע – 5 ארוחות',   5,  11000, TRUE),
  ('11111111-0000-0000-0000-000000000003', 'חבילת חודש – 24 ארוחות', 24, 45600, TRUE);

-- ---------------------------------------------------------------------------
-- Dietary tags
-- ---------------------------------------------------------------------------

INSERT INTO dietary_tags (id, slug, label_he, label_en) VALUES
  ('22222222-0000-0000-0000-000000000001', 'gluten_free', 'ללא גלוטן',  'Gluten Free'),
  ('22222222-0000-0000-0000-000000000002', 'nut_free',    'ללא אגוזים', 'Nut Free'),
  ('22222222-0000-0000-0000-000000000003', 'dairy_free',  'ללא חלב',    'Dairy Free'),
  ('22222222-0000-0000-0000-000000000004', 'vegan',       'טבעוני',     'Vegan'),
  ('22222222-0000-0000-0000-000000000005', 'vegetarian',  'צמחוני',     'Vegetarian'),
  ('22222222-0000-0000-0000-000000000006', 'halal',       'חלאל',       'Halal'),
  ('22222222-0000-0000-0000-000000000007', 'egg_free',    'ללא ביצים',  'Egg Free'),
  ('22222222-0000-0000-0000-000000000008', 'sesame_free', 'ללא שומשום', 'Sesame Free');

-- ---------------------------------------------------------------------------
-- Meal categories (single category — atomic mains)
-- ---------------------------------------------------------------------------

INSERT INTO meal_categories (id, name_he, sort_order) VALUES
  ('33333333-0000-0000-0000-000000000001', 'ארוחה מוכנה', 1);

-- ---------------------------------------------------------------------------
-- Ingredient options (5 layers)
-- ---------------------------------------------------------------------------

-- Bread
INSERT INTO ingredient_options (id, name_he, category, sort_order) VALUES
  ('aa000001-0000-0000-0000-000000000001', 'לחם קסטן לבן',     'bread', 1),
  ('aa000001-0000-0000-0000-000000000002', 'לחמניה',            'bread', 2),
  ('aa000001-0000-0000-0000-000000000003', 'לחמניה מקמח מלא',  'bread', 3),
  ('aa000001-0000-0000-0000-000000000004', 'טורטייה',           'bread', 4),
  ('aa000001-0000-0000-0000-000000000005', 'לחם ללא גלוטן',     'bread', 5),
  ('aa000001-0000-0000-0000-000000000006', 'פיתה',              'bread', 6);

-- Filling
INSERT INTO ingredient_options (id, name_he, category, sort_order) VALUES
  ('aa000002-0000-0000-0000-000000000001', 'חביתה',          'filling', 1),
  ('aa000002-0000-0000-0000-000000000002', 'גבינה לבנה',     'filling', 2),
  ('aa000002-0000-0000-0000-000000000003', 'גבינה צהובה',    'filling', 3),
  ('aa000002-0000-0000-0000-000000000004', 'גבינת שמנת',     'filling', 4),
  ('aa000002-0000-0000-0000-000000000005', 'חומוס',           'filling', 5),
  ('aa000002-0000-0000-0000-000000000006', 'טחינה',           'filling', 6),
  ('aa000002-0000-0000-0000-000000000007', 'ביצה קשה',        'filling', 7),
  ('aa000002-0000-0000-0000-000000000008', 'סלט ביצים',       'filling', 8),
  ('aa000002-0000-0000-0000-000000000009', 'סלט טונה',        'filling', 9),
  ('aa000002-0000-0000-0000-000000000010', 'פסטו',            'filling', 10);

-- Sandwich vegetables
INSERT INTO ingredient_options (id, name_he, category, sort_order) VALUES
  ('aa000003-0000-0000-0000-000000000001', 'חסה',                'sandwich_vegetable', 1),
  ('aa000003-0000-0000-0000-000000000002', 'מלפפון',             'sandwich_vegetable', 2),
  ('aa000003-0000-0000-0000-000000000003', 'עגבנייה',            'sandwich_vegetable', 3),
  ('aa000003-0000-0000-0000-000000000004', 'פלפל גמבה אדום',     'sandwich_vegetable', 4),
  ('aa000003-0000-0000-0000-000000000005', 'מלפפון חמוץ',        'sandwich_vegetable', 5),
  ('aa000003-0000-0000-0000-000000000006', 'זיתים ירוקים',        'sandwich_vegetable', 6);

-- Side vegetables
INSERT INTO ingredient_options (id, name_he, category, sort_order) VALUES
  ('aa000004-0000-0000-0000-000000000001', 'מלפפון בייבי',         'side_vegetable', 1),
  ('aa000004-0000-0000-0000-000000000002', 'פלפלים בייבי צבעוני',  'side_vegetable', 2),
  ('aa000004-0000-0000-0000-000000000003', 'גזר בייבי',            'side_vegetable', 3);

-- Side fruits (תפוז seasonal: Nov–May)
INSERT INTO ingredient_options (id, name_he, category, sort_order, seasonal_months) VALUES
  ('aa000005-0000-0000-0000-000000000001', 'תפוח',  'side_fruit', 1, NULL),
  ('aa000005-0000-0000-0000-000000000002', 'בננה',  'side_fruit', 2, NULL),
  ('aa000005-0000-0000-0000-000000000003', 'תפוז',  'side_fruit', 3, ARRAY[11,12,1,2,3,4,5]::SMALLINT[]);

-- ---------------------------------------------------------------------------
-- Ingredient ↔ dietary tag assignments
--   Tag IDs:
--     gluten_free=22222222...001  nut_free=...002  dairy_free=...003
--     vegan=...004  vegetarian=...005  halal=...006  egg_free=...007  sesame_free=...008
-- ---------------------------------------------------------------------------

-- Helper: insert all 8 tags for a given ingredient (everything-friendly produce)
-- Used for plain veg / fruit ingredients that contain none of the allergens/restrictions.

-- Breads — only לחם ללא גלוטן is gluten-free; all are vegan, vegetarian, dairy_free, egg_free, halal, sesame_free, nut_free.
-- לחם קסטן לבן
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000001-0000-0000-0000-000000000001', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegan','vegetarian','dairy_free','egg_free','halal','sesame_free','nut_free');
-- לחמניה
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000001-0000-0000-0000-000000000002', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegan','vegetarian','dairy_free','egg_free','halal','sesame_free','nut_free');
-- לחמניה מקמח מלא
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000001-0000-0000-0000-000000000003', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegan','vegetarian','dairy_free','egg_free','halal','sesame_free','nut_free');
-- טורטייה
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000001-0000-0000-0000-000000000004', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegan','vegetarian','dairy_free','egg_free','halal','sesame_free','nut_free');
-- לחם ללא גלוטן
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000001-0000-0000-0000-000000000005', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('gluten_free','vegan','vegetarian','dairy_free','egg_free','halal','sesame_free','nut_free');
-- פיתה: vegan, vegetarian, dairy_free, egg_free, halal, sesame_free, nut_free. NOT gluten_free.
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000001-0000-0000-0000-000000000006', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegan','vegetarian','dairy_free','egg_free','halal','sesame_free','nut_free');

-- Fillings
-- חביתה: vegetarian, dairy_free, gluten_free, halal, sesame_free, nut_free. NOT vegan, NOT egg_free.
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000002-0000-0000-0000-000000000001', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegetarian','dairy_free','gluten_free','halal','sesame_free','nut_free');
-- גבינה לבנה: vegetarian, gluten_free, halal, egg_free, sesame_free, nut_free. NOT vegan, NOT dairy_free.
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000002-0000-0000-0000-000000000002', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegetarian','gluten_free','halal','egg_free','sesame_free','nut_free');
-- גבינה צהובה: same as לבנה
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000002-0000-0000-0000-000000000003', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegetarian','gluten_free','halal','egg_free','sesame_free','nut_free');
-- גבינת שמנת: same as לבנה
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000002-0000-0000-0000-000000000004', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegetarian','gluten_free','halal','egg_free','sesame_free','nut_free');
-- חומוס: vegan, vegetarian, dairy_free, gluten_free, halal, egg_free, nut_free. NOT sesame_free (mixed with tahini).
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000002-0000-0000-0000-000000000005', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegan','vegetarian','dairy_free','gluten_free','halal','egg_free','nut_free');
-- טחינה: vegan, vegetarian, dairy_free, gluten_free, halal, egg_free, nut_free. NOT sesame_free.
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000002-0000-0000-0000-000000000006', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegan','vegetarian','dairy_free','gluten_free','halal','egg_free','nut_free');
-- ביצה קשה: vegetarian, dairy_free, gluten_free, halal, sesame_free, nut_free. NOT vegan, NOT egg_free.
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000002-0000-0000-0000-000000000007', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegetarian','dairy_free','gluten_free','halal','sesame_free','nut_free');
-- סלט ביצים: vegetarian, gluten_free, halal, sesame_free, nut_free. NOT vegan, NOT egg_free, NOT dairy_free (mayo may contain egg).
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000002-0000-0000-0000-000000000008', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegetarian','gluten_free','halal','sesame_free','nut_free','dairy_free');
-- סלט טונה: dairy_free, gluten_free, egg_free, halal, sesame_free, nut_free. NOT vegan, NOT vegetarian.
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000002-0000-0000-0000-000000000009', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('dairy_free','gluten_free','egg_free','halal','sesame_free','nut_free');
-- פסטו: vegetarian, gluten_free, halal, egg_free, sesame_free. NOT vegan (parmesan), NOT dairy_free, NOT nut_free (pine nuts).
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT 'aa000002-0000-0000-0000-000000000010', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegetarian','gluten_free','halal','egg_free','sesame_free');

-- Sandwich vegetables — all 8 tags (clean produce)
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT io.id, dt.id
FROM ingredient_options io
CROSS JOIN dietary_tags dt
WHERE io.category = 'sandwich_vegetable';

-- Side vegetables — all 8 tags
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT io.id, dt.id
FROM ingredient_options io
CROSS JOIN dietary_tags dt
WHERE io.category = 'side_vegetable';

-- Side fruits — all 8 tags
INSERT INTO ingredient_dietary_tags (ingredient_option_id, dietary_tag_id)
SELECT io.id, dt.id
FROM ingredient_options io
CROSS JOIN dietary_tags dt
WHERE io.category = 'side_fruit';

-- ---------------------------------------------------------------------------
-- Preset menu items (atomic non-customizable mains)
-- ---------------------------------------------------------------------------

INSERT INTO menu_items (id, category_id, name_he, description_he, price_agorot, is_available, sort_order) VALUES
  ('55555555-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   'מוזלי',
   'מוזלי מלא בדגנים, פירות יבשים ויוגורט',
   NULL, TRUE, 1),
  ('55555555-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001',
   'סלט ישראלי',
   'סלט ישראלי טרי — עגבנייה, מלפפון ופלפל קצוצים בעדינות',
   NULL, TRUE, 2);

-- מוזלי tags: vegetarian, dairy_free (oat milk variant), egg_free, halal, sesame_free, nut_free
INSERT INTO menu_item_dietary_tags (menu_item_id, dietary_tag_id)
SELECT '55555555-0000-0000-0000-000000000001', dt.id FROM dietary_tags dt
WHERE dt.slug IN ('vegetarian','dairy_free','egg_free','halal','sesame_free','nut_free');

-- סלט ישראלי tags: all 8 (clean produce, no allergens)
INSERT INTO menu_item_dietary_tags (menu_item_id, dietary_tag_id)
SELECT '55555555-0000-0000-0000-000000000002', dt.id FROM dietary_tags dt;

-- ---------------------------------------------------------------------------
-- Sandwich presets (DB-managed)
--
-- Ingredient UUIDs come from the ingredient_options seed above.
--   Bread:                          aa000001-0000-0000-0000-00000000000X
--   Filling:                        aa000002-0000-0000-0000-00000000000X
--   Sandwich vegetable:             aa000003-0000-0000-0000-00000000000X
--   Side vegetable (default sides): aa000004-0000-0000-0000-00000000000X
-- ---------------------------------------------------------------------------

INSERT INTO sandwich_presets (id, slug, name_he, description_he, bread_id, default_side_veg_id, sort_order) VALUES
  ('66666666-0000-0000-0000-000000000001',
   'classic',
   'הכריך הקלאסי',
   'לחמניה רכה עם גבינה לבנה, עגבנייה וחסה — הקלאסיקה האהובה',
   'aa000001-0000-0000-0000-000000000002', -- לחמניה
   'aa000004-0000-0000-0000-000000000001', -- מלפפון בייבי
   1),
  ('66666666-0000-0000-0000-000000000002',
   'morning_energy',
   'אנרגיה של בוקר',
   'לחמניה מקמח מלא עם ביצה קשה וגבינה צהובה — מלא חלבון לבוקר פעיל',
   'aa000001-0000-0000-0000-000000000003', -- לחמניה מקמח מלא
   'aa000004-0000-0000-0000-000000000003', -- גזר בייבי
   2),
  ('66666666-0000-0000-0000-000000000003',
   'omelette_classic',
   'כריך החביתה',
   'חביתה רכה על לחם קסטן עם עגבנייה וחסה — בוקר ביתי וחם',
   'aa000001-0000-0000-0000-000000000001', -- לחם קסטן לבן
   'aa000004-0000-0000-0000-000000000001', -- מלפפון בייבי
   3),
  ('66666666-0000-0000-0000-000000000004',
   'mediterranean',
   'הכריך הים תיכוני',
   'טורטייה עם חומוס, מלפפון, פלפל וזיתים — טעמים של הים התיכון',
   'aa000001-0000-0000-0000-000000000004', -- טורטייה
   'aa000004-0000-0000-0000-000000000002', -- פלפלים בייבי צבעוני
   4),
  ('66666666-0000-0000-0000-000000000005',
   'tahini',
   'כריך הטחינה',
   'טחינה משובחת עם עגבנייה ומלפפון על לחמניה — פשוט ועשיר בטעם',
   'aa000001-0000-0000-0000-000000000002', -- לחמניה
   'aa000004-0000-0000-0000-000000000003', -- גזר בייבי
   5),
  ('66666666-0000-0000-0000-000000000006',
   'omelette_white_cheese',
   'חביתה וגבינה לבנה',
   'חביתה חמה עם גבינה לבנה, מלפפון ועגבנייה — הבוקר השלם',
   'aa000001-0000-0000-0000-000000000002', -- לחמניה
   'aa000004-0000-0000-0000-000000000001', -- מלפפון בייבי
   6),
  ('66666666-0000-0000-0000-000000000007',
   'yellow_cheese_pesto',
   'גבינה צהובה ופסטו',
   'גבינה צהובה עם פסטו ריחני ועגבנייה — שילוב איטלקי מנצח',
   'aa000001-0000-0000-0000-000000000002', -- לחמניה
   'aa000004-0000-0000-0000-000000000002', -- פלפלים בייבי צבעוני
   7),
  ('66666666-0000-0000-0000-000000000008',
   'hummus_pita',
   'פיתה עם חומוס',
   'פיתה רכה ממולאת בחומוס משובח עם מלפפון חמוץ — כיף ישראלי אמיתי',
   'aa000001-0000-0000-0000-000000000006', -- פיתה
   'aa000004-0000-0000-0000-000000000002', -- פלפלים בייבי צבעוני
   8),
  ('66666666-0000-0000-0000-000000000009',
   'tuna_salad',
   'כריך סלט טונה',
   'סלט טונה ביתי עם מלפפון ועגבנייה — מלא חלבון וטעם',
   'aa000001-0000-0000-0000-000000000002', -- לחמניה
   'aa000004-0000-0000-0000-000000000003', -- גזר בייבי
   9);

-- Fillings: (preset_id, ingredient_option_id, sort_order)
INSERT INTO sandwich_preset_fillings (preset_id, ingredient_option_id, sort_order) VALUES
  -- classic: גבינה לבנה
  ('66666666-0000-0000-0000-000000000001', 'aa000002-0000-0000-0000-000000000002', 1),
  -- morning_energy: ביצה קשה + גבינה צהובה
  ('66666666-0000-0000-0000-000000000002', 'aa000002-0000-0000-0000-000000000007', 1),
  ('66666666-0000-0000-0000-000000000002', 'aa000002-0000-0000-0000-000000000003', 2),
  -- omelette_classic: חביתה
  ('66666666-0000-0000-0000-000000000003', 'aa000002-0000-0000-0000-000000000001', 1),
  -- mediterranean: חומוס
  ('66666666-0000-0000-0000-000000000004', 'aa000002-0000-0000-0000-000000000005', 1),
  -- tahini: טחינה
  ('66666666-0000-0000-0000-000000000005', 'aa000002-0000-0000-0000-000000000006', 1),
  -- omelette_white_cheese: חביתה + גבינה לבנה
  ('66666666-0000-0000-0000-000000000006', 'aa000002-0000-0000-0000-000000000001', 1),
  ('66666666-0000-0000-0000-000000000006', 'aa000002-0000-0000-0000-000000000002', 2),
  -- yellow_cheese_pesto: גבינה צהובה + פסטו
  ('66666666-0000-0000-0000-000000000007', 'aa000002-0000-0000-0000-000000000003', 1),
  ('66666666-0000-0000-0000-000000000007', 'aa000002-0000-0000-0000-000000000010', 2),
  -- hummus_pita: חומוס
  ('66666666-0000-0000-0000-000000000008', 'aa000002-0000-0000-0000-000000000005', 1),
  -- tuna_salad: סלט טונה
  ('66666666-0000-0000-0000-000000000009', 'aa000002-0000-0000-0000-000000000009', 1);

-- Sandwich vegetables: (preset_id, ingredient_option_id, sort_order)
INSERT INTO sandwich_preset_vegetables (preset_id, ingredient_option_id, sort_order) VALUES
  -- classic: עגבנייה + חסה
  ('66666666-0000-0000-0000-000000000001', 'aa000003-0000-0000-0000-000000000003', 1),
  ('66666666-0000-0000-0000-000000000001', 'aa000003-0000-0000-0000-000000000001', 2),
  -- morning_energy: מלפפון
  ('66666666-0000-0000-0000-000000000002', 'aa000003-0000-0000-0000-000000000002', 1),
  -- omelette_classic: עגבנייה + חסה
  ('66666666-0000-0000-0000-000000000003', 'aa000003-0000-0000-0000-000000000003', 1),
  ('66666666-0000-0000-0000-000000000003', 'aa000003-0000-0000-0000-000000000001', 2),
  -- mediterranean: מלפפון + פלפל גמבה אדום + זיתים ירוקים
  ('66666666-0000-0000-0000-000000000004', 'aa000003-0000-0000-0000-000000000002', 1),
  ('66666666-0000-0000-0000-000000000004', 'aa000003-0000-0000-0000-000000000004', 2),
  ('66666666-0000-0000-0000-000000000004', 'aa000003-0000-0000-0000-000000000006', 3),
  -- tahini: עגבנייה + מלפפון
  ('66666666-0000-0000-0000-000000000005', 'aa000003-0000-0000-0000-000000000003', 1),
  ('66666666-0000-0000-0000-000000000005', 'aa000003-0000-0000-0000-000000000002', 2),
  -- omelette_white_cheese: מלפפון + עגבנייה
  ('66666666-0000-0000-0000-000000000006', 'aa000003-0000-0000-0000-000000000002', 1),
  ('66666666-0000-0000-0000-000000000006', 'aa000003-0000-0000-0000-000000000003', 2),
  -- yellow_cheese_pesto: עגבנייה
  ('66666666-0000-0000-0000-000000000007', 'aa000003-0000-0000-0000-000000000003', 1),
  -- hummus_pita: מלפפון חמוץ
  ('66666666-0000-0000-0000-000000000008', 'aa000003-0000-0000-0000-000000000005', 1),
  -- tuna_salad: מלפפון + עגבנייה
  ('66666666-0000-0000-0000-000000000009', 'aa000003-0000-0000-0000-000000000002', 1),
  ('66666666-0000-0000-0000-000000000009', 'aa000003-0000-0000-0000-000000000003', 2);
