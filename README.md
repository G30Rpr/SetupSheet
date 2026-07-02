# SimSetups

A free, community-driven sim racing setups site. Built with Next.js 15 (App
Router), TypeScript, Tailwind CSS v4, and shadcn/ui-style components on a
dark, sim-racing themed UI (carbon black, racing green, alert red).

## Pages

- `/` — Landing page: hero, stats, featured setups, call-to-action.
- `/setups` — Browse page with a Game / Car / Track / Condition filter bar and
  a responsive grid of setup cards.
- `/upload` — Drag-and-drop upload form for sharing a setup with the
  community.

## Project structure

```
src/
  app/
    layout.tsx        Root layout (header + footer + fonts + metadata)
    page.tsx           Landing page
    globals.css        Tailwind v4 theme (CSS variables, dark theme)
    setups/page.tsx     Browse setups page
    upload/page.tsx      Upload setup page
  components/
    ui/                 shadcn/ui-style primitives (button, card, select, ...)
    site-header.tsx     Top nav with mobile drawer (Sheet)
    site-footer.tsx     Footer
    setup-card.tsx      The setup card (car/track, lap time, tags, ratings...)
    setups-browser.tsx  Client component: filter state + filtered grid
    upload-form.tsx      Upload form with validation + simulated submit
    file-dropzone.tsx    Drag-and-drop / tap-to-choose file input
    star-rating.tsx      Pace / Predictability star rating display
    tag-badge.tsx         Setup tag → Badge color mapping
  lib/
    types.ts             Setup / Game / Condition / SetupTag types
    data.ts               Mock setup data + filter helpers
    utils.ts              `cn()` class-merging helper
    supabase/
      client.ts           Browser Supabase client (Client Components)
      server.ts            Server Supabase client (Server Components/Actions/Route Handlers)
      middleware.ts         Session-refresh helper used by src/middleware.ts
  middleware.ts            Runs on every request, keeps the auth cookie fresh
  app/
    auth/callback/route.ts       Exchanges the OAuth ?code= for a session
    auth/auth-code-error/page.tsx Shown if the OAuth exchange fails
  components/
    auth-provider.tsx      Client context: user/session state + sign in/out
    auth-nav.tsx            DiscordLoginButton, UserMenu (avatar dropdown), AuthNav
```

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Auth: Supabase + Discord OAuth

Authentication uses [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side/nextjs),
the current recommended package for Supabase Auth with the Next.js App
Router (it replaces the deprecated `auth-helpers-nextjs`). The flow:

1. `DiscordLoginButton` (in `auth-nav.tsx`) calls
   `supabase.auth.signInWithOAuth({ provider: "discord" })` from the browser
   client, which redirects the user to Discord, then back to Supabase.
2. Supabase redirects the browser to `/auth/callback?code=...` on your site.
   `src/app/auth/callback/route.ts` exchanges that code for a session and
   sets the auth cookies, then redirects to `/`.
3. `src/middleware.ts` runs on every request and refreshes the session
   cookie via `updateSession()`, so the token never silently expires.
4. `AuthProvider` (wrapped around the app in `layout.tsx`) hydrates from the
   server-rendered user (no login flash) and then subscribes to
   `supabase.auth.onAuthStateChange` to keep the header in sync everywhere.

### 1. Environment variables

Create `.env.local` in the project root (already gitignored):

```bash
# Supabase project settings → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

A template is committed at `.env.local.example` — copy it and fill in your
project's values. These are the public URL + anon key, safe to expose to the
browser (the anon key only allows what your Row Level Security policies
permit).

### 2. Create a Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Open **OAuth2 → General** and copy the **Client ID** and **Client Secret**.
3. Under **OAuth2 → Redirects**, add the callback URL Supabase gives you (see
   next step) — it looks like
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.

### 3. Enable the Discord provider in Supabase

1. In the [Supabase dashboard](https://supabase.com/dashboard), open your
   project → **Authentication → Providers → Discord**.
2. Toggle it **on**, paste in the **Client ID** and **Client Secret** from
   Discord, and save. Supabase shows the exact **Redirect URL** to paste back
   into Discord's OAuth2 settings (step 3 above) — copy it from there rather
   than guessing, since it includes your project ref.
3. In **Authentication → URL Configuration**, set:
   - **Site URL**: `http://localhost:3000` for local dev (your production
     domain once deployed).
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` (and your
     production equivalent, e.g. `https://simsetups.app/auth/callback`).
     Supabase only allows redirecting to URLs on this allow-list.

### 4. Test it

```bash
npm run dev
```

Click **Login with Discord** in the header → approve on Discord → you're
redirected back to SimSetups signed in, with your Discord avatar in the
header. Click the avatar → **Log out** to sign out.

## Notes

- The upload form and setup data are mocked client-side — there's no backend
  yet. `upload-form.tsx` simulates a network request and shows a success
  state; wiring it to a real API/database (e.g. Supabase Postgres, scoped to
  the logged-in user via RLS) is the natural next step.
- UI primitives in `src/components/ui` are hand-written in the shadcn/ui
  style (Radix primitives + `class-variance-authority` + Tailwind), so
  `npx shadcn@latest add <component>` continues to work against
  `components.json` if you want to add more.
