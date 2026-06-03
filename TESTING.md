# Testing Guide

This document explains how the Tenmeal test suite is structured, what it covers, and what is intentionally left to integration testing. Pair this with [OVERVIEW.md](OVERVIEW.md) for the broader project context.

---

## Running tests

```bash
npm test              # one-shot run (CI mode)
npm run test:watch    # watch mode (re-runs on file change)
npm run test:coverage # with V8 coverage report (HTML in coverage/)
```

The suite uses [Vitest](https://vitest.dev/) + [@testing-library/react](https://testing-library.com/) running in jsdom. Configuration lives in [vitest.config.ts](vitest.config.ts); test setup (jest-dom matchers, RTL cleanup) is in [vitest.setup.ts](vitest.setup.ts).

Tests live next to source files using the `.test.ts` / `.test.tsx` suffix.

---

## What the suite covers (179 tests in 12 files)

### 1. Pure-logic units — fast, no React, no mocks

Highest ROI. These verify the code that's easiest to silently break.

| File | Covers |
|------|--------|
| `dietary.test.ts` | `getKidRequiredSlugs` (slug lookup, missing-tag defense), `isCustomSandwichCompatible` (slug intersection, retired-ingredient handling), `isMenuItemCompatible`, `isPresetCompatible` |
| `lib/week.test.ts` | `toDateKey` (zero-padding, local-time), `getWeekStart` (offset math, Sun anchoring), `getOrderableDates` (Sun→Fri, length 6), `formatWeekRange` (single-month + month-crossing), `formatExpandedLabel` |
| `data/mappers.test.ts` | All row → view-type transforms: `mapMenuItemWithTags`, `mapIngredientOption`, `mapCustomSandwich`, `mapSandwichPreset` (incl. the dietary slug *intersection* across bread + fillings + vegetables), `buildSlugById`, `buildTagsByIngredient` |
| `orders/dayPlan.test.ts` | `emptyPlan`, `mainKeyFromOrder` (every kind discriminator + ordering), `mainSelectionFromKey` (resolution + null branches), `getWeekLabel` |

### 2. Component tests — React Testing Library + jsdom

Verify presentation logic and event wiring. Components are tested in isolation; their data and callbacks are passed in as props.

| File | Covers |
|------|--------|
| `ui/GlassCard.test.tsx` | Default + override padding/radius, style-prop precedence, click + className passthrough |
| `orders/DayCell.test.tsx` | All 8 visual states (empty/filled/saving/error/today/past/quota-full/with-note), click gating across read-only / saving / no-picker / quota-full / planned-day-with-quota-full, error-pill propagation stop |
| `orders/MealPickerSheet.test.tsx` | Rendered entries, selection callback, quota warnings, cancel-button visibility, notes typing, active-entry highlight |
| `orders/WeekCard.test.tsx` | Day-cell delegation, week label + range, planned counter, toolbar visibility (read-only / current vs other / future-planned), bulk-action handler wiring, error banner, no-subscription footer, past-week collapse/expand |
| `account/KidForm.test.tsx` | Add vs edit mode prefill, KidInput payload shape (incl. null-coalesced empties), emoji change, dietary tag toggle on/off, error display, pending state disabling, cancel |

### 3. Hook tests — React Testing Library `renderHook`

Custom hooks tested through their public API.

| File | Covers |
|------|--------|
| `menu/useFavoriteToggle.test.tsx` | Optimistic add (insert + swap to real row), optimistic remove, error rollback for both directions, `isPending` per-target gating, no-op when kidId is null, preset target routing |
| `orders/useWeekOps.test.tsx` | `fillWeekFromPrev` happy path + nothing-to-copy + insufficient-meals + already-planned-skip, `clearWeek` happy path + no-future-planned + past-day-skip, `copyToNextWeek` happy path + nothing-to-copy + insufficient-meals, undo for every operation |

### 4. Server-action seam tests — Supabase fully mocked

`actions.ts` is exercised via a custom Supabase fluent stub at [`__test-utils__/supabaseMock.ts`](src/app/(app)/app/__test-utils__/supabaseMock.ts). The stub keys responses by `<table>:<op>` and returns whatever the test specifies. `auth.getUser()` is also mockable.

| File | Covers |
|------|--------|
| `actions.test.ts` | **`updatePhone`**: 5 valid + 5 invalid Israeli formats, auth-fail, DB-error. **`purchaseSubscription`**: empty plan, plan-not-found, success, auth-fail. **`toggleAutoRenew`**: empty id, ownership check, success. **`addKid`**: auth-fail, success, insert error. **`updateKid`** + **`removeKid`**: ownership check + success. **`createCustomSandwich`**: name validation (empty, too long, non-array, empty list, dupes), auth-fail, no-bread rule, too-many-fillings rule. **`updateCustomSandwich`**: ownership check + name validation. **`toggleKidFavorite`**: ambiguous/empty target rejection, ownership check, unfavorite, favorite, concurrent-insert (PG error code `23505`) recovery. |

---

## What is NOT covered (and why)

### `saveDayOrder` (the big one)

The single most important server action — orchestrates kid lookup, existing-order detection, FIFO meal debit/refund, ingredient resolution, sandwich preset/custom snapshotting, and 3-slot order_items management. It's intentionally NOT covered here because:

- It calls 8+ chained Supabase operations across 5+ tables.
- The branches that matter (date-in-the-past, no-side-fruit-available, sandwich-preset-not-found, custom-sandwich-not-owned, FIFO meal exhaustion, item-insert rollback) all interact with multi-step DB state — you'd be testing the mock, not the code.
- The right place for this test is **integration** (real Supabase test branch + RLS + actual order_items table).

If you add a Supabase test branch, the recommended approach is a `tests/integration/saveDayOrder.spec.ts` that:
1. Provisions a profile + 1 kid + 1 active subscription with N meals.
2. Calls `saveDayOrder` with each variant (cancel, create, update).
3. Asserts the DB state via direct queries.

### `loadDashboard` and the `data/queries.ts` wrappers

Same reason: they're thin Supabase pipelines. The mappers they call are unit-tested; the queries themselves only matter under a real DB.

### Onboarding (`src/app/(app)/onboard/`)

The onboarding form is a 5-step wizard with its own validation. It was out of scope for the recent refactor and isn't covered by tests yet. A future test pass should mirror the `KidForm.test.tsx` structure for each step, and a happy-path test for `completeOnboarding` using the same Supabase mock.

### Marketing site (`src/components/Hero.tsx` etc.)

Static presentational components — low regression risk, low test value.

### End-to-end (E2E)

Not set up. A Playwright suite would be appropriate for a smoke pass against a deployed preview environment, especially for: Google OAuth, the onboarding redirect, the cross-tab state sync (subscription change → orders panel quota update).

---

## How to add a test

1. Create `<source>.test.ts` (or `.tsx` for React) next to the file you're testing.
2. For pure functions: import + assert. No mocks needed.
3. For React components: `import { render, screen } from '@testing-library/react'` plus `userEvent` for interactions.
4. For hooks: `import { renderHook, act } from '@testing-library/react'`.
5. For anything that calls a server action: mock the action import via `vi.mock('../actions', () => ({ ... }))`. **Don't try to test the action's internals from the component test** — test the action's seam separately.
6. For server actions themselves: use `createSupabaseMock` from [`__test-utils__/supabaseMock.ts`](src/app/(app)/app/__test-utils__/supabaseMock.ts). Set `responses['<table>:<op>']` for every Supabase call the action makes.

### When NOT to add a test

- Trivial render-only components (no logic).
- One-line wrapper functions.
- Anything where the test would just re-encode the implementation. If the test wouldn't catch a real bug, skip it.

---

## Test isolation rules

- Every test file is independent — no shared mutable state across `describe` blocks.
- The auto-cleanup in `vitest.setup.ts` unmounts components between tests (`afterEach(cleanup)`).
- Fake timers are scoped to the `describe` that needs them; restore in `afterEach`.
- Module mocks declared at the top of a test file affect the whole file. If two files in the same suite need conflicting mocks for the same module, split them.

---

## CI integration

The `npm test` script runs in non-watch mode and exits with a non-zero code on any failure — wire it into your pipeline directly. Coverage thresholds aren't enforced yet; if you want them, add a `coverage.thresholds` block to [vitest.config.ts](vitest.config.ts).
