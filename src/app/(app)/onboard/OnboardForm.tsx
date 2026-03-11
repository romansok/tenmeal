'use client'

import { useState, useTransition } from 'react'
import { completeOnboarding } from './actions'

interface DietaryTag {
  id: string
  slug: string
  label_he: string
}

interface KidEntry {
  name: string
  class_name: string
  emoji_avatar: string
  tag_ids: string[]
}

const EMOJI_OPTIONS = ['🧒', '👦', '👧', '🌟', '🦁', '🐻', '🐼', '🚀', '🦊', '🐯']

const PHONE_RE = /^0[2-9]\d{7,8}$/

function isValidPhone(phone: string) {
  return PHONE_RE.test(phone.replace(/-/g, '').replace(/\s/g, ''))
}

function mkKid(): KidEntry {
  return { name: '', class_name: '', emoji_avatar: '🧒', tag_ids: [] }
}

export default function OnboardForm({ tags }: { tags: DietaryTag[] }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [phone, setPhone] = useState('')
  const [kids, setKids] = useState<KidEntry[]>([mkKid()])
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function updateKid(idx: number, patch: Partial<KidEntry>) {
    setKids((prev) => prev.map((k, i) => (i === idx ? { ...k, ...patch } : k)))
  }

  function toggleTag(kidIdx: number, tagId: string) {
    setKids((prev) =>
      prev.map((k, i) => {
        if (i !== kidIdx) return k
        const has = k.tag_ids.includes(tagId)
        return {
          ...k,
          tag_ids: has ? k.tag_ids.filter((t) => t !== tagId) : [...k.tag_ids, tagId],
        }
      })
    )
  }

  function addKid() {
    if (kids.length < 8) setKids((prev) => [...prev, mkKid()])
  }

  function removeKid(idx: number) {
    setKids((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleFinish() {
    setError('')
    startTransition(async () => {
      const result = await completeOnboarding({ phone, kids })
      if (result?.error) setError(result.error)
    })
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.18)',
    backdropFilter: 'blur(12px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.35)',
    boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
    borderRadius: '24px',
  }

  const btnPrimary = (disabled: boolean) =>
    ({
      background: disabled ? 'rgba(255,107,53,0.4)' : '#FF6B35',
      color: 'white',
      border: 'none',
      borderRadius: '14px',
      padding: '14px 0',
      width: '100%',
      fontWeight: 700,
      fontSize: '16px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'transform 150ms',
    }) as React.CSSProperties

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(44,24,16,0.15)',
    background: 'rgba(255,255,255,0.6)',
    fontSize: '16px',
    color: '#2C1810',
    outline: 'none',
    boxSizing: 'border-box',
    textAlign: 'right',
    direction: 'rtl',
  }

  return (
    <div style={cardStyle} className="w-full max-w-sm p-8" dir="rtl">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: s <= step ? '#FF6B35' : 'rgba(44,24,16,0.2)',
              transition: 'background 300ms',
            }}
          />
        ))}
      </div>

      {/* Step 1 — Phone */}
      {step === 1 && (
        <div>
          <div className="text-5xl text-center mb-4">📱</div>
          <h1
            style={{ color: '#2C1810', fontSize: '24px', fontWeight: 800 }}
            className="text-center mb-2"
          >
            נשמח להכיר!
          </h1>
          <p style={{ color: 'rgba(44,24,16,0.55)', fontSize: '14px' }} className="text-center mb-6">
            מה מספר הטלפון שלך?
          </p>

          <input
            type="tel"
            placeholder="05X-XXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
            dir="ltr"
          />

          <button
            style={{ ...btnPrimary(!isValidPhone(phone)), marginTop: '20px' }}
            disabled={!isValidPhone(phone)}
            onClick={() => setStep(2)}
          >
            הבא
          </button>
        </div>
      )}

      {/* Step 2 — Kids */}
      {step === 2 && (
        <div>
          <div className="text-5xl text-center mb-4">👨‍👩‍👧</div>
          <h1
            style={{ color: '#2C1810', fontSize: '24px', fontWeight: 800 }}
            className="text-center mb-2"
          >
            ספרו לנו על הילד/ה
          </h1>
          <p style={{ color: 'rgba(44,24,16,0.55)', fontSize: '14px' }} className="text-center mb-5">
            הוסיפו את הילדים שיהנו מהארוחות
          </p>

          <div style={{ maxHeight: '340px', overflowY: 'auto', paddingLeft: '4px' }}>
            {kids.map((kid, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255,255,255,0.5)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.6)',
                  padding: '14px',
                  marginBottom: '12px',
                }}
              >
                {kids.length > 1 && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => removeKid(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(44,24,16,0.4)',
                        fontSize: '18px',
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Emoji picker */}
                <div className="flex flex-wrap gap-1 mb-3 justify-center">
                  {EMOJI_OPTIONS.map((em) => (
                    <button
                      key={em}
                      onClick={() => updateKid(idx, { emoji_avatar: em })}
                      style={{
                        fontSize: '22px',
                        padding: '4px',
                        borderRadius: '8px',
                        border: kid.emoji_avatar === em ? '2px solid #FF6B35' : '2px solid transparent',
                        background: kid.emoji_avatar === em ? 'rgba(255,107,53,0.1)' : 'transparent',
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="שם הילד/ה *"
                  value={kid.name}
                  onChange={(e) => updateKid(idx, { name: e.target.value })}
                  style={{ ...inputStyle, marginBottom: '10px' }}
                />
                <input
                  type="text"
                  placeholder="כיתה (למשל א׳, ב׳...)"
                  value={kid.class_name}
                  onChange={(e) => updateKid(idx, { class_name: e.target.value })}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          {kids.length < 8 && (
            <button
              onClick={addKid}
              style={{
                width: '100%',
                padding: '11px 0',
                borderRadius: '12px',
                border: '1.5px dashed rgba(255,107,53,0.5)',
                background: 'transparent',
                color: '#FF6B35',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              + הוסף ילד/ה נוספת
            </button>
          )}

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setStep(1)}
              style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: '14px',
                border: '1.5px solid rgba(44,24,16,0.2)',
                background: 'transparent',
                color: '#2C1810',
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              חזור
            </button>
            <button
              style={{
                ...btnPrimary(kids.some((k) => !k.name.trim())),
                flex: 2,
              }}
              disabled={kids.some((k) => !k.name.trim())}
              onClick={() => setStep(3)}
            >
              הבא
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Dietary */}
      {step === 3 && (
        <div>
          <div className="text-5xl text-center mb-4">🥗</div>
          <h1
            style={{ color: '#2C1810', fontSize: '24px', fontWeight: 800 }}
            className="text-center mb-2"
          >
            העדפות תזונה
          </h1>
          <p style={{ color: 'rgba(44,24,16,0.55)', fontSize: '14px' }} className="text-center mb-5">
            נשתמש בזה כדי להציע ארוחות מתאימות
          </p>

          <div style={{ maxHeight: '340px', overflowY: 'auto', paddingLeft: '4px' }}>
            {kids.map((kid, kidIdx) => (
              <div key={kidIdx} style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '10px',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{kid.emoji_avatar}</span>
                  <span style={{ color: '#2C1810', fontWeight: 700, fontSize: '15px' }}>
                    {kid.name}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                  }}
                >
                  {tags.map((tag) => {
                    const checked = kid.tag_ids.includes(tag.id)
                    return (
                      <label
                        key={tag.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '10px',
                          background: checked ? 'rgba(255,107,53,0.1)' : 'rgba(255,255,255,0.5)',
                          border: checked ? '1.5px solid #FF6B35' : '1.5px solid rgba(44,24,16,0.1)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#2C1810',
                          transition: 'all 150ms',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTag(kidIdx, tag.id)}
                          style={{ accentColor: '#FF6B35' }}
                        />
                        {tag.label_he}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div
              style={{
                color: '#EF476F',
                fontSize: '13px',
                textAlign: 'center',
                marginTop: '12px',
                padding: '8px',
                background: 'rgba(239,71,111,0.08)',
                borderRadius: '8px',
              }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setStep(2)}
              style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: '14px',
                border: '1.5px solid rgba(44,24,16,0.2)',
                background: 'transparent',
                color: '#2C1810',
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              חזור
            </button>
            <button
              style={{ ...btnPrimary(isPending), flex: 2 }}
              disabled={isPending}
              onClick={handleFinish}
            >
              {isPending ? '...' : 'סיים'}
            </button>
          </div>

          <button
            onClick={handleFinish}
            disabled={isPending}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '10px 0',
              background: 'none',
              border: 'none',
              color: 'rgba(44,24,16,0.45)',
              fontSize: '14px',
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            דלג
          </button>
        </div>
      )}
    </div>
  )
}
