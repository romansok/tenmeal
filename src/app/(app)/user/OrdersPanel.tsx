'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveWeekOrders } from './actions'
import type { Kid, MenuItem, ExistingOrder, DayPlan, Subscription } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekStart(weekOffset: number): Date {
  const now = new Date()
  const sun = new Date(now)
  sun.setDate(now.getDate() - now.getDay() + weekOffset * 7)
  sun.setHours(0, 0, 0, 0)
  return sun
}

function getSchoolWeekDates(weekStart: Date): Date[] {
  return [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
}

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function formatWeekLabel(sun: Date, thu: Date): string {
  const sm = HE_MONTHS[sun.getMonth()]
  const em = HE_MONTHS[thu.getMonth()]
  if (sun.getMonth() === thu.getMonth()) {
    return `${sun.getDate()}–${thu.getDate()} ב${sm} ${sun.getFullYear()}`
  }
  return `${sun.getDate()} ב${sm} – ${thu.getDate()} ב${em} ${thu.getFullYear()}`
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי']

function formatDayLabel(d: Date): string {
  const dayIndex = d.getDay()
  const name = DAY_NAMES[dayIndex] ?? ''
  return `${name} ${d.getDate()}.${d.getMonth() + 1}`
}

function buildInitialDayPlans(
  orders: ExistingOrder[],
  kidId: string,
  dates: string[]
): Record<string, DayPlan> {
  const result: Record<string, DayPlan> = {}
  for (const date of dates) {
    const order = orders.find((o) => o.kid_id === kidId && o.delivery_date === date)
    result[date] = {
      menuItemId: order?.order_items?.[0]?.menu_item_id ?? null,
      notes: order?.notes ?? '',
    }
  }
  return result
}

function isDirty(current: Record<string, DayPlan>, initial: Record<string, DayPlan>): boolean {
  for (const key of Object.keys(current)) {
    if (current[key].menuItemId !== initial[key]?.menuItemId) return true
    if (current[key].notes !== initial[key]?.notes) return true
  }
  return false
}

function countPlanned(dayPlans: Record<string, DayPlan>): number {
  return Object.values(dayPlans).filter((p) => p.menuItemId !== null).length
}

function isDeadlineDay(): boolean {
  return new Date().getDay() >= 5
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OrdersPanelProps {
  profileId: string
  kids: Kid[]
  subscription: Subscription | null
  menuItems: MenuItem[]
  initialWeekOrders: ExistingOrder[]
  mealsRemaining: number
  onMealsUsed: (n: number) => void
}

export default function OrdersPanel({
  profileId,
  kids,
  subscription,
  menuItems,
  initialWeekOrders,
  mealsRemaining,
  onMealsUsed,
}: OrdersPanelProps) {
  const initWeekStart = getWeekStart(0)
  const initWeekDates = getSchoolWeekDates(initWeekStart)
  const initWeekDateKeys = initWeekDates.map(toDateKey)
  const initKidId = kids[0]?.id ?? ''
  const builtInitial = buildInitialDayPlans(initialWeekOrders, initKidId, initWeekDateKeys)

  const [selectedKidId, setSelectedKidId] = useState(initKidId)
  const [weekOffset, setWeekOffset] = useState(0)
  const [dayPlans, setDayPlans] = useState<Record<string, DayPlan>>(builtInitial)
  const [initialDayPlans, setInitialDayPlans] = useState<Record<string, DayPlan>>(builtInitial)
  const [openMealSelector, setOpenMealSelector] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const weekStart = getWeekStart(weekOffset)
  const weekDates = getSchoolWeekDates(weekStart)
  const weekDateKeys = weekDates.map(toDateKey)
  const dirty = isDirty(dayPlans, initialDayPlans)
  const plannedCount = countPlanned(dayPlans)

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const supabase = createClient()
    const ws = toDateKey(getWeekStart(weekOffset))
    const we = toDateKey(getSchoolWeekDates(getWeekStart(weekOffset))[4])
    supabase
      .from('orders')
      .select('id, kid_id, delivery_date, notes, status, order_items(id, menu_item_id, quantity)')
      .eq('kid_id', selectedKidId)
      .gte('delivery_date', ws)
      .lte('delivery_date', we)
      .is('deleted_at', null)
      .then(({ data }) => {
        const orders = (data ?? []) as ExistingOrder[]
        const newDateKeys = getSchoolWeekDates(getWeekStart(weekOffset)).map(toDateKey)
        const plans = buildInitialDayPlans(orders, selectedKidId, newDateKeys)
        setDayPlans(plans)
        setInitialDayPlans(plans)
      })
  }, [weekOffset, selectedKidId])

  function handleSave() {
    setSaveError(null)
    startTransition(async () => {
      const days = weekDateKeys.map((date) => ({
        date,
        menuItemId: dayPlans[date]?.menuItemId ?? null,
        notes: dayPlans[date]?.notes ?? '',
      }))

      const result = await saveWeekOrders({
        kidId: selectedKidId,
        profileId,
        days,
      })

      if ('error' in result) {
        setSaveError(result.error)
      } else {
        onMealsUsed(result.mealsUsed)
        setInitialDayPlans({ ...dayPlans })
      }
    })
  }

  function toggleDay(dateKey: string) {
    setDayPlans((prev) => {
      const current = prev[dateKey]
      if (current.menuItemId) {
        return { ...prev, [dateKey]: { menuItemId: null, notes: '' } }
      } else {
        setOpenMealSelector(dateKey)
        return { ...prev, [dateKey]: { menuItemId: null, notes: '' } }
      }
    })
  }

  function selectMeal(dateKey: string, menuItemId: string) {
    setDayPlans((prev) => ({
      ...prev,
      [dateKey]: { ...prev[dateKey], menuItemId },
    }))
    setOpenMealSelector(null)
  }

  function updateNotes(dateKey: string, notes: string) {
    setDayPlans((prev) => ({
      ...prev,
      [dateKey]: { ...prev[dateKey], notes },
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80 }}>
      {/* Kid switcher */}
      {kids.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {kids.map((kid) => (
            <button
              key={kid.id}
              onClick={() => setSelectedKidId(kid.id)}
              className={`kid-pill${selectedKidId === kid.id ? ' kid-pill-active' : ''}`}
              style={{ border: 'none' }}
            >
              <span>{kid.emoji_avatar}</span>
              <span>{kid.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Deadline banner */}
      {isDeadlineDay() && (
        <div className="dash-deadline-banner">
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#2C1810' }}>
            נעל את הבחירות שלך עד יום ראשון 20:00!
          </span>
        </div>
      )}

      {/* Week picker */}
      <div
        style={{
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
          borderRadius: 16,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setWeekOffset((o) => Math.max(-4, o - 1))}
            className="week-chip"
            style={{ border: 'none', fontSize: 20, padding: '8px 12px' }}
            aria-label="שבוע קודם"
          >
            →
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#2C1810', textAlign: 'center', flex: 1 }}>
            {formatWeekLabel(weekDates[0], weekDates[4])}
          </span>
          <button
            onClick={() => setWeekOffset((o) => Math.min(4, o + 1))}
            className="week-chip"
            style={{ border: 'none', fontSize: 20, padding: '8px 12px' }}
            aria-label="שבוע הבא"
          >
            ←
          </button>
        </div>
      </div>

      {/* Day cards */}
      {kids.length === 0 ? (
        <div
          style={{
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(12px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.35)',
            boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
            borderRadius: 16,
            padding: 32, textAlign: 'center', color: 'rgba(44,24,16,0.45)', fontSize: 14,
          }}
        >
          אין ילדים רשומים
        </div>
      ) : (
        weekDateKeys.map((dateKey, i) => {
          const dayPlan = dayPlans[dateKey] ?? { menuItemId: null, notes: '' }
          const isOn = dayPlan.menuItemId !== null
          const selectedItem = menuItems.find((m) => m.id === dayPlan.menuItemId)
          const visibleItems = menuItems.slice(0, 4)
          const hasMore = menuItems.length > 4
          const isOpen = openMealSelector === dateKey

          return (
            <div
              key={dateKey}
              className={isOn ? 'glass-card-interactive' : 'glass-card-off'}
              style={{ padding: 16, cursor: isOn ? 'default' : 'pointer' }}
              onClick={!isOn ? () => {
                setDayPlans((prev) => ({ ...prev, [dateKey]: { ...prev[dateKey], menuItemId: null, notes: '' } }))
                setOpenMealSelector(dateKey)
              } : undefined}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isOn ? 12 : 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#2C1810' }}>
                  {formatDayLabel(weekDates[i])}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleDay(dateKey) }}
                  style={{
                    padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                    background: isOn ? 'rgba(255,107,53,0.15)' : 'rgba(44,24,16,0.08)',
                    color: isOn ? '#FF6B35' : 'rgba(44,24,16,0.45)',
                  }}
                >
                  {isOn ? 'מזמין' : 'דולג'}
                </button>
              </div>

              {isOn && (
                <div onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {visibleItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectMeal(dateKey, item.id)}
                        className={`meal-icon-btn${dayPlan.menuItemId === item.id ? ' meal-icon-btn-active' : ''}`}
                        style={{ border: 'none' }}
                        title={item.name_he}
                      >
                        <span style={{ fontSize: 22 }}>🍱</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#2C1810', maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1 }}>
                          {item.name_he.split(' ')[0]}
                        </span>
                      </button>
                    ))}
                    {hasMore && (
                      <button
                        onClick={() => setOpenMealSelector(isOpen ? null : dateKey)}
                        className="meal-icon-btn"
                        style={{ border: 'none' }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(44,24,16,0.55)' }}>עוד...</span>
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div style={{
                      background: 'rgba(255,255,255,0.90)', borderRadius: 12,
                      border: '1px solid rgba(44,24,16,0.08)', maxHeight: 200, overflowY: 'auto', marginBottom: 10,
                    }}>
                      {menuItems.length === 0 ? (
                        <div style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(44,24,16,0.45)' }}>
                          אין ארוחות זמינות
                        </div>
                      ) : (
                        menuItems.map((item, idx) => (
                          <button
                            key={item.id}
                            onClick={() => selectMeal(dateKey, item.id)}
                            style={{
                              width: '100%', textAlign: 'right', padding: '10px 16px',
                              background: 'none', border: 'none',
                              borderBottom: idx < menuItems.length - 1 ? '1px solid rgba(44,24,16,0.06)' : 'none',
                              cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#2C1810',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}
                          >
                            <span>{item.name_he}</span>
                            {dayPlan.menuItemId === item.id && <span style={{ color: '#FF6B35' }}>✓</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {selectedItem && !isOpen && (
                    <div style={{ fontSize: 13, color: '#FF6B35', fontWeight: 600, marginBottom: 10 }}>
                      {selectedItem.name_he}
                    </div>
                  )}

                  <textarea
                    rows={2}
                    value={dayPlan.notes}
                    onChange={(e) => updateNotes(dateKey, e.target.value)}
                    placeholder="הערה למטבח..."
                    className="input-field"
                    style={{ resize: 'none', fontSize: 14 }}
                  />
                </div>
              )}

              {!isOn && (
                <div style={{ fontSize: 13, color: 'rgba(44,24,16,0.35)', marginTop: 4 }}>
                  לחץ להוספת ארוחה
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Save bar */}
      <div className="save-week-bar">
        <button
          onClick={handleSave}
          disabled={!dirty || isPending || !subscription}
          style={{
            width: '100%', height: 52, borderRadius: 14, border: 'none',
            fontSize: 16, fontWeight: 700,
            cursor: dirty && !isPending && subscription ? 'pointer' : 'default',
            color: dirty && subscription ? 'white' : 'rgba(44,24,16,0.35)',
            background: dirty && subscription ? '#FF6B35' : 'rgba(44,24,16,0.08)',
            transition: 'background 200ms ease-out',
          }}
        >
          {isPending ? 'שומר...' : `שמור ${plannedCount} ארוחות לשבוע זה`}
        </button>
        {!subscription && (
          <div style={{ color: 'rgba(44,24,16,0.45)', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
            נדרש מנוי פעיל לשמירת ארוחות
          </div>
        )}
        {saveError && (
          <div style={{ color: '#EF476F', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
            {saveError}
          </div>
        )}
      </div>
    </div>
  )
}
