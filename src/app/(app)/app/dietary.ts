import type {
  CustomSandwich,
  DietaryTag,
  IngredientOption,
  Kid,
  MenuItemWithTags,
  SandwichPreset,
} from './types'

/** Slugs the kid REQUIRES — every meal/sandwich must carry every one of them. */
export function getKidRequiredSlugs(kid: Kid | null, dietaryTags: DietaryTag[]): string[] {
  if (!kid || kid.kid_dietary_restrictions.length === 0) return []
  const slugById = new Map(dietaryTags.map((t) => [t.id, t.slug]))
  return kid.kid_dietary_restrictions
    .map((r) => slugById.get(r.dietary_tag_id))
    .filter((s): s is string => !!s)
}

/**
 * A saved custom sandwich is compatible if every one of its ingredients carries
 * every dietary tag slug the kid requires. Sandwiches that contain ingredients
 * missing from the catalog (e.g. retired) are treated as incompatible.
 *
 * Sandwiches that fail this check are hidden from the menu + orders picker but
 * are NOT deleted — removing the offending dietary tag brings them back.
 */
export function isCustomSandwichCompatible(
  sandwich: CustomSandwich,
  ingredients: IngredientOption[],
  requiredSlugs: string[]
): boolean {
  if (requiredSlugs.length === 0) return true
  const ingMap = new Map(ingredients.map((i) => [i.id, i]))
  for (const id of sandwich.ingredient_ids) {
    const ing = ingMap.get(id)
    if (!ing) return false
    for (const slug of requiredSlugs) {
      if (!ing.dietary_tag_slugs.includes(slug)) return false
    }
  }
  return true
}

/** Atomic menu_item is compatible iff it carries every dietary_tag_id the kid requires. */
export function isMenuItemCompatible(kid: Kid | null, item: MenuItemWithTags): boolean {
  if (!kid) return true
  const kidTagIds = kid.kid_dietary_restrictions.map((r) => r.dietary_tag_id)
  if (kidTagIds.length === 0) return true
  return kidTagIds.every((tagId) => item.dietary_tag_ids.includes(tagId))
}

/** Sandwich preset is compatible iff every required slug appears in its computed slug set. */
export function isPresetCompatible(
  kid: Kid | null,
  preset: SandwichPreset,
  dietaryTags: DietaryTag[]
): boolean {
  if (!kid || kid.kid_dietary_restrictions.length === 0) return true
  const required = getKidRequiredSlugs(kid, dietaryTags)
  return required.every((s) => preset.dietary_tag_slugs.includes(s))
}
