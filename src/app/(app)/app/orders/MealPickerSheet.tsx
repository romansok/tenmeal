'use client'

import { formatExpandedLabel } from '../lib/week'
import type { DayPlanUI, PickerEntry } from './dayPlan'

export interface MealPickerSheetProps {
  dateKey: string
  plan: DayPlanUI
  pickerEntries: PickerEntry[]
  quotaFull: boolean
  onClose: () => void
  onSelect: (entry: PickerEntry) => void
  onCancelDay: () => void
  onUpdateNotes: (notes: string) => void
}

export default function MealPickerSheet({
  dateKey,
  plan,
  pickerEntries,
  quotaFull,
  onClose,
  onSelect,
  onCancelDay,
  onUpdateNotes,
}: MealPickerSheetProps) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(44,24,16,0.15)',
          margin: '0 auto 12px',
        }} />

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 12,
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#2C1810' }}>
            {formatExpandedLabel(dateKey)}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(44,24,16,0.08)', border: 'none',
              borderRadius: 20, padding: '4px 12px',
              fontSize: 12, cursor: 'pointer', color: 'rgba(44,24,16,0.6)',
              fontWeight: 600,
            }}
          >
            סגור
          </button>
        </div>

        {!plan.mainKey && quotaFull && (
          <div style={{
            marginBottom: 12, padding: '8px 12px', borderRadius: 10,
            background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.2)',
            fontSize: 12, color: '#EF476F', fontWeight: 600, textAlign: 'center',
          }}>
            כל ארוחות המנוי מנוצלות — בטל ארוחה אחרת כדי לפנות מקום
          </div>
        )}

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: '50vh', overflowY: 'auto',
          paddingBottom: 4, marginBottom: 12,
        }}>
          {pickerEntries.map((entry) => {
            const active = plan.mainKey === entry.key
            const disabled = !plan.mainKey && quotaFull
            return (
              <button
                key={entry.key}
                onClick={disabled ? undefined : () => onSelect(entry)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 14px', borderRadius: 14,
                  textAlign: 'right',
                  border: active ? '2px solid #FF6B35' : '1.5px solid rgba(44,24,16,0.12)',
                  background: active ? 'rgba(255,107,53,0.10)' : 'rgba(255,255,255,0.75)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  transition: 'all 150ms ease-out',
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{entry.icon}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700,
                    color: active ? '#FF6B35' : disabled ? 'rgba(44,24,16,0.3)' : '#2C1810',
                  }}>
                    {entry.name}
                  </span>
                  {entry.description && (
                    <span style={{
                      fontSize: 12, fontWeight: 500, lineHeight: 1.35,
                      color: 'rgba(44,24,16,0.55)',
                    }}>
                      {entry.description}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <textarea
          rows={2}
          value={plan.notes}
          onChange={(e) => onUpdateNotes(e.target.value)}
          placeholder="הערה למטבח..."
          className="input-field"
          style={{ resize: 'none', fontSize: 14, marginBottom: plan.mainKey ? 12 : 0 }}
        />

        {plan.mainKey && (
          <button
            onClick={onCancelDay}
            style={{
              padding: '8px 16px', borderRadius: 20, border: 'none',
              background: 'rgba(239,71,111,0.1)', color: '#EF476F',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ביטול ארוחה
          </button>
        )}
      </div>
    </>
  )
}
