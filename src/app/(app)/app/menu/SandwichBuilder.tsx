'use client'

import { useEffect, useState, useTransition } from 'react'
import { createCustomSandwich, removeCustomSandwich, updateCustomSandwich } from '../actions'
import GlassCard from '../ui/GlassCard'
import {
  SANDWICH_BUILDER_CATEGORIES,
  SANDWICH_CATEGORY_RULES,
  type CustomSandwich,
  type IngredientCategory,
  type IngredientOption,
  type Kid,
} from '../types'

type BuilderCategory = 'bread' | 'filling' | 'sandwich_vegetable'

export interface SandwichBuilderProps {
  selectedKid: Kid
  /** Already filtered to builder-eligible categories AND kid-compatible. */
  builderIngredients: IngredientOption[]
  /** Customs already filtered for visibility (kid-owned + currently compatible). */
  visibleSandwiches: CustomSandwich[]
  /** Callback for any DB-side change to the kid's saved sandwiches. */
  onSandwichesChange: (next: CustomSandwich[]) => void
  /** All saved customs (across all kids) — caller stores this in state. */
  allSavedSandwiches: CustomSandwich[]
}

export default function SandwichBuilder({
  selectedKid,
  builderIngredients,
  visibleSandwiches,
  onSandwichesChange,
  allSavedSandwiches,
}: SandwichBuilderProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<Set<string>>(new Set())
  const [editingSandwichId, setEditingSandwichId] = useState<string | null>(null)
  const [sandwichName, setSandwichName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(null), 4000)
    return () => clearTimeout(t)
  }, [success])

  // Reset whenever the kid changes — saved selections from a different kid
  // shouldn't leak into the builder for this one.
  useEffect(() => {
    setSelectedIngredientIds(new Set())
    setEditingSandwichId(null)
    setSandwichName('')
    setError(null)
    setSuccess(null)
  }, [selectedKid.id])

  const ingredientById = new Map<string, IngredientOption>(
    builderIngredients.map((i) => [i.id, i])
  )
  const ingredientsByCategory: Record<BuilderCategory, IngredientOption[]> = {
    bread: [], filling: [], sandwich_vegetable: [],
  }
  for (const ing of builderIngredients) {
    if (ing.category === 'bread' || ing.category === 'filling' || ing.category === 'sandwich_vegetable') {
      ingredientsByCategory[ing.category].push(ing)
    }
  }

  function countByCategory(ids: Set<string>): Record<BuilderCategory, number> {
    const counts: Record<BuilderCategory, number> = { bread: 0, filling: 0, sandwich_vegetable: 0 }
    ids.forEach((id) => {
      const cat = ingredientById.get(id)?.category
      if (cat === 'bread' || cat === 'filling' || cat === 'sandwich_vegetable') counts[cat]++
    })
    return counts
  }

  const categoryCounts = countByCategory(selectedIngredientIds)
  const previewNames = Array.from(selectedIngredientIds)
    .map((id) => ingredientById.get(id))
    .filter((ing): ing is IngredientOption => Boolean(ing))
    .sort(
      (a, b) =>
        SANDWICH_BUILDER_CATEGORIES.indexOf(a.category) -
          SANDWICH_BUILDER_CATEGORIES.indexOf(b.category) || a.sort_order - b.sort_order
    )
    .map((ing) => ing.name_he)
  const canSave =
    categoryCounts.bread === 1 &&
    categoryCounts.filling >= 1 &&
    categoryCounts.filling <= 2 &&
    sandwichName.trim().length > 0 &&
    !isPending

  function toggleIngredient(id: string) {
    const ing = ingredientById.get(id)
    if (!ing) return
    setError(null)
    setSuccess(null)
    setSelectedIngredientIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      // Bread is single-select: replace any existing bread.
      if (ing.category === 'bread') {
        ingredientsByCategory.bread.forEach((b) => next.delete(b.id))
        next.add(id)
        return next
      }
      const cat = ing.category as BuilderCategory
      const rule = SANDWICH_CATEGORY_RULES[cat]
      const currentCount = countByCategory(next)[cat]
      if (rule.max !== null && currentCount >= rule.max) return prev
      next.add(id)
      return next
    })
  }

  function resetBuilder() {
    setSelectedIngredientIds(new Set())
    setEditingSandwichId(null)
    setSandwichName('')
    setError(null)
  }

  function loadIntoBuilder(sandwich: CustomSandwich) {
    setEditingSandwichId(sandwich.id)
    setSandwichName(sandwich.name_he)
    // Drop ingredients no longer in the (compatibility-filtered) builder pool.
    const compatibleIds = sandwich.ingredient_ids.filter((id) => ingredientById.has(id))
    const droppedCount = sandwich.ingredient_ids.length - compatibleIds.length
    setSelectedIngredientIds(new Set(compatibleIds))
    setError(
      droppedCount > 0
        ? `הוסרו ${droppedCount} מרכיבים שאינם תואמים את הגבלות התזונה הנוכחיות של הילד.`
        : null
    )
    setSuccess(null)
  }

  function handleSave() {
    const ids = Array.from(selectedIngredientIds)
    const trimmedName = sandwichName.trim()
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      if (editingSandwichId) {
        const result = await updateCustomSandwich(editingSandwichId, trimmedName, ids)
        if ('error' in result) { setError(result.error); return }
        onSandwichesChange(
          allSavedSandwiches.map((s) => (s.id === result.sandwich.id ? result.sandwich : s))
        )
        setSuccess('הכריך עודכן בהצלחה.')
        resetBuilder()
      } else {
        const result = await createCustomSandwich(selectedKid.id, trimmedName, ids)
        if ('error' in result) { setError(result.error); return }
        onSandwichesChange([result.sandwich, ...allSavedSandwiches])
        setSuccess('הכריך נשמר בהצלחה.')
        resetBuilder()
      }
    })
  }

  function handleDelete(id: string) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await removeCustomSandwich(id)
      if ('error' in result) { setError(result.error); return }
      onSandwichesChange(allSavedSandwiches.filter((s) => s.id !== id))
      if (editingSandwichId === id) resetBuilder()
    })
  }

  return (
    <>
      {visibleSandwiches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2C1810', paddingRight: 4 }}>
            הכריכים השמורים
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {visibleSandwiches.map((sand) => {
              const isEditing = editingSandwichId === sand.id
              return (
                <GlassCard
                  key={sand.id}
                  padding={12}
                  style={{
                    minWidth: 160, flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 8,
                    border: isEditing ? '2px solid #FF6B35' : undefined,
                  }}
                >
                  <span style={{ fontSize: 22 }}>🥪</span>
                  <button
                    onClick={() => loadIntoBuilder(sand)}
                    disabled={isPending}
                    style={{
                      flex: 1, background: 'none', border: 'none',
                      cursor: isPending ? 'default' : 'pointer',
                      textAlign: 'right', padding: 0,
                      fontSize: 13, fontWeight: 700, color: '#2C1810',
                      lineHeight: 1.3, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {sand.name_he}
                  </button>
                  <button
                    onClick={() => handleDelete(sand.id)}
                    disabled={isPending}
                    aria-label="מחק כריך"
                    style={{
                      background: 'none', border: 'none', fontSize: 16,
                      cursor: isPending ? 'default' : 'pointer',
                      padding: 4, lineHeight: 1,
                      opacity: isPending ? 0.5 : 0.7,
                    }}
                  >
                    🗑️
                  </button>
                </GlassCard>
              )
            })}
          </div>
        </div>
      )}

      <GlassCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>🥪</span>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#2C1810' }}>
            {editingSandwichId ? 'עריכת הכריך' : 'בנה כריך בעצמך'}
          </div>
          {editingSandwichId && (
            <button
              onClick={resetBuilder}
              disabled={isPending}
              style={{
                marginInlineStart: 'auto',
                background: 'none', border: 'none', padding: 0,
                fontSize: 12, fontWeight: 600, color: '#FF6B35',
                cursor: isPending ? 'default' : 'pointer',
              }}
            >
              התחל מחדש
            </button>
          )}
        </div>

        {(SANDWICH_BUILDER_CATEGORIES as BuilderCategory[]).map((cat) => {
          const rule = SANDWICH_CATEGORY_RULES[cat as IngredientCategory]
          const items = ingredientsByCategory[cat]
          if (items.length === 0) return null
          const count = categoryCounts[cat]
          const atCap = rule.max !== null && count >= rule.max
          const required = rule.min > 0
          return (
            <div key={cat} style={{ marginBottom: 18 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline',
                justifyContent: 'space-between', gap: 8, marginBottom: 8,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2C1810' }}>
                  {rule.label_he}
                  {required && <span style={{ color: '#FF6B35', marginInlineStart: 4 }}>*</span>}
                </div>
                {rule.max !== null && (
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                    background: atCap ? 'rgba(255,107,53,0.15)' : 'rgba(255,255,255,0.4)',
                    color: atCap ? '#FF6B35' : 'rgba(44,24,16,0.55)',
                  }}>
                    {count}/{rule.max}
                  </div>
                )}
                {rule.max === null && count > 0 && (
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.4)',
                    color: 'rgba(44,24,16,0.55)',
                  }}>
                    {count} נבחרו
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {items.map((ing) => {
                  const selected = selectedIngredientIds.has(ing.id)
                  const disabled = !selected && atCap && cat !== 'bread'
                  return (
                    <button
                      key={ing.id}
                      onClick={() => toggleIngredient(ing.id)}
                      disabled={disabled || isPending}
                      style={{
                        padding: '8px 14px', borderRadius: 30,
                        border: selected
                          ? '2px solid #FF6B35'
                          : '1px solid rgba(255,255,255,0.5)',
                        background: selected
                          ? 'linear-gradient(135deg, #FF6B35, #FFB347)'
                          : disabled
                            ? 'rgba(255,255,255,0.10)'
                            : 'rgba(255,255,255,0.35)',
                        color: selected ? '#fff' : disabled ? 'rgba(44,24,16,0.35)' : '#2C1810',
                        fontWeight: 600, fontSize: 13,
                        cursor: (disabled || isPending) ? 'not-allowed' : 'pointer',
                        transition: 'all 150ms ease-out',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {ing.name_he}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div style={{
          marginTop: 16, padding: 12, borderRadius: 14,
          background: previewNames.length > 0
            ? 'rgba(255,107,53,0.08)'
            : 'rgba(255,255,255,0.20)',
          border: '1px dashed rgba(255,107,53,0.25)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🥪</span>
          <div style={{
            fontSize: 13,
            color: previewNames.length > 0 ? '#2C1810' : 'rgba(44,24,16,0.45)',
            fontWeight: previewNames.length > 0 ? 600 : 400,
            lineHeight: 1.4,
          }}>
            {previewNames.length > 0 ? previewNames.join(' · ') : 'הכריך שלך יופיע כאן'}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            value={sandwichName}
            onChange={(e) => {
              setSandwichName(e.target.value)
              if (error) setError(null)
            }}
            maxLength={60}
            placeholder="שם הכריך"
            dir="rtl"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.45)',
              fontSize: 14, fontWeight: 500, color: '#2C1810',
              outline: 'none', backdropFilter: 'blur(8px)',
              textAlign: 'right',
            }}
          />
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: '12px 20px', borderRadius: 14, border: 'none',
              background: canSave
                ? 'linear-gradient(135deg, #FF6B35, #FFB347)'
                : 'rgba(255,107,53,0.30)',
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: canSave ? 'pointer' : 'not-allowed',
              transition: 'all 150ms ease-out',
              boxShadow: canSave ? '0 4px 14px rgba(255,107,53,0.30)' : 'none',
            }}
          >
            {isPending ? '...שומר' : (editingSandwichId ? 'עדכן כריך' : 'שמור כריך')}
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: 10, color: '#EF476F', fontSize: 13,
            padding: '8px 12px', background: 'rgba(239,71,111,0.08)',
            borderRadius: 10, border: '1px solid rgba(239,71,111,0.2)',
          }}>
            {error}
          </div>
        )}
        {success && !error && (
          <div style={{
            marginTop: 10, color: '#0E9F8A', fontSize: 13,
            padding: '8px 12px', background: 'rgba(14,159,138,0.10)',
            borderRadius: 10, border: '1px solid rgba(14,159,138,0.25)',
          }}>
            {success}
          </div>
        )}
      </GlassCard>
    </>
  )
}
