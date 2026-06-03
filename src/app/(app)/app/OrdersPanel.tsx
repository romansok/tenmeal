'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { saveDayOrder } from './actions'
import {
  getKidRequiredSlugs,
  isCustomSandwichCompatible,
  isMenuItemCompatible,
  isPresetCompatible,
} from './dietary'
import { getOrderableDates, getWeekStart, toDateKey } from './lib/week'
import DayCell from './orders/DayCell'
import MealPickerSheet from './orders/MealPickerSheet'
import WeekCard from './orders/WeekCard'
import { useWeekOps } from './orders/useWeekOps'
import GlassCard from './ui/GlassCard'
import {
  WEEK_OFFSETS,
  type DayPlanUI,
  type MainKey,
  type PickerEntry,
  type WeekMeta,
  type WeekOffset,
  emptyPlan,
  mainKeyFromOrder,
  mainSelectionFromKey,
} from './orders/dayPlan'
import type {
  CustomSandwich,
  DietaryTag,
  ExistingOrder,
  IngredientOption,
  Kid,
  KidFavorite,
  MainSelection,
  MenuItemWithTags,
  SandwichPreset,
  Subscription,
} from './types'

interface OrdersPanelProps {
  profileId: string
  kids: Kid[]
  subscription: Subscription | null
  menuItemsWithTags: MenuItemWithTags[]
  customSandwiches: CustomSandwich[]
  favorites: KidFavorite[]
  sandwichPresets: SandwichPreset[]
  dietaryTags: DietaryTag[]
  ingredients: IngredientOption[]
  initialWeekOrders: ExistingOrder[]
  mealsRemaining: number
  onMealsUsed: (n: number) => void
}

export default function OrdersPanel({
  profileId,
  kids,
  subscription,
  menuItemsWithTags,
  customSandwiches,
  favorites,
  sandwichPresets,
  dietaryTags,
  ingredients,
  initialWeekOrders,
  mealsRemaining,
  onMealsUsed,
}: OrdersPanelProps) {
  const todayKey = toDateKey(new Date())
  const toast = useToast()

  const allWeeks: WeekMeta[] = WEEK_OFFSETS.map((offset) => {
    const ws = getWeekStart(offset)
    const dates = getOrderableDates(ws)
    return { offset, ws, dates, dateKeys: dates.map(toDateKey), weekEnd: dates[dates.length - 1] }
  })

  const initKidId = kids[0]?.id ?? ''

  function buildSsrPlans(): Record<string, DayPlanUI> {
    const plans: Record<string, DayPlanUI> = {}
    const currentWeek = allWeeks.find((w) => w.offset === 0)!
    for (const dateKey of currentWeek.dateKeys) {
      const order = initialWeekOrders.find((o) => o.kid_id === initKidId && o.delivery_date === dateKey)
      if (order) {
        const { key, name } = mainKeyFromOrder(order)
        plans[dateKey] = { mainKey: key, mainName: name, notes: order.notes ?? '' }
      } else {
        plans[dateKey] = emptyPlan()
      }
    }
    return plans
  }

  const [selectedKidId, setSelectedKidId] = useState(initKidId)
  const [dayPlans, setDayPlans] = useState<Record<string, DayPlanUI>>(buildSsrPlans)
  const [openSheetDay, setOpenSheetDay] = useState<string | null>(null)
  const [savingDays, setSavingDays] = useState<Set<string>>(new Set())
  const [dayErrors, setDayErrors] = useState<Record<string, string>>({})
  const [expandedError, setExpandedError] = useState<string | null>(null)
  const [weekErrors, setWeekErrors] = useState<Partial<Record<WeekOffset, string | undefined>>>({})
  const [pastExpanded, setPastExpanded] = useState(false)
  const notesTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const selectedKid = kids.find((k) => k.id === selectedKidId) ?? null
  const kidRequiredSlugs = getKidRequiredSlugs(selectedKid, dietaryTags)

  // Hide saved customs whose ingredients would violate the kid's CURRENT
  // dietary tags. Rows stay in the DB — removing the offending tag brings
  // them back automatically.
  const kidCustoms = customSandwiches
    .filter((c) => c.kid_id === selectedKidId)
    .filter((c) => isCustomSandwichCompatible(c, ingredients, kidRequiredSlugs))
  const kidFavorites = favorites.filter((f) => f.kid_id === selectedKidId)
  const favoritedMenuIds = new Set(kidFavorites.map((f) => f.menu_item_id).filter((x): x is string => !!x))
  const favoritedPresetIds = new Set(kidFavorites.map((f) => f.preset_id).filter((x): x is string => !!x))

  // Picker is strictly: kid's saved customs + favorited menu items + favorited presets.
  // Compatibility check still applied so a kid whose tags changed after favoriting
  // doesn't see now-incompatible items.
  const pickerMenuItems = menuItemsWithTags
    .filter((m) => favoritedMenuIds.has(m.id))
    .filter((m) => isMenuItemCompatible(selectedKid, m))
  const pickerSandwichPresets = sandwichPresets
    .filter((p) => favoritedPresetIds.has(p.id))
    .filter((p) => isPresetCompatible(selectedKid, p, dietaryTags))

  const pickerEntries: PickerEntry[] = [
    ...kidCustoms.map((c): PickerEntry => ({
      key: `custom:${c.id}`,
      name: c.name_he,
      description: 'הכריך השמור שלך',
      kind: 'custom',
      icon: '🥪',
    })),
    ...pickerSandwichPresets.map((p): PickerEntry => ({
      key: `sandwich_preset:${p.id}`,
      name: p.name_he,
      description: p.description_he,
      kind: 'sandwich_preset',
      icon: '🥪',
    })),
    ...pickerMenuItems.map((m): PickerEntry => ({
      key: `menu:${m.id}`,
      name: m.name_he,
      description: m.description_he,
      kind: 'menu',
      icon: '🍱',
    })),
  ]

  // Re-fetch full window of orders when the selected kid changes.
  useEffect(() => {
    if (!selectedKidId) return
    const supabase = createClient()
    const startDate = allWeeks[0].dateKeys[0]
    const endDate = toDateKey(allWeeks[allWeeks.length - 1].weekEnd)

    supabase
      .from('orders')
      .select(
        'id, kid_id, delivery_date, notes, status, order_items(id, slot, menu_item_id, custom_sandwich_id, ingredient_option_id, name_he_snapshot, sandwich_config)'
      )
      .eq('kid_id', selectedKidId)
      .gte('delivery_date', startDate)
      .lte('delivery_date', endDate)
      .is('deleted_at', null)
      .returns<ExistingOrder[]>()
      .then(({ data }) => {
        const orders = data ?? []
        const plans: Record<string, DayPlanUI> = {}
        for (const week of allWeeks) {
          for (const dateKey of week.dateKeys) {
            const order = orders.find((o) => o.delivery_date === dateKey)
            plans[dateKey] = order
              ? (() => {
                  const { key, name } = mainKeyFromOrder(order)
                  return { mainKey: key, mainName: name, notes: order.notes ?? '' }
                })()
              : emptyPlan()
          }
        }
        setDayPlans(plans)
        setOpenSheetDay(null)
        setSavingDays(new Set())
        setDayErrors({})
      })
  }, [selectedKidId]) // eslint-disable-line react-hooks/exhaustive-deps

  function countPlanned(week: WeekMeta): number {
    return week.dateKeys.filter((k) => dayPlans[k]?.mainKey != null).length
  }

  function countFuturePlanned(week: WeekMeta): number {
    return week.dateKeys.filter((k) => k > todayKey && dayPlans[k]?.mainKey != null).length
  }

  const persistDay = useCallback(async (
    dateKey: string,
    mainKey: MainKey | null,
    notes: string,
    prevPlan: DayPlanUI | null,
    isNewMeal: boolean,
    isCancellation: boolean,
  ) => {
    setSavingDays((prev) => new Set(prev).add(dateKey))
    setDayErrors((prev) => { const next = { ...prev }; delete next[dateKey]; return next })

    let main: MainSelection | null = null
    let sideVegId: string | undefined
    if (mainKey) {
      const resolved = mainSelectionFromKey(mainKey, menuItemsWithTags, customSandwiches, sandwichPresets)
      if (!resolved) {
        setSavingDays((prev) => { const next = new Set(prev); next.delete(dateKey); return next })
        setDayErrors((prev) => ({ ...prev, [dateKey]: 'בחירה לא תקינה.' }))
        return
      }
      main = resolved.main
      sideVegId = resolved.sideVegId
    }

    const result = await saveDayOrder({
      kidId: selectedKidId,
      profileId,
      date: dateKey,
      main,
      notes,
      ...(sideVegId !== undefined ? { sideVegId } : {}),
    })

    setSavingDays((prev) => { const next = new Set(prev); next.delete(dateKey); return next })

    if ('error' in result) {
      if (prevPlan) setDayPlans((prev) => ({ ...prev, [dateKey]: prevPlan }))
      if (isNewMeal) onMealsUsed(-1)
      if (isCancellation) onMealsUsed(1)
      setDayErrors((prev) => ({ ...prev, [dateKey]: result.error }))
    }
  }, [selectedKidId, profileId, onMealsUsed, menuItemsWithTags, customSandwiches, sandwichPresets])

  const { fillWeekFromPrev, copyToNextWeek, clearWeek } = useWeekOps({
    allWeeks,
    todayKey,
    mealsRemaining,
    dayPlans,
    setDayPlans,
    setFillErrors: setWeekErrors,
    onMealsUsed,
    persistDay,
    toast,
  })

  function handleKidChange(kidId: string) {
    setSelectedKidId(kidId)
    setDayErrors({})
    setWeekErrors({})
    setOpenSheetDay(null)
  }

  function selectMain(dateKey: string, entry: PickerEntry) {
    if (!subscription) return
    const prevPlan = dayPlans[dateKey] ?? emptyPlan()
    const isNewMeal = prevPlan.mainKey === null
    if (isNewMeal && mealsRemaining <= 0) return
    if (savingDays.has(dateKey)) return

    const newPlan: DayPlanUI = { ...prevPlan, mainKey: entry.key, mainName: entry.name }
    setDayPlans((prev) => ({ ...prev, [dateKey]: newPlan }))
    setOpenSheetDay(null)
    if (isNewMeal) onMealsUsed(1)

    persistDay(dateKey, entry.key, prevPlan.notes, prevPlan, isNewMeal, false)
  }

  function cancelDay(dateKey: string) {
    const prevPlan = dayPlans[dateKey] ?? emptyPlan()
    if (!prevPlan.mainKey) return
    if (savingDays.has(dateKey)) return

    setDayPlans((prev) => ({ ...prev, [dateKey]: emptyPlan() }))
    setOpenSheetDay(null)
    onMealsUsed(-1)

    persistDay(dateKey, null, '', prevPlan, false, true)

    toast.show({
      message: 'הארוחה בוטלה',
      onUndo: () => {
        setDayPlans((prev) => ({ ...prev, [dateKey]: prevPlan }))
        onMealsUsed(1)
        persistDay(dateKey, prevPlan.mainKey, prevPlan.notes, emptyPlan(), true, false)
      },
    })
  }

  function updateNotes(dateKey: string, notes: string) {
    setDayPlans((prev) => ({ ...prev, [dateKey]: { ...prev[dateKey], notes } }))

    if (notesTimers.current[dateKey]) clearTimeout(notesTimers.current[dateKey])
    notesTimers.current[dateKey] = setTimeout(() => {
      const plan = dayPlans[dateKey]
      if (plan?.mainKey) {
        const resolved = mainSelectionFromKey(plan.mainKey, menuItemsWithTags, customSandwiches, sandwichPresets)
        if (resolved) {
          saveDayOrder({ kidId: selectedKidId, profileId, date: dateKey, main: resolved.main, notes })
        }
      }
    }, 500)
  }

  const quotaFullGlobal = mealsRemaining <= 0

  function renderDayCell(week: WeekMeta, d: Date, i: number) {
    const dateKey = week.dateKeys[i]
    return (
      <DayCell
        key={dateKey}
        date={d}
        weekdayIndex={i}
        dateKey={dateKey}
        plan={dayPlans[dateKey] ?? emptyPlan()}
        todayKey={todayKey}
        isReadOnly={week.offset === -1}
        isOpen={openSheetDay === dateKey}
        isSaving={savingDays.has(dateKey)}
        errorMessage={dayErrors[dateKey] ?? null}
        errorExpanded={expandedError === dateKey}
        quotaFull={quotaFullGlobal}
        pickerHasEntries={pickerEntries.length > 0}
        onOpen={() => setOpenSheetDay(dateKey)}
        onToggleErrorExpanded={() =>
          setExpandedError((prev) => (prev === dateKey ? null : dateKey))
        }
      />
    )
  }

  const sheetState = (() => {
    if (!openSheetDay) return null
    const dateKey = openSheetDay
    const isFuture = dateKey > todayKey
    const week = allWeeks.find((w) => w.dateKeys.includes(dateKey))
    const isReadOnly = week?.offset === -1
    if (isReadOnly || !isFuture) return null
    return { dateKey, plan: dayPlans[dateKey] ?? emptyPlan() }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>

      {kids.length > 0 && (
        <div
          className="scroll-fade-edge"
          style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}
        >
          {kids.map((kid) => (
            <button
              key={kid.id}
              onClick={() => handleKidChange(kid.id)}
              className={`kid-pill${selectedKidId === kid.id ? ' kid-pill-active' : ''}`}
              style={{ border: 'none' }}
            >
              <span>{kid.emoji_avatar}</span>
              <span>{kid.name}</span>
            </button>
          ))}
        </div>
      )}

      {kids.length > 0 && quotaFullGlobal && subscription && (
        <div style={{
          background: 'rgba(255,107,53,0.10)',
          border: '1.5px solid rgba(255,107,53,0.35)',
          borderRadius: 14,
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: '#2C1810', fontWeight: 600,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span>המנוי מלא — בטל ארוחה כדי להוסיף ארוחה חדשה</span>
        </div>
      )}

      {kids.length === 0 && (
        <GlassCard
          padding={32}
          radius={16}
          style={{ textAlign: 'center', color: 'rgba(44,24,16,0.45)', fontSize: 14 }}
        >
          אין ילדים רשומים
        </GlassCard>
      )}

      {kids.length > 0 && pickerEntries.length === 0 && (
        <div style={{
          background: 'rgba(255,179,71,0.12)', border: '1px solid rgba(255,179,71,0.35)',
          borderRadius: 14, padding: '12px 16px',
          fontSize: 13, color: 'rgba(44,24,16,0.65)', textAlign: 'center', fontWeight: 500,
        }}>
          אין ארוחות זמינות לילד זה — עבור ללשונית <strong>תפריט</strong> וסמן ❤️ ארוחות אהובות או בנה כריך 🥪
        </div>
      )}

      {kids.length > 0 && allWeeks.map((week) => (
        <WeekCard
          key={week.offset}
          week={week}
          isReadOnly={week.offset === -1}
          pastExpanded={pastExpanded}
          onTogglePast={() => setPastExpanded((p) => !p)}
          planned={countPlanned(week)}
          totalDays={week.dateKeys.length}
          futurePlanned={countFuturePlanned(week)}
          weekError={weekErrors[week.offset]}
          renderDayCell={renderDayCell}
          hasSubscription={!!subscription}
          onFillFromPrev={fillWeekFromPrev}
          onCopyToNext={copyToNextWeek}
          onClear={clearWeek}
        />
      ))}

      {sheetState && (
        <MealPickerSheet
          dateKey={sheetState.dateKey}
          plan={sheetState.plan}
          pickerEntries={pickerEntries}
          quotaFull={quotaFullGlobal}
          onClose={() => setOpenSheetDay(null)}
          onSelect={(entry) => selectMain(sheetState.dateKey, entry)}
          onCancelDay={() => cancelDay(sheetState.dateKey)}
          onUpdateNotes={(notes) => updateNotes(sheetState.dateKey, notes)}
        />
      )}
    </div>
  )
}
