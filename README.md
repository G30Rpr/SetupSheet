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
    data.ts               Static filter option lists (games, conditions) + helpers
    utils.ts              `cn()` class-merging helper
    supabase/
      client.ts           Browser Supabase client (Client Components)
      server.ts            Server Supabase client (Server Components/Actions/Route Handlers)
      middleware.ts         Session-refresh helper used by src/middleware.ts
      setups.ts             getSetups() — real data fetch + row-to-Setup mapping
    actions/
      setups.ts             Server actions: createSetup, toggleUpvote
  middleware.ts            Runs on every request, keeps the auth cookie fresh
  app/
    auth/callback/route.ts       Exchanges the OAuth ?code= for a session
    auth/auth-code-error/page.tsx Shown if the OAuth exchange fails
  components/
    auth-provider.tsx      Client context: user/session state + sign in/out
    auth-nav.tsx            DiscordLoginButton, UserMenu (avatar dropdown), AuthNav
supabase/
  migrations/0001_init_setups_schema.sql   profiles, setups, setup_upvotes + RLS
  seed.sql                                  optional sample data for a fresh project
  seed_more_games.sql                       adds coverage for the games seed.sql didn't touch
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

   **If you land back on `/?code=...` instead of being logged in:** that
   means the `redirectTo` your app asked for wasn't on the allow-list above,
   so Supabase silently fell back to the bare Site URL instead of
   `/auth/callback` — check the exact entry exists (not just the bare
   origin). `src/middleware.ts` will forward a stray `?code=` on any page to
   `/auth/callback` as a safety net, but that only papers over the symptom;
   the actual fix is fixing the allow-list entry.

### 4. Test it

```bash
npm run dev
```

Click **Login with Discord** in the header → approve on Discord → you're
redirected back to SimSetups signed in, with your Discord avatar in the
header. Click the avatar → **Log out** to sign out.

## Database: setups, upvotes, and RLS

Setup data lives in Supabase Postgres — `src/lib/data.ts` no longer holds
mock rows, only the static filter option lists (`games`, `conditions`) that
don't change per-row.

### 1. Apply the schema

In the [Supabase dashboard](https://supabase.com/dashboard) → your project →
**SQL Editor**, paste and run `supabase/migrations/0001_init_setups_schema.sql`.
(If you use the Supabase CLI locally instead, `supabase db push` picks up
everything under `supabase/migrations/`.) It creates:

- **`profiles`** — one row per user, auto-populated from Discord's OAuth
  metadata (username, avatar) by a trigger on `auth.users` insert. Needed
  because the client API can't query `auth.users` directly.
- **`setups`** — the core table. `game`, `condition`, `rig_profile`, and
  `tags` all have `check` constraints matching the TS unions in
  `src/lib/types.ts`, so bad data can't get in at the DB layer even if a
  client bug slips past validation. `setup_values` is a single `jsonb`
  column (tire pressure, camber, ARB, etc.) rather than 14 separate columns,
  since those fields are always read/written together. `upvotes` is a
  denormalized counter, not a live count.
- **`setup_upvotes`** — one row per `(user_id, setup_id)`; its existence
  *is* the upvote. Two `security definer` triggers keep `setups.upvotes` in
  sync on insert/delete, so reading the browse page never needs a join +
  count over every setup's upvotes.

**RLS policies**, scoped with `auth.uid()`:

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `setups` | anyone | owner only (`auth.uid() = user_id`) | owner only | owner only |
| `setup_upvotes` | owner only (each user sees only their own upvotes) | as self only | — | as self only |
| `profiles` | anyone | (via trigger only) | owner only | — |

Anonymous visitors can always browse (`setups` select is public) — only
uploading, editing, and upvoting require being logged in and acting as
yourself.

### 2. (Optional) Seed sample data

`supabase/seed.sql` has the same 12 sample setups that used to be hardcoded
in `src/lib/data.ts`, informed by public setup-guide consensus rather than
copied from any single source (see git history for the research sources).
Log in with Discord on the site once first — so a row exists in
`public.profiles` to attribute the seed rows to — then run `seed.sql` in the
SQL Editor.

`seed.sql`'s 12 rows only covered 6 of the 12 supported games (several F1
years and Assetto Corsa EVO had zero setups). `supabase/seed_more_games.sql`
adds one setup for each previously-uncovered game plus a few more combos for
variety — same research-grounded approach, safe to run alongside or instead
of `seed.sql` since it only inserts new rows. Both are meant to run once
each; running either twice duplicates rows (no dedupe logic, since real
uploads are expected to have duplicate car/track combos legitimately).

### 3. How the app talks to it

- `src/lib/supabase/setups.ts` — `getSetups()` fetches all setups plus the
  current viewer's upvote state in one server-side call, mapping DB rows to
  the `Setup` type the UI already expects. If Supabase is unreachable or the
  query errors, it logs and returns `[]` instead of throwing, so a backend
  hiccup degrades to an empty browse page rather than a 500 — verified by
  running with the Supabase host deliberately unreachable.
- `src/lib/actions/setups.ts` — `createSetup` and `toggleUpvote` are Server
  Actions; both check for a logged-in user before touching the database
  (defense in depth on top of RLS, so the error message is friendly instead
  of a raw Postgres permission error).
- `SetupCard`'s upvote pill is now a real toggle button: optimistic
  update on click, reverted if the server action errors. Clicking it while
  logged out triggers Discord login instead of failing silently.
- `UploadForm` is gated behind auth — logged-out visitors see a "Log in to
  upload" prompt instead of the form.

## Deploying to Vercel

This is a stock Next.js App Router project — Vercel detects the framework
automatically, so no `vercel.json` or custom build settings are needed.

1. **Push this branch to GitHub** (or your git provider) if it isn't already,
   then go to [vercel.com/new](https://vercel.com/new) and import the repo.
   Framework Preset should auto-detect as **Next.js**; leave the build
   command (`next build`) and output settings as default.

2. **Add environment variables** in the Vercel project → **Settings →
   Environment Variables** (add them for Production, Preview, *and*
   Development environments so preview deploys work too):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-ref.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon/publishable key |

   The build itself succeeds even without these set (verified — every route
   that touches auth is dynamically rendered, so nothing reads them at build
   time), but the app will silently behave as logged-out until they're set,
   so add them before your first real test.

3. **Deploy.** Vercel gives you a URL like `https://<project>.vercel.app`
   (production) and a unique `https://<project>-git-<branch>-<team>.vercel.app`
   URL for this branch's preview deploys.

4. **Update Supabase's allow-list with that URL** — this is the step people
   most often forget, and it's why login works locally but not on the
   deployed link:
   - Supabase dashboard → **Authentication → URL Configuration**.
   - Set **Site URL** to your main Vercel URL (or custom domain).
   - Add both `https://<your-vercel-url>/auth/callback` **and**
     `http://localhost:3000/auth/callback` to **Redirect URLs** — Supabase
     rejects redirects to anything not on this list. If you'll also test
     from branch preview URLs, add each of those too (or a wildcard pattern
     if your Supabase plan supports it).
   - You do **not** need to touch Discord's OAuth2 settings again — Discord
     only ever redirects back to Supabase's fixed
     `https://<project-ref>.supabase.co/auth/v1/callback`, never directly to
     Vercel.

5. **Test it** by opening the deployed URL and clicking **Login with
   Discord**. If Supabase rejects the redirect, its error message will name
   the exact URL it received — compare that against the allow-list in step 4.

## Notes

- Uploading a setup via the **file dropzone** only saves the form's metadata
  right now — the actual file isn't persisted anywhere yet (no Supabase
  Storage bucket wired up). The form says this explicitly under the
  dropzone. The **manual entry** path (structured tire pressure/camber/ARB/
  etc. fields) is fully real end-to-end since it's just data, not a file.
- Pace and Predictability are currently self-rated by the uploader at
  submission time (two star-pickers in the form) rather than aggregated from
  other users who've tried the setup — a real community rating system would
  be a good follow-up.
- UI primitives in `src/components/ui` are hand-written in the shadcn/ui
  style (Radix primitives + `class-variance-authority` + Tailwind), so
  `npx shadcn@latest add <component>` continues to work against
  `components.json` if you want to add more.
- The Next.js build logs a harmless warning about a Node.js API
  (`process.version`) in `@supabase/supabase-js` not being supported in the
  Edge Runtime. This comes from a version check inside the library that
  never actually executes on Edge — it does not affect Vercel's Edge
  Middleware at runtime, and is a widely reported, benign warning.
