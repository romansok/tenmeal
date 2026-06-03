'use client'

import { SHORT_DAY } from '../lib/week'
import type { DayPlanUI } from './dayPlan'

export interface DayCellProps {
  date: Date
  weekdayIndex: number
  dateKey: string
  plan: DayPlanUI
  todayKey: string
  isReadOnly: boolean
  isOpen: boolean
  isSaving: boolean
  errorMessage: string | null
  errorExpanded: boolean
  /** True when no slots remain in any active subscription. */
  quotaFull: boolean
  /** False when the kid has no available picker entries (no favorites + no customs). */
  pickerHasEntries: boolean
  onOpen: () => void
  onToggleErrorExpanded: () => void
}

export default function DayCell({
  date,
  weekdayIndex,
  dateKey,
  plan,
  todayKey,
  isReadOnly,
  isOpen,
  isSaving,
  errorMessage,
  errorExpanded,
  quotaFull,
  pickerHasEntries,
  onOpen,
  onToggleErrorExpanded,
}: DayCellProps) {
  const isOn = plan.mainKey != null
  const isFuture = dateKey > todayKey
  const isToday = dateKey === todayKey
  const canEdit = !isReadOnly && isFuture
  const isActive = isOpen || isOn
  const hasError = errorMessage != null
  const hasNote = isOn && plan.notes.trim().length > 0
  const quotaBlocked = !isOn && quotaFull
  const clickable = canEdit && pickerHasEntries && !isSaving && (!quotaBlocked || isOn)

  return (
    <div
      onClick={clickable ? onOpen : undefined}
      style={{
        borderRadius: 12,
        padding: '7px 3px 9px',
        textAlign: 'center',
        cursor: clickable ? 'pointer' : 'default',
        background: isOpen
          ? 'rgba(255,107,53,0.15)'
          : isOn
            ? 'rgba(255,107,53,0.08)'
            : isToday
              ? 'rgba(255,209,71,0.15)'
              : 'rgba(255,255,255,0.38)',
        border: isOpen
          ? '2px solid #FF6B35'
          : isOn
            ? '1.5px solid rgba(255,107,53,0.3)'
            : isToday
              ? '1.5px solid rgba(255,209,71,0.5)'
              : '1px solid rgba(255,255,255,0.5)',
        opacity: !isFuture && !isToday && !isOn && !isReadOnly ? 0.4 : 1,
        transition: 'all 150ms ease-out',
        minHeight: 74,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {hasNote && (
        <span
          title="יש הערה למטבח"
          style={{
            position: 'absolute', top: 4, left: 4,
            width: 7, height: 7, borderRadius: '50%',
            background: '#FFB347', boxShadow: '0 0 0 2px rgba(255,255,255,0.7)',
          }}
        />
      )}

      {(isSaving || hasError) && (
        <span
          onClick={hasError
            ? (e) => { e.stopPropagation(); onToggleErrorExpanded() }
            : undefined}
          title={hasError ? errorMessage! : 'שומר...'}
          style={{
            position: 'absolute', top: 3, right: 3,
            width: 16, height: 16, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: hasError ? '#EF476F' : 'rgba(255,255,255,0.85)',
            color: hasError ? '#fff' : '#2C1810',
            fontSize: 10, fontWeight: 700,
            cursor: hasError ? 'pointer' : 'default',
            animation: isSaving ? 'spin 1s linear infinite' : undefined,
            boxShadow: hasError ? '0 0 0 2px rgba(239,71,111,0.2)' : undefined,
          }}
        >
          {hasError ? '!' : '⏳'}
        </span>
      )}

      <div style={{
        fontSize: 10, fontWeight: 700,
        color: isActive ? '#FF6B35' : 'rgba(44,24,16,0.4)',
      }}>
        {SHORT_DAY[weekdayIndex]}
      </div>

      <div style={{
        fontSize: 12, fontWeight: 600,
        color: isOn ? '#2C1810' : 'rgba(44,24,16,0.6)',
        marginTop: 2,
      }}>
        {date.getDate()}.{date.getMonth() + 1}
      </div>

      <div style={{ marginTop: 4, lineHeight: 1 }}>
        {isOn ? (
          <span style={{ fontSize: 18 }}>🍱</span>
        ) : canEdit && pickerHasEntries && !quotaBlocked ? (
          <span style={{
            fontSize: 15, fontWeight: 700,
            color: isOpen ? '#FF6B35' : 'rgba(255,107,53,0.5)',
          }}>＋</span>
        ) : (
          <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.2)' }}>—</span>
        )}
      </div>

      {isToday && (
        <div style={{
          fontSize: 8, fontWeight: 800, padding: '1px 4px',
          borderRadius: 4, background: 'rgba(255,209,71,0.6)',
          color: '#2C1810', marginTop: 2, letterSpacing: 0.3,
        }}>
          היום
        </div>
      )}

      {hasError && errorExpanded && (
        <div style={{
          position: 'absolute', bottom: -4, left: '50%', transform: 'translate(-50%, 100%)',
          background: '#fff', border: '1.5px solid #EF476F', borderRadius: 10,
          padding: '6px 10px', fontSize: 11, color: '#EF476F',
          whiteSpace: 'nowrap', zIndex: 20,
          boxShadow: '0 8px 20px rgba(239,71,111,0.25)',
        }}>
          {errorMessage}
        </div>
      )}
    </div>
  )
}
