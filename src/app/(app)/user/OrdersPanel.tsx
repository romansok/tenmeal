'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveDayOrder } from './actions'
import type { Kid, MenuItem, ExistingOrder, DayPlan, Subscription, KidFavorite } from './types'

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_OFFSETS = [-1, 0, 1, 2] as const
type WeekOffset = typeof WEEK_OFFSETS[number]

const SHORT_DAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳']
const LONG_DAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function getWeekLabel(offset: WeekOffset): string {
  if (offset === -1) return 'שבוע שעבר'
  if (offset === 0)  return 'שבוע נוכחי'
  if (offset === 1)  return 'שבוע הבא'
  return 'בעוד שבועיים'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekStart(weekOffset: number): Date {
  const now = new Date()
  const sun = new Date(now)
  sun.setDate(now.getDate() - now.getDay() + weekOffset * 7)
  sun.setHours(0, 0, 0, 0)
  return sun
}

function getOrderableDates(weekStart: Date): Date[] {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
}

function formatWeekRange(ws: Date): string {
  const dates = getOrderableDates(ws)
  const sun = dates[0]
  const fri = dates[dates.length - 1]
  if (sun.getMonth() === fri.getMonth()) {
    return `${sun.getDate()}–${fri.getDate()} ${HE_MONTHS[sun.getMonth()]}`
  }
  return `${sun.getDate()} ${HE_MONTHS[sun.getMonth()]} – ${fri.getDate()} ${HE_MONTHS[fri.getMonth()]}`
}

function formatExpandedLabel(dateKey: string): string {
  const d = new Date(dateKey)
  return `יום ${LONG_DAY[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekMeta {
  offset: WeekOffset
  ws: Date
  dates: Date[]
  dateKeys: string[]
  weekEnd: Date
}

interface OrdersPanelProps {
  profileId: string
  kids: Kid[]
  subscription: Subscription | null
  menuItems: MenuItem[]
  initialWeekOrders: ExistingOrder[]
  mealsRemaining: number
  onMealsUsed: (n: number) => void
  kidFavorites: KidFavorite[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrdersPanel({
  profileId,
  kids,
  subscription,
  menuItems,
  initialWeekOrders,
  mealsRemaining,
  onMealsUsed,
  kidFavorites,
}: OrdersPanelProps) {
  const todayKey = toDateKey(new Date())

  // Pre-compute week metadata
  const allWeeks: WeekMeta[] = WEEK_OFFSETS.map((offset) => {
    const ws = getWeekStart(offset)
    const dates = getOrderableDates(ws)
    return { offset, ws, dates, dateKeys: dates.map(toDateKey), weekEnd: dates[dates.length - 1] }
  })

  const initKidId = kids[0]?.id ?? ''

  // Seed current week from SSR data
  function buildSsrPlans(): Record<string, DayPlan> {
    const plans: Record<string, DayPlan> = {}
    const currentWeek = allWeeks.find((w) => w.offset === 0)!
    for (const dateKey of currentWeek.dateKeys) {
      const order = initialWeekOrders.find((o) => o.kid_id === initKidId && o.delivery_date === dateKey)
      plans[dateKey] = {
        menuItemId: order?.order_items?.[0]?.menu_item_id ?? null,
        notes: order?.notes ?? '',
      }
    }
    return plans
  }

  const [selectedKidId, setSelectedKidId] = useState(initKidId)
  const [dayPlans, setDayPlans] = useState<Record<string, DayPlan>>(buildSsrPlans)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [savingDays, setSavingDays] = useState<Set<string>>(new Set())
  const [dayErrors, setDayErrors] = useState<Record<string, string>>({})
  const [fillErrors, setFillErrors] = useState<Partial<Record<WeekOffset, string>>>({})
  const notesTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // Favorites for selected kid
  const favMealIds = new Set(
    kidFavorites.filter((f) => f.kid_id === selectedKidId).map((f) => f.menu_item_id)
  )
  const favMenuItems = menuItems.filter((m) => favMealIds.has(m.id))

  // Load all 4 weeks whenever kid changes
  useEffect(() => {
    if (!selectedKidId) return
    const supabase = createClient()
    const startDate = allWeeks[0].dateKeys[0]
    const endDate = toDateKey(allWeeks[allWeeks.length - 1].weekEnd)

    supabase
      .from('orders')
      .select('id, kid_id, delivery_date, notes, status, order_items(id, menu_item_id, quantity)')
      .eq('kid_id', selectedKidId)
      .gte('delivery_date', startDate)
      .lte('delivery_date', endDate)
      .is('deleted_at', null)
      .then(({ data }) => {
        const orders = (data ?? []) as ExistingOrder[]
        const plans: Record<string, DayPlan> = {}
        for (const week of allWeeks) {
          for (const dateKey of week.dateKeys) {
            const order = orders.find((o) => o.delivery_date === dateKey)
            plans[dateKey] = {
              menuItemId: order?.order_items?.[0]?.menu_item_id ?? null,
              notes: order?.notes ?? '',
            }
          }
        }
        setDayPlans(plans)
        setExpandedDay(null)
        setSavingDays(new Set())
        setDayErrors({})
      })
  }, [selectedKidId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-week helpers ──────────────────────────────────────────────────────

  function countPlanned(week: WeekMeta): number {
    return week.dateKeys.filter((k) => dayPlans[k]?.menuItemId != null).length
  }

  function countNewMealsForFill(week: WeekMeta): number {
    const prevWeek = allWeeks.find((w) => w.offset === week.offset - 1)
    if (!prevWeek) return 0
    let count = 0
    for (let i = 0; i < week.dateKeys.length; i++) {
      const currKey = week.dateKeys[i]
      const prevKey = prevWeek.dateKeys[i]
      if (currKey <= todayKey) continue
      if (dayPlans[prevKey]?.menuItemId && !dayPlans[currKey]?.menuItemId) count++
    }
    return count
  }

  // ── Auto-save helper ─────────────────────────────────────────────────────

  const persistDay = useCallback(async (
    dateKey: string,
    menuItemId: string | null,
    notes: string,
    prevPlan: DayPlan | null,
    isNewMeal: boolean,
    isCancellation: boolean,
  ) => {
    setSavingDays((prev) => new Set(prev).add(dateKey))
    setDayErrors((prev) => { const next = { ...prev }; delete next[dateKey]; return next })

    const result = await saveDayOrder({
      kidId: selectedKidId,
      profileId,
      date: dateKey,
      menuItemId,
      notes,
    })

    setSavingDays((prev) => { const next = new Set(prev); next.delete(dateKey); return next })

    if ('error' in result) {
      // Rollback
      if (prevPlan) {
        setDayPlans((prev) => ({ ...prev, [dateKey]: prevPlan }))
      }
      if (isNewMeal) onMealsUsed(-1)
      if (isCancellation) onMealsUsed(1)
      setDayErrors((prev) => ({ ...prev, [dateKey]: result.error }))
    }
  }, [selectedKidId, profileId, onMealsUsed])

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleKidChange(kidId: string) {
    setSelectedKidId(kidId)
    setDayErrors({})
    setFillErrors({})
    setExpandedDay(null)
  }

  function selectMeal(dateKey: string, menuItemId: string) {
    if (!subscription) return
    const prevPlan = dayPlans[dateKey] ?? { menuItemId: null, notes: '' }
    const isNewMeal = prevPlan.menuItemId === null
    if (isNewMeal && mealsRemaining <= 0) return
    if (savingDays.has(dateKey)) return

    // Optimistic update
    const newPlan = { ...prevPlan, menuItemId }
    setDayPlans((prev) => ({ ...prev, [dateKey]: newPlan }))
    setExpandedDay(null)
    if (isNewMeal) onMealsUsed(1)

    persistDay(dateKey, menuItemId, prevPlan.notes, prevPlan, isNewMeal, false)
  }

  function cancelDay(dateKey: string) {
    const prevPlan = dayPlans[dateKey] ?? { menuItemId: null, notes: '' }
    if (!prevPlan.menuItemId) return
    if (savingDays.has(dateKey)) return

    // Optimistic update
    setDayPlans((prev) => ({ ...prev, [dateKey]: { menuItemId: null, notes: '' } }))
    setExpandedDay(null)
    onMealsUsed(-1)

    persistDay(dateKey, null, '', prevPlan, false, true)
  }

  function updateNotes(dateKey: string, notes: string) {
    setDayPlans((prev) => ({ ...prev, [dateKey]: { ...prev[dateKey], notes } }))

    // Debounce notes save
    if (notesTimers.current[dateKey]) clearTimeout(notesTimers.current[dateKey])
    notesTimers.current[dateKey] = setTimeout(() => {
      const plan = dayPlans[dateKey]
      if (plan?.menuItemId) {
        saveDayOrder({ kidId: selectedKidId, profileId, date: dateKey, menuItemId: plan.menuItemId, notes })
      }
    }, 500)
  }

  function fillWeekFromPrev(week: WeekMeta) {
    const prevWeek = allWeeks.find((w) => w.offset === week.offset - 1)
    if (!prevWeek) return

    const needed = countNewMealsForFill(week)
    if (needed === 0) {
      setFillErrors((e) => ({ ...e, [week.offset]: 'אין ארוחות מהשבוע הקודם להעתיק' }))
      return
    }
    if (needed > mealsRemaining) {
      const missing = needed - mealsRemaining
      setFillErrors((e) => ({ ...e, [week.offset]: `אין מספיק ארוחות במנוי (חסרות ${missing})` }))
      return
    }
    setFillErrors((e) => ({ ...e, [week.offset]: undefined }))

    // Collect days to fill
    const daysToFill: { currKey: string; prevPlan: DayPlan }[] = []
    for (let i = 0; i < week.dateKeys.length; i++) {
      const currKey = week.dateKeys[i]
      const prevKey = prevWeek.dateKeys[i]
      if (currKey <= todayKey) continue
      const prevPlan = dayPlans[prevKey]
      if (prevPlan?.menuItemId && !dayPlans[currKey]?.menuItemId) {
        daysToFill.push({ currKey, prevPlan })
      }
    }

    // Optimistic update all at once
    setDayPlans((prev) => {
      const next = { ...prev }
      for (const { currKey, prevPlan } of daysToFill) {
        next[currKey] = { menuItemId: prevPlan.menuItemId, notes: prevPlan.notes }
      }
      return next
    })
    onMealsUsed(daysToFill.length)

    // Fire parallel saves
    for (const { currKey, prevPlan } of daysToFill) {
      const prevEmpty = { menuItemId: null, notes: '' }
      persistDay(currKey, prevPlan.menuItemId!, prevPlan.notes, prevEmpty, true, false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>

      {/* Kid selector */}
      {kids.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
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

      {/* No kids */}
      {kids.length === 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.35)', borderRadius: 16,
          padding: 32, textAlign: 'center', color: 'rgba(44,24,16,0.45)', fontSize: 14,
        }}>
          אין ילדים רשומים
        </div>
      )}

      {/* No favorites warning */}
      {kids.length > 0 && favMenuItems.length === 0 && (
        <div style={{
          background: 'rgba(255,179,71,0.12)', border: '1px solid rgba(255,179,71,0.35)',
          borderRadius: 14, padding: '12px 16px',
          fontSize: 13, color: 'rgba(44,24,16,0.65)', textAlign: 'center', fontWeight: 500,
        }}>
          עדיין אין מועדפים לילד זה — עבור ללשונית <strong>תפריט</strong> כדי להוסיף ❤️
        </div>
      )}

      {/* ── 4-week grid ── */}
      {kids.length > 0 && allWeeks.map((week) => {
        const { offset, ws, dates, dateKeys } = week
        const isReadOnly = offset === -1
        const planned = countPlanned(week)
        const expandedInWeek = expandedDay != null && dateKeys.includes(expandedDay)

        return (
          <div
            key={offset}
            style={{
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(12px) saturate(180%)',
              border: offset === 0
                ? '1.5px solid rgba(255,107,53,0.35)'
                : '1px solid rgba(255,255,255,0.35)',
              boxShadow: offset === 0
                ? '0 8px 32px rgba(255,107,53,0.10)'
                : '0 4px 16px rgba(31,38,135,0.08)',
              borderRadius: 20,
              overflow: 'hidden',
            }}
          >
            {/* ── Week header ── */}
            <div style={{
              padding: '12px 14px',
              background: offset === 0
                ? 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,179,71,0.07))'
                : isReadOnly
                  ? 'rgba(44,24,16,0.04)'
                  : 'rgba(255,255,255,0.08)',
              borderBottom: '1px solid rgba(255,255,255,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 15, fontWeight: 800,
                  color: offset === 0 ? '#FF6B35' : '#2C1810',
                }}>
                  {getWeekLabel(offset)}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.45)', fontWeight: 500 }}>
                  {formatWeekRange(ws)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {isReadOnly && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                    background: 'rgba(44,24,16,0.08)', color: 'rgba(44,24,16,0.4)',
                  }}>
                    צפייה בלבד
                  </span>
                )}
                {!isReadOnly && planned > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: 'rgba(255,107,53,0.12)', color: '#FF6B35',
                  }}>
                    {planned} ארוחות
                  </span>
                )}
                {!isReadOnly && (
                  <button
                    onClick={() => fillWeekFromPrev(week)}
                    title="מלא כמו שבוע קודם"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 20,
                      border: '1.5px dashed rgba(255,107,53,0.4)',
                      background: 'rgba(255,107,53,0.06)',
                      color: '#FF6B35', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <span>📋</span>
                    <span>מלא מהשבוע הקודם</span>
                  </button>
                )}
              </div>
            </div>

            {/* Fill error */}
            {fillErrors[offset] && (
              <div style={{
                padding: '6px 14px',
                background: 'rgba(239,71,111,0.07)',
                borderBottom: '1px solid rgba(239,71,111,0.15)',
                color: '#EF476F', fontSize: 11, textAlign: 'center', fontWeight: 500,
              }}>
                {fillErrors[offset]}
              </div>
            )}

            {/* ── Day grid ── */}
            <div style={{ padding: '12px 10px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
                {dates.map((d, i) => {
                  const dateKey = dateKeys[i]
                  const plan = dayPlans[dateKey] ?? { menuItemId: null, notes: '' }
                  const isOn = plan.menuItemId != null
                  const isFuture = dateKey > todayKey
                  const isToday = dateKey === todayKey
                  const canEdit = !isReadOnly && isFuture
                  const isExpanded = expandedDay === dateKey
                  const isActive = isExpanded || isOn
                  const isSaving = savingDays.has(dateKey)
                  const hasError = !!dayErrors[dateKey]
                  const quotaFull = !isOn && mealsRemaining <= 0
                  const clickable = canEdit && favMenuItems.length > 0 && !quotaFull && !isSaving

                  return (
                    <div
                      key={dateKey}
                      onClick={
                        clickable
                          ? () => setExpandedDay(isExpanded ? null : dateKey)
                          : isOn && canEdit && !isSaving
                            ? () => setExpandedDay(isExpanded ? null : dateKey)
                            : undefined
                      }
                      style={{
                        borderRadius: 12,
                        padding: '7px 3px 9px',
                        textAlign: 'center',
                        cursor: (clickable || (isOn && canEdit && !isSaving)) ? 'pointer' : 'default',
                        background: isExpanded
                          ? 'rgba(255,107,53,0.15)'
                          : isOn
                            ? 'rgba(255,107,53,0.08)'
                            : isToday
                              ? 'rgba(255,209,71,0.15)'
                              : 'rgba(255,255,255,0.38)',
                        border: hasError
                          ? '2px solid #EF476F'
                          : isExpanded
                            ? '2px solid #FF6B35'
                            : isOn
                              ? '1.5px solid rgba(255,107,53,0.3)'
                              : isToday
                                ? '1.5px solid rgba(255,209,71,0.5)'
                                : '1px solid rgba(255,255,255,0.5)',
                        opacity: isSaving
                          ? 0.55
                          : !isFuture && !isToday && !isOn && !isReadOnly ? 0.4 : 1,
                        transition: 'all 150ms ease-out',
                        minHeight: 74,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'space-between',
                        boxSizing: 'border-box',
                        position: 'relative',
                      }}
                    >
                      {/* Saving spinner overlay */}
                      {isSaving && (
                        <div style={{
                          position: 'absolute', inset: 0, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          borderRadius: 12, zIndex: 1,
                        }}>
                          <span style={{ fontSize: 14, animation: 'spin 1s linear infinite' }}>⏳</span>
                        </div>
                      )}

                      {/* Day name */}
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        color: isActive ? '#FF6B35' : 'rgba(44,24,16,0.4)',
                      }}>
                        {SHORT_DAY[i]}
                      </div>

                      {/* Date */}
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: isOn ? '#2C1810' : 'rgba(44,24,16,0.6)',
                        marginTop: 2,
                      }}>
                        {d.getDate()}.{d.getMonth() + 1}
                      </div>

                      {/* Status icon */}
                      <div style={{ marginTop: 4, lineHeight: 1 }}>
                        {isOn ? (
                          <span style={{ fontSize: 18 }}>🍱</span>
                        ) : canEdit && favMenuItems.length > 0 && !quotaFull ? (
                          <span style={{
                            fontSize: 15, fontWeight: 700,
                            color: isExpanded ? '#FF6B35' : 'rgba(255,107,53,0.5)',
                          }}>＋</span>
                        ) : canEdit && quotaFull ? (
                          <span style={{ fontSize: 13 }} title="המנוי מלא">🔒</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.2)' }}>—</span>
                        )}
                      </div>

                      {/* Today badge */}
                      {isToday && (
                        <div style={{
                          fontSize: 8, fontWeight: 800, padding: '1px 4px',
                          borderRadius: 4, background: 'rgba(255,209,71,0.6)',
                          color: '#2C1810', marginTop: 2, letterSpacing: 0.3,
                        }}>
                          היום
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Day error messages */}
              {dateKeys.some((k) => dayErrors[k]) && (
                <div style={{ marginTop: 6 }}>
                  {dateKeys.map((k) => dayErrors[k] ? (
                    <div key={k} style={{
                      fontSize: 11, color: '#EF476F', textAlign: 'center',
                      padding: '2px 0', fontWeight: 500,
                    }}>
                      {dayErrors[k]}
                    </div>
                  ) : null)}
                </div>
              )}

              {/* ── Expanded meal picker panel ── */}
              {expandedInWeek && expandedDay && (() => {
                const plan = dayPlans[expandedDay] ?? { menuItemId: null, notes: '' }
                const isFuture = expandedDay > todayKey
                const canEdit = !isReadOnly && isFuture
                if (!canEdit) return null
                return (
                  <div style={{
                    marginTop: 10,
                    background: 'rgba(255,255,255,0.5)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 16,
                    padding: '12px 12px 14px',
                    border: '1.5px solid rgba(255,107,53,0.2)',
                  }}>
                    {/* Picker header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 10,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#2C1810' }}>
                        {formatExpandedLabel(expandedDay)}
                      </span>
                      <button
                        onClick={() => setExpandedDay(null)}
                        style={{
                          background: 'rgba(44,24,16,0.08)', border: 'none',
                          borderRadius: 20, padding: '3px 10px',
                          fontSize: 12, cursor: 'pointer', color: 'rgba(44,24,16,0.5)',
                        }}
                      >
                        סגור
                      </button>
                    </div>

                    {/* Quota full warning */}
                    {!plan.menuItemId && mealsRemaining <= 0 && (
                      <div style={{
                        marginBottom: 10, padding: '7px 12px', borderRadius: 10,
                        background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.2)',
                        fontSize: 12, color: '#EF476F', fontWeight: 600, textAlign: 'center',
                      }}>
                        כל ארוחות המנוי מנוצלות — בטל ארוחה אחרת כדי לפנות מקום
                      </div>
                    )}

                    {/* Meal pills */}
                    <div style={{
                      display: 'flex', gap: 8, overflowX: 'auto',
                      paddingBottom: 6, marginBottom: 10,
                    }}>
                      {favMenuItems.map((item) => {
                        const active = plan.menuItemId === item.id
                        const disabled = !plan.menuItemId && mealsRemaining <= 0
                        return (
                          <button
                            key={item.id}
                            onClick={disabled ? undefined : () => selectMeal(expandedDay, item.id)}
                            style={{
                              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                              padding: '8px 14px', borderRadius: 20,
                              border: active ? '2px solid #FF6B35' : '1.5px solid rgba(44,24,16,0.15)',
                              background: active ? 'rgba(255,107,53,0.12)' : 'rgba(255,255,255,0.7)',
                              cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13,
                              fontWeight: active ? 700 : 500,
                              color: active ? '#FF6B35' : disabled ? 'rgba(44,24,16,0.3)' : '#2C1810',
                              opacity: disabled ? 0.5 : 1,
                              whiteSpace: 'nowrap',
                              transition: 'all 150ms ease-out',
                            }}
                          >
                            <span style={{ fontSize: 15 }}>🍱</span>
                            {item.name_he}
                          </button>
                        )
                      })}
                    </div>

                    {/* Notes */}
                    <textarea
                      rows={2}
                      value={plan.notes}
                      onChange={(e) => updateNotes(expandedDay, e.target.value)}
                      placeholder="הערה למטבח..."
                      className="input-field"
                      style={{ resize: 'none', fontSize: 13, marginBottom: plan.menuItemId ? 10 : 0 }}
                    />

                    {/* Cancel meal */}
                    {plan.menuItemId && (
                      <button
                        onClick={() => cancelDay(expandedDay)}
                        style={{
                          padding: '6px 14px', borderRadius: 20, border: 'none',
                          background: 'rgba(239,71,111,0.1)', color: '#EF476F',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        ביטול ארוחה
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* No subscription warning (replaces save button area) */}
            {!isReadOnly && !subscription && (
              <div style={{ padding: '10px 10px 12px' }}>
                <div style={{ color: 'rgba(44,24,16,0.4)', fontSize: 11, textAlign: 'center' }}>
                  נדרש מנוי פעיל לשמירת ארוחות
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
