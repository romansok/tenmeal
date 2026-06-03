import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { KidFavorite } from '../types'

// Mock the server action import.
const toggleKidFavorite = vi.fn()
vi.mock('../actions', () => ({
  toggleKidFavorite: (...args: unknown[]) => toggleKidFavorite(...args),
}))

// Import AFTER mocking.
import { useFavoriteToggle } from './useFavoriteToggle'

const KID = 'kid-1'

function buildHarness(initialFavorites: KidFavorite[] = []) {
  let favorites = initialFavorites
  const onChange = vi.fn((updater: KidFavorite[] | ((prev: KidFavorite[]) => KidFavorite[])) => {
    favorites = typeof updater === 'function' ? updater(favorites) : updater
  })
  return {
    getFavorites: () => favorites,
    onChange,
    rerender: (hookResult: { rerender: (props?: unknown) => void }) => {
      hookResult.rerender({ kidId: KID, favorites, onChange })
    },
  }
}

beforeEach(() => {
  toggleKidFavorite.mockReset()
})

describe('useFavoriteToggle', () => {
  it('isPending is false initially', () => {
    const h = buildHarness()
    const { result } = renderHook(() => useFavoriteToggle(KID, h.getFavorites(), h.onChange))
    expect(result.current.isPending({ menu_item_id: 'mi-1' })).toBe(false)
    expect(result.current.error).toBeNull()
  })

  describe('add (favorite)', () => {
    it('inserts an optimistic row, then swaps to the real row on success', async () => {
      toggleKidFavorite.mockResolvedValueOnce({
        favorite: { id: 'real-1', kid_id: KID, menu_item_id: 'mi-1', preset_id: null },
      })

      const h = buildHarness()
      const { result, rerender } = renderHook(
        ({ favorites }) => useFavoriteToggle(KID, favorites, h.onChange),
        { initialProps: { favorites: h.getFavorites() } }
      )

      await act(async () => {
        await result.current.toggle({ menu_item_id: 'mi-1' })
      })

      // After toggle resolved: optimistic insert + then swap to real
      const calls = h.onChange.mock.calls
      expect(calls.length).toBeGreaterThanOrEqual(2)
      expect(toggleKidFavorite).toHaveBeenCalledWith(KID, { menu_item_id: 'mi-1' }, true)
      expect(h.getFavorites()).toEqual([
        { id: 'real-1', kid_id: KID, menu_item_id: 'mi-1', preset_id: null },
      ])

      // Expose final state to the hook so isPending re-evaluates correctly.
      rerender({ favorites: h.getFavorites() })
      expect(result.current.error).toBeNull()
    })

    it('rolls back the optimistic insert on server error', async () => {
      toggleKidFavorite.mockResolvedValueOnce({ error: 'server died' })

      const h = buildHarness()
      const { result } = renderHook(() => useFavoriteToggle(KID, h.getFavorites(), h.onChange))

      await act(async () => {
        await result.current.toggle({ menu_item_id: 'mi-1' })
      })

      expect(h.getFavorites()).toEqual([]) // back to empty
      expect(result.current.error).toBe('server died')
    })

    it('treats existing favorite as desired=false (toggling off)', async () => {
      toggleKidFavorite.mockResolvedValueOnce({ favorite: null })

      const existing: KidFavorite = {
        id: 'real-1', kid_id: KID, menu_item_id: 'mi-1', preset_id: null,
      }
      const h = buildHarness([existing])
      const { result } = renderHook(() => useFavoriteToggle(KID, h.getFavorites(), h.onChange))

      await act(async () => {
        await result.current.toggle({ menu_item_id: 'mi-1' })
      })

      expect(toggleKidFavorite).toHaveBeenCalledWith(KID, { menu_item_id: 'mi-1' }, false)
      expect(h.getFavorites()).toEqual([])
    })

    it('rolls back a failed delete by re-inserting the removed row', async () => {
      toggleKidFavorite.mockResolvedValueOnce({ error: 'delete failed' })

      const existing: KidFavorite = {
        id: 'real-1', kid_id: KID, menu_item_id: 'mi-1', preset_id: null,
      }
      const h = buildHarness([existing])
      const { result } = renderHook(() => useFavoriteToggle(KID, h.getFavorites(), h.onChange))

      await act(async () => {
        await result.current.toggle({ menu_item_id: 'mi-1' })
      })

      expect(h.getFavorites()).toEqual([existing]) // restored
      expect(result.current.error).toBe('delete failed')
    })
  })

  describe('isPending', () => {
    it('is true while a toggle is in flight', async () => {
      let resolve: (v: { favorite: KidFavorite | null }) => void = () => {}
      toggleKidFavorite.mockReturnValueOnce(new Promise((r) => { resolve = r }))

      const h = buildHarness()
      const { result } = renderHook(() => useFavoriteToggle(KID, h.getFavorites(), h.onChange))

      let togglePromise: Promise<void>
      act(() => {
        togglePromise = result.current.toggle({ menu_item_id: 'mi-1' })
      })

      await waitFor(() => {
        expect(result.current.isPending({ menu_item_id: 'mi-1' })).toBe(true)
      })

      await act(async () => {
        resolve({ favorite: { id: 'r', kid_id: KID, menu_item_id: 'mi-1', preset_id: null } })
        await togglePromise!
      })

      expect(result.current.isPending({ menu_item_id: 'mi-1' })).toBe(false)
    })

    it('blocks a second toggle on the same target after a re-render shows isPending=true', async () => {
      let resolve: (v: { favorite: KidFavorite | null }) => void = () => {}
      toggleKidFavorite.mockReturnValueOnce(new Promise((r) => { resolve = r }))

      const h = buildHarness()
      const { result } = renderHook(() => useFavoriteToggle(KID, h.getFavorites(), h.onChange))

      let firstPromise: Promise<void>
      act(() => {
        firstPromise = result.current.toggle({ menu_item_id: 'mi-1' })
      })

      // After the act() above, React has flushed a re-render and isPending should be true.
      await waitFor(() => {
        expect(result.current.isPending({ menu_item_id: 'mi-1' })).toBe(true)
      })

      // A second toggle attempted now should bail out via the pendingKeys.has(key) guard.
      await act(async () => {
        await result.current.toggle({ menu_item_id: 'mi-1' })
      })
      expect(toggleKidFavorite).toHaveBeenCalledTimes(1)

      await act(async () => {
        resolve({ favorite: { id: 'r', kid_id: KID, menu_item_id: 'mi-1', preset_id: null } })
        await firstPromise!
      })
    })
  })

  describe('clearError', () => {
    it('clears the error', async () => {
      toggleKidFavorite.mockResolvedValueOnce({ error: 'oops' })

      const h = buildHarness()
      const { result } = renderHook(() => useFavoriteToggle(KID, h.getFavorites(), h.onChange))

      await act(async () => {
        await result.current.toggle({ menu_item_id: 'mi-1' })
      })
      expect(result.current.error).toBe('oops')

      act(() => result.current.clearError())
      expect(result.current.error).toBeNull()
    })
  })

  describe('null kid', () => {
    it('does nothing when kidId is null', async () => {
      const h = buildHarness()
      const { result } = renderHook(() => useFavoriteToggle(null, h.getFavorites(), h.onChange))

      await act(async () => {
        await result.current.toggle({ menu_item_id: 'mi-1' })
      })
      expect(toggleKidFavorite).not.toHaveBeenCalled()
      expect(h.getFavorites()).toEqual([])
    })
  })

  describe('preset target', () => {
    it('routes preset toggles correctly', async () => {
      toggleKidFavorite.mockResolvedValueOnce({
        favorite: { id: 'real-2', kid_id: KID, menu_item_id: null, preset_id: 'p-1' },
      })

      const h = buildHarness()
      const { result } = renderHook(() => useFavoriteToggle(KID, h.getFavorites(), h.onChange))

      await act(async () => {
        await result.current.toggle({ preset_id: 'p-1' })
      })

      expect(toggleKidFavorite).toHaveBeenCalledWith(KID, { preset_id: 'p-1' }, true)
      expect(h.getFavorites()).toEqual([
        { id: 'real-2', kid_id: KID, menu_item_id: null, preset_id: 'p-1' },
      ])
    })
  })
})
