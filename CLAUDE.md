# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tenmeal** is a Breakfast Ordering App targeting parents (primary: speed-focused) and kids (secondary: delight-focused). The core design philosophy is **"Speed for parents, delight for kids."**

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS, Supabase backend, deployed to GitHub Pages as a static export.

**Status:** Early development — the project is actively evolving. DB schema changes, architectural pivots, and major refactors are expected and welcome. Don't be conservative: if a better approach exists, propose it.

**Language:** Hebrew (RTL layout required). All UI text, labels, and content are in Hebrew.

## Development Commands

```bash
npm run dev     # Start dev server at localhost:3000
npm run build   # Build for production (outputs to out/)
npm run start   # Start production server
```

No lint or test scripts are configured. TypeScript is checked on build.

## Code Architecture

```
src/
├── app/
│   ├── (app)/          # Protected route group (requires auth)
│   │   ├── onboard/    # Onboarding flow (Server Actions in actions.ts)
│   │   └── user/       # User dashboard (profile, orders, subscription, kids)
│   ├── api/contact/    # Contact form API route (Resend email)
│   ├── auth/callback/  # Google OAuth callback handler
│   └── login/          # Login page (triggers Google OAuth)
├── components/         # Shared UI components (Hero, Navbar, Plans, Contact)
└── lib/
    ├── supabase/
    │   ├── client.ts   # Browser Supabase client (createBrowserClient)
    │   └── server.ts   # Server Supabase client (createServerClient with cookies)
    └── constants.ts    # Subscription plans, contact email, WhatsApp number
```

**Routing & Auth Flow:** `middleware.ts` (root) refreshes Supabase sessions on every request and guards `/dashboard` and `/onboard` routes. After Google OAuth, `/auth/callback` exchanges the code for a session, then redirects to `/onboard` or `/user`.

**Static Export:** `next.config.js` is configured for static export (`output: 'export'`). GitHub Actions builds and deploys the `out/` directory to GitHub Pages.

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
RESEND_API_KEY
```

## Backend & Auth

- **Backend:** Supabase (database, storage, realtime, edge functions)
- **Authentication:** Google OAuth via Supabase Auth (`supabase.auth.signInWithOAuth({ provider: 'google' })`)
- Use Supabase RLS (Row Level Security) policies to restrict data access per user
- Store user profiles in a `profiles` table linked to `auth_identities` (never directly to `auth.users`) — see auth portability pattern in the Database Agent section

## Database Agent

Use the `supabase-db` agent for all database work. Invoke it for:
- Writing or reviewing SQL migrations
- Designing schema changes (new tables, columns, indexes)
- Authoring RLS policies using the `auth.profile_id()` pattern
- Writing complex SQL queries
- Any decision touching the auth portability pattern

The agent has persistent memory at `.claude/agent-memory/supabase-db/` and knows the full schema.

## Design Agent

Use the `bento-glassmorphic-ui-designer` agent for all UI/UX design work. Invoke it for:
- Designing or specifying screens and components
- Generating design tokens (colors, spacing, typography)
- Reviewing implemented components against the design system
- Layout blueprints using the Bento Grid system

The agent has persistent memory at `.claude/agent-memory/bento-glassmorphic-ui-designer/` to maintain consistency across sessions.

## Design System Reference

### Core Design Philosophy
- Parent-primary screens: ≤3 taps for any core action
- Kid-facing elements: use delight accents sparingly, never on navigation
- All spacing must be multiples of 8pt (4pt allowed as half-unit exception)

### Color Palette
**Brand:** Sunrise Orange `#FF6B35`, Warm Amber `#FFB347`, Creamy White `#FFF8F0`, Deep Espresso `#2C1810`

**Glass Surfaces:** Base `rgba(255,255,255,0.18)`, Border `rgba(255,255,255,0.35)`, Shadow `rgba(31,38,135,0.12)`

**Semantic:** Success `#4CAF82`, Warning `#FFD166`, Error `#EF476F`, Info `#118AB2`

**Kid Accents (child-facing only):** Bubblegum Pink `#FF85A1`, Sky Blue `#74C7EC`, Lime Pop `#A8E063`, Sunny Yellow `#FFE66D`

### Glassmorphic CSS Pattern
```css
background: rgba(255, 255, 255, 0.18);
backdrop-filter: blur(12px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.35);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(31, 38, 135, 0.12);
```
Glass blur levels: L1=8px, L2=12px, L3=20px, L4=24px (max on mobile)

### Bento Grid
- Columns: 4 (mobile) / 8 (tablet) / 12 (desktop), gap: 16pt
- Card archetypes: 1×1 micro, 2×1 horizontal, 1×2 vertical, 2×2 feature, 4×1 full-width, 2×3 tall
- Every screen must have one dominant hero card; maintain asymmetry

### Typography
- Display: SF Pro Rounded Bold / Nunito ExtraBold, 32–48px
- H1: 24px SemiBold, H2: 20px SemiBold, Body: 14px Regular (line-height 1.5), CTA: 16px Bold

### Animation
- Entry: 300ms, Micro-interactions: 150ms, Page transitions: 400ms ease-in-out
- Kid elements: `cubic-bezier(0.34, 1.56, 0.64, 1)` (bouncy); Parent flows: `ease-out`

### Accessibility
WCAG 2.1 AA minimum: 4.5:1 contrast for body text, 3:1 for large text, 44×44pt touch targets

## Key Screens
1. Splash / Onboarding
2. Parent Dashboard (Home)
3. Meal Browser
4. Quick Order Flow
5. Customization Sheet
6. Order Tracker
7. Favorites / Saved Orders
8. Profile & Preferences
