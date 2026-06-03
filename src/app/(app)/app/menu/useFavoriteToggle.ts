'use client'

import { type Dispatch, type SetStateAction, useState } from 'react'
import { toggleKidFavorite } from '../actions'
import type { KidFavorite } from '../types'

export type FavoriteTarget =
  | { menu_item_id: string }
  | { preset_id: string }

export interface UseFavoriteToggleResult {
  /** Per-target busy state. Key shape: `m:<menu_item_id>` or `p:<preset_id>`. */
  isPending: (target: FavoriteTarget) => boolean
  toggle: (target: FavoriteTarget) => Promise<void>
  error: string | null
  clearError: () => void
}

function targetKey(target: FavoriteTarget): string {
  return 'menu_item_id' in target ? `m:${target.menu_item_id}` : `p:${target.preset_id}`
}

function matchesTarget(f: KidFavorite, kidId: string, target: FavoriteTarget): boolean {
  if (f.kid_id !== kidId) return false
  if ('menu_item_id' in target) return f.menu_item_id === target.menu_item_id
  return f.preset_id === target.preset_id
}

/**
 * Optimistic toggle of a kid's favorite preset/menu_item. Inserts a placeholder
 * row immediately, calls the server action, then either swaps the placeholder
 * for the real row or rolls back on error. Survives concurrent edits to the
 * favorites list (uses functional setState).
 */
export function useFavoriteToggle(
  kidId: string | null,
  favorites: KidFavorite[],
  onFavoritesChange: Dispatch<SetStateAction<KidFavorite[]>>
): UseFavoriteToggleResult {
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  function isPending(target: FavoriteTarget): boolean {
    return pendingKeys.has(targetKey(target))
  }

  async function toggle(target: FavoriteTarget): Promise<void> {
    if (!kidId) return
    const key = targetKey(target)
    if (pendingKeys.has(key)) return

    const isFav = favorites.some((f) => matchesTarget(f, kidId, target))
    const desired = !isFav
    const optimisticId = `optimistic-${key}`

    setPendingKeys((prev) => new Set(prev).add(key))

    const removedRow = !desired ? favorites.find((f) => matchesTarget(f, kidId, target)) ?? null : null

    if (desired) {
      const optimisticRow: KidFavorite = {
        id: optimisticId,
        kid_id: kidId,
        menu_item_id: 'menu_item_id' in target ? target.menu_item_id : null,
        preset_id: 'preset_id' in target ? target.preset_id : null,
      }
      onFavoritesChange((prev) => [...prev, optimisticRow])
    } else {
      onFavoritesChange((prev) => prev.filter((f) => !matchesTarget(f, kidId, target)))
    }

    const result = await toggleKidFavorite(kidId, target as never, desired)

    setPendingKeys((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })

    if ('error' in result) {
      // Roll back the optimistic update without disturbing other concurrent edits.
      if (desired) {
        onFavoritesChange((prev) => prev.filter((f) => f.id !== optimisticId))
      } else if (removedRow) {
        onFavoritesChange((prev) => [...prev, removedRow])
      }
      setError(result.error)
      return
    }
    setError(null)

    if (desired && result.favorite) {
      const real = result.favorite
      onFavoritesChange((prev) => prev.map((f) => (f.id === optimisticId ? real : f)))
    }
  }

  return {
    isPending,
    toggle,
    error,
    clearError: () => setError(null),
  }
}
