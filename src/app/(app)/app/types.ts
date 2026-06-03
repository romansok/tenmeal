export interface DietaryTag { id: string; slug: string; label_he: string }
export interface KidRestriction { dietary_tag_id: string; dietary_tags: DietaryTag | null }

export interface School {
  id: string
  name_he: string
  address: string
}

export interface Kid {
  id: string
  name: string
  last_name: string | null
  class_name: string | null
  phone: string | null
  emoji_avatar: string
  sort_order: number
  school_id: string | null
  school: School | null
  kid_dietary_restrictions: KidRestriction[]
}

export interface SubscriptionPlan {
  id: string
  name_he: string
  meals_count: number
  price_agorot: number
}

export interface Subscription {
  id: string
  meals_remaining: number
  starts_at: string
  expires_at: string | null
  auto_renew: boolean
  subscription_plans: SubscriptionPlan | null
}

export interface SubscriptionHistoryItem {
  id: string
  meals_remaining: number
  starts_at: string
  expires_at: string | null
  status: string
  auto_renew: boolean
  subscription_plans: SubscriptionPlan | null
}

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  onboarding_done: boolean
}

export interface MenuItem {
  id: string
  name_he: string
  description_he: string | null
  image_url: string | null
}

export interface MenuItemWithTags extends MenuItem {
  dietary_tag_ids: string[]
}

export type MealSlot = 'main' | 'side_veg' | 'side_fruit'

export interface OrderItem {
  id: string
  slot: MealSlot
  menu_item_id: string | null
  custom_sandwich_id: string | null
  ingredient_option_id: string | null
  name_he_snapshot: string
  sandwich_config: SandwichConfigSnapshot | null
}

export interface SandwichConfigSnapshot {
  bread_id: string
  bread: string
  fillings: { id: string; name: string }[]
  vegetables: { id: string; name: string }[]
  summary: string
  /** Set when this snapshot was built from a sandwich_presets row. */
  preset_id?: string
}

export interface ExistingOrder {
  id: string
  kid_id: string
  delivery_date: string
  notes: string | null
  status: string
  order_items: OrderItem[]
}

export type MainSelectionKind =
  | 'menu_item'        // DB-backed atomic menu_item (e.g. מוזלי, סלט ישראלי)
  | 'sandwich_preset'  // DB-backed sandwich preset row (sandwich_presets)
  | 'custom_sandwich'  // kid's saved sandwich row (kid_custom_sandwiches)
  | 'ad_hoc_sandwich'  // one-off, built client-side, never persisted as a template

export interface MainSelection {
  kind: MainSelectionKind
  // exactly one identifier is set, depending on kind:
  menu_item_id?: string | null
  sandwich_preset_id?: string | null
  custom_sandwich_id?: string | null
  sandwich_config?: SandwichConfigSnapshot | null
  display_name: string
}

export interface DayPlan {
  main: MainSelection | null
  sideVegId: string | null
  sideFruitId: string | null
  notes: string
}

export type IngredientCategory =
  | 'bread'
  | 'filling'
  | 'sandwich_vegetable'
  | 'side_vegetable'
  | 'side_fruit'

export interface IngredientOption {
  id: string
  name_he: string
  category: IngredientCategory
  sort_order: number
  available: boolean
  seasonal_months: number[] | null
  /**
   * Dietary tag slugs that this ingredient carries (e.g. ['vegan','gluten_free']).
   * Computed at fetch time from `ingredient_dietary_tags` so the builder UI can
   * grey out ingredients that would violate the kid's dietary restrictions.
   */
  dietary_tag_slugs: string[]
}

export interface CustomSandwich {
  id: string
  kid_id: string
  name_he: string
  ingredient_ids: string[]
}

/**
 * DB-managed sandwich preset. Replaces the former code-defined PRESET_SANDWICHES.
 *
 * dietary_tag_slugs is computed at fetch time as the intersection of every
 * ingredient's dietary tags (bread, all fillings, all vegetables) — same logic
 * applied to custom sandwiches.
 */
export interface SandwichPreset {
  id: string
  slug: string
  name_he: string
  description_he: string | null
  bread_id: string
  bread_name: string
  fillings: { id: string; name: string }[]
  vegetables: { id: string; name: string }[]
  default_side_veg: { id: string; name: string }
  dietary_tag_slugs: string[]
  sort_order: number
}

/**
 * A kid's marked-favorite meal. Exactly one of menu_item_id / preset_id is set:
 *   - menu_item_id  → DB-backed atomic menu_item (e.g. מוזלי, סלט ישראלי)
 *   - preset_id     → DB-backed sandwich preset (sandwich_presets row)
 *
 * Custom sandwiches are not represented here — they are inherently kid-owned and
 * always appear in the orders picker.
 */
export interface KidFavorite {
  id: string
  kid_id: string
  menu_item_id: string | null
  preset_id: string | null
}

// Sandwich-builder rules (applies to bread + filling + sandwich_vegetable only).
// side_vegetable + side_fruit are per-meal slot pickers, not part of the sandwich.
export const SANDWICH_BUILDER_CATEGORIES: IngredientCategory[] = [
  'bread',
  'filling',
  'sandwich_vegetable',
]

export const SANDWICH_CATEGORY_RULES: Record<
  IngredientCategory,
  { label_he: string; helper_he?: string; min: number; max: number | null }
> = {
  bread:              { label_he: 'לחם',            min: 1, max: 1 },
  filling:            { label_he: 'מילוי',          min: 1, max: 2 },
  sandwich_vegetable: { label_he: 'ירקות בכריך',    min: 0, max: null },
  side_vegetable:     { label_he: 'ירק בצד',        min: 0, max: null },
  side_fruit:         { label_he: 'פרי בצד',        min: 0, max: null },
}

// ─── Server-action input/return contracts ─────────────────────────────────────

/** Form input for addKid / updateKid. */
export interface KidInput {
  name: string
  last_name: string | null
  class_name: string | null
  phone: string | null
  emoji_avatar: string
  school_id: string | null
  dietary_tag_ids: string[]
}

// ─── Internal Supabase-row shapes for nested SELECTs ──────────────────────────
// These describe what PostgREST returns for specific .select() patterns used in
// actions.ts. Keep them aligned with the SELECT strings; if you add/remove a
// column, update the row type.

export interface SandwichPresetIngredientJoinRow {
  sort_order: number
  ingredient_options: { id: string; name_he: string }
}

export interface SandwichPresetRow {
  id: string
  name_he: string
  default_side_veg_id: string
  bread: { id: string; name_he: string }
  sandwich_preset_fillings: SandwichPresetIngredientJoinRow[]
  sandwich_preset_vegetables: SandwichPresetIngredientJoinRow[]
}

export interface CustomSandwichIngredientJoinRow {
  ingredient_option_id: string
  ingredient_options: { id: string; name_he: string; category: IngredientCategory }
}

export interface CustomSandwichWithIngredientsRow {
  id: string
  kid_id: string
  name_he: string
  kid_custom_sandwich_ingredients: CustomSandwichIngredientJoinRow[]
}

export interface CustomSandwichOwnershipRow {
  id: string
  kid_id: string
  kids: { profile_id: string; deleted_at: string | null } | null
}

export interface KidDietaryRequirementRow {
  dietary_tag_id: string
  dietary_tags: { label_he: string } | null
}
