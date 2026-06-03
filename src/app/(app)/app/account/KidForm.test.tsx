import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KidForm from './KidForm'
import type { DietaryTag, Kid, School } from '../types'

const SCHOOLS: School[] = [
  { id: 's-1', name_he: 'בית ספר א', address: 'רחוב 1' },
  { id: 's-2', name_he: 'בית ספר ב', address: 'רחוב 2' },
]
const TAGS: DietaryTag[] = [
  { id: 't1', slug: 'vegan', label_he: 'טבעוני' },
  { id: 't2', slug: 'gluten_free', label_he: 'ללא גלוטן' },
]

function buildKid(): Kid {
  return {
    id: 'kid-1',
    name: 'דני',
    last_name: 'כהן',
    class_name: 'ב׳',
    phone: '0501234567',
    emoji_avatar: '🦁',
    sort_order: 0,
    school_id: 's-2',
    school: SCHOOLS[1],
    kid_dietary_restrictions: [{ dietary_tag_id: 't1', dietary_tags: TAGS[0] }],
  }
}

function renderForm(overrides: Partial<React.ComponentProps<typeof KidForm>> = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  render(
    <KidForm
      kid={null}
      schools={SCHOOLS}
      dietaryTags={TAGS}
      isPending={false}
      error={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />
  )
  return { onSubmit, onCancel }
}

describe('<KidForm>', () => {
  describe('add mode', () => {
    it('starts empty with default emoji', () => {
      renderForm()
      expect(screen.getByPlaceholderText('שם פרטי')).toHaveValue('')
      expect(screen.getByPlaceholderText('שם משפחה')).toHaveValue('')
    })

    it('shows the "הוסף" submit label', () => {
      renderForm()
      expect(screen.getByText('הוסף')).toBeInTheDocument()
    })

    it('submits a KidInput with the form data', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderForm()
      await user.type(screen.getByPlaceholderText('שם פרטי'), 'מיכל')
      await user.type(screen.getByPlaceholderText('שם משפחה'), 'לוי')
      await user.type(screen.getByPlaceholderText('05X-XXXXXXX'), '0501234567')
      await user.selectOptions(screen.getByRole('combobox'), 's-1')
      await user.click(screen.getByText('טבעוני'))
      await user.click(screen.getByText('הוסף'))

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'מיכל',
        last_name: 'לוי',
        class_name: null,
        phone: '0501234567',
        emoji_avatar: '🧒',
        school_id: 's-1',
        dietary_tag_ids: ['t1'],
      })
    })

    it('null-coalesces empty optional fields', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderForm()
      await user.type(screen.getByPlaceholderText('שם פרטי'), 'X')
      await user.click(screen.getByText('הוסף'))
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        last_name: null,
        class_name: null,
        phone: null,
        school_id: null,
      }))
    })
  })

  describe('edit mode', () => {
    it('prefills from the kid', () => {
      renderForm({ kid: buildKid() })
      expect(screen.getByPlaceholderText('שם פרטי')).toHaveValue('דני')
      expect(screen.getByPlaceholderText('שם משפחה')).toHaveValue('כהן')
      expect(screen.getByPlaceholderText('למשל: ב׳')).toHaveValue('ב׳')
      expect(screen.getByPlaceholderText('05X-XXXXXXX')).toHaveValue('0501234567')
      expect(screen.getByRole('combobox')).toHaveValue('s-2')
    })

    it('shows the "שמור" submit label', () => {
      renderForm({ kid: buildKid() })
      expect(screen.getByText('שמור')).toBeInTheDocument()
    })

    it('preserves prefilled dietary tag selection', () => {
      renderForm({ kid: buildKid() })
      const veganBtn = screen.getByText('טבעוני')
      expect(veganBtn).toHaveStyle({ background: 'rgb(255, 107, 53)' })
    })
  })

  describe('emoji picker', () => {
    it('changing avatar updates the submit payload', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderForm()
      await user.type(screen.getByPlaceholderText('שם פרטי'), 'X')
      await user.click(screen.getByText('🦄'))
      await user.click(screen.getByText('הוסף'))
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ emoji_avatar: '🦄' }))
    })
  })

  describe('dietary tag toggle', () => {
    it('clicking a tag adds it; clicking again removes it', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderForm()
      await user.type(screen.getByPlaceholderText('שם פרטי'), 'X')

      await user.click(screen.getByText('טבעוני'))
      await user.click(screen.getByText('ללא גלוטן'))
      await user.click(screen.getByText('הוסף'))
      expect(onSubmit).toHaveBeenLastCalledWith(
        expect.objectContaining({ dietary_tag_ids: ['t1', 't2'] })
      )

      // Re-render is implicit via state — toggle off and add again to verify removal
      await user.click(screen.getByText('טבעוני')) // off
      await user.click(screen.getByText('הוסף'))
      expect(onSubmit).toHaveBeenLastCalledWith(
        expect.objectContaining({ dietary_tag_ids: ['t2'] })
      )
    })
  })

  describe('error + pending state', () => {
    it('renders the error message', () => {
      renderForm({ error: 'יש להזין שם פרטי.' })
      expect(screen.getByText('יש להזין שם פרטי.')).toBeInTheDocument()
    })

    it('disables save + cancel while pending', () => {
      renderForm({ isPending: true })
      expect(screen.getByText('...')).toBeDisabled()
      expect(screen.getByText('ביטול')).toBeDisabled()
    })
  })

  describe('cancel', () => {
    it('cancel calls onCancel', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderForm()
      await user.click(screen.getByText('ביטול'))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })
})
