'use client'

import { useState, useTransition } from 'react'
import { updatePhone, addKid, updateKid, removeKid } from './actions'
import type { Profile, Kid, DietaryTag } from './types'

interface AccountPanelProps {
  profile: Profile
  kids: Kid[]
  dietaryTags: DietaryTag[]
  onKidsChange: (kids: Kid[]) => void
}

const EMOJI_OPTIONS = ['🧒', '👦', '👧', '🌟', '🦁', '🐻', '🐼', '🚀', '🦊', '🐯', '🐶', '🐱', '🐰', '🦄', '🎈', '🎀', '⭐', '🌈', '🎨', '⚽']

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.18)',
  backdropFilter: 'blur(12px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.35)',
  boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
  borderRadius: 20,
  padding: 24,
}

interface KidFormData {
  name: string
  class_name: string
  emoji_avatar: string
  school_name: string
  school_address: string
  dietary_tag_ids: string[]
}

function emptyForm(): KidFormData {
  return { name: '', class_name: '', emoji_avatar: '🧒', school_name: '', school_address: '', dietary_tag_ids: [] }
}

function formFromKid(kid: Kid): KidFormData {
  return {
    name: kid.name,
    class_name: kid.class_name ?? '',
    emoji_avatar: kid.emoji_avatar,
    school_name: kid.school_name ?? '',
    school_address: kid.school_address ?? '',
    dietary_tag_ids: kid.kid_dietary_restrictions.map((r) => r.dietary_tag_id),
  }
}

export default function AccountPanel({ profile, kids, dietaryTags, onKidsChange }: AccountPanelProps) {
  // Phone
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState(profile.phone ?? '')
  const [phoneError, setPhoneError] = useState('')
  const [phoneSuccess, setPhoneSuccess] = useState(false)
  const [isPhonePending, startPhoneTransition] = useTransition()

  // Kids form
  const [editingKidId, setEditingKidId] = useState<string | 'new' | null>(null)
  const [formData, setFormData] = useState<KidFormData>(emptyForm())
  const [formError, setFormError] = useState('')
  const [isKidPending, startKidTransition] = useTransition()
  const [removingKidId, setRemovingKidId] = useState<string | null>(null)

  function openAdd() {
    setFormData(emptyForm())
    setFormError('')
    setEditingKidId('new')
  }

  function openEdit(kid: Kid) {
    setFormData(formFromKid(kid))
    setFormError('')
    setEditingKidId(kid.id)
  }

  function cancelForm() {
    setEditingKidId(null)
    setFormError('')
  }

  function toggleTag(tagId: string) {
    setFormData((prev) => ({
      ...prev,
      dietary_tag_ids: prev.dietary_tag_ids.includes(tagId)
        ? prev.dietary_tag_ids.filter((t) => t !== tagId)
        : [...prev.dietary_tag_ids, tagId],
    }))
  }

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

  function handleKidSave() {
    if (!formData.name.trim()) {
      setFormError('יש להזין שם ילד.')
      return
    }
    setFormError('')

    if (editingKidId === 'new') {
      startKidTransition(async () => {
        const result = await addKid({
          name: formData.name,
          class_name: formData.class_name || null,
          emoji_avatar: formData.emoji_avatar,
          school_name: formData.school_name || null,
          school_address: formData.school_address || null,
          dietary_tag_ids: formData.dietary_tag_ids,
        })
        if ('error' in result) {
          setFormError(result.error)
        } else {
          onKidsChange([...kids, result.kid as unknown as Kid])
          setEditingKidId(null)
        }
      })
    } else if (editingKidId) {
      const kidId = editingKidId
      startKidTransition(async () => {
        const result = await updateKid(kidId, {
          name: formData.name,
          class_name: formData.class_name || null,
          emoji_avatar: formData.emoji_avatar,
          school_name: formData.school_name || null,
          school_address: formData.school_address || null,
          dietary_tag_ids: formData.dietary_tag_ids,
        })
        if ('error' in result) {
          setFormError(result.error)
        } else {
          onKidsChange(
            kids.map((k) =>
              k.id === kidId
                ? {
                    ...k,
                    name: formData.name.trim(),
                    class_name: formData.class_name.trim() || null,
                    emoji_avatar: formData.emoji_avatar,
                    school_name: formData.school_name.trim() || null,
                    school_address: formData.school_address.trim() || null,
                    kid_dietary_restrictions: formData.dietary_tag_ids.map((tagId) => {
                      const tag = dietaryTags.find((t) => t.id === tagId) ?? null
                      return { dietary_tag_id: tagId, dietary_tags: tag }
                    }),
                  }
                : k
            )
          )
          setEditingKidId(null)
        }
      })
    }
  }

  function handleKidRemove(kidId: string) {
    setRemovingKidId(kidId)
    startKidTransition(async () => {
      const result = await removeKid(kidId)
      setRemovingKidId(null)
      if ('error' in result) {
        setFormError(result.error)
      } else {
        onKidsChange(kids.filter((k) => k.id !== kidId))
        if (editingKidId === kidId) setEditingKidId(null)
      }
    })
  }

  const formCard = (
    <div
      style={{
        background: 'rgba(255,107,53,0.06)',
        border: '1.5px solid rgba(255,107,53,0.25)',
        borderRadius: 16,
        padding: 16,
        marginTop: 8,
      }}
    >
      {/* Emoji picker */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 8 }}>אווטאר</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              onClick={() => setFormData((p) => ({ ...p, emoji_avatar: e }))}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', fontSize: 20,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: formData.emoji_avatar === e ? 'rgba(255,107,53,0.18)' : 'rgba(255,255,255,0.5)',
                boxShadow: formData.emoji_avatar === e ? '0 0 0 2px #FF6B35' : 'none',
                transition: 'all 150ms',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 4 }}>שם *</div>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          className="input-field"
          style={{ padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
          placeholder="שם הילד/ה"
          autoFocus
        />
      </div>

      {/* Class */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 4 }}>כיתה</div>
        <input
          type="text"
          value={formData.class_name}
          onChange={(e) => setFormData((p) => ({ ...p, class_name: e.target.value }))}
          className="input-field"
          style={{ padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
          placeholder="למשל: ב׳"
        />
      </div>

      {/* School name */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 4 }}>שם בית ספר</div>
        <input
          type="text"
          value={formData.school_name}
          onChange={(e) => setFormData((p) => ({ ...p, school_name: e.target.value }))}
          className="input-field"
          style={{ padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
          placeholder="למשל: בית ספר יסודי רמות"
        />
      </div>

      {/* School address */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 4 }}>כתובת בית ספר (אופציונלי)</div>
        <input
          type="text"
          value={formData.school_address}
          onChange={(e) => setFormData((p) => ({ ...p, school_address: e.target.value }))}
          className="input-field"
          style={{ padding: '8px 12px', width: '100%', boxSizing: 'border-box' }}
          placeholder="למשל: רחוב הרצל 5, תל אביב"
        />
      </div>

      {/* Dietary tags */}
      {dietaryTags.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600, marginBottom: 8 }}>הגבלות תזונה</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {dietaryTags.map((tag) => {
              const selected = formData.dietary_tag_ids.includes(tag.id)
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

      {formError && (
        <div style={{ color: '#EF476F', fontSize: 12, marginBottom: 10, padding: '6px 10px', background: 'rgba(239,71,111,0.08)', borderRadius: 8 }}>
          {formError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleKidSave}
          disabled={isKidPending}
          style={{
            padding: '8px 20px', borderRadius: 10, border: 'none', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
            background: isKidPending ? 'rgba(255,107,53,0.4)' : '#FF6B35',
            color: 'white',
          }}
        >
          {isKidPending ? '...' : editingKidId === 'new' ? 'הוסף' : 'שמור'}
        </button>
        <button
          onClick={cancelForm}
          disabled={isKidPending}
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Profile info */}
      <div style={glass}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 20 }}>
          פרטי חשבון
        </div>

        {/* Avatar + name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
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

        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', marginBottom: 4, fontWeight: 600 }}>
            אימייל
          </div>
          <div style={{ fontSize: 15, color: '#2C1810', direction: 'ltr', unicodeBidi: 'plaintext' as const }}>
            {profile.email ?? 'לא ידוע'}
          </div>
        </div>

        {/* Phone */}
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
            <div style={{ color: '#4CAF82', fontSize: 12, marginTop: 6 }}>הטלפון עודכן בהצלחה</div>
          )}
        </div>
      </div>

      {/* Kids */}
      <div style={glass}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810' }}>ילדים רשומים</div>
          {editingKidId !== 'new' && (
            <button
              onClick={openAdd}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 14px', borderRadius: 10, border: 'none',
                background: '#FF6B35', color: 'white', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> הוסף ילד
            </button>
          )}
        </div>

        {kids.length === 0 && editingKidId !== 'new' && (
          <div style={{ color: 'rgba(44,24,16,0.4)', fontSize: 13, marginBottom: 8 }}>
            אין ילדים רשומים עדיין.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {kids.map((kid) => (
            <div key={kid.id}>
              {editingKidId === kid.id ? (
                formCard
              ) : (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 14,
                    background: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.6)',
                    opacity: removingKidId === kid.id ? 0.4 : 1,
                    transition: 'opacity 150ms',
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{kid.emoji_avatar}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2C1810' }}>{kid.name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {kid.class_name && (
                        <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600 }}>
                          {kid.class_name}
                        </span>
                      )}
                      {kid.school_name && (
                        <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)' }}>
                          {kid.school_name}
                        </span>
                      )}
                      {kid.kid_dietary_restrictions.map((r) =>
                        r.dietary_tags ? (
                          <span
                            key={r.dietary_tag_id}
                            style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 20,
                              background: 'rgba(255,107,53,0.1)', color: '#FF6B35', fontWeight: 600,
                            }}
                          >
                            {r.dietary_tags.label_he}
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(kid)}
                      disabled={isKidPending}
                      style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', padding: 6, lineHeight: 1, borderRadius: 8 }}
                      title="ערוך"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleKidRemove(kid.id)}
                      disabled={isKidPending}
                      style={{
                        background: 'none', border: 'none', fontSize: 15, cursor: 'pointer',
                        padding: 6, lineHeight: 1, borderRadius: 8, color: '#EF476F',
                        opacity: isKidPending ? 0.4 : 1,
                      }}
                      title="הסר"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {editingKidId === 'new' && formCard}
        </div>
      </div>
    </div>
  )
}
