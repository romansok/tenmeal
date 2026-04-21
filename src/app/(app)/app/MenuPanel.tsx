'use client'

import { useState, useTransition } from 'react'
import { toggleKidFavorite } from './actions'
import type { Kid, MenuItemWithTags, KidFavorite, DietaryTag } from './types'

interface MenuPanelProps {
  kids: Kid[]
  menuItemsWithTags: MenuItemWithTags[]
  initialKidFavorites: KidFavorite[]
  dietaryTags: DietaryTag[]
  onFavoritesChange: (favorites: KidFavorite[]) => void
}

type FavoriteKey = string // `${kidId}:${menuItemId}`
type MenuSection = 'ready' | 'custom'

function buildFavoriteSet(favorites: KidFavorite[]): Set<FavoriteKey> {
  return new Set(favorites.map((f) => `${f.kid_id}:${f.menu_item_id}`))
}

function getCompatibleItems(kid: Kid, items: MenuItemWithTags[]): MenuItemWithTags[] {
  const kidTagIds = kid.kid_dietary_restrictions.map((r) => r.dietary_tag_id)
  if (kidTagIds.length === 0) return items
  return items.filter((item) => kidTagIds.every((tagId) => item.dietary_tag_ids.includes(tagId)))
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.18)',
  backdropFilter: 'blur(12px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.35)',
  boxShadow: '0 8px 32px rgba(31,38,135,0.12)',
  borderRadius: 20,
  padding: 16,
}

const SECTIONS: { id: MenuSection; label: string; icon: string }[] = [
  { id: 'ready', label: 'מנות מוכנות', icon: '🍱' },
  { id: 'custom', label: 'בנה כריך', icon: '🥪' },
]

export default function MenuPanel({ kids, menuItemsWithTags, initialKidFavorites, dietaryTags, onFavoritesChange }: MenuPanelProps) {
  const [selectedKidId, setSelectedKidId] = useState(kids[0]?.id ?? '')
  const [activeSection, setActiveSection] = useState<MenuSection>('ready')
  const [favorites, setFavorites] = useState<Set<FavoriteKey>>(() => buildFavoriteSet(initialKidFavorites))
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function favSetToArray(set: Set<FavoriteKey>): KidFavorite[] {
    return Array.from(set).map((key) => {
      const [kid_id, menu_item_id] = key.split(':')
      return { kid_id, menu_item_id }
    })
  }

  const selectedKid = kids.find((k) => k.id === selectedKidId) ?? null
  const visibleItems = selectedKid ? getCompatibleItems(selectedKid, menuItemsWithTags) : []
  const tagLabelMap = Object.fromEntries(dietaryTags.map((t) => [t.id, t.label_he]))

  function handleToggleFavorite(menuItemId: string) {
    if (!selectedKid) return
    const key: FavoriteKey = `${selectedKid.id}:${menuItemId}`
    const wasOn = favorites.has(key)

    setFavorites((prev) => {
      const next = new Set(prev)
      wasOn ? next.delete(key) : next.add(key)
      onFavoritesChange(favSetToArray(next))
      return next
    })
    setActionError(null)

    startTransition(async () => {
      const result = await toggleKidFavorite(selectedKid.id, menuItemId, !wasOn)
      if ('error' in result) {
        setFavorites((prev) => {
          const next = new Set(prev)
          wasOn ? next.add(key) : next.delete(key)
          onFavoritesChange(favSetToArray(next))
          return next
        })
        setActionError(result.error)
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Kid selector */}
      {kids.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, flexWrap: 'nowrap' }}>
          {kids.map((kid) => (
            <button
              key={kid.id}
              onClick={() => setSelectedKidId(kid.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 40,
                border: selectedKidId === kid.id ? '2px solid #FF6B35' : '1px solid rgba(255,255,255,0.5)',
                background: selectedKidId === kid.id ? 'linear-gradient(135deg, #FF6B35, #FFB347)' : 'rgba(255,255,255,0.25)',
                color: selectedKidId === kid.id ? '#fff' : '#2C1810',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
                backdropFilter: 'blur(8px)', transition: 'all 150ms ease-out',
              }}
            >
              <span style={{ fontSize: 18 }}>{kid.emoji_avatar}</span>
              <span>{kid.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* No kids */}
      {kids.length === 0 && (
        <div style={glass}>
          <div style={{ textAlign: 'center', color: 'rgba(44,24,16,0.45)', fontSize: 14, padding: 32 }}>
            אין ילדים רשומים. הוסף ילד בלשונית &ldquo;חשבון&rdquo;.
          </div>
        </div>
      )}

      {kids.length > 0 && (
        <>
          {/* Section tabs */}
          <div style={{
            display: 'flex', gap: 8,
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 16, padding: 4,
            border: '1px solid rgba(255,255,255,0.4)',
          }}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 0', borderRadius: 12, border: 'none',
                  background: activeSection === s.id ? 'rgba(255,255,255,0.85)' : 'transparent',
                  boxShadow: activeSection === s.id ? '0 2px 8px rgba(31,38,135,0.10)' : 'none',
                  color: activeSection === s.id ? '#FF6B35' : 'rgba(44,24,16,0.55)',
                  fontWeight: activeSection === s.id ? 700 : 500,
                  fontSize: 14, cursor: 'pointer',
                  transition: 'all 150ms ease-out',
                }}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* Error banner */}
          {actionError && (
            <div style={{ color: '#EF476F', fontSize: 13, padding: '8px 12px', background: 'rgba(239,71,111,0.08)', borderRadius: 10, border: '1px solid rgba(239,71,111,0.2)' }}>
              {actionError}
            </div>
          )}

          {/* ── Section: ready meals ── */}
          {activeSection === 'ready' && (
            <>
              {visibleItems.length === 0 && selectedKid && (
                <div style={glass}>
                  <div style={{ textAlign: 'center', color: 'rgba(44,24,16,0.45)', fontSize: 14, padding: 32 }}>
                    אין פריטים התואמים את הגבלות התזונה של {selectedKid.name}.
                  </div>
                </div>
              )}

              {visibleItems.map((item) => {
                const key: FavoriteKey = `${selectedKidId}:${item.id}`
                const isFav = favorites.has(key)
                return (
                  <div key={item.id} style={glass}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      {/* Image */}
                      <div style={{
                        width: 64, height: 64, borderRadius: 12, flexShrink: 0,
                        overflow: 'hidden', background: 'rgba(255,179,71,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.image_url
                          ? <img src={item.image_url} alt={item.name_he} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 28 }}>🍱</span>
                        }
                      </div>
                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 6 }}>
                          {item.name_he}
                        </div>
                        {item.dietary_tag_ids.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {item.dietary_tag_ids.map((tagId) =>
                              tagLabelMap[tagId] ? (
                                <span key={tagId} style={{
                                  fontSize: 11, padding: '2px 8px', borderRadius: 20,
                                  background: 'rgba(255,107,53,0.10)', color: '#FF6B35', fontWeight: 600,
                                }}>
                                  {tagLabelMap[tagId]}
                                </span>
                              ) : null
                            )}
                          </div>
                        )}
                      </div>
                      {/* Heart */}
                      <button
                        onClick={() => handleToggleFavorite(item.id)}
                        disabled={isPending}
                        aria-label={isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                        style={{
                          background: 'none', border: 'none', fontSize: 24,
                          cursor: isPending ? 'default' : 'pointer',
                          padding: 4, lineHeight: 1, flexShrink: 0,
                          opacity: isPending ? 0.6 : 1,
                          transition: 'opacity 150ms',
                        }}
                      >
                        {isFav ? '❤️' : '🤍'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* ── Section: custom sandwich (placeholder) ── */}
          {activeSection === 'custom' && (
            <div style={{
              ...glass,
              border: '2px dashed rgba(255,107,53,0.3)',
              background: 'rgba(255,255,255,0.10)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12, padding: 40, textAlign: 'center',
            }}>
              <span style={{ fontSize: 48 }}>🥪</span>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#2C1810' }}>בנה כריך בעצמך</div>
              <div style={{ fontSize: 13, color: 'rgba(44,24,16,0.5)', maxWidth: 220, lineHeight: 1.5 }}>
                בחר מרכיבים, הגדר כמויות ושמור את הכריך האהוב — בקרוב
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 1,
                padding: '4px 12px', borderRadius: 20,
                background: 'rgba(255,107,53,0.10)', color: '#FF6B35',
              }}>
                בקרוב
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
