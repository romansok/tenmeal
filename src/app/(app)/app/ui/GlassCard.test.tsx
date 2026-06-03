import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GlassCard from './GlassCard'

describe('<GlassCard>', () => {
  it('renders children', () => {
    render(<GlassCard>hello</GlassCard>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('uses default padding 16 and radius 20', () => {
    const { container } = render(<GlassCard>x</GlassCard>)
    const el = container.firstChild as HTMLElement
    expect(el.style.padding).toBe('16px')
    expect(el.style.borderRadius).toBe('20px')
  })

  it('honors padding + radius overrides', () => {
    const { container } = render(<GlassCard padding={24} radius={12}>x</GlassCard>)
    const el = container.firstChild as HTMLElement
    expect(el.style.padding).toBe('24px')
    expect(el.style.borderRadius).toBe('12px')
  })

  it('lets style prop override base styles', () => {
    const { container } = render(<GlassCard style={{ background: 'rgb(0, 0, 0)' }}>x</GlassCard>)
    const el = container.firstChild as HTMLElement
    expect(el.style.background).toBe('rgb(0, 0, 0)')
  })

  it('applies className and onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { container } = render(
      <GlassCard className="my-card" onClick={onClick}>x</GlassCard>
    )
    const el = container.firstChild as HTMLElement
    expect(el.className).toBe('my-card')
    await user.click(el)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
