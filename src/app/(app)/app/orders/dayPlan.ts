// Types + pure helpers shared across OrdersPanel, DayCell, useWeekOps, and the
// meal-picker sheet. No React imports — just plain data shaping.

import type {
  CustomSandwich,
  ExistingOrder,
  MainSelection,
  MenuItemWithTags,
  SandwichPreset,
} from '../types'

export const WEEK_OFFSETS = [-1, 0, 1, 2] as const
export type WeekOffset = (typeof WEEK_OFFSETS)[number]

export interface WeekMeta {
  offset: WeekOffset
  ws: Date
  dates: Date[]
  dateKeys: string[]
  weekEnd: Date
}

/**
 * Identifies the chosen main for a day:
 *   "menu:<menu_item_id>"           — DB-backed atomic menu_item
 *   "custom:<custom_sandwich_id>"   — kid's saved custom sandwich
 *   "sandwich_preset:<preset_id>"   — DB-backed sandwich preset
 */
export type MainKey = string

export interface DayPlanUI {
  mainKey: MainKey | null
  mainName: string
  notes: string
}

export function emptyPlan(): DayPlanUI {
  return { mainKey: null, mainName: '', notes: '' }
}

export function mainKeyFromOrder(order: ExistingOrder): { key: MainKey | null; name: string } {
  const main = order.order_items?.find((oi) => oi.slot === 'main')
  if (!main) return { key: null, name: '' }
  if (main.custom_sandwich_id) return { key: `custom:${main.custom_sandwich_id}`, name: main.name_he_snapshot }
  if (main.menu_item_id) return { key: `menu:${main.menu_item_id}`, name: main.name_he_snapshot }
  if (main.sandwich_config?.preset_id) {
    return { key: `sandwich_preset:${main.sandwich_config.preset_id}`, name: main.name_he_snapshot }
  }
  return { key: null, name: main.name_he_snapshot }
}

export function mainSelectionFromKey(
  key: MainKey,
  menuItems: MenuItemWithTags[],
  customs: CustomSandwich[],
  presets: SandwichPreset[]
): { main: MainSelection; sideVegId?: string } | null {
  const idx = key.indexOf(':')
  if (idx < 0) return null
  const kind = key.slice(0, idx)
  const id = key.slice(idx + 1)

  if (kind === 'menu') {
    const item = menuItems.find((p) => p.id === id)
    if (!item) return null
    return { main: { kind: 'menu_item', menu_item_id: id, display_name: item.name_he } }
  }
  if (kind === 'custom') {
    const sandwich = customs.find((c) => c.id === id)
    if (!sandwich) return null
    return { main: { kind: 'custom_sandwich', custom_sandwich_id: id, display_name: sandwich.name_he } }
  }
  if (kind === 'sandwich_preset') {
    const preset = presets.find((p) => p.id === id)
    if (!preset) return null
    return {
      main: { kind: 'sandwich_preset', sandwich_preset_id: preset.id, display_name: preset.name_he },
      sideVegId: preset.default_side_veg.id,
    }
  }
  return null
}

export interface PickerEntry {
  key: MainKey
  name: string
  description: string | null
  kind: 'menu' | 'custom' | 'sandwich_preset'
  icon: string
}

export function getWeekLabel(offset: WeekOffset): string {
  if (offset === -1) return 'שבוע שעבר'
  if (offset === 0) return 'שבוע נוכחי'
  if (offset === 1) return 'שבוע הבא'
  return 'בעוד שבועיים'
}
