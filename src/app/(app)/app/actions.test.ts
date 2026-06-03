/**
 * Server-action tests (`actions.ts`) — covers validation paths, auth-fail
 * branches, and core happy paths. The Supabase client is fully mocked via
 * `__test-utils__/supabaseMock.ts`. End-to-end persistence is NOT exercised
 * here — see TESTING.md for the integration-test gap.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authChainResponses, createSupabaseMock } from './__test-utils__/supabaseMock'

const supabaseRef: { current: ReturnType<typeof createSupabaseMock>['supabase'] | null } = { current: null }
const adminRef:    { current: ReturnType<typeof createSupabaseMock>['supabase'] | null } = { current: null }

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => supabaseRef.current!,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => Object.assign(adminRef.current ?? supabaseRef.current!, {
    auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
  }),
}))

import {
  addKid,
  createCustomSandwich,
  purchaseSubscription,
  removeKid,
  toggleAutoRenew,
  toggleKidFavorite,
  updateCustomSandwich,
  updateKid,
  updatePhone,
} from './actions'

beforeEach(() => {
  supabaseRef.current = null
  adminRef.current = null
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── updatePhone ──────────────────────────────────────────────────────────────

describe('updatePhone', () => {
  it.each([
    '0501234567',  // 9-digit prefix-5
    '0212345678',  // landline
    '052-1234567', // dashes allowed
    '052 1234567', // spaces allowed
    '037654321',   // 9 digits
  ])('accepts valid Israeli format %s', async (phone) => {
    const m = createSupabaseMock({
      responses: { ...authChainResponses(), 'profiles:update': { data: null, error: null } },
    })
    supabaseRef.current = m.supabase
    expect(await updatePhone(phone)).toEqual({ success: true })
  })

  it.each([
    '12345',        // too short
    '0123456',      // starts 01 (invalid prefix)
    '0500',         // too short overall
    'abc1234567',   // letters
    '+972501234567', // country code
  ])('rejects invalid format %s', async (phone) => {
    supabaseRef.current = createSupabaseMock().supabase
    const result = await updatePhone(phone)
    expect(result).toEqual({ error: expect.stringContaining('מספר טלפון לא תקין') })
  })

  it('rejects when not logged in', async () => {
    supabaseRef.current = createSupabaseMock({ authUser: null }).supabase
    expect(await updatePhone('0501234567')).toEqual({
      error: expect.stringContaining('לא מחובר'),
    })
  })

  it('returns error when DB update fails', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'profiles:update': { data: null, error: { message: 'denied' } },
      },
    }).supabase
    expect(await updatePhone('0501234567')).toEqual({
      error: expect.stringContaining('שגיאה בשמירת הטלפון'),
    })
  })
})

// ─── purchaseSubscription ────────────────────────────────────────────────────

describe('purchaseSubscription', () => {
  it('rejects empty plan id', async () => {
    supabaseRef.current = createSupabaseMock().supabase
    expect(await purchaseSubscription('')).toEqual({ error: expect.stringContaining('נדרש מזהה חבילה') })
  })

  it('rejects when plan not found', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'subscription_plans:select': { data: null, error: { message: 'not found' } },
      },
    }).supabase
    expect(await purchaseSubscription('plan-1')).toEqual({
      error: expect.stringContaining('חבילה לא נמצאה'),
    })
  })

  it('returns the new subscription on success', async () => {
    const newSub = {
      id: 'sub-1', meals_remaining: 5, starts_at: '2026-05-10T00:00:00Z',
      expires_at: null, auto_renew: false,
      subscription_plans: { id: 'plan-1', name_he: '5', meals_count: 5, price_agorot: 11000 },
    }
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'subscription_plans:select': { data: { id: 'plan-1', meals_count: 5 }, error: null },
        'subscriptions:insert': { data: newSub, error: null },
      },
    }).supabase

    expect(await purchaseSubscription('plan-1')).toEqual({ subscription: newSub })
  })

  it('rejects when not logged in', async () => {
    supabaseRef.current = createSupabaseMock({ authUser: null }).supabase
    expect(await purchaseSubscription('plan-1')).toEqual({
      error: expect.stringContaining('לא מחובר'),
    })
  })
})

// ─── toggleAutoRenew ─────────────────────────────────────────────────────────

describe('toggleAutoRenew', () => {
  it('rejects empty subscription id', async () => {
    supabaseRef.current = createSupabaseMock().supabase
    expect(await toggleAutoRenew('', true)).toEqual({ error: expect.stringContaining('נדרש מזהה מנוי') })
  })

  it('rejects when subscription not owned by user', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'subscriptions:select': { data: null, error: { message: 'no row' } },
      },
    }).supabase
    expect(await toggleAutoRenew('sub-1', true)).toEqual({
      error: expect.stringContaining('מנוי לא נמצא'),
    })
  })

  it('returns success when DB update succeeds', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'subscriptions:select': { data: { id: 'sub-1' }, error: null },
        'subscriptions:update': { data: null, error: null },
      },
    }).supabase
    expect(await toggleAutoRenew('sub-1', true)).toEqual({ success: true })
  })
})

// ─── addKid ──────────────────────────────────────────────────────────────────

describe('addKid', () => {
  const validInput = {
    name: 'דני',
    last_name: 'כהן',
    class_name: 'ב׳',
    phone: '0501234567',
    emoji_avatar: '🦁',
    school_id: 'school-1',
    dietary_tag_ids: ['t1'],
  }

  it('rejects when not logged in', async () => {
    supabaseRef.current = createSupabaseMock({ authUser: null }).supabase
    expect(await addKid(validInput)).toEqual({ error: expect.stringContaining('לא מחובר') })
  })

  it('returns the full kid on success', async () => {
    const fullKid = {
      id: 'kid-new', name: 'דני', last_name: 'כהן', class_name: 'ב׳',
      phone: '0501234567', emoji_avatar: '🦁', sort_order: 0, school_id: 'school-1',
      school: { id: 'school-1', name_he: 'בית ספר', address: 'רחוב' },
      kid_dietary_restrictions: [],
    }
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        // count call uses select with { count: 'exact', head: true } → counted as 'select' first then upgraded to 'count'.
        'kids:count': { data: null, error: null, count: 0 },
        'kids:insert': { data: { id: 'kid-new' }, error: null },
        'kid_dietary_restrictions:insert': { data: null, error: null },
        'kids:select': { data: fullKid, error: null },
      },
    }).supabase

    expect(await addKid(validInput)).toEqual({ kid: fullKid })
  })

  it('returns error when insert fails', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:count': { data: null, error: null, count: 0 },
        'kids:insert': { data: null, error: { message: 'unique violation' } },
      },
    }).supabase
    expect(await addKid(validInput)).toEqual({ error: expect.stringContaining('שגיאה בהוספת הילד') })
  })
})

// ─── updateKid ───────────────────────────────────────────────────────────────

describe('updateKid', () => {
  const input = {
    name: 'דני', last_name: null, class_name: null, phone: null,
    emoji_avatar: '🦁', school_id: null, dietary_tag_ids: [],
  }

  it('rejects when kid not found / not owned', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: null, error: { message: 'no row' } },
      },
    }).supabase
    expect(await updateKid('kid-1', input)).toEqual({ error: expect.stringContaining('ילד לא נמצא') })
  })

  it('returns success on happy path', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: { id: 'kid-1' }, error: null },
        'kids:update': { data: null, error: null },
        'kid_dietary_restrictions:delete': { data: null, error: null },
      },
    }).supabase
    expect(await updateKid('kid-1', input)).toEqual({ success: true })
  })
})

// ─── removeKid ───────────────────────────────────────────────────────────────

describe('removeKid', () => {
  it('soft-deletes the kid', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: { id: 'kid-1' }, error: null },
        'kids:update': { data: null, error: null },
      },
    }).supabase
    expect(await removeKid('kid-1')).toEqual({ success: true })
  })

  it('rejects when kid not owned', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: null, error: { message: 'no row' } },
      },
    }).supabase
    expect(await removeKid('kid-1')).toEqual({ error: expect.stringContaining('ילד לא נמצא') })
  })
})

// ─── createCustomSandwich ────────────────────────────────────────────────────

describe('createCustomSandwich', () => {
  beforeEach(() => {
    supabaseRef.current = createSupabaseMock().supabase
  })

  it('rejects empty name', async () => {
    expect(await createCustomSandwich('kid-1', '   ', ['ing-1'])).toEqual({
      error: expect.stringContaining('יש להזין שם לכריך'),
    })
  })

  it('rejects too-long name (>60 chars)', async () => {
    const long = 'a'.repeat(61)
    expect(await createCustomSandwich('kid-1', long, ['ing-1'])).toEqual({
      error: expect.stringContaining('שם הכריך ארוך מדי'),
    })
  })

  it('rejects non-array ingredients', async () => {
    expect(await createCustomSandwich('kid-1', 'X', null as never)).toEqual({
      error: expect.stringContaining('יש לבחור לפחות לחם אחד'),
    })
  })

  it('rejects empty ingredient list', async () => {
    expect(await createCustomSandwich('kid-1', 'X', [])).toEqual({
      error: expect.stringContaining('יש לבחור לפחות לחם אחד'),
    })
  })

  it('rejects duplicate ingredient ids', async () => {
    expect(await createCustomSandwich('kid-1', 'X', ['ing-1', 'ing-1'])).toEqual({
      error: expect.stringContaining('מרכיב נבחר יותר מפעם אחת'),
    })
  })

  it('rejects when not logged in', async () => {
    supabaseRef.current = createSupabaseMock({ authUser: null }).supabase
    expect(await createCustomSandwich('kid-1', 'X', ['ing-1'])).toEqual({
      error: expect.stringContaining('לא מחובר'),
    })
  })

  it('rejects when no bread is selected', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: { id: 'kid-1' }, error: null },
        // ingredient_options.select returns rows with categories — only fillings, no bread.
        'ingredient_options:select': {
          data: [
            { id: 'ing-1', category: 'filling' },
            { id: 'ing-2', category: 'filling' },
          ],
          error: null,
        },
      },
    }).supabase
    expect(await createCustomSandwich('kid-1', 'X', ['ing-1', 'ing-2'])).toEqual({
      error: expect.stringContaining('יש לבחור לחם אחד'),
    })
  })

  it('rejects when too many fillings (>2)', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: { id: 'kid-1' }, error: null },
        'ingredient_options:select': {
          data: [
            { id: 'b1', category: 'bread' },
            { id: 'f1', category: 'filling' },
            { id: 'f2', category: 'filling' },
            { id: 'f3', category: 'filling' },
          ],
          error: null,
        },
      },
    }).supabase
    expect(await createCustomSandwich('kid-1', 'X', ['b1', 'f1', 'f2', 'f3'])).toEqual({
      error: expect.stringContaining('יש לבחור לפחות מילוי אחד'),
    })
  })
})

// ─── updateCustomSandwich ────────────────────────────────────────────────────

describe('updateCustomSandwich', () => {
  it('rejects when sandwich is not owned by the user', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses('profile-1'),
        'kid_custom_sandwiches:select': {
          data: { id: 'sw-1', kid_id: 'kid-1', kids: { profile_id: 'someone-else', deleted_at: null } },
          error: null,
        },
      },
    }).supabase
    expect(await updateCustomSandwich('sw-1', 'New', ['ing-1'])).toEqual({
      error: expect.stringContaining('כריך לא נמצא'),
    })
  })

  it('rejects when sandwich not found', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kid_custom_sandwiches:select': { data: null, error: { message: 'no row' } },
      },
    }).supabase
    expect(await updateCustomSandwich('sw-1', 'New', ['ing-1'])).toEqual({
      error: expect.stringContaining('כריך לא נמצא'),
    })
  })

  it('shares the same name validation as create', async () => {
    supabaseRef.current = createSupabaseMock().supabase
    expect(await updateCustomSandwich('sw-1', '', ['ing-1'])).toEqual({
      error: expect.stringContaining('יש להזין שם'),
    })
  })
})

// ─── toggleKidFavorite ───────────────────────────────────────────────────────

describe('toggleKidFavorite', () => {
  it('rejects ambiguous target (both ids set)', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: { id: 'kid-1' }, error: null },
      },
    }).supabase
    expect(
      await toggleKidFavorite('kid-1', { menu_item_id: 'm1', preset_id: 'p1' } as never, true)
    ).toEqual({ error: expect.stringContaining('בחירה לא תקינה') })
  })

  it('rejects empty target', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: { id: 'kid-1' }, error: null },
      },
    }).supabase
    expect(await toggleKidFavorite('kid-1', {} as never, true)).toEqual({
      error: expect.stringContaining('בחירה לא תקינה'),
    })
  })

  it('rejects when kid not owned', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: null, error: null },
      },
    }).supabase
    expect(await toggleKidFavorite('kid-1', { menu_item_id: 'm1' }, true)).toEqual({
      error: expect.stringContaining('ילד לא נמצא'),
    })
  })

  it('returns favorite=null on successful unfavorite', async () => {
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: { id: 'kid-1' }, error: null },
        'kid_favorite_meals:delete': { data: null, error: null },
      },
    }).supabase
    expect(await toggleKidFavorite('kid-1', { menu_item_id: 'm1' }, false)).toEqual({
      favorite: null,
    })
  })

  it('returns the inserted row on successful favorite', async () => {
    const row = { id: 'fav-1', kid_id: 'kid-1', menu_item_id: 'm1', preset_id: null }
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: { id: 'kid-1' }, error: null },
        'kid_favorite_meals:insert': { data: row, error: null },
      },
    }).supabase
    expect(await toggleKidFavorite('kid-1', { menu_item_id: 'm1' }, true)).toEqual({
      favorite: row,
    })
  })

  it('handles concurrent insert (23505) by returning the existing row', async () => {
    const existing = { id: 'fav-1', kid_id: 'kid-1', menu_item_id: 'm1', preset_id: null }
    let calls = 0
    supabaseRef.current = createSupabaseMock({
      responses: {
        ...authChainResponses(),
        'kids:select': { data: { id: 'kid-1' }, error: null },
        'kid_favorite_meals:insert': () => {
          // The insert returns a 23505 error; the code then re-fetches via select.
          return { data: null, error: { message: 'duplicate', code: '23505' } }
        },
        'kid_favorite_meals:select': () => {
          calls++
          return { data: existing, error: null }
        },
      },
    }).supabase
    expect(await toggleKidFavorite('kid-1', { menu_item_id: 'm1' }, true)).toEqual({
      favorite: existing,
    })
    expect(calls).toBe(1)
  })
})
