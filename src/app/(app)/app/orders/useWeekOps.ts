'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { ToastApi } from '@/components/Toast'
import {
  type DayPlanUI,
  type MainKey,
  type WeekMeta,
  type WeekOffset,
  emptyPlan,
} from './dayPlan'

interface DayChange {
  dateKey: string
  prevPlan: DayPlanUI
  newPlan: DayPlanUI
}

type WeekErrors = Partial<Record<WeekOffset, string | undefined>>

export interface UseWeekOpsArgs {
  allWeeks: WeekMeta[]
  todayKey: string
  mealsRemaining: number
  dayPlans: Record<string, DayPlanUI>
  setDayPlans: Dispatch<SetStateAction<Record<string, DayPlanUI>>>
  setFillErrors: Dispatch<SetStateAction<WeekErrors>>
  onMealsUsed: (n: number) => void
  persistDay: (
    dateKey: string,
    mainKey: MainKey | null,
    notes: string,
    prevPlan: DayPlanUI | null,
    isNewMeal: boolean,
    isCancellation: boolean
  ) => void
  toast: ToastApi
}

export interface UseWeekOpsResult {
  fillWeekFromPrev: (week: WeekMeta) => void
  copyToNextWeek: (week: WeekMeta) => void
  clearWeek: (week: WeekMeta) => void
}

/**
 * Encapsulates the three week-level bulk operations and their shared
 * apply-then-undo machinery. All ops:
 *   1. compute a list of `DayChange`s
 *   2. validate (per-op)
 *   3. delegate to `executeWeekOp` for the optimistic update + persist + undo toast
 */
export function useWeekOps(args: UseWeekOpsArgs): UseWeekOpsResult {
  const {
    allWeeks, todayKey, mealsRemaining,
    dayPlans, setDayPlans, setFillErrors,
    onMealsUsed, persistDay, toast,
  } = args

  function executeWeekOp(
    changes: DayChange[],
    kind: 'add' | 'remove',
    toastMessage: string
  ): void {
    const isAdd = kind === 'add'
    const consumeDelta = isAdd ? changes.length : -changes.length

    const apply = (pick: (c: DayChange) => DayPlanUI) => {
      setDayPlans((prev) => {
        const next = { ...prev }
        for (const c of changes) next[c.dateKey] = pick(c)
        return next
      })
    }

    apply((c) => c.newPlan)
    onMealsUsed(consumeDelta)
    for (const c of changes) {
      persistDay(c.dateKey, c.newPlan.mainKey, c.newPlan.notes, c.prevPlan, isAdd, !isAdd)
    }

    toast.show({
      message: toastMessage,
      onUndo: () => {
        apply((c) => c.prevPlan)
        onMealsUsed(-consumeDelta)
        for (const c of changes) {
          persistDay(c.dateKey, c.prevPlan.mainKey, c.prevPlan.notes, c.newPlan, !isAdd, isAdd)
        }
      },
    })
  }

  function setWeekError(offset: WeekOffset, message: string | undefined) {
    setFillErrors((e) => ({ ...e, [offset]: message }))
  }

  function fillWeekFromPrev(week: WeekMeta) {
    const prevWeek = allWeeks.find((w) => w.offset === week.offset - 1)
    if (!prevWeek) return

    const changes: DayChange[] = []
    for (let i = 0; i < week.dateKeys.length; i++) {
      const currKey = week.dateKeys[i]
      const prevKey = prevWeek.dateKeys[i]
      if (currKey <= todayKey) continue
      const prevPlan = dayPlans[prevKey]
      if (prevPlan?.mainKey && !dayPlans[currKey]?.mainKey) {
        changes.push({
          dateKey: currKey,
          prevPlan: emptyPlan(),
          newPlan: { mainKey: prevPlan.mainKey, mainName: prevPlan.mainName, notes: prevPlan.notes },
        })
      }
    }

    if (changes.length === 0) {
      setWeekError(week.offset, 'אין ארוחות מהשבוע הקודם להעתיק')
      return
    }
    if (changes.length > mealsRemaining) {
      setWeekError(week.offset, `אין מספיק ארוחות במנוי (חסרות ${changes.length - mealsRemaining})`)
      return
    }
    setWeekError(week.offset, undefined)

    executeWeekOp(changes, 'add', `הועתקו ${changes.length} ארוחות מהשבוע הקודם`)
  }

  function copyToNextWeek(week: WeekMeta) {
    const nextWeek = allWeeks.find((w) => w.offset === week.offset + 1)
    if (!nextWeek) return

    const changes: DayChange[] = []
    for (let i = 0; i < week.dateKeys.length; i++) {
      const srcKey = week.dateKeys[i]
      const dstKey = nextWeek.dateKeys[i]
      if (dstKey <= todayKey) continue
      const src = dayPlans[srcKey]
      if (src?.mainKey && !dayPlans[dstKey]?.mainKey) {
        changes.push({
          dateKey: dstKey,
          prevPlan: emptyPlan(),
          newPlan: { mainKey: src.mainKey, mainName: src.mainName, notes: src.notes },
        })
      }
    }

    if (changes.length === 0) {
      setWeekError(week.offset, 'אין ארוחות להעתיק לשבוע הבא')
      return
    }
    if (changes.length > mealsRemaining) {
      setWeekError(week.offset, `אין מספיק ארוחות במנוי (חסרות ${changes.length - mealsRemaining})`)
      return
    }
    setWeekError(week.offset, undefined)

    executeWeekOp(changes, 'add', `הועתקו ${changes.length} ארוחות לשבוע הבא`)
  }

  function clearWeek(week: WeekMeta) {
    const changes: DayChange[] = []
    for (const dateKey of week.dateKeys) {
      if (dateKey <= todayKey) continue
      const plan = dayPlans[dateKey]
      if (plan?.mainKey) changes.push({ dateKey, prevPlan: plan, newPlan: emptyPlan() })
    }

    if (changes.length === 0) {
      setWeekError(week.offset, 'אין ארוחות עתידיות לניקוי')
      return
    }
    setWeekError(week.offset, undefined)

    executeWeekOp(changes, 'remove', `${changes.length} ארוחות נוקו`)
  }

  return { fillWeekFromPrev, copyToNextWeek, clearWeek }
}
