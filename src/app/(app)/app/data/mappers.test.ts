import { describe, expect, it } from 'vitest'
import {
  buildSlugById,
  buildTagsByIngredient,
  mapCustomSandwich,
  mapIngredientOption,
  mapMenuItemWithTags,
  mapSandwichPreset,
  type CustomSandwichListRow,
  type IngredientDietaryTagRow,
  type IngredientOptionListRow,
  type MenuItemListRow,
  type SandwichPresetListRow,
} from './mappers'

describe('buildSlugById', () => {
  it('builds an id → slug map', () => {
    const m = buildSlugById([
      { id: 't1', slug: 'vegan' },
      { id: 't2', slug: 'gluten_free' },
    ])
    expect(m.get('t1')).toBe('vegan')
    expect(m.get('t2')).toBe('gluten_free')
    expect(m.get('missing')).toBeUndefined()
  })

  it('handles empty input', () => {
    expect(buildSlugById([]).size).toBe(0)
  })
})

describe('buildTagsByIngredient', () => {
  const slugById = new Map([['t1', 'vegan'], ['t2', 'gluten_free']])

  it('groups slugs per ingredient', () => {
    const rows: IngredientDietaryTagRow[] = [
      { ingredient_option_id: 'ing-1', dietary_tag_id: 't1' },
      { ingredient_option_id: 'ing-1', dietary_tag_id: 't2' },
      { ingredient_option_id: 'ing-2', dietary_tag_id: 't1' },
    ]
    const map = buildTagsByIngredient(rows, slugById)
    expect(Array.from(map.get('ing-1')!)).toEqual(expect.arrayContaining(['vegan', 'gluten_free']))
    expect(Array.from(map.get('ing-2')!)).toEqual(['vegan'])
  })

  it('drops rows whose tag id is not in the slug map', () => {
    const rows: IngredientDietaryTagRow[] = [
      { ingredient_option_id: 'ing-1', dietary_tag_id: 't1' },
      { ingredient_option_id: 'ing-1', dietary_tag_id: 't-unknown' },
    ]
    expect(Array.from(buildTagsByIngredient(rows, slugById).get('ing-1')!)).toEqual(['vegan'])
  })
})

describe('mapMenuItemWithTags', () => {
  it('extracts dietary_tag_ids from the join rows', () => {
    const row: MenuItemListRow = {
      id: 'mi-1',
      name_he: 'מוזלי',
      description_he: null,
      image_url: null,
      menu_item_dietary_tags: [{ dietary_tag_id: 't1' }, { dietary_tag_id: 't2' }],
    }
    expect(mapMenuItemWithTags(row)).toEqual({
      id: 'mi-1',
      name_he: 'מוזלי',
      description_he: null,
      image_url: null,
      dietary_tag_ids: ['t1', 't2'],
    })
  })

  it('returns [] for menu_item_dietary_tags when join is empty', () => {
    const row: MenuItemListRow = {
      id: 'mi-1',
      name_he: 'מוזלי',
      description_he: null,
      image_url: null,
      menu_item_dietary_tags: [],
    }
    expect(mapMenuItemWithTags(row).dietary_tag_ids).toEqual([])
  })
})

describe('mapIngredientOption', () => {
  const tagsByIng = new Map<string, Set<string>>([
    ['ing-1', new Set(['vegan', 'gluten_free'])],
  ])

  it('attaches the slug set for the ingredient', () => {
    const row: IngredientOptionListRow = {
      id: 'ing-1',
      name_he: 'אבוקדו',
      category: 'filling',
      sort_order: 5,
      available: true,
      seasonal_months: null,
    }
    expect(mapIngredientOption(row, tagsByIng).dietary_tag_slugs.sort()).toEqual([
      'gluten_free', 'vegan',
    ])
  })

  it('returns an empty slug list for an ingredient with no recorded tags', () => {
    const row: IngredientOptionListRow = {
      id: 'ing-2',
      name_he: 'מלפפון',
      category: 'sandwich_vegetable',
      sort_order: 1,
      available: true,
      seasonal_months: [4, 5, 6],
    }
    expect(mapIngredientOption(row, tagsByIng).dietary_tag_slugs).toEqual([])
  })
})

describe('mapCustomSandwich', () => {
  it('flattens the join into ingredient_ids', () => {
    const row: CustomSandwichListRow = {
      id: 'sw-1',
      kid_id: 'kid-1',
      name_he: 'הכריך שלי',
      kid_custom_sandwich_ingredients: [
        { ingredient_option_id: 'ing-a' },
        { ingredient_option_id: 'ing-b' },
      ],
    }
    expect(mapCustomSandwich(row).ingredient_ids).toEqual(['ing-a', 'ing-b'])
  })
})

describe('mapSandwichPreset', () => {
  const tagsByIng = new Map<string, Set<string>>([
    ['ing-bread',  new Set(['vegan', 'gluten_free'])],
    ['ing-fill1',  new Set(['vegan', 'gluten_free', 'kosher'])],
    ['ing-fill2',  new Set(['vegan'])],          // missing gluten_free → drops it from intersection
    ['ing-veg1',   new Set(['vegan', 'gluten_free'])],
  ])

  function buildRow(): SandwichPresetListRow {
    return {
      id: 'p-1',
      slug: 'tuna',
      name_he: 'טונה',
      description_he: null,
      bread_id: 'ing-bread',
      sort_order: 1,
      bread: { id: 'ing-bread', name_he: 'לחם' },
      default_side_veg: { id: 'sv-1', name_he: 'מלפפון' },
      sandwich_preset_fillings: [
        { sort_order: 2, ingredient_options: { id: 'ing-fill2', name_he: 'חסה' } },
        { sort_order: 1, ingredient_options: { id: 'ing-fill1', name_he: 'גבינה' } },
      ],
      sandwich_preset_vegetables: [
        { sort_order: 1, ingredient_options: { id: 'ing-veg1', name_he: 'עגבנייה' } },
      ],
    }
  }

  it('orders fillings + vegetables by sort_order', () => {
    const out = mapSandwichPreset(buildRow(), tagsByIng)
    expect(out.fillings.map((f) => f.id)).toEqual(['ing-fill1', 'ing-fill2'])
    expect(out.vegetables.map((v) => v.id)).toEqual(['ing-veg1'])
  })

  it('flattens bread to bread_id + bread_name', () => {
    const out = mapSandwichPreset(buildRow(), tagsByIng)
    expect(out.bread_id).toBe('ing-bread')
    expect(out.bread_name).toBe('לחם')
  })

  it('computes the dietary slug intersection across bread + all fillings + all vegetables', () => {
    // bread: vegan, gf
    // fill1: vegan, gf, kosher
    // fill2: vegan        ← drops gf, kosher from intersection
    // veg1:  vegan, gf
    // → intersection = ['vegan']
    const out = mapSandwichPreset(buildRow(), tagsByIng)
    expect(out.dietary_tag_slugs).toEqual(['vegan'])
  })

  it('returns empty intersection if any ingredient has no recorded tags', () => {
    const partial = new Map(tagsByIng)
    partial.delete('ing-fill2')
    const out = mapSandwichPreset(buildRow(), partial)
    expect(out.dietary_tag_slugs).toEqual([])
  })
})
