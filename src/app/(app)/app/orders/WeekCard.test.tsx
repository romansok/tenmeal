import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WeekCard from './WeekCard'
import { type WeekMeta } from './dayPlan'

function buildWeek(offset: -1 | 0 | 1 | 2 = 0): WeekMeta {
  const ws = new Date(2026, 4, 3) // Sunday
  const dates = [0, 1, 2, 3, 4, 5].map((i) => {
    const d = new Date(ws)
    d.setDate(ws.getDate() + i)
    return d
  })
  return {
    offset,
    ws,
    dates,
    dateKeys: dates.map((d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    ),
    weekEnd: dates[dates.length - 1],
  }
}

function renderCard(overrides: Partial<React.ComponentProps<typeof WeekCard>> = {}) {
  const onTogglePast = vi.fn()
  const onFillFromPrev = vi.fn()
  const onCopyToNext = vi.fn()
  const onClear = vi.fn()
  const renderDayCell = vi.fn((_w, d, i) => <span key={i} data-testid={`day-${i}`}>{d.getDate()}</span>)

  render(
    <WeekCard
      week={buildWeek(0)}
      isReadOnly={false}
      pastExpanded={false}
      onTogglePast={onTogglePast}
      planned={2}
      totalDays={6}
      futurePlanned={2}
      weekError={undefined}
      renderDayCell={renderDayCell}
      hasSubscription={true}
      onFillFromPrev={onFillFromPrev}
      onCopyToNext={onCopyToNext}
      onClear={onClear}
      {...overrides}
    />
  )
  return { onTogglePast, onFillFromPrev, onCopyToNext, onClear, renderDayCell }
}

describe('<WeekCard>', () => {
  it('renders 6 day cells via the renderDayCell prop', () => {
    const { renderDayCell } = renderCard()
    expect(renderDayCell).toHaveBeenCalledTimes(6)
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`day-${i}`)).toBeInTheDocument()
    }
  })

  it('shows the week label and date range', () => {
    renderCard()
    expect(screen.getByText('שבוע נוכחי')).toBeInTheDocument()
    expect(screen.getByText('3–8 מאי')).toBeInTheDocument()
  })

  it('shows planned / total counter', () => {
    renderCard({ planned: 3, totalDays: 6 })
    expect(screen.getByText('3 / 6 ימים')).toBeInTheDocument()
  })

  it('shows the bulk-action toolbar when not read-only', () => {
    renderCard()
    expect(screen.getByText('מלא מהשבוע הקודם')).toBeInTheDocument()
  })

  it('hides the toolbar in past (read-only) week', () => {
    renderCard({ week: buildWeek(-1), isReadOnly: true, pastExpanded: true })
    expect(screen.queryByText('מלא מהשבוע הקודם')).not.toBeInTheDocument()
  })

  it('shows "copy to next week" only on the current week', () => {
    renderCard({ week: buildWeek(0) })
    expect(screen.getByText('העתק לשבוע הבא')).toBeInTheDocument()

    renderCard({ week: buildWeek(1) })
    expect(screen.queryAllByText('העתק לשבוע הבא')).toHaveLength(1) // still the first one only
  })

  it('shows "clear week" only when there are future-planned days', () => {
    renderCard({ futurePlanned: 0 })
    expect(screen.queryByText('נקה שבוע')).not.toBeInTheDocument()

    renderCard({ futurePlanned: 1 })
    expect(screen.getByText('נקה שבוע')).toBeInTheDocument()
  })

  it('clicking each toolbar button invokes the matching handler with the week', async () => {
    const user = userEvent.setup()
    const { onFillFromPrev, onCopyToNext, onClear } = renderCard({ futurePlanned: 1 })
    await user.click(screen.getByText('מלא מהשבוע הקודם'))
    expect(onFillFromPrev).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }))
    await user.click(screen.getByText('העתק לשבוע הבא'))
    expect(onCopyToNext).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }))
    await user.click(screen.getByText('נקה שבוע'))
    expect(onClear).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }))
  })

  it('shows the week error banner when set', () => {
    renderCard({ weekError: 'אין מספיק ארוחות במנוי (חסרות 2)' })
    expect(screen.getByText('אין מספיק ארוחות במנוי (חסרות 2)')).toBeInTheDocument()
  })

  it('shows the no-subscription footer warning', () => {
    renderCard({ hasSubscription: false })
    expect(screen.getByText('נדרש מנוי פעיל לשמירת ארוחות')).toBeInTheDocument()
  })

  it('past + collapsed renders just a tile with planned count and triangle', async () => {
    const user = userEvent.setup()
    const { onTogglePast } = renderCard({
      week: buildWeek(-1),
      isReadOnly: true,
      pastExpanded: false,
      planned: 4,
    })
    expect(screen.getByText('שבוע שעבר')).toBeInTheDocument()
    expect(screen.getByText('4 ארוחות')).toBeInTheDocument()
    await user.click(screen.getByText('שבוע שעבר'))
    expect(onTogglePast).toHaveBeenCalledTimes(1)
  })
})
