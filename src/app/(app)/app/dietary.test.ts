import { describe, expect, it } from 'vitest'
import {
  getKidRequiredSlugs,
  isCustomSandwichCompatible,
  isMenuItemCompatible,
  isPresetCompatible,
} from './dietary'
import type {
  CustomSandwich,
  DietaryTag,
  IngredientOption,
  Kid,
  MenuItemWithTags,
  SandwichPreset,
} from './types'

const TAGS: DietaryTag[] = [
  { id: 'tag-vegan', slug: 'vegan', label_he: 'טבעוני' },
  { id: 'tag-gf',    slug: 'gluten_free', label_he: 'ללא גלוטן' },
  { id: 'tag-kosher', slug: 'kosher', label_he: 'כשר' },
]

function buildKid(opts?: Partial<Kid> & { tagIds?: string[] }): Kid {
  return {
    id: 'kid-1',
    name: 'דני',
    last_name: null,
    class_name: null,
    phone: null,
    emoji_avatar: '🧒',
    sort_order: 0,
    school_id: null,
    school: null,
    kid_dietary_restrictions: (opts?.tagIds ?? []).map((id) => ({
      dietary_tag_id: id,
      dietary_tags: TAGS.find((t) => t.id === id) ?? null,
    })),
    ...opts,
  }
}

function buildIngredient(id: string, slugs: string[]): IngredientOption {
  return {
    id,
    name_he: id,
    category: 'filling',
    sort_order: 0,
    available: true,
    seasonal_months: null,
    dietary_tag_slugs: slugs,
  }
}

describe('getKidRequiredSlugs', () => {
  it('returns [] for null kid', () => {
    expect(getKidRequiredSlugs(null, TAGS)).toEqual([])
  })

  it('returns [] when kid has no restrictions', () => {
    expect(getKidRequiredSlugs(buildKid(), TAGS)).toEqual([])
  })

  it('maps restriction tag IDs to slugs', () => {
    const kid = buildKid({ tagIds: ['tag-vegan', 'tag-gf'] })
    expect(getKidRequiredSlugs(kid, TAGS).sort()).toEqual(['gluten_free', 'vegan'])
  })

  it('drops tag IDs that are not in the catalog (defensive)', () => {
    const kid = buildKid({ tagIds: ['tag-vegan', 'tag-unknown'] })
    expect(getKidRequiredSlugs(kid, TAGS)).toEqual(['vegan'])
  })
})

describe('isCustomSandwichCompatible', () => {
  const sandwich: CustomSandwich = {
    id: 'sw-1',
    kid_id: 'kid-1',
    name_he: 'הכריך שלי',
    ingredient_ids: ['ing-bread', 'ing-cheese'],
  }
  const ingredients = [
    buildIngredient('ing-bread', ['vegan', 'gluten_free']),
    buildIngredient('ing-cheese', ['vegan', 'gluten_free']),
  ]

  it('passes when no slugs are required', () => {
    expect(isCustomSandwichCompatible(sandwich, ingredients, [])).toBe(true)
  })

  it('passes when every ingredient carries every required slug', () => {
    expect(isCustomSandwichCompatible(sandwich, ingredients, ['vegan'])).toBe(true)
    expect(isCustomSandwichCompatible(sandwich, ingredients, ['vegan', 'gluten_free'])).toBe(true)
  })

  it('fails when an ingredient is missing a required slug', () => {
    const partialIngs = [
      buildIngredient('ing-bread', ['vegan']),
      buildIngredient('ing-cheese', ['vegan', 'gluten_free']),
    ]
    expect(isCustomSandwichCompatible(sandwich, partialIngs, ['gluten_free'])).toBe(false)
  })

  it('fails when an ingredient is missing from the catalog (retired ingredient)', () => {
    const incompleteCatalog = [buildIngredient('ing-bread', ['vegan'])]
    expect(isCustomSandwichCompatible(sandwich, incompleteCatalog, ['vegan'])).toBe(false)
  })
})

describe('isMenuItemCompatible', () => {
  const item: MenuItemWithTags = {
    id: 'mi-1',
    name_he: 'מוזלי',
    description_he: null,
    image_url: null,
    dietary_tag_ids: ['tag-vegan', 'tag-gf'],
  }

  it('passes for null kid', () => {
    expect(isMenuItemCompatible(null, item)).toBe(true)
  })

  it('passes when kid has no restrictions', () => {
    expect(isMenuItemCompatible(buildKid(), item)).toBe(true)
  })

  it('passes when item carries every required tag', () => {
    expect(isMenuItemCompatible(buildKid({ tagIds: ['tag-vegan'] }), item)).toBe(true)
  })

  it('fails when item lacks a required tag', () => {
    expect(isMenuItemCompatible(buildKid({ tagIds: ['tag-kosher'] }), item)).toBe(false)
  })
})

describe('isPresetCompatible', () => {
  const preset: SandwichPreset = {
    id: 'p-1',
    slug: 'tuna',
    name_he: 'טונה',
    description_he: null,
    bread_id: 'b-1',
    bread_name: 'לחם',
    fillings: [],
    vegetables: [],
    default_side_veg: { id: 'sv-1', name: 'מלפפון' },
    dietary_tag_slugs: ['vegan', 'gluten_free'],
    sort_order: 0,
  }

  it('passes when kid has no restrictions', () => {
    expect(isPresetCompatible(buildKid(), preset, TAGS)).toBe(true)
  })

  it('passes for null kid', () => {
    expect(isPresetCompatible(null, preset, TAGS)).toBe(true)
  })

  it('passes when preset carries every required slug', () => {
    expect(isPresetCompatible(buildKid({ tagIds: ['tag-vegan'] }), preset, TAGS)).toBe(true)
  })

  it('fails when preset is missing a required slug', () => {
    expect(isPresetCompatible(buildKid({ tagIds: ['tag-kosher'] }), preset, TAGS)).toBe(false)
  })
})
