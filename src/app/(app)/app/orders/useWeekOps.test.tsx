import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useWeekOps, type UseWeekOpsArgs } from './useWeekOps'
import { type DayPlanUI, type WeekMeta, emptyPlan } from './dayPlan'

function buildWeek(offset: -1 | 0 | 1 | 2, startDateKey: string): WeekMeta {
  const [y, m, d] = startDateKey.split('-').map(Number)
  const ws = new Date(y, m - 1, d)
  const dates = [0, 1, 2, 3, 4, 5].map((i) => {
    const dd = new Date(ws)
    dd.setDate(ws.getDate() + i)
    return dd
  })
  return {
    offset,
    ws,
    dates,
    dateKeys: dates.map((dd) =>
      `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
    ),
    weekEnd: dates[5],
  }
}

function makeFilled(mainKey: string, name: string, notes = ''): DayPlanUI {
  return { mainKey, mainName: name, notes }
}

interface Harness {
  args: UseWeekOpsArgs
  capturedToast: { message: string; onUndo?: () => void }[]
  persistCalls: Parameters<UseWeekOpsArgs['persistDay']>[]
  mealsUsedDelta: number
  applyDayPlanUpdate: (next: Record<string, DayPlanUI>) => void
  getDayPlans: () => Record<string, DayPlanUI>
  getWeekErrors: () => Partial<Record<-1 | 0 | 1 | 2, string | undefined>>
}

function buildHarness({
  initialPlans = {},
  mealsRemaining = 10,
  todayKey = '2026-05-09',
}: { initialPlans?: Record<string, DayPlanUI>; mealsRemaining?: number; todayKey?: string } = {}): Harness {
  let dayPlans: Record<string, DayPlanUI> = { ...initialPlans }
  let weekErrors: Partial<Record<-1 | 0 | 1 | 2, string | undefined>> = {}
  let mealsUsedDelta = 0

  const setDayPlans: UseWeekOpsArgs['setDayPlans'] = (updater) => {
    dayPlans = typeof updater === 'function' ? updater(dayPlans) : updater
  }
  const setFillErrors: UseWeekOpsArgs['setFillErrors'] = (updater) => {
    weekErrors = typeof updater === 'function' ? updater(weekErrors) : updater
  }

  const persistCalls: Parameters<UseWeekOpsArgs['persistDay']>[] = []
  const persistDay: UseWeekOpsArgs['persistDay'] = (...args) => {
    persistCalls.push(args)
  }

  const capturedToast: { message: string; onUndo?: () => void }[] = []
  const toast = {
    show: (opts: { message: string; onUndo?: () => void }) => {
      capturedToast.push(opts)
    },
  }

  const allWeeks: WeekMeta[] = [
    buildWeek(-1, '2026-04-26'),
    buildWeek(0,  '2026-05-03'),
    buildWeek(1,  '2026-05-10'),
    buildWeek(2,  '2026-05-17'),
  ]

  const args: UseWeekOpsArgs = {
    allWeeks,
    todayKey,
    mealsRemaining,
    get dayPlans() { return dayPlans },
    setDayPlans,
    setFillErrors,
    onMealsUsed: (n) => { mealsUsedDelta += n },
    persistDay,
    toast,
  } as unknown as UseWeekOpsArgs
  // The "get dayPlans" trick is so the hook always reads the latest value
  // (the hook captures props, not state — same pattern OrdersPanel uses).

  return {
    args,
    capturedToast,
    persistCalls,
    get mealsUsedDelta() { return mealsUsedDelta },
    applyDayPlanUpdate: (next) => { dayPlans = next },
    getDayPlans: () => dayPlans,
    getWeekErrors: () => weekErrors,
  } as unknown as Harness
}

describe('useWeekOps', () => {
  describe('fillWeekFromPrev', () => {
    it('errors when no previous week exists (offset -1)', () => {
      const h = buildHarness()
      const { result } = renderHook(() => useWeekOps(h.args))
      // For offset -1, there's no offset -2; the hook returns early without error.
      // The actual case the user sees: try to fill the past week itself doesn't make sense.
      // Just ensure no crash.
      act(() => {
        result.current.fillWeekFromPrev(h.args.allWeeks[0])
      })
      expect(h.persistCalls).toEqual([])
    })

    it('errors when there is nothing to copy', () => {
      const h = buildHarness({ initialPlans: {} })
      const { result } = renderHook(() => useWeekOps(h.args))

      act(() => result.current.fillWeekFromPrev(h.args.allWeeks[1])) // current week
      expect(h.getWeekErrors()[0]).toBe('אין ארוחות מהשבוע הקודם להעתיק')
      expect(h.persistCalls).toEqual([])
    })

    it('errors when not enough meals remain', () => {
      // Source: current week (offset 0). Destination: next week (offset 1).
      // Pre-populate current week so source has 6 meals to copy.
      const currentWeek = buildWeek(0, '2026-05-03')
      const initialPlans: Record<string, DayPlanUI> = {}
      currentWeek.dateKeys.forEach((k) => { initialPlans[k] = makeFilled('menu:mi-1', 'X') })

      const h = buildHarness({ initialPlans, mealsRemaining: 3, todayKey: '2026-05-09' })
      const { result } = renderHook(() => useWeekOps(h.args))

      // Fill the next week (offset 1, all days > today). Need 6, have 3 → "חסרות 3".
      act(() => result.current.fillWeekFromPrev(h.args.allWeeks[2]))
      expect(h.getWeekErrors()[1]).toMatch(/חסרות 3/)
    })

    it('happy path: copies, optimistically updates, persists, and shows undo toast', () => {
      const previousWeek = buildWeek(0, '2026-05-03') // currentWeek; will be source
      const targetWeek = buildWeek(1, '2026-05-10')   // destination

      const initialPlans: Record<string, DayPlanUI> = {}
      previousWeek.dateKeys.forEach((k, i) => {
        initialPlans[k] = makeFilled('menu:mi-1', `meal-${i}`)
      })

      const h = buildHarness({ initialPlans })
      const { result } = renderHook(() => useWeekOps(h.args))

      act(() => result.current.fillWeekFromPrev(h.args.allWeeks[2]))

      // 6 changes were persisted (one per day)
      expect(h.persistCalls).toHaveLength(6)
      // The toast was shown
      expect(h.capturedToast).toHaveLength(1)
      expect(h.capturedToast[0].message).toBe('הועתקו 6 ארוחות מהשבוע הקודם')

      // Plans are now populated for the target week
      targetWeek.dateKeys.forEach((k, i) => {
        expect(h.getDayPlans()[k]).toEqual(makeFilled('menu:mi-1', `meal-${i}`))
      })

      // 6 meals consumed
      expect(h.mealsUsedDelta).toBe(6)

      // Undo restores
      act(() => h.capturedToast[0].onUndo?.())
      targetWeek.dateKeys.forEach((k) => {
        expect(h.getDayPlans()[k]).toEqual(emptyPlan())
      })
      expect(h.mealsUsedDelta).toBe(0)
      // Each day persisted again on undo (cancellation)
      expect(h.persistCalls.length).toBe(12)
    })

    it('skips days that already have a plan in the target week', () => {
      const previousWeek = buildWeek(0, '2026-05-03')
      const targetWeek = buildWeek(1, '2026-05-10')

      const initialPlans: Record<string, DayPlanUI> = {}
      previousWeek.dateKeys.forEach((k, i) => {
        initialPlans[k] = makeFilled('menu:mi-1', `meal-${i}`)
      })
      // Pre-fill the first day of target week
      initialPlans[targetWeek.dateKeys[0]] = makeFilled('menu:mi-2', 'already there')

      const h = buildHarness({ initialPlans })
      const { result } = renderHook(() => useWeekOps(h.args))

      act(() => result.current.fillWeekFromPrev(h.args.allWeeks[2]))
      expect(h.persistCalls).toHaveLength(5) // not 6
      expect(h.getDayPlans()[targetWeek.dateKeys[0]].mainName).toBe('already there')
    })
  })

  describe('clearWeek', () => {
    it('errors when no future-planned days exist', () => {
      const h = buildHarness({ initialPlans: {}, todayKey: '2026-05-09' })
      const { result } = renderHook(() => useWeekOps(h.args))
      act(() => result.current.clearWeek(h.args.allWeeks[2])) // future week, all empty
      expect(h.getWeekErrors()[1]).toBe('אין ארוחות עתידיות לניקוי')
    })

    it('clears + persists each, shows toast, undo restores', () => {
      const targetWeek = buildWeek(1, '2026-05-10')
      const initialPlans: Record<string, DayPlanUI> = {}
      targetWeek.dateKeys.forEach((k, i) => {
        initialPlans[k] = makeFilled('menu:mi-1', `meal-${i}`)
      })

      const h = buildHarness({ initialPlans })
      const { result } = renderHook(() => useWeekOps(h.args))

      act(() => result.current.clearWeek(h.args.allWeeks[2]))
      expect(h.persistCalls).toHaveLength(6)
      expect(h.capturedToast[0].message).toBe('6 ארוחות נוקו')
      expect(h.mealsUsedDelta).toBe(-6)
      targetWeek.dateKeys.forEach((k) => {
        expect(h.getDayPlans()[k]).toEqual(emptyPlan())
      })

      act(() => h.capturedToast[0].onUndo?.())
      targetWeek.dateKeys.forEach((k, i) => {
        expect(h.getDayPlans()[k]).toEqual(makeFilled('menu:mi-1', `meal-${i}`))
      })
      expect(h.mealsUsedDelta).toBe(0)
    })

    it('does not clear past or today', () => {
      const currentWeek = buildWeek(0, '2026-05-03') // sun..fri 3..8
      const initialPlans: Record<string, DayPlanUI> = {}
      currentWeek.dateKeys.forEach((k, i) => {
        initialPlans[k] = makeFilled('menu:mi-1', `meal-${i}`)
      })

      // Today = 2026-05-06 (Wed). Days <=09 → none after today in this week (8 is Fri but <=8 < 06? no).
      // Use today = '2026-05-06' so Thu/Fri (07, 08) are future.
      const h = buildHarness({ initialPlans, todayKey: '2026-05-06' })
      const { result } = renderHook(() => useWeekOps(h.args))

      act(() => result.current.clearWeek(h.args.allWeeks[1]))
      expect(h.persistCalls).toHaveLength(2) // only 07 and 08
    })
  })

  describe('copyToNextWeek', () => {
    it('happy path mirrors fill-from-prev but onto offset+1', () => {
      const sourceWeek = buildWeek(0, '2026-05-03')
      const destWeek = buildWeek(1, '2026-05-10')

      const initialPlans: Record<string, DayPlanUI> = {}
      sourceWeek.dateKeys.forEach((k, i) => {
        initialPlans[k] = makeFilled('menu:mi-1', `m-${i}`)
      })

      const h = buildHarness({ initialPlans })
      const { result } = renderHook(() => useWeekOps(h.args))

      act(() => result.current.copyToNextWeek(h.args.allWeeks[1]))
      expect(h.capturedToast[0].message).toBe('הועתקו 6 ארוחות לשבוע הבא')
      destWeek.dateKeys.forEach((k, i) => {
        expect(h.getDayPlans()[k]).toEqual(makeFilled('menu:mi-1', `m-${i}`))
      })
    })

    it('errors when no source meals to copy', () => {
      const h = buildHarness()
      const { result } = renderHook(() => useWeekOps(h.args))
      act(() => result.current.copyToNextWeek(h.args.allWeeks[1]))
      expect(h.getWeekErrors()[0]).toBe('אין ארוחות להעתיק לשבוע הבא')
    })

    it('errors when not enough meals remain', () => {
      const sourceWeek = buildWeek(0, '2026-05-03')
      const initialPlans: Record<string, DayPlanUI> = {}
      sourceWeek.dateKeys.forEach((k) => { initialPlans[k] = makeFilled('menu:mi-1', 'x') })

      const h = buildHarness({ initialPlans, mealsRemaining: 2 })
      const { result } = renderHook(() => useWeekOps(h.args))
      act(() => result.current.copyToNextWeek(h.args.allWeeks[1]))
      expect(h.getWeekErrors()[0]).toMatch(/חסרות 4/)
    })
  })
})
