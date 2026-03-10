-- =============================================================================
-- Migration: 20260310000002_rls_policies.sql
-- Tenmeal — Row Level Security policies
--
-- Pattern:
--   • Lookup / catalog tables: SELECT only, available to all authenticated users
--   • User-owned tables: full access restricted to the owning profile via auth.profile_id()
-- =============================================================================

-- ---------------------------------------------------------------------------
-- auth_identities — users may only see their own identity row
-- ---------------------------------------------------------------------------

ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_identities: owner read"
  ON auth_identities FOR SELECT
  USING (provider_uid = auth.uid()::TEXT AND provider = 'supabase');

-- ---------------------------------------------------------------------------
-- profiles — owner only
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: owner all"
  ON profiles FOR ALL
  USING (id = auth.profile_id())
  WITH CHECK (id = auth.profile_id());

-- ---------------------------------------------------------------------------
-- kids — scoped to parent profile
-- ---------------------------------------------------------------------------

ALTER TABLE kids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids: owner all"
  ON kids FOR ALL
  USING (profile_id = auth.profile_id())
  WITH CHECK (profile_id = auth.profile_id());

-- ---------------------------------------------------------------------------
-- dietary_tags — public read-only (catalog)
-- ---------------------------------------------------------------------------

ALTER TABLE dietary_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dietary_tags: authenticated read"
  ON dietary_tags FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- kid_dietary_restrictions — via kid ownership
-- ---------------------------------------------------------------------------

ALTER TABLE kid_dietary_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kid_dietary_restrictions: owner all"
  ON kid_dietary_restrictions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = kid_dietary_restrictions.kid_id
        AND kids.profile_id = auth.profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kids
      WHERE kids.id = kid_dietary_restrictions.kid_id
        AND kids.profile_id = auth.profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- meal_categories — public read-only (catalog)
-- ---------------------------------------------------------------------------

ALTER TABLE meal_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_categories: authenticated read"
  ON meal_categories FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- menu_items — public read-only (catalog)
-- ---------------------------------------------------------------------------

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_items: authenticated read"
  ON menu_items FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- menu_item_dietary_tags — public read-only (catalog)
-- ---------------------------------------------------------------------------

ALTER TABLE menu_item_dietary_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_item_dietary_tags: authenticated read"
  ON menu_item_dietary_tags FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- ingredient_options — public read-only (catalog)
-- ---------------------------------------------------------------------------

ALTER TABLE ingredient_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredient_options: authenticated read"
  ON ingredient_options FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- menu_item_components — public read-only (catalog)
-- ---------------------------------------------------------------------------

ALTER TABLE menu_item_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_item_components: authenticated read"
  ON menu_item_components FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- subscription_plans — public read-only (catalog)
-- ---------------------------------------------------------------------------

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_plans: authenticated read"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- subscriptions — scoped to profile
-- ---------------------------------------------------------------------------

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions: owner all"
  ON subscriptions FOR ALL
  USING (profile_id = auth.profile_id())
  WITH CHECK (profile_id = auth.profile_id());

-- ---------------------------------------------------------------------------
-- orders — scoped to profile
-- ---------------------------------------------------------------------------

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders: owner all"
  ON orders FOR ALL
  USING (profile_id = auth.profile_id())
  WITH CHECK (profile_id = auth.profile_id());

-- ---------------------------------------------------------------------------
-- order_items — via order ownership
-- ---------------------------------------------------------------------------

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items: owner all"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.profile_id = auth.profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.profile_id = auth.profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- order_item_customizations — via order_item → order ownership
-- ---------------------------------------------------------------------------

ALTER TABLE order_item_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_item_customizations: owner all"
  ON order_item_customizations FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_customizations.order_item_id
        AND o.profile_id = auth.profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_customizations.order_item_id
        AND o.profile_id = auth.profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- saved_orders — scoped to profile
-- ---------------------------------------------------------------------------

ALTER TABLE saved_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_orders: owner all"
  ON saved_orders FOR ALL
  USING (profile_id = auth.profile_id())
  WITH CHECK (profile_id = auth.profile_id());

-- ---------------------------------------------------------------------------
-- saved_order_items — via saved_order ownership
-- ---------------------------------------------------------------------------

ALTER TABLE saved_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_order_items: owner all"
  ON saved_order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM saved_orders
      WHERE saved_orders.id = saved_order_items.saved_order_id
        AND saved_orders.profile_id = auth.profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM saved_orders
      WHERE saved_orders.id = saved_order_items.saved_order_id
        AND saved_orders.profile_id = auth.profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- favorite_meals — scoped to profile
-- ---------------------------------------------------------------------------

ALTER TABLE favorite_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorite_meals: owner all"
  ON favorite_meals FOR ALL
  USING (profile_id = auth.profile_id())
  WITH CHECK (profile_id = auth.profile_id());
