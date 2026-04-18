-- =============================================================================
-- Migration: 20260404000001_kid_favorite_meals.sql
-- Description: Per-kid favorite meals table with RLS via kids ownership
-- =============================================================================

CREATE TABLE kid_favorite_meals (
  kid_id       UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (kid_id, menu_item_id)
);

CREATE INDEX idx_kid_favorite_meals_kid_id ON kid_favorite_meals(kid_id);

ALTER TABLE kid_favorite_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kid_favorite_meals: owner all"
  ON kid_favorite_meals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = kid_favorite_meals.kid_id
        AND kids.profile_id = public.profile_id()
        AND kids.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = kid_favorite_meals.kid_id
        AND kids.profile_id = public.profile_id()
        AND kids.deleted_at IS NULL
    )
  );
