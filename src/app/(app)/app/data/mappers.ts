// Pure row → view-type mappers for dashboard SSR data.
// Each mapper is deterministic, side-effect-free, and trivially testable.

import type {
  CustomSandwich,
  DietaryTag,
  IngredientCategory,
  IngredientOption,
  MenuItemWithTags,
  SandwichPreset,
} from '../types'

// ─── Raw row types (mirror the PostgREST select strings in queries.ts) ────────

export interface MenuItemListRow {
  id: string
  name_he: string
  description_he: string | null
  image_url: string | null
  menu_item_dietary_tags: { dietary_tag_id: string }[]
}

export interface IngredientOptionListRow {
  id: string
  name_he: string
  category: IngredientCategory
  sort_order: number
  available: boolean
  seasonal_months: number[] | null
}

export interface IngredientDietaryTagRow {
  ingredient_option_id: string
  dietary_tag_id: string
}

export interface CustomSandwichListRow {
  id: string
  kid_id: string
  name_he: string
  kid_custom_sandwich_ingredients: { ingredient_option_id: string }[]
}

interface SandwichPresetIngredientJoinRow {
  sort_order: number
  ingredient_options: { id: string; name_he: string }
}

export interface SandwichPresetListRow {
  id: string
  slug: string
  name_he: string
  description_he: string | null
  bread_id: string
  sort_order: number
  bread: { id: string; name_he: string }
  default_side_veg: { id: string; name_he: string }
  sandwich_preset_fillings: SandwichPresetIngredientJoinRow[]
  sandwich_preset_vegetables: SandwichPresetIngredientJoinRow[]
}

// ─── Helpers built once per load ─────────────────────────────────────────────

export function buildSlugById(
  tags: Pick<DietaryTag, 'id' | 'slug'>[]
): Map<string, string> {
  return new Map(tags.map((t) => [t.id, t.slug]))
}

export function buildTagsByIngredient(
  rows: IngredientDietaryTagRow[],
  slugById: Map<string, string>
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const row of rows) {
    const slug = slugById.get(row.dietary_tag_id)
    if (!slug) continue
    let set = out.get(row.ingredient_option_id)
    if (!set) {
      set = new Set()
      out.set(row.ingredient_option_id, set)
    }
    set.add(slug)
  }
  return out
}

// ─── Row → view mappers ──────────────────────────────────────────────────────

export function mapMenuItemWithTags(row: MenuItemListRow): MenuItemWithTags {
  return {
    id: row.id,
    name_he: row.name_he,
    description_he: row.description_he,
    image_url: row.image_url,
    dietary_tag_ids: row.menu_item_dietary_tags.map((t) => t.dietary_tag_id),
  }
}

export function mapIngredientOption(
  row: IngredientOptionListRow,
  tagsByIngredient: Map<string, Set<string>>
): IngredientOption {
  return {
    id: row.id,
    name_he: row.name_he,
    category: row.category,
    sort_order: row.sort_order,
    available: row.available,
    seasonal_months: row.seasonal_months,
    dietary_tag_slugs: Array.from(tagsByIngredient.get(row.id) ?? []),
  }
}

export function mapCustomSandwich(row: CustomSandwichListRow): CustomSandwich {
  return {
    id: row.id,
    kid_id: row.kid_id,
    name_he: row.name_he,
    ingredient_ids: row.kid_custom_sandwich_ingredients.map(
      (r) => r.ingredient_option_id
    ),
  }
}

function intersectIngredientSlugs(
  ingredientIds: string[],
  tagsByIngredient: Map<string, Set<string>>
): string[] {
  let acc: Set<string> | null = null
  for (const id of ingredientIds) {
    const tags: Set<string> = tagsByIngredient.get(id) ?? new Set<string>()
    if (acc === null) {
      acc = new Set<string>(tags)
    } else {
      const next = new Set<string>()
      acc.forEach((s) => { if (tags.has(s)) next.add(s) })
      acc = next
    }
  }
  return acc ? Array.from(acc) : []
}

export function mapSandwichPreset(
  row: SandwichPresetListRow,
  tagsByIngredient: Map<string, Set<string>>
): SandwichPreset {
  const toEntries = (rows: SandwichPresetIngredientJoinRow[]) =>
    rows
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({ id: r.ingredient_options.id, name: r.ingredient_options.name_he }))

  const fillings = toEntries(row.sandwich_preset_fillings)
  const vegetables = toEntries(row.sandwich_preset_vegetables)
  const ingredientIds = [
    row.bread_id,
    ...fillings.map((f) => f.id),
    ...vegetables.map((v) => v.id),
  ]

  return {
    id: row.id,
    slug: row.slug,
    name_he: row.name_he,
    description_he: row.description_he,
    bread_id: row.bread.id,
    bread_name: row.bread.name_he,
    fillings,
    vegetables,
    default_side_veg: { id: row.default_side_veg.id, name: row.default_side_veg.name_he },
    dietary_tag_slugs: intersectIngredientSlugs(ingredientIds, tagsByIngredient),
    sort_order: row.sort_order,
  }
}
