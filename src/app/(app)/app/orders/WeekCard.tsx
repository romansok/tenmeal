'use client'

import { formatWeekRange } from '../lib/week'
import DayCell, { type DayCellProps } from './DayCell'
import { type WeekMeta, type WeekOffset, getWeekLabel } from './dayPlan'

interface WeekCardProps {
  week: WeekMeta
  isReadOnly: boolean
  pastExpanded: boolean
  onTogglePast: () => void
  planned: number
  totalDays: number
  futurePlanned: number
  weekError: string | undefined
  /**
   * Renders a `<DayCell>` for the day at column `i`. Caller wires the per-day
   * state (plan, error, savingDays, etc.) so this card stays presentation-only.
   */
  renderDayCell: (
    week: WeekMeta,
    date: Date,
    weekdayIndex: number
  ) => React.ReactElement<DayCellProps>
  hasSubscription: boolean
  onFillFromPrev: (week: WeekMeta) => void
  onCopyToNext: (week: WeekMeta) => void
  onClear: (week: WeekMeta) => void
}

const bulkBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 11px', borderRadius: 20,
  border: '1.5px dashed rgba(255,107,53,0.4)',
  background: 'rgba(255,107,53,0.06)',
  color: '#FF6B35', fontSize: 11, fontWeight: 700,
  cursor: 'pointer', whiteSpace: 'nowrap',
}

function ProgressDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i < filled ? '#FF6B35' : 'rgba(44,24,16,0.14)',
          }}
        />
      ))}
    </div>
  )
}

/** Collapsed past-week tile shown when `pastExpanded` is false. */
function PastWeekCollapsed({
  week,
  planned,
  onExpand,
}: { week: WeekMeta; planned: number; onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      style={{
        background: 'rgba(255,255,255,0.14)',
        backdropFilter: 'blur(12px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.35)',
        borderRadius: 16,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, cursor: 'pointer', textAlign: 'right',
        color: '#2C1810',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(44,24,16,0.65)' }}>
          {getWeekLabel(week.offset)}
        </span>
        <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.45)', fontWeight: 500 }}>
          {formatWeekRange(week.ws)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.55)', fontWeight: 600 }}>
          {planned} ארוחות
        </span>
        <span style={{ fontSize: 14, color: 'rgba(44,24,16,0.4)' }}>▸</span>
      </div>
    </button>
  )
}

export default function WeekCard({
  week,
  isReadOnly,
  pastExpanded,
  onTogglePast,
  planned,
  totalDays,
  futurePlanned,
  weekError,
  renderDayCell,
  hasSubscription,
  onFillFromPrev,
  onCopyToNext,
  onClear,
}: WeekCardProps) {
  const { offset, ws, dates } = week

  if (isReadOnly && !pastExpanded) {
    return <PastWeekCollapsed week={week} planned={planned} onExpand={onTogglePast} />
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.18)',
        backdropFilter: 'blur(12px) saturate(180%)',
        border: offset === 0
          ? '1.5px solid rgba(255,107,53,0.35)'
          : '1px solid rgba(255,255,255,0.35)',
        boxShadow: offset === 0
          ? '0 8px 32px rgba(255,107,53,0.10)'
          : '0 4px 16px rgba(31,38,135,0.08)',
        borderRadius: 20,
        overflow: 'hidden',
      }}
    >
      <div style={{
        padding: '12px 14px',
        background: offset === 0
          ? 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,179,71,0.07))'
          : isReadOnly
            ? 'rgba(44,24,16,0.04)'
            : 'rgba(255,255,255,0.08)',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 15, fontWeight: 800,
            color: offset === 0 ? '#FF6B35' : '#2C1810',
          }}>
            {getWeekLabel(offset)}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.45)', fontWeight: 500 }}>
            {formatWeekRange(ws)}
          </span>
          {isReadOnly && pastExpanded && (
            <button
              onClick={onTogglePast}
              style={{
                background: 'none', border: 'none', fontSize: 11, fontWeight: 700,
                color: 'rgba(44,24,16,0.45)', cursor: 'pointer', padding: '2px 6px',
                borderRadius: 6,
              }}
              title="צמצם"
            >
              ▾
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(44,24,16,0.65)' }}>
            {planned} / {totalDays} ימים
          </span>
          <ProgressDots filled={planned} total={totalDays} />
        </div>
      </div>

      {!isReadOnly && (
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap',
          padding: '8px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.04)',
        }}>
          <button onClick={() => onFillFromPrev(week)} title="מלא כמו שבוע קודם" style={bulkBtnStyle}>
            <span>📋</span>
            <span>מלא מהשבוע הקודם</span>
          </button>
          {offset === 0 && (
            <button onClick={() => onCopyToNext(week)} title="העתק את השבוע הזה לשבוע הבא" style={bulkBtnStyle}>
              <span>➡️</span>
              <span>העתק לשבוע הבא</span>
            </button>
          )}
          {futurePlanned > 0 && (
            <button
              onClick={() => onClear(week)}
              title="נקה ארוחות עתידיות בשבוע זה"
              style={{
                ...bulkBtnStyle,
                borderColor: 'rgba(239,71,111,0.35)',
                color: '#EF476F',
                background: 'rgba(239,71,111,0.05)',
              }}
            >
              <span>🧹</span>
              <span>נקה שבוע</span>
            </button>
          )}
        </div>
      )}

      {weekError && (
        <div style={{
          padding: '6px 14px',
          background: 'rgba(239,71,111,0.07)',
          borderBottom: '1px solid rgba(239,71,111,0.15)',
          color: '#EF476F', fontSize: 11, textAlign: 'center', fontWeight: 500,
        }}>
          {weekError}
        </div>
      )}

      <div style={{ padding: '12px 10px 14px' }}>
        <div className="day-grid">
          {dates.map((d, i) => renderDayCell(week, d, i))}
        </div>
      </div>

      {!isReadOnly && !hasSubscription && (
        <div style={{ padding: '0 10px 12px' }}>
          <div style={{ color: 'rgba(44,24,16,0.4)', fontSize: 11, textAlign: 'center' }}>
            נדרש מנוי פעיל לשמירת ארוחות
          </div>
        </div>
      )}
    </div>
  )
}

// Re-export so OrdersPanel only needs to import from WeekCard.
export type { WeekOffset }
