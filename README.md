# Tenmeal

Tenmeal is a **breakfast ordering app** for families. The core idea is **"speed for parents, delight for kids"**: parents can set up and manage breakfast orders in just a few taps, while kids enjoy a playful, delightful experience around their meals.

> **Note:** The app UI itself is in Hebrew (RTL). This README is in English for developers and collaborators.

## Tech & Architecture

- **Frontend:** React / Next.js (TypeScript, components under `src/`)
- **Backend & Database:** [Supabase](https://supabase.com/)
- **Auth:** Google OAuth via Supabase Auth
- **Design system:** Bento-style layout + glassmorphism, tailored for mobile-first usage

## Key Concepts

- **Parent-first flows:** Any core parent action (ordering, editing, or re-ordering a meal) should take **≤ 3 taps** from the main dashboard.
- **Kid delight, not distraction:** Kid-facing visuals and micro-interactions should be fun but must never slow down navigation or block important actions.
- **Hebrew / RTL by default:** All content and layout are RTL, including typography, spacing, and alignment.

## Getting Started (local development)

1. **Install dependencies**

   ```bash
   npm install
   # or
   pnpm install
   # or
   yarn install
   ```

2. **Run the dev server**

   ```bash
   npm run dev
   ```

3. Open the app in your browser (usually `http://localhost:3000`).

## Supabase Setup (high level)

These are high-level guidelines; adapt them to your actual setup:

- Create a new project in Supabase.
- Enable **Google** as an OAuth provider.
- Use `supabase.auth.signInWithOAuth({ provider: 'google' })` on the client to start login.
- Store user profiles in a `profiles` table, linked to `auth.users` via `auth.uid()` or trigger.
- Use **RLS policies** so each user can only access their own data.

## Design Principles

- **Grid:** 4-column Bento grid on mobile, 8/12 on larger breakpoints.
- **Glassmorphism:** Semi-transparent cards with blur and soft shadows for key surfaces.
- **Spacing:** 8pt scale (with 4pt allowed as a half step).
- **Accessibility:** Aim for WCAG 2.1 AA contrast and 44×44pt minimum touch targets.

## Project Status

This project is currently in the **design/specification** phase. The codebase and architecture may evolve rapidly. If you are adding or changing behavior, please:

- Keep README sections up to date.
- Prefer small, focused PRs.
- Document any new environment variables or setup steps.

## License

Currently unlicensed (private/internal). Do not distribute without permission.

