import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DayCell from './DayCell'
import type { DayPlanUI } from './dayPlan'

const PLAN_EMPTY: DayPlanUI = { mainKey: null, mainName: '', notes: '' }
const PLAN_FILLED: DayPlanUI = { mainKey: 'menu:mi-1', mainName: 'מוזלי', notes: '' }
const PLAN_WITH_NOTE: DayPlanUI = { mainKey: 'menu:mi-1', mainName: 'מוזלי', notes: 'בלי פרי' }

const TODAY_KEY = '2026-05-10'

function renderCell(overrides: Partial<React.ComponentProps<typeof DayCell>> = {}) {
  const onOpen = vi.fn()
  const onToggleErrorExpanded = vi.fn()
  render(
    <DayCell
      date={new Date(2026, 4, 12)}
      weekdayIndex={2}
      dateKey="2026-05-12"
      plan={PLAN_EMPTY}
      todayKey={TODAY_KEY}
      isReadOnly={false}
      isOpen={false}
      isSaving={false}
      errorMessage={null}
      errorExpanded={false}
      quotaFull={false}
      pickerHasEntries
      onOpen={onOpen}
      onToggleErrorExpanded={onToggleErrorExpanded}
      {...overrides}
    />
  )
  return { onOpen, onToggleErrorExpanded }
}

describe('<DayCell>', () => {

  it('renders weekday short name and DD.MM date', () => {
    renderCell()
    expect(screen.getByText('ג׳')).toBeInTheDocument() // weekdayIndex 2
    expect(screen.getByText('12.5')).toBeInTheDocument()
  })

  it('shows the meal-emoji when a meal is planned', () => {
    renderCell({ plan: PLAN_FILLED })
    expect(screen.getByText('🍱')).toBeInTheDocument()
  })

  it('shows a + when empty, future, picker has entries, and no quota issue', () => {
    renderCell({ dateKey: '2026-05-12', plan: PLAN_EMPTY })
    expect(screen.getByText('＋')).toBeInTheDocument()
  })

  it('shows a — placeholder when picker has no entries', () => {
    renderCell({ pickerHasEntries: false })
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows a — placeholder when read-only past day', () => {
    renderCell({ dateKey: '2026-05-01', isReadOnly: true })
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows the "היום" badge on today', () => {
    renderCell({ dateKey: TODAY_KEY, date: new Date(2026, 4, 10) })
    expect(screen.getByText('היום')).toBeInTheDocument()
  })

  it('shows a note dot when planned and notes are non-empty', () => {
    renderCell({ plan: PLAN_WITH_NOTE })
    const dot = screen.getByTitle('יש הערה למטבח')
    expect(dot).toBeInTheDocument()
  })

  it('omits the note dot when planned without notes', () => {
    renderCell({ plan: PLAN_FILLED })
    expect(screen.queryByTitle('יש הערה למטבח')).not.toBeInTheDocument()
  })

  it('shows the saving indicator', () => {
    renderCell({ isSaving: true })
    expect(screen.getByText('⏳')).toBeInTheDocument()
  })

  it('shows the error indicator + tooltip when expanded', () => {
    renderCell({ errorMessage: 'נכשלה השמירה', errorExpanded: true })
    expect(screen.getByText('!')).toBeInTheDocument()
    expect(screen.getByText('נכשלה השמירה')).toBeInTheDocument()
  })

  it('does NOT show the expanded error message when errorExpanded=false', () => {
    renderCell({ errorMessage: 'נכשלה השמירה', errorExpanded: false })
    expect(screen.queryByText('נכשלה השמירה')).not.toBeInTheDocument()
  })

  it('calls onOpen when clicked and editable', async () => {
    const user = userEvent.setup()
    const { onOpen } = renderCell()
    await user.click(screen.getByText('＋'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onOpen for past day (read-only)', () => {
    const { onOpen } = renderCell({ dateKey: '2026-05-01', isReadOnly: true })
    fireEvent.click(screen.getByText('—'))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('does NOT call onOpen while saving', () => {
    const { onOpen } = renderCell({ isSaving: true })
    fireEvent.click(screen.getByText('⏳'))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('does NOT call onOpen when picker has no entries', () => {
    const { onOpen } = renderCell({ pickerHasEntries: false })
    fireEvent.click(screen.getByText('—'))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('does NOT call onOpen for empty + quota-full (no slots left)', () => {
    const { onOpen } = renderCell({ quotaFull: true })
    fireEvent.click(screen.getByText('—'))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('DOES allow clicking a planned day even when quota is full (so the user can cancel)', () => {
    const { onOpen } = renderCell({ plan: PLAN_FILLED, quotaFull: true })
    fireEvent.click(screen.getByText('🍱'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('toggling the error pill calls onToggleErrorExpanded and stops propagation', () => {
    const { onOpen, onToggleErrorExpanded } = renderCell({ errorMessage: 'oops' })
    fireEvent.click(screen.getByText('!'))
    expect(onToggleErrorExpanded).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled() // propagation stopped
  })
})
