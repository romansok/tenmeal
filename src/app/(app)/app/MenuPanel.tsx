'use client'

import { type Dispatch, type SetStateAction, useState } from 'react'
import {
  getKidRequiredSlugs,
  isCustomSandwichCompatible,
  isMenuItemCompatible,
  isPresetCompatible,
} from './dietary'
import SandwichBuilder from './menu/SandwichBuilder'
import { useFavoriteToggle } from './menu/useFavoriteToggle'
import GlassCard from './ui/GlassCard'
import { SANDWICH_BUILDER_CATEGORIES } from './types'
import type {
  CustomSandwich,
  DietaryTag,
  IngredientOption,
  Kid,
  KidFavorite,
  MenuItemWithTags,
  SandwichPreset,
} from './types'

interface MenuPanelProps {
  kids: Kid[]
  menuItemsWithTags: MenuItemWithTags[]
  dietaryTags: DietaryTag[]
  ingredients: IngredientOption[]
  initialCustomSandwiches: CustomSandwich[]
  onCustomSandwichesChange: (sandwiches: CustomSandwich[]) => void
  favorites: KidFavorite[]
  onFavoritesChange: Dispatch<SetStateAction<KidFavorite[]>>
  sandwichPresets: SandwichPreset[]
}

type MenuSection = 'meals' | 'custom'

const SECTIONS: { id: MenuSection; label: string; icon: string }[] = [
  { id: 'meals',  label: 'הארוחות שלי', icon: '🍱' },
  { id: 'custom', label: 'בנה כריך',    icon: '🥪' },
]

function HeartButton({
  on,
  pending,
  onClick,
}: { on: boolean; pending: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-label={on ? 'הסר מהמועדפים' : 'הוסף למועדפים'}
      style={{
        width: 38, height: 38, borderRadius: '50%',
        border: 'none', flexShrink: 0,
        background: on ? 'rgba(255,107,53,0.15)' : 'rgba(255,255,255,0.5)',
        color: on ? '#FF6B35' : 'rgba(44,24,16,0.4)',
        cursor: pending ? 'default' : 'pointer',
        fontSize: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 150ms ease-out',
      }}
    >
      {on ? '❤️' : '🤍'}
    </button>
  )
}

function TagBadgeRow({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {labels.map((label) => (
        <span key={label} style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: 'rgba(255,107,53,0.10)', color: '#FF6B35', fontWeight: 600,
        }}>
          {label}
        </span>
      ))}
    </div>
  )
}

export default function MenuPanel({
  kids,
  menuItemsWithTags,
  dietaryTags,
  ingredients,
  initialCustomSandwiches,
  onCustomSandwichesChange,
  favorites,
  onFavoritesChange,
  sandwichPresets,
}: MenuPanelProps) {
  const [selectedKidId, setSelectedKidId] = useState(kids[0]?.id ?? '')
  const [activeSection, setActiveSection] = useState<MenuSection>('meals')
  const [savedSandwiches, setSavedSandwiches] = useState<CustomSandwich[]>(initialCustomSandwiches)

  const selectedKid = kids.find((k) => k.id === selectedKidId) ?? null

  const tagLabelById = new Map(dietaryTags.map((t) => [t.id, t.label_he]))
  const tagLabelBySlug = new Map(dietaryTags.map((t) => [t.slug, t.label_he]))

  const compatibleMenuItems = menuItemsWithTags.filter((m) => isMenuItemCompatible(selectedKid, m))
  const compatibleSandwichPresets = sandwichPresets.filter((p) => isPresetCompatible(selectedKid, p, dietaryTags))

  const kidRequiredSlugs = getKidRequiredSlugs(selectedKid, dietaryTags)
  const isIngredientCompatible = (ing: IngredientOption): boolean =>
    kidRequiredSlugs.every((s) => ing.dietary_tag_slugs.includes(s))

  const kidFavorites = favorites.filter((f) => f.kid_id === selectedKidId)
  const favoritedMenuIds = new Set(
    kidFavorites.map((f) => f.menu_item_id).filter((x): x is string => !!x)
  )
  const favoritedPresetIds = new Set(
    kidFavorites.map((f) => f.preset_id).filter((x): x is string => !!x)
  )

  // Builder pool: bread + filling + sandwich_vegetable, restricted to kid-compatible.
  const builderIngredients = ingredients
    .filter((i) => SANDWICH_BUILDER_CATEGORIES.includes(i.category))
    .filter(isIngredientCompatible)

  // Visible saved customs for this kid: kid-owned + currently-compatible.
  const visibleSandwiches = savedSandwiches
    .filter((s) => s.kid_id === selectedKidId)
    .filter((s) => isCustomSandwichCompatible(s, ingredients, kidRequiredSlugs))

  const fav = useFavoriteToggle(selectedKidId || null, favorites, onFavoritesChange)

  function applySandwichesChange(next: CustomSandwich[]) {
    setSavedSandwiches(next)
    onCustomSandwichesChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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

      {kids.length === 0 && (
        <GlassCard>
          <div style={{ textAlign: 'center', color: 'rgba(44,24,16,0.45)', fontSize: 14, padding: 32 }}>
            אין ילדים רשומים. הוסף ילד בלשונית &ldquo;חשבון&rdquo;.
          </div>
        </GlassCard>
      )}

      {kids.length > 0 && (
        <>
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

          {activeSection === 'meals' && selectedKid && (
            <>
              <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.55)', fontWeight: 500, paddingRight: 4, lineHeight: 1.5 }}>
                סמן ❤️ ארוחות שאתה אוהב — הן יופיעו לבחירה כשאתה מזמין.
              </div>

              {fav.error && (
                <div style={{
                  background: 'rgba(239,71,111,0.08)',
                  border: '1px solid rgba(239,71,111,0.25)',
                  color: '#EF476F', borderRadius: 12,
                  padding: '10px 14px', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <span style={{ flex: 1, lineHeight: 1.45 }}>{fav.error}</span>
                  <button
                    onClick={fav.clearError}
                    aria-label="סגור"
                    style={{
                      background: 'none', border: 'none', color: '#EF476F',
                      cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {compatibleMenuItems.length === 0 &&
                compatibleSandwichPresets.length === 0 &&
                visibleSandwiches.length === 0 && (
                  <GlassCard>
                    <div style={{ textAlign: 'center', color: 'rgba(44,24,16,0.45)', fontSize: 14, padding: 32 }}>
                      אין פריטים התואמים את הגבלות התזונה של {selectedKid.name}.
                    </div>
                  </GlassCard>
                )}

              {compatibleSandwichPresets.map((preset) => {
                const isFav = favoritedPresetIds.has(preset.id)
                const target = { preset_id: preset.id }
                const labels = preset.dietary_tag_slugs
                  .map((slug) => tagLabelBySlug.get(slug))
                  .filter((s): s is string => !!s)
                return (
                  <GlassCard key={preset.id}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: 12, flexShrink: 0,
                        background: 'rgba(255,179,71,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 28 }}>🥪</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 4 }}>
                          {preset.name_he}
                        </div>
                        {preset.description_he && (
                          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.6)', lineHeight: 1.4, marginBottom: 6 }}>
                            {preset.description_he}
                          </div>
                        )}
                        <TagBadgeRow labels={labels} />
                      </div>
                      <HeartButton
                        on={isFav}
                        pending={fav.isPending(target)}
                        onClick={() => fav.toggle(target)}
                      />
                    </div>
                  </GlassCard>
                )
              })}

              {compatibleMenuItems.map((item) => {
                const isFav = favoritedMenuIds.has(item.id)
                const target = { menu_item_id: item.id }
                const labels = item.dietary_tag_ids
                  .map((id) => tagLabelById.get(id))
                  .filter((s): s is string => !!s)
                return (
                  <GlassCard key={item.id}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: 12, flexShrink: 0,
                        overflow: 'hidden', background: 'rgba(255,179,71,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.image_url
                          ? <img src={item.image_url} alt={item.name_he} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 28 }}>🍱</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#2C1810', marginBottom: 4 }}>
                          {item.name_he}
                        </div>
                        {item.description_he && (
                          <div style={{ fontSize: 12, color: 'rgba(44,24,16,0.6)', lineHeight: 1.4, marginBottom: 6 }}>
                            {item.description_he}
                          </div>
                        )}
                        <TagBadgeRow labels={labels} />
                      </div>
                      <HeartButton
                        on={isFav}
                        pending={fav.isPending(target)}
                        onClick={() => fav.toggle(target)}
                      />
                    </div>
                  </GlassCard>
                )
              })}

              {visibleSandwiches.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: '#2C1810', paddingRight: 4 }}>
                  הכריכים שלך
                </div>
              )}
              {visibleSandwiches.map((sand) => (
                <GlassCard key={sand.id}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      background: 'rgba(255,179,71,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 22 }}>🥪</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: '#2C1810' }}>
                      {sand.name_he}
                    </div>
                    <button
                      onClick={() => setActiveSection('custom')}
                      style={{
                        background: 'rgba(255,255,255,0.5)', border: 'none',
                        borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                        color: '#2C1810', cursor: 'pointer',
                      }}
                    >
                      ערוך
                    </button>
                  </div>
                </GlassCard>
              ))}
            </>
          )}

          {activeSection === 'custom' && selectedKid && (
            <SandwichBuilder
              selectedKid={selectedKid}
              builderIngredients={builderIngredients}
              visibleSandwiches={visibleSandwiches}
              onSandwichesChange={applySandwichesChange}
              allSavedSandwiches={savedSandwiches}
            />
          )}
        </>
      )}
    </div>
  )
}
