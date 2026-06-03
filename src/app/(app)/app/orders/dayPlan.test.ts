import { describe, expect, it } from 'vitest'
import {
  emptyPlan,
  getWeekLabel,
  mainKeyFromOrder,
  mainSelectionFromKey,
} from './dayPlan'
import type {
  CustomSandwich,
  ExistingOrder,
  MenuItemWithTags,
  SandwichPreset,
} from '../types'

const MENU_ITEMS: MenuItemWithTags[] = [
  { id: 'mi-1', name_he: 'מוזלי', description_he: null, image_url: null, dietary_tag_ids: [] },
]
const CUSTOMS: CustomSandwich[] = [
  { id: 'sw-1', kid_id: 'kid-1', name_he: 'הכריך שלי', ingredient_ids: ['ing-a'] },
]
const PRESETS: SandwichPreset[] = [
  {
    id: 'p-1',
    slug: 'tuna',
    name_he: 'טונה',
    description_he: null,
    bread_id: 'b-1',
    bread_name: 'לחם',
    fillings: [],
    vegetables: [],
    default_side_veg: { id: 'sv-1', name: 'מלפפון' },
    dietary_tag_slugs: [],
    sort_order: 0,
  },
]

function buildOrder(overrides: {
  menu_item_id?: string | null
  custom_sandwich_id?: string | null
  preset_id?: string
  name?: string
}): ExistingOrder {
  return {
    id: 'order-1',
    kid_id: 'kid-1',
    delivery_date: '2026-05-10',
    notes: null,
    status: 'pending',
    order_items: [
      {
        id: 'oi-main',
        slot: 'main',
        menu_item_id: overrides.menu_item_id ?? null,
        custom_sandwich_id: overrides.custom_sandwich_id ?? null,
        ingredient_option_id: null,
        name_he_snapshot: overrides.name ?? 'מוזלי',
        sandwich_config: overrides.preset_id
          ? {
              bread_id: 'b-1', bread: 'לחם',
              fillings: [], vegetables: [], summary: 'X',
              preset_id: overrides.preset_id,
            }
          : null,
      },
    ],
  }
}

describe('emptyPlan', () => {
  it('returns a fresh empty plan', () => {
    expect(emptyPlan()).toEqual({ mainKey: null, mainName: '', notes: '' })
  })

  it('returns a new object each call (no shared reference)', () => {
    expect(emptyPlan()).not.toBe(emptyPlan())
  })
})

describe('mainKeyFromOrder', () => {
  it('returns null + empty name when there is no main slot', () => {
    const order: ExistingOrder = {
      id: 'o', kid_id: 'k', delivery_date: '2026-05-10', notes: null, status: 'pending',
      order_items: [],
    }
    expect(mainKeyFromOrder(order)).toEqual({ key: null, name: '' })
  })

  it('classifies a custom sandwich main', () => {
    const order = buildOrder({ custom_sandwich_id: 'sw-1', name: 'הכריך שלי' })
    expect(mainKeyFromOrder(order)).toEqual({ key: 'custom:sw-1', name: 'הכריך שלי' })
  })

  it('classifies a menu_item main', () => {
    const order = buildOrder({ menu_item_id: 'mi-1', name: 'מוזלי' })
    expect(mainKeyFromOrder(order)).toEqual({ key: 'menu:mi-1', name: 'מוזלי' })
  })

  it('classifies a sandwich_preset main from sandwich_config.preset_id', () => {
    const order = buildOrder({ preset_id: 'p-1', name: 'טונה' })
    expect(mainKeyFromOrder(order)).toEqual({ key: 'sandwich_preset:p-1', name: 'טונה' })
  })

  it('returns null key when main exists but none of the discriminators are set', () => {
    const order = buildOrder({ name: 'אד הוק' })
    expect(mainKeyFromOrder(order)).toEqual({ key: null, name: 'אד הוק' })
  })

  it('prefers custom_sandwich_id over menu_item_id (ordering rule)', () => {
    const order = buildOrder({ custom_sandwich_id: 'sw-1', menu_item_id: 'mi-1', name: 'A' })
    expect(mainKeyFromOrder(order).key).toBe('custom:sw-1')
  })
})

describe('mainSelectionFromKey', () => {
  it('resolves a menu key', () => {
    const out = mainSelectionFromKey('menu:mi-1', MENU_ITEMS, CUSTOMS, PRESETS)
    expect(out).toEqual({
      main: { kind: 'menu_item', menu_item_id: 'mi-1', display_name: 'מוזלי' },
    })
  })

  it('resolves a custom key', () => {
    const out = mainSelectionFromKey('custom:sw-1', MENU_ITEMS, CUSTOMS, PRESETS)
    expect(out).toEqual({
      main: { kind: 'custom_sandwich', custom_sandwich_id: 'sw-1', display_name: 'הכריך שלי' },
    })
  })

  it('resolves a sandwich_preset key and returns the default side veg', () => {
    const out = mainSelectionFromKey('sandwich_preset:p-1', MENU_ITEMS, CUSTOMS, PRESETS)
    expect(out).toEqual({
      main: { kind: 'sandwich_preset', sandwich_preset_id: 'p-1', display_name: 'טונה' },
      sideVegId: 'sv-1',
    })
  })

  it('returns null for an unknown ID', () => {
    expect(mainSelectionFromKey('menu:does-not-exist', MENU_ITEMS, CUSTOMS, PRESETS)).toBeNull()
    expect(mainSelectionFromKey('custom:does-not-exist', MENU_ITEMS, CUSTOMS, PRESETS)).toBeNull()
    expect(mainSelectionFromKey('sandwich_preset:does-not-exist', MENU_ITEMS, CUSTOMS, PRESETS)).toBeNull()
  })

  it('returns null for an unknown kind', () => {
    expect(mainSelectionFromKey('weird:1', MENU_ITEMS, CUSTOMS, PRESETS)).toBeNull()
  })

  it('returns null for a malformed key with no separator', () => {
    expect(mainSelectionFromKey('nosep', MENU_ITEMS, CUSTOMS, PRESETS)).toBeNull()
  })
})

describe('getWeekLabel', () => {
  it('labels each offset', () => {
    expect(getWeekLabel(-1)).toBe('שבוע שעבר')
    expect(getWeekLabel(0)).toBe('שבוע נוכחי')
    expect(getWeekLabel(1)).toBe('שבוע הבא')
    expect(getWeekLabel(2)).toBe('בעוד שבועיים')
  })
})
