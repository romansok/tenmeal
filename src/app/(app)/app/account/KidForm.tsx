'use client'

import { useState } from 'react'
import type { DietaryTag, Kid, KidInput, School } from '../types'

const EMOJI_OPTIONS = [
  '🧒', '👦', '👧', '🌟', '🦁', '🐻', '🐼', '🚀', '🦊', '🐯',
  '🐶', '🐱', '🐰', '🦄', '🎈', '🎀', '⭐', '🌈', '🎨', '⚽',
]

interface FormState {
  first_name: string
  last_name: string
  class_name: string
  phone: string
  emoji_avatar: string
  school_id: string
  dietary_tag_ids: string[]
}

function emptyState(): FormState {
  return {
    first_name: '',
    last_name: '',
    class_name: '',
    phone: '',
    emoji_avatar: '🧒',
    school_id: '',
    dietary_tag_ids: [],
  }
}

function stateFromKid(kid: Kid): FormState {
  return {
    first_name: kid.name,
    last_name: kid.last_name ?? '',
    class_name: kid.class_name ?? '',
    phone: kid.phone ?? '',
    emoji_avatar: kid.emoji_avatar,
    school_id: kid.school_id ?? '',
    dietary_tag_ids: kid.kid_dietary_restrictions.map((r) => r.dietary_tag_id),
  }
}

function toKidInput(s: FormState): KidInput {
  return {
    name: s.first_name,
    last_name: s.last_name || null,
    class_name: s.class_name || null,
    phone: s.phone || null,
    emoji_avatar: s.emoji_avatar,
    school_id: s.school_id || null,
    dietary_tag_ids: s.dietary_tag_ids,
  }
}

export interface KidFormProps {
  /** null = add mode; otherwise edit mode prefilled from this kid. */
  kid: Kid | null
  schools: School[]
  dietaryTags: DietaryTag[]
  isPending: boolean
  error: string | null
  onSubmit: (input: KidInput) => void
  onCancel: () => void
}

export default function KidForm({
  kid,
  schools,
  dietaryTags,
  isPending,
  error,
  onSubmit,
  onCancel,
}: KidFormProps) {
  const [state, setState] = useState<FormState>(() => (kid ? stateFromKid(kid) : emptyState()))
  const isAdd = kid === null

  function toggleTag(tagId: string) {
    setState((prev) => ({
      ...prev,
      dietary_tag_ids: prev.dietary_tag_ids.includes(tagId)
        ? prev.dietary_tag_ids.filter((t) => t !== tagId)
        : [...prev.dietary_tag_ids, tagId],
    }))
  }

  return (
    <div
      style={{
        background: 'rgba(255,107,53,0.06)',
        border: '1.5px solid rgba(255,107,53,0.25)',
        borderRadius: 16,
        padding: 16,
        marginTop: 8,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 8 }}>אווטאר</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              onClick={() => setState((p) => ({ ...p, emoji_avatar: e }))}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', fontSize: 20,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: state.emoji_avatar === e ? 'rgba(255,107,53,0.18)' : 'rgba(255,255,255,0.5)',
                boxShadow: state.emoji_avatar === e ? '0 0 0 2px #FF6B35' : 'none',
                transition: 'all 150ms',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 4 }}>שם פרטי *</div>
          <input
            type="text"
            value={state.first_name}
            onChange={(e) => setState((p) => ({ ...p, first_name: e.target.value }))}
            className="input-field"
            style={{ padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
            placeholder="שם פרטי"
            autoFocus
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 4 }}>שם משפחה</div>
          <input
            type="text"
            value={state.last_name}
            onChange={(e) => setState((p) => ({ ...p, last_name: e.target.value }))}
            className="input-field"
            style={{ padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
            placeholder="שם משפחה"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 4 }}>כיתה</div>
          <input
            type="text"
            value={state.class_name}
            onChange={(e) => setState((p) => ({ ...p, class_name: e.target.value }))}
            className="input-field"
            style={{ padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
            placeholder="למשל: ב׳"
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 4 }}>טלפון ילד/ה</div>
          <input
            type="tel"
            value={state.phone}
            onChange={(e) => setState((p) => ({ ...p, phone: e.target.value }))}
            className="input-field"
            style={{ padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
            placeholder="05X-XXXXXXX"
            dir="ltr"
          />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 4 }}>בית ספר</div>
        <select
          value={state.school_id}
          onChange={(e) => setState((p) => ({ ...p, school_id: e.target.value }))}
          className="input-field"
          style={{ padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
        >
          <option value="">בחר בית ספר</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name_he}</option>
          ))}
        </select>
      </div>

      {dietaryTags.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 8 }}>הגבלות תזונה</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {dietaryTags.map((tag) => {
              const selected = state.dietary_tag_ids.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer',
                    background: selected ? '#FF6B35' : 'rgba(44,24,16,0.08)',
                    color: selected ? 'white' : '#2C1810',
                    transition: 'all 150ms',
                  }}
                >
                  {tag.label_he}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          color: '#EF476F', fontSize: 12, marginBottom: 10,
          padding: '6px 10px', background: 'rgba(239,71,111,0.08)', borderRadius: 8,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSubmit(toKidInput(state))}
          disabled={isPending}
          style={{
            padding: '8px 20px', borderRadius: 10, border: 'none', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
            background: isPending ? 'rgba(255,107,53,0.4)' : '#FF6B35',
            color: 'white',
          }}
        >
          {isPending ? '...' : isAdd ? 'הוסף' : 'שמור'}
        </button>
        <button
          onClick={onCancel}
          disabled={isPending}
          style={{
            padding: '8px 14px', borderRadius: 10, border: 'none', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
            background: 'rgba(44,24,16,0.08)', color: '#2C1810',
          }}
        >
          ביטול
        </button>
      </div>
    </div>
  )
}
