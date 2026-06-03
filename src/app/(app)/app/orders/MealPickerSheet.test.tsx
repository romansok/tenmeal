import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MealPickerSheet from './MealPickerSheet'
import type { DayPlanUI, PickerEntry } from './dayPlan'

const PLAN_EMPTY: DayPlanUI = { mainKey: null, mainName: '', notes: '' }
const PLAN_FILLED: DayPlanUI = { mainKey: 'menu:mi-1', mainName: 'מוזלי', notes: 'בלי שוקולד' }

const ENTRIES: PickerEntry[] = [
  { key: 'menu:mi-1', name: 'מוזלי', description: 'דגנים מלאים', kind: 'menu', icon: '🍱' },
  { key: 'sandwich_preset:p-1', name: 'טונה', description: null, kind: 'sandwich_preset', icon: '🥪' },
  { key: 'custom:sw-1', name: 'הכריך שלי', description: 'הכריך השמור שלך', kind: 'custom', icon: '🥪' },
]

function renderSheet(overrides: Partial<React.ComponentProps<typeof MealPickerSheet>> = {}) {
  const onClose = vi.fn()
  const onSelect = vi.fn()
  const onCancelDay = vi.fn()
  const onUpdateNotes = vi.fn()
  render(
    <MealPickerSheet
      dateKey="2026-05-12"
      plan={PLAN_EMPTY}
      pickerEntries={ENTRIES}
      quotaFull={false}
      onClose={onClose}
      onSelect={onSelect}
      onCancelDay={onCancelDay}
      onUpdateNotes={onUpdateNotes}
      {...overrides}
    />
  )
  return { onClose, onSelect, onCancelDay, onUpdateNotes }
}

describe('<MealPickerSheet>', () => {
  it('renders the formatted date header', () => {
    renderSheet()
    // 2026-05-12 is a Tuesday → שלישי
    expect(screen.getByText('יום שלישי 12.5')).toBeInTheDocument()
  })

  it('renders all picker entries with icons + names + descriptions', () => {
    renderSheet()
    expect(screen.getByText('מוזלי')).toBeInTheDocument()
    expect(screen.getByText('דגנים מלאים')).toBeInTheDocument()
    expect(screen.getByText('טונה')).toBeInTheDocument()
    expect(screen.getByText('הכריך שלי')).toBeInTheDocument()
    expect(screen.getByText('הכריך השמור שלך')).toBeInTheDocument()
  })

  it('calls onSelect with the chosen entry', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderSheet()
    await user.click(screen.getByText('טונה'))
    expect(onSelect).toHaveBeenCalledWith(ENTRIES[1])
  })

  it('does NOT call onSelect when quota is full and nothing is chosen', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderSheet({ quotaFull: true })
    await user.click(screen.getByText('מוזלי'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows the quota-full warning when empty + quota full', () => {
    renderSheet({ quotaFull: true })
    expect(
      screen.getByText('כל ארוחות המנוי מנוצלות — בטל ארוחה אחרת כדי לפנות מקום')
    ).toBeInTheDocument()
  })

  it('does NOT show the quota warning when a meal is already planned (user can swap or cancel)', () => {
    renderSheet({ plan: PLAN_FILLED, quotaFull: true })
    expect(
      screen.queryByText('כל ארוחות המנוי מנוצלות — בטל ארוחה אחרת כדי לפנות מקום')
    ).not.toBeInTheDocument()
  })

  it('shows the cancel button only when a meal is planned', () => {
    renderSheet({ plan: PLAN_FILLED })
    expect(screen.getByText('ביטול ארוחה')).toBeInTheDocument()
  })

  it('omits the cancel button when no meal is planned', () => {
    renderSheet({ plan: PLAN_EMPTY })
    expect(screen.queryByText('ביטול ארוחה')).not.toBeInTheDocument()
  })

  it('cancel button calls onCancelDay', async () => {
    const user = userEvent.setup()
    const { onCancelDay } = renderSheet({ plan: PLAN_FILLED })
    await user.click(screen.getByText('ביטול ארוחה'))
    expect(onCancelDay).toHaveBeenCalledTimes(1)
  })

  it('typing in notes calls onUpdateNotes with the new value', async () => {
    const user = userEvent.setup()
    const { onUpdateNotes } = renderSheet({ plan: PLAN_FILLED })
    const textarea = screen.getByPlaceholderText('הערה למטבח...')
    await user.type(textarea, 'X')
    expect(onUpdateNotes).toHaveBeenCalled()
    // userEvent.type fires per-keystroke; last call captures full state under controlled component
    expect(onUpdateNotes.mock.calls[onUpdateNotes.mock.calls.length - 1][0]).toContain('X')
  })

  it('close button calls onClose', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSheet()
    await user.click(screen.getByText('סגור'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('marks the active entry visually (border)', () => {
    renderSheet({ plan: PLAN_FILLED }) // mainKey = 'menu:mi-1'
    const activeBtn = screen.getByText('מוזלי').closest('button')!
    // jsdom normalizes #FF6B35 → rgb(255, 107, 53)
    expect(activeBtn.style.border).toContain('rgb(255, 107, 53)')
  })
})
