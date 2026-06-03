-- =============================================================================
-- Migration: 20260502000001_sandwich_builder.sql
-- Adds category + sort_order to ingredient_options, seeds sandwich ingredients,
-- and creates kid_custom_sandwiches / kid_custom_sandwich_ingredients tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend ingredient_options: category + sort_order
-- ---------------------------------------------------------------------------

ALTER TABLE ingredient_options
  ADD COLUMN category   TEXT,       -- known values: bread | filling | vegetable | side_vegetable
  ADD COLUMN sort_order SMALLINT NOT NULL DEFAULT 0;

CREATE INDEX idx_ingredient_options_category ON ingredient_options(category);

-- ---------------------------------------------------------------------------
-- 2. Backfill categories for 4 existing reusable ingredients
-- ---------------------------------------------------------------------------

UPDATE ingredient_options
  SET category = 'filling', sort_order = 3
  WHERE id = '44444444-0000-0000-0000-000000000002'; -- גבינה צהובה

UPDATE ingredient_options
  SET category = 'vegetable', sort_order = 1
  WHERE id = '44444444-0000-0000-0000-000000000006'; -- חסה

UPDATE ingredient_options
  SET category = 'vegetable', sort_order = 3
  WHERE id = '44444444-0000-0000-0000-000000000007'; -- עגבנייה

UPDATE ingredient_options
  SET category = 'vegetable', sort_order = 2
  WHERE id = '44444444-0000-0000-0000-000000000008'; -- מלפפון

-- ---------------------------------------------------------------------------
-- 3. Seed 18 new sandwich ingredients
--    No UNIQUE constraint exists on name_he, so guard with WHERE NOT EXISTS.
-- ---------------------------------------------------------------------------

-- bread
INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'לחם קסטן לבן', 'bread', 1
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'לחם קסטן לבן');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'לחמניה', 'bread', 2
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'לחמניה');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'לחמניה מקמח מלא', 'bread', 3
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'לחמניה מקמח מלא');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'טורטייה', 'bread', 4
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'טורטייה');

-- filling (sort 3 is deliberately reserved for the existing גבינה צהובה row)
INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'חביתה', 'filling', 1
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'חביתה');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'גבינה לבנה', 'filling', 2
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'גבינה לבנה');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'גבינת שמנת', 'filling', 4
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'גבינת שמנת');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'חומוס', 'filling', 5
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'חומוס');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'טחינה', 'filling', 6
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'טחינה');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'ביצה קשה', 'filling', 7
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'ביצה קשה');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'סלט ביצים', 'filling', 8
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'סלט ביצים');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'סלט טונה', 'filling', 9
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'סלט טונה');

-- vegetable (sorts 1-3 reserved for existing חסה/מלפפון/עגבנייה rows)
INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'פלפל גמבה אדום', 'vegetable', 4
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'פלפל גמבה אדום');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'מלפפון חמוץ', 'vegetable', 5
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'מלפפון חמוץ');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'זיתים ירוקים', 'vegetable', 6
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'זיתים ירוקים');

-- side_vegetable
INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'מלפפון בייבי', 'side_vegetable', 1
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'מלפפון בייבי');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'פלפלים בייבי צבעוני', 'side_vegetable', 2
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'פלפלים בייבי צבעוני');

INSERT INTO ingredient_options (name_he, category, sort_order)
  SELECT 'גזר בייבי', 'side_vegetable', 3
  WHERE NOT EXISTS (SELECT 1 FROM ingredient_options WHERE name_he = 'גזר בייבי');

-- ---------------------------------------------------------------------------
-- 4. New tables: kid_custom_sandwiches + kid_custom_sandwich_ingredients
-- ---------------------------------------------------------------------------

CREATE TABLE kid_custom_sandwiches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id     UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  name_he    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_kid_custom_sandwiches_kid ON kid_custom_sandwiches(kid_id);
SELECT attach_updated_at('kid_custom_sandwiches');

CREATE TABLE kid_custom_sandwich_ingredients (
  sandwich_id          UUID NOT NULL REFERENCES kid_custom_sandwiches(id) ON DELETE CASCADE,
  ingredient_option_id UUID NOT NULL REFERENCES ingredient_options(id),
  PRIMARY KEY (sandwich_id, ingredient_option_id)
);

CREATE INDEX idx_kcs_ingredients_sandwich ON kid_custom_sandwich_ingredients(sandwich_id);

-- ---------------------------------------------------------------------------
-- 5. RLS: kid_custom_sandwiches + kid_custom_sandwich_ingredients
-- ---------------------------------------------------------------------------

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
