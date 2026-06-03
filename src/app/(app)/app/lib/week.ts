// Week-math primitives shared between page-level data loading and OrdersPanel.
// Rules: a "week" runs Sun→Fri (6 orderable days). All dates are in local TZ.

export const SHORT_DAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'] as const
export const LONG_DAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'] as const
export const HE_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
] as const

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Sunday of the week containing today, offset by `weekOffset` weeks. */
export function getWeekStart(weekOffset: number = 0): Date {
  const now = new Date()
  const sun = new Date(now)
  sun.setDate(now.getDate() - now.getDay() + weekOffset * 7)
  sun.setHours(0, 0, 0, 0)
  return sun
}

/** Sun → Fri (6 days). Length is always 6. */
export function getOrderableDates(weekStart: Date): Date[] {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
}

/** "13–18 מאי" or, when crossing a month, "30 מאי – 4 יוני". */
export function formatWeekRange(weekStart: Date): string {
  const dates = getOrderableDates(weekStart)
  const sun = dates[0]
  const fri = dates[dates.length - 1]
  if (sun.getMonth() === fri.getMonth()) {
    return `${sun.getDate()}–${fri.getDate()} ${HE_MONTHS[sun.getMonth()]}`
  }
  return `${sun.getDate()} ${HE_MONTHS[sun.getMonth()]} – ${fri.getDate()} ${HE_MONTHS[fri.getMonth()]}`
}

/** "יום שני 13.5" — used in the day-detail header. */
export function formatExpandedLabel(dateKey: string): string {
  const d = new Date(dateKey)
  return `יום ${LONG_DAY[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`
}
