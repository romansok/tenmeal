'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addKid, deleteAccount, removeKid, updateKid, updatePhone } from './actions'
import KidForm from './account/KidForm'
import GlassCard from './ui/GlassCard'
import type { DietaryTag, Kid, KidInput, Profile, School } from './types'

interface AccountPanelProps {
  profile: Profile
  kids: Kid[]
  dietaryTags: DietaryTag[]
  schools: School[]
  onKidsChange: (kids: Kid[]) => void
}

/** Reconstruct a Kid view-row after updateKid succeeds. */
function patchKid(
  prev: Kid,
  input: KidInput,
  schools: School[],
  dietaryTags: DietaryTag[]
): Kid {
  const newSchool = schools.find((s) => s.id === input.school_id) ?? null
  return {
    ...prev,
    name: input.name.trim(),
    last_name: input.last_name?.trim() || null,
    class_name: input.class_name?.trim() || null,
    phone: input.phone?.trim() || null,
    emoji_avatar: input.emoji_avatar,
    school_id: input.school_id,
    school: newSchool,
    kid_dietary_restrictions: input.dietary_tag_ids.map((tagId) => {
      const tag = dietaryTags.find((t) => t.id === tagId) ?? null
      return { dietary_tag_id: tagId, dietary_tags: tag }
    }),
  }
}

export default function AccountPanel({
  profile,
  kids,
  dietaryTags,
  schools,
  onKidsChange,
}: AccountPanelProps) {
  const router = useRouter()

  // Phone
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState(profile.phone ?? '')
  const [phoneError, setPhoneError] = useState('')
  const [phoneSuccess, setPhoneSuccess] = useState(false)
  const [isPhonePending, startPhoneTransition] = useTransition()

  // Kid form
  const [editingKidId, setEditingKidId] = useState<string | 'new' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isKidPending, startKidTransition] = useTransition()
  const [removingKidId, setRemovingKidId] = useState<string | null>(null)

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isDeletePending, startDeleteTransition] = useTransition()

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

  function handleKidSubmit(input: KidInput) {
    if (!input.name.trim()) {
      setFormError('יש להזין שם פרטי.')
      return
    }
    setFormError(null)

    if (editingKidId === 'new') {
      startKidTransition(async () => {
        const result = await addKid(input)
        if ('error' in result) {
          setFormError(result.error)
        } else {
          onKidsChange([...kids, result.kid])
          setEditingKidId(null)
        }
      })
    } else if (editingKidId) {
      const kidId = editingKidId
      startKidTransition(async () => {
        const result = await updateKid(kidId, input)
        if ('error' in result) {
          setFormError(result.error)
        } else {
          onKidsChange(
            kids.map((k) => (k.id === kidId ? patchKid(k, input, schools, dietaryTags) : k))
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

  function handleDeleteAccount() {
    setDeleteError('')
    startDeleteTransition(async () => {
      const result = await deleteAccount()
      if ('error' in result) {
        setDeleteError(result.error)
      } else {
        router.push('/login')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Profile info */}
      <GlassCard padding={24}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 20 }}>
          פרטי חשבון
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="avatar"
              style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #FFB347, #FF6B35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 24, fontWeight: 700,
            }}>
              {(profile.full_name ?? 'U')[0]}
            </div>
          )}
          <div style={{ fontSize: 17, fontWeight: 700, color: '#2C1810' }}>
            {profile.full_name ?? 'שם לא הוגדר'}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', marginBottom: 4, fontWeight: 600 }}>אימייל</div>
          <div style={{ fontSize: 15, color: '#2C1810', direction: 'ltr', unicodeBidi: 'plaintext' as const }}>
            {profile.email ?? 'לא ידוע'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', marginBottom: 6, fontWeight: 600 }}>טלפון</div>
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
                <div style={{
                  color: '#EF476F', fontSize: 12, marginTop: 6,
                  padding: '6px 10px', background: 'rgba(239,71,111,0.08)', borderRadius: 8,
                }}>
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
      </GlassCard>

      {/* Kids */}
      <GlassCard padding={24}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810' }}>ילדים רשומים</div>
          {editingKidId !== 'new' && (
            <button
              onClick={() => { setFormError(null); setEditingKidId('new') }}
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
                <KidForm
                  kid={kid}
                  schools={schools}
                  dietaryTags={dietaryTags}
                  isPending={isKidPending}
                  error={formError}
                  onCancel={() => { setEditingKidId(null); setFormError(null) }}
                  onSubmit={handleKidSubmit}
                />
              ) : (
                <KidRow
                  kid={kid}
                  isRemoving={removingKidId === kid.id}
                  isBusy={isKidPending}
                  onEdit={() => { setFormError(null); setEditingKidId(kid.id) }}
                  onRemove={() => handleKidRemove(kid.id)}
                />
              )}
            </div>
          ))}

          {editingKidId === 'new' && (
            <KidForm
              kid={null}
              schools={schools}
              dietaryTags={dietaryTags}
              isPending={isKidPending}
              error={formError}
              onCancel={() => { setEditingKidId(null); setFormError(null) }}
              onSubmit={handleKidSubmit}
            />
          )}
        </div>
      </GlassCard>

      {/* Danger zone */}
      <GlassCard
        padding={24}
        style={{
          border: '1px solid rgba(239,71,111,0.25)',
          background: 'rgba(239,71,111,0.04)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#EF476F', marginBottom: 8 }}>
          מחיקת חשבון
        </div>
        <div style={{ fontSize: 13, color: 'rgba(44,24,16,0.55)', marginBottom: 16, lineHeight: 1.5 }}>
          מחיקת החשבון היא פעולה בלתי הפיכה. כל הנתונים יימחקו לצמיתות.
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{
            padding: '10px 20px', borderRadius: 12, border: '1.5px solid #EF476F',
            background: 'transparent', color: '#EF476F', fontSize: 14,
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          מחק חשבון
        </button>
      </GlassCard>

      {showDeleteConfirm && (
        <DeleteAccountModal
          isPending={isDeletePending}
          error={deleteError}
          onConfirm={handleDeleteAccount}
          onCancel={() => { setShowDeleteConfirm(false); setDeleteError('') }}
        />
      )}
    </div>
  )
}

interface KidRowProps {
  kid: Kid
  isRemoving: boolean
  isBusy: boolean
  onEdit: () => void
  onRemove: () => void
}

function KidRow({ kid, isRemoving, isBusy, onEdit, onRemove }: KidRowProps) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 14,
        background: 'rgba(255,255,255,0.5)',
        border: '1px solid rgba(255,255,255,0.6)',
        opacity: isRemoving ? 0.4 : 1,
        transition: 'opacity 150ms',
      }}
    >
      <span style={{ fontSize: 24, flexShrink: 0 }}>{kid.emoji_avatar}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2C1810' }}>
          {kid.name}{kid.last_name ? ` ${kid.last_name}` : ''}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {kid.class_name && (
            <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', fontWeight: 600 }}>
              {kid.class_name}
            </span>
          )}
          {kid.school && (
            <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)' }}>{kid.school.name_he}</span>
          )}
          {kid.phone && (
            <span style={{ fontSize: 12, color: 'rgba(44,24,16,0.5)', direction: 'ltr', unicodeBidi: 'plaintext' as const }}>
              {kid.phone}
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
          onClick={onEdit}
          disabled={isBusy}
          style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', padding: 6, lineHeight: 1, borderRadius: 8 }}
          title="ערוך"
        >
          ✏️
        </button>
        <button
          onClick={onRemove}
          disabled={isBusy}
          style={{
            background: 'none', border: 'none', fontSize: 15, cursor: 'pointer',
            padding: 6, lineHeight: 1, borderRadius: 8, color: '#EF476F',
            opacity: isBusy ? 0.4 : 1,
          }}
          title="הסר"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

interface DeleteAccountModalProps {
  isPending: boolean
  error: string
  onConfirm: () => void
  onCancel: () => void
}

function DeleteAccountModal({ isPending, error, onConfirm, onCancel }: DeleteAccountModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(44,24,16,0.45)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={() => { if (!isPending) onCancel() }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
          borderRadius: 20,
          padding: 24,
          maxWidth: 360, width: '90%',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: '#2C1810', marginBottom: 12 }}>
          מחיקת חשבון לצמיתות
        </div>
        <div style={{ fontSize: 14, color: 'rgba(44,24,16,0.65)', marginBottom: 20, lineHeight: 1.6 }}>
          האם אתה בטוח? פעולה זו תמחק לצמיתות את כל הנתונים שלך ואת חשבונך. לא ניתן לבטל פעולה זו.
        </div>
        {error && (
          <div style={{
            color: '#EF476F', fontSize: 13, marginBottom: 14,
            padding: '8px 12px', background: 'rgba(239,71,111,0.08)', borderRadius: 10,
          }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
              background: isPending ? 'rgba(239,71,111,0.4)' : '#EF476F',
              color: 'white', fontSize: 14, fontWeight: 700,
              cursor: isPending ? 'default' : 'pointer',
            }}
          >
            {isPending ? 'מוחק...' : 'כן, מחק לצמיתות'}
          </button>
          <button
            onClick={onCancel}
            disabled={isPending}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
              background: 'rgba(44,24,16,0.08)', color: '#2C1810',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
