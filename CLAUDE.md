# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tenmeal** is a Breakfast Ordering App targeting parents (primary: speed-focused) and kids (secondary: delight-focused). Core philosophy: **"Speed for parents, delight for kids."**

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS, Supabase backend, intended for GitHub Pages static export.

**Status:** Early development — schema changes, architectural pivots, and major refactors are expected and welcome. Don't be conservative: if a better approach exists, propose it.

**Language:** Hebrew (RTL layout required). All UI text is in Hebrew.

## Development Commands

```bash
npm run dev     # Start dev server at localhost:3000
npm run build   # Build for production (outputs to .next/, or out/ when exporting)
npm run start   # Start production server
```

No lint or test scripts are configured. TypeScript is checked on build.

## Code Architecture

```
src/
├── app/
│   ├── (app)/          # Protected route group (requires auth)
│   │   ├── onboard/    # Onboarding (OnboardForm.tsx + Server Actions in actions.ts)
│   │   └── user/       # User dashboard — panel-based tabs:
│   │                   #   ProfileView, AccountPanel, MenuPanel,
│   │                   #   OrdersPanel, SubscriptionPanel
│   ├── api/contact/    # Contact form API route (Resend email)
│   ├── auth/callback/  # Google OAuth callback handler
│   └── login/          # Login page (triggers Google OAuth)
├── components/         # Shared UI (Hero, Navbar, Plans, Contact, …)
└── lib/
    ├── supabase/
    │   ├── client.ts   # Browser client — use in Client Components only
    │   └── server.ts   # Server client — use in Server Components, Route Handlers, Server Actions
    └── constants.ts    # Subscription plans, contact email, WhatsApp number
```

**Supabase client rule:** never import `client.ts` from server code or `server.ts` from client code. Server Actions and Route Handlers must use `server.ts` so session cookies propagate.

**Routing & Auth Flow:**
1. `middleware.ts` refreshes Supabase sessions on every request and guards `/user/*` and `/onboard/*`. Unauthenticated visitors to those paths get redirected to `/login`; authenticated visitors to `/login` get redirected to `/user`.
2. Google OAuth: `/login` calls `supabase.auth.signInWithOAuth({ provider: 'google' })`.
3. `/auth/callback` ([src/app/auth/callback/route.ts](src/app/auth/callback/route.ts)) exchanges the code for a session, then looks up `auth_identities → profiles`. If the identity row is missing OR `profiles.onboarding_done` is false, it redirects to `/onboard`; otherwise to `/user` (or `?next=` if provided and safe).

**Static Export:** The app is intended for GitHub Pages. [next.config.js](next.config.js) is **missing `output: 'export'`** — add it (and handle the Route Handlers / middleware accordingly) before deploying, since static export disallows server-only features.

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
RESEND_API_KEY
```

## Backend & Auth

- **Backend:** Supabase (Postgres, Auth, Storage)
- **Auth portability pattern:** business tables link to an `auth_identities` bridge table, never directly to `auth.users`. The SQL function `auth.profile_id()` wraps the lookup; RLS policies call it rather than `auth.uid()` so the auth provider can be swapped without rewriting policies.
- Migrations live in [supabase/migrations/](supabase/migrations/). Always add new schema changes as a new migration — do not edit past ones.

## Specialized Agents

Delegate to these rather than doing the work inline:

- **`supabase-db`** — all DB work: migrations, schema design, RLS policies, complex SQL. Has persistent memory with the full schema at `.claude/agent-memory/supabase-db/`.
- **`bento-glassmorphic-ui-designer`** — all UI/UX design: screen specs, design tokens, layout blueprints, component reviews against the Bento Grid + Glassmorphic system. Has persistent memory at `.claude/agent-memory/bento-glassmorphic-ui-designer/` — the full design-system reference (color hex codes, glass CSS, blur levels, Bento card archetypes, type scale, animation curves) lives there.

## Design System (summary — full spec in the design agent's memory)

- **Philosophy:** parent-primary screens ≤3 taps to any core action; kid delight accents sparingly and never on navigation.
- **Brand palette:** Sunrise Orange `#FF6B35`, Warm Amber `#FFB347`, Creamy White `#FFF8F0`, Deep Espresso `#2C1810`.
- **Glass surfaces:** `rgba(255,255,255,0.18)` base, `blur(12px) saturate(180%)`, 16px radius.
- **Bento grid:** 4 (mobile) / 8 (tablet) / 12 (desktop) cols, 16pt gap. One dominant hero card per screen; maintain asymmetry.
- **Spacing:** 8pt scale (4pt allowed as half-unit).
- **Accessibility:** WCAG 2.1 AA — 4.5:1 body / 3:1 large-text contrast, 44×44pt touch targets.

Delegate anything beyond this summary to the design agent.
