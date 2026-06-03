import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HE_MONTHS,
  LONG_DAY,
  SHORT_DAY,
  formatExpandedLabel,
  formatWeekRange,
  getOrderableDates,
  getWeekStart,
  toDateKey,
} from './week'

describe('toDateKey', () => {
  it('formats a date as YYYY-MM-DD with zero-padded month and day', () => {
    expect(toDateKey(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
    expect(toDateKey(new Date(2026, 4, 9))).toBe('2026-05-09')
  })

  it('uses local time, not UTC', () => {
    const d = new Date(2026, 4, 9, 23, 30) // local 11:30pm
    expect(toDateKey(d).slice(0, 10)).toBe('2026-05-09')
  })
})

describe('getWeekStart / getOrderableDates', () => {
  beforeEach(() => {
    // Pin "today" to a Wednesday so day-of-week math is predictable.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 6, 10, 0, 0)) // Wed 2026-05-06
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns this Sunday for offset 0', () => {
    const ws = getWeekStart(0)
    expect(ws.getDay()).toBe(0)
    expect(toDateKey(ws)).toBe('2026-05-03')
  })

  it('returns previous Sunday for offset -1', () => {
    expect(toDateKey(getWeekStart(-1))).toBe('2026-04-26')
  })

  it('returns next Sunday for offset +1', () => {
    expect(toDateKey(getWeekStart(1))).toBe('2026-05-10')
  })

  it('returns 6 dates Sun→Fri for getOrderableDates', () => {
    const dates = getOrderableDates(getWeekStart(0))
    expect(dates).toHaveLength(6)
    expect(dates.map(toDateKey)).toEqual([
      '2026-05-03', // Sun
      '2026-05-04', // Mon
      '2026-05-05', // Tue
      '2026-05-06', // Wed (today)
      '2026-05-07', // Thu
      '2026-05-08', // Fri
    ])
  })

  it('zeroes the time component', () => {
    const ws = getWeekStart(0)
    expect(ws.getHours()).toBe(0)
    expect(ws.getMinutes()).toBe(0)
    expect(ws.getSeconds()).toBe(0)
    expect(ws.getMilliseconds()).toBe(0)
  })
})

describe('formatWeekRange', () => {
  it('uses one month name when the week stays inside one month', () => {
    // Week of Sun 2026-05-03 → Fri 2026-05-08 (all in May).
    expect(formatWeekRange(new Date(2026, 4, 3))).toBe('3–8 מאי')
  })

  it('shows both month names when the week crosses a month boundary', () => {
    // Week of Sun 2026-05-31 → Fri 2026-06-05.
    expect(formatWeekRange(new Date(2026, 4, 31))).toBe('31 מאי – 5 יוני')
  })
})

describe('formatExpandedLabel', () => {
  it('builds "יום <day> <DD.MM>" from a YYYY-MM-DD key', () => {
    // 2026-05-06 is a Wednesday → רביעי.
    expect(formatExpandedLabel('2026-05-06')).toBe('יום רביעי 6.5')
    expect(formatExpandedLabel('2026-01-01')).toBe('יום חמישי 1.1')
  })
})

describe('Day/month constants', () => {
  it('SHORT_DAY has 6 entries (Sun–Fri)', () => {
    expect(SHORT_DAY).toHaveLength(6)
  })

  it('LONG_DAY has 6 entries', () => {
    expect(LONG_DAY).toHaveLength(6)
  })

  it('HE_MONTHS has 12 entries', () => {
    expect(HE_MONTHS).toHaveLength(12)
  })
})
