'use client'

import { useState, useTransition } from 'react'
import { updatePhone } from './actions'
import type { Profile, Kid } from './types'

interface AccountPanelProps {
  profile: Profile
  kids: Kid[]
}

export default function AccountPanel({ profile, kids }: AccountPanelProps) {
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState(profile.phone ?? '')
  const [phoneError, setPhoneError] = useState('')
  const [phoneSuccess, setPhoneSuccess] = useState(false)
  const [isPhonePending, startPhoneTransition] = useTransition()

  function handlePhoneSave() {
    setPhoneError('')
    setPhoneSuccess(false)
    startPhoneTransition(async () => {
      const result = await updatePhone(phoneInput)
      if ('error' in result) {
        setPhoneError(result.error)
      } else {
        setPhone(phoneInput)
        setEditingPhone(false)
        setPhoneSuccess(true)
        setTimeout(() => setPhoneSuccess(false), 3000)
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Profile info */}
      <div
        style={{
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
          borderRadius: 20,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 20 }}>
          פרטי חשבון
        </div>

        {/* Avatar + name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="avatar"
              style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #FFB347, #FF6B35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 24, fontWeight: 700,
              }}
            >
              {(profile.full_name ?? 'U')[0]}
            </div>
          )}
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#2C1810' }}>
              {profile.full_name ?? 'שם לא הוגדר'}
            </div>
          </div>
        </div>

        {/* Phone field */}
        <div>
          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', marginBottom: 6, fontWeight: 600 }}>
            טלפון
          </div>
          {editingPhone ? (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="input-field"
                  style={{ padding: '10px 12px', flex: 1 }}
                  dir="ltr"
                  placeholder="05X-XXXXXXX"
                  autoFocus
                />
                <button
                  onClick={handlePhoneSave}
                  disabled={isPhonePending}
                  style={{
                    padding: '8px 14px', borderRadius: 10, border: 'none', fontSize: 14,
                    fontWeight: 600, cursor: 'pointer',
                    background: isPhonePending ? 'rgba(255,107,53,0.4)' : '#FF6B35',
                    color: 'white',
                  }}
                >
                  {isPhonePending ? '...' : 'שמור'}
                </button>
                <button
                  onClick={() => { setEditingPhone(false); setPhoneError('') }}
                  disabled={isPhonePending}
                  style={{
                    padding: '8px 14px', borderRadius: 10, border: 'none', fontSize: 14,
                    fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(44,24,16,0.08)', color: '#2C1810',
                  }}
                >
                  ✕
                </button>
              </div>
              {phoneError && (
                <div style={{ color: '#EF476F', fontSize: 12, marginTop: 6, padding: '6px 10px', background: 'rgba(239,71,111,0.08)', borderRadius: 8 }}>
                  {phoneError}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, color: '#2C1810', direction: 'ltr', unicodeBidi: 'plaintext' as const }}>
                {phone || 'לא הוגדר'}
              </span>
              <button
                onClick={() => { setPhoneInput(phone); setPhoneError(''); setEditingPhone(true) }}
                style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 4, lineHeight: 1 }}
                title="ערוך טלפון"
              >
                ✏️
              </button>
            </div>
          )}
          {phoneSuccess && (
            <div style={{ color: '#4CAF82', fontSize: 12, marginTop: 6 }}>
              הטלפון עודכן בהצלחה
            </div>
          )}
        </div>
      </div>

      {/* Kids list (read-only) */}
      {kids.length > 0 && (
        <div
          style={{
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(12px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.35)',
            boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 16 }}>
            ילדים רשומים
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {kids.map((kid) => (
              <div
                key={kid.id}
                className="kid-pill"
                style={{ cursor: 'default' }}
              >
                <span>{kid.emoji_avatar}</span>
                <span>{kid.name}</span>
                {kid.class_name && (
                  <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.45)' }}>
                    {kid.class_name}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
