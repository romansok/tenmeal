'use client'

import type { CSSProperties, ReactNode } from 'react'

export interface GlassCardProps {
  /** Default 16; pass 20 / 24 for the larger surfaces. */
  padding?: number
  /** Border-radius override (default 20). Day-cell-sized surfaces use 12 or 14. */
  radius?: number
  /** Lets callers override or extend the base style (e.g. red-tinted danger zone). */
  style?: CSSProperties
  className?: string
  onClick?: () => void
  children: ReactNode
}

const BASE: CSSProperties = {
  background: 'rgba(255,255,255,0.18)',
  backdropFilter: 'blur(12px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.35)',
  boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
}

/**
 * The shared glass surface used by every dashboard panel. Replaces the four
 * `glass` / `cardStyle` constants that were drifting (16 / 20 / 24 padding).
 * Callers pass `style` to add panel-specific overrides (e.g. coloured borders);
 * those win over the base via spread order.
 */
export default function GlassCard({
  padding = 16,
  radius = 20,
  style,
  className,
  onClick,
  children,
}: GlassCardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{ ...BASE, borderRadius: radius, padding, ...style }}
    >
      {children}
    </div>
  )
}
