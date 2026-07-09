# SetupSheet

A free, community-driven sim racing setups site. Built with Next.js 15 (App
Router), TypeScript, Tailwind CSS v4, and shadcn/ui-style components on a
dark, sim-racing themed UI (carbon black, racing green, alert red).

## Pages

- `/` — Landing page: hero, stats, a bounded top-6-by-upvotes featured rail,
  call-to-action.
- `/setups` — Browse page with a Game / Car / Track / Condition filter bar and
  a responsive grid of setup cards.
- `/upload` — Drag-and-drop upload form for sharing a setup with the
  community.
- `/leaderboard` — Top Contributors, ranked by total upvotes across every
  setup a user has shared, with Bronze/Silver/Gold contributor badges.
- `/profile` — Your own profile: avatar, badge, stats, your uploaded setups.
- `/profile/[userId]` — Anyone's public profile (same layout as `/profile`),
  with a Follow button when you're viewing someone else's.

## Project structure

```
src/
  app/
    layout.tsx        Root layout (header + footer + fonts + metadata + notification fetch)
    error.tsx          Catches any client-side render error below the layout
    global-error.tsx   Last-resort fallback if the root layout itself throws
    page.tsx           Landing page
    globals.css        Tailwind v4 theme (CSS variables, dark theme)
    setups/page.tsx, loading.tsx     Browse setups page + loading skeleton
    upload/page.tsx, loading.tsx      Upload setup page + loading skeleton
    leaderboard/page.tsx, loading.tsx  Top Contributors page + loading skeleton
    profile/page.tsx, loading.tsx      Your own profile
    profile/[userId]/page.tsx, loading.tsx  Anyone's public profile
  components/
    ui/                 shadcn/ui-style primitives (button, card, select, dropdown-menu, ...)
    site-header.tsx     Top nav with mobile drawer (Sheet); notification bell + account
                         menu each mount once regardless of viewport
    site-footer.tsx     Footer
    setup-card.tsx      The setup card (car/track, lap time, tags, ratings, author byline...)
    setups-browser.tsx  Client component: filter state + filtered grid
    upload-form.tsx      Upload form; drag a real ACC .json and it auto-fills the Car field
    file-dropzone.tsx    Drag-and-drop / tap-to-choose file input
    star-rating.tsx      Pace / Predictability star rating display
    tag-badge.tsx         Setup tag → Badge color mapping
    profile-view.tsx      Shared display for both /profile and /profile/[userId]
    profile-skeleton.tsx   Shared loading skeleton for both profile routes
    contributor-badge.tsx  Bronze/Silver/Gold badge, derived from total upvotes
    follow-button.tsx      Follow/Following toggle shown on someone else's profile
    notification-bell.tsx  Unread badge + dropdown; re-syncs on navigation, no realtime yet
  lib/
    types.ts             Setup / Game / Condition / SetupTag / RigProfile types
    data.ts               Static filter option lists (games, conditions, rigProfiles,
                           setupTags) + helpers -- also what server actions validate against
    badges.ts              Bronze/Silver/Gold upvote thresholds
    acc-setup-parser.ts     Parses a dropped ACC .json to auto-fill the Car field
    setup-schemas.ts       Per-game setup-screen field definitions (see below)
    utils.ts              `cn()` class-merging helper, `getInitials()`
    supabase/
      client.ts           Browser Supabase client (Client Components)
      server.ts            Server Supabase client, memoized per-request via React's cache()
      proxy.ts               Session-refresh helper used by src/proxy.ts
      setups.ts             getSetups(), getFeaturedSetups(), getSetupCount(), row mapping
      leaderboard.ts          getLeaderboard() — reads the public.leaderboard view
      follows.ts               isFollowing()
      notifications.ts         getNotifications(), getUnreadNotificationCount()
    actions/
      setups.ts             Server actions: createSetup, updateSetup, toggleUpvote, rateSetup,
                            uploadSetupFile, downloadSetup -- validates game/condition/rig/tags
                            against lib/data.ts before touching the database
      follows.ts              toggleFollow
      notifications.ts         markNotificationRead, markAllNotificationsRead,
                              clearReadNotifications
  proxy.ts                 Runs on every request, keeps the auth cookie fresh
  app/
    auth/callback/route.ts       Exchanges the OAuth ?code= for a session
    auth/auth-code-error/page.tsx Shown if the OAuth exchange fails
  components/
    auth-provider.tsx      Client context: user/session state + sign in/out
    auth-nav.tsx            DiscordLoginButton, UserMenu (avatar dropdown), AuthNav
next.config.ts             Security headers: CSP, X-Frame-Options, Referrer-Policy, etc.
supabase/
  migrations/
    0001_init_setups_schema.sql          profiles, setups, setup_upvotes + RLS
    0002_update_games_list.sql            drops F1 19-23, adds F1 25 + Gran Turismo 7
    0003_setup_ratings.sql                 pace/predictability become community averages
    0004_setup_files.sql                    Storage bucket + file_path/file_name columns
    0005_remove_f1_24.sql                    drops F1 24, leaving F1 25 as the only F1 title
    0006_leaderboard_view.sql                 public.leaderboard view (upvotes per profile)
    0007_follows.sql                           follows table + profiles.follower_count
    0008_notifications.sql                      notifications table + follower fan-out trigger
    0009_column_level_grants.sql                 column-scoped UPDATE grants on setups/profiles
    0010_notifications_delete_policy.sql          lets a user delete their own notifications
    0011_notifications_column_grant.sql            same column-scoped grant, for notifications
  seed.sql                          sample setups across all 8 supported games
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
3. `src/proxy.ts` runs on every request and refreshes the session
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
     production equivalent, e.g. `https://setupsheet.app/auth/callback`).
     Supabase only allows redirecting to URLs on this allow-list.

   **If you land back on `/?code=...` instead of being logged in:** that
   means the `redirectTo` your app asked for wasn't on the allow-list above,
   so Supabase silently fell back to the bare Site URL instead of
   `/auth/callback` — check the exact entry exists (not just the bare
   origin). `src/proxy.ts` will forward a stray `?code=` on any page to
   `/auth/callback` as a safety net, but that only papers over the symptom;
   the actual fix is fixing the allow-list entry.

### 4. Test it

```bash
npm run dev
```

Click **Login with Discord** in the header → approve on Discord → you're
redirected back to SetupSheet signed in, with your Discord avatar in the
header. Click the avatar → **Log out** to sign out.

## Database: setups, upvotes, and RLS

Setup data lives in Supabase Postgres — `src/lib/data.ts` no longer holds
mock rows, only the static filter option lists (`games`, `conditions`) that
don't change per-row.

### 1. Apply the schema

In the [Supabase dashboard](https://supabase.com/dashboard) → your project →
**SQL Editor**, paste and run the migrations **in order**:
`supabase/migrations/0001_init_setups_schema.sql`, then
`0002_update_games_list.sql`. (If you use the Supabase CLI locally instead,
`supabase db push` picks up everything under `supabase/migrations/` in
order.)

`0001` creates:

- **`profiles`** — one row per user, auto-populated from Discord's OAuth
  metadata (username, avatar) by a trigger on `auth.users` insert. Needed
  because the client API can't query `auth.users` directly.
- **`setups`** — the core table. `game`, `condition`, `rig_profile`, and
  `tags` all have `check` constraints matching the TS unions in
  `src/lib/types.ts`, so bad data can't get in at the DB layer even if a
  client bug slips past validation. `setup_values` is a single `jsonb`
  column since every game has a different set of setup-screen fields (see
  "Per-game setup fields" below) — a fixed set of columns can't represent
  that. `upvotes` is a denormalized counter, not a live count.
- **`setup_upvotes`** — one row per `(user_id, setup_id)`; its existence
  *is* the upvote. Two `security definer` triggers keep `setups.upvotes` in
  sync on insert/delete, so reading the browse page never needs a join +
  count over every setup's upvotes.

`0002` drops F1 2019–23 from the supported games list, adds F1 25 and Gran
Turismo 7, and deletes any existing setups for the removed F1 years so the
new `check` constraint doesn't reject on old data.

**RLS policies**, scoped with `auth.uid()`:

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `setups` | anyone | owner only (`auth.uid() = user_id`) | owner only | owner only |
| `setup_upvotes` | owner only (each user sees only their own upvotes) | as self only | — | as self only |
| `setup_ratings` | owner only | as self only | own rating only | own rating only |
| `follows` | owner only (own follows list) | as self only | — | as self only |
| `notifications` | owner only | (via trigger only) | own rows, `read` column only | own rows only |
| `profiles` | anyone | (via trigger only) | own row, `username`/`avatar_url` only | — |

Row-level policies only restrict *which row* a user can touch — nothing
about *which column*. `0009` and `0011` close that gap for the
denormalized/trigger-owned columns (`setups.upvotes/downloads/pace/
predictability/rating_count`, `profiles.follower_count`,
`notifications.actor_id/setup_id/type`) with an explicit
`revoke ... / grant update (<allowed columns>) ...`, so a user's own
row-level write access can't be used to fabricate a public trust signal
like an upvote count or a fake notification.

Anonymous visitors can always browse (`setups` select is public) — only
uploading, editing, and upvoting require being logged in and acting as
yourself.

### 2. (Optional) Seed sample data

`supabase/seed.sql` has sample setups across all 8 supported games,
informed by public setup-guide consensus (Coach Dave Academy, F1Laps, GT
Planet, simracingsetup.com, etc.) rather than copied from any single
source — see git history for the research trail. Log in with Discord on
the site once first — so a row exists in `public.profiles` to attribute
the seed rows to — then run `seed.sql` in the SQL Editor.

It's meant to run once; running it twice duplicates rows (no dedupe logic,
since real uploads are expected to have duplicate car/track combos
legitimately). If you need to start over — e.g. an earlier version of this
file used a different `setup_values` shape that no longer matches
`src/lib/setup-schemas.ts` — wipe the table first:

```sql
truncate public.setups cascade;
```

### 3. Per-game setup fields

Every game has a genuinely different setup screen — a Gran Turismo 7 tuning
sheet (LSD initial/accel/braking torque, ballast, no tire pressure at all)
has nothing in common with F1 25's Suspension Geometry tab (camber, toe,
0-11 sliders), which in turn differs from a GT3 sim's mechanical grip tab
(tire pressure, ARB clicks, brake ducts). `src/lib/setup-schemas.ts` defines
one field-group schema per `Game`, grounded in each title's actual setup
UI, and `SetupValues` (in `src/lib/types.ts`) is a plain
`Record<string, string>` rather than a fixed interface — there's no single
shape that could represent all eight.

Two places consume this:

- `SetupValuesFields` (the upload form's manual-entry mode) renders
  whichever fields belong to the selected game, and resets to that game's
  empty field set when you change games.
- `SetupCard`'s "Setup values" panel groups and labels whatever keys are
  present in a setup's `setup_values` using that same schema, skipping any
  field with no value.

Since `setup_values` is unstructured `jsonb`, no migration is needed when
the schema changes — only `src/lib/setup-schemas.ts` and the seed data.

### 4. How the app talks to it

- `src/lib/supabase/setups.ts` — `getSetups()` fetches all setups plus the
  current viewer's upvote state in one server-side call, mapping DB rows to
  the `Setup` type the UI already expects. If Supabase is unreachable or the
  query errors, it logs and returns `[]` instead of throwing, so a backend
  hiccup degrades to an empty browse page rather than a 500 — verified by
  running with the Supabase host deliberately unreachable.
- `src/lib/actions/setups.ts` — `createSetup`, `updateSetup`, `deleteSetup`,
  `toggleUpvote`, `rateSetup`, `uploadSetupFile`, and `downloadSetup` are all
  Server Actions; each checks for a logged-in user before touching the
  database (defense in depth on top of RLS), and `createSetup`/`updateSetup`
  additionally validate `game`/`condition`/`rigProfile`/`tags` against the
  arrays in `lib/data.ts` before the query runs, so a bad value gets a clean
  error message instead of a raw Postgres constraint violation.
- `SetupCard`'s upvote pill is a real toggle button: optimistic update on
  click, reverted if the server action errors. Clicking it while logged out
  triggers Discord login instead of failing silently. Its download button
  serves the actual uploaded file from Supabase Storage when one exists, or
  a generated text export of the manually-entered values when it doesn't.
- `UploadForm` is gated behind auth — logged-out visitors see a "Log in to
  upload" prompt instead of the form. Dropping a real ACC (Assetto Corsa
  Competizione) `.json` setup file auto-fills the Car field (see
  `lib/acc-setup-parser.ts`); everything else stays manual, so a drop is
  never blocked on filling in fields the parser can't reliably read.

## Community features: leaderboard, follows, notifications

- **Leaderboard & badges** — `public.leaderboard` (migration `0006`) is a
  view aggregating `setup_count`/`total_upvotes` per profile;
  `getLeaderboard()` reads it directly rather than summing setups in JS.
  `lib/badges.ts` derives a Bronze/Silver/Gold tier from total upvotes,
  rendered by `ContributorBadge` on both the leaderboard and any profile.
- **Follows** — migration `0007` adds a `follows` join table plus a
  denormalized `profiles.follower_count`, kept in sync by the same
  `security definer` trigger pattern as `setups.upvotes`. `FollowButton`
  shows on someone else's profile only; `isFollowing()` checks the
  viewer's own follow state.
- **Notifications** — migration `0008` fans a new setup upload out to every
  follower of the uploader (one row per follower, inserted by a
  `security definer` trigger on `setups` insert — currently unbatched, so a
  contributor with an unusually large follower count would see a
  proportionally larger insert on their next upload; worth revisiting if
  that ever shows up in practice). The bell in the header
  (`NotificationBell`) shows an unread count and a dropdown; its
  `initialNotifications`/`initialUnreadCount` come from a server-side fetch
  in the root layout re-synced on every navigation, not a live
  subscription, so a notification created while a tab is already open won't
  appear until the next navigation. Migrations `0010` and `0011` let a user
  delete their own read notifications (via the "Clear read notifications"
  action) and close the same row-vs-column RLS gap `0009` fixed for
  `setups`/`profiles`.

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

- Uploading a setup via the **file dropzone** persists the real file to a
  Supabase Storage bucket (`setup-files`, one folder per uploader) —
  `SetupCard`'s download button serves that original file. The **manual
  entry** path (structured tire pressure/camber/ARB/etc. fields) stays
  available alongside a dropped file rather than replacing it, and
  generates a text export on download when there's no file behind a setup.
- Pace and Predictability are a real community average (migration `0003`,
  `setup_ratings` table) — the uploader's own star-picker at submission
  time just becomes their first rating row, not a fixed value nobody else
  can change. Every setup shows `ratingCount` alongside the averages.
- UI primitives in `src/components/ui` are hand-written in the shadcn/ui
  style (Radix primitives + `class-variance-authority` + Tailwind), so
  `npx shadcn@latest add <component>` continues to work against
  `components.json` if you want to add more.
- `next.config.ts` sets a Content-Security-Policy and the standard security
  headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`). The CSP allows `'unsafe-eval'` in development only
  — webpack's Fast Refresh needs it, production never does — so it can't be
  loosened for real visitors by a dev-mode change.
- `src/app/error.tsx` and `global-error.tsx` catch client-side rendering
  errors that would otherwise fall through to Next.js's generic, unstyled,
  unlogged crash page; both log the real error to the console before
  rendering a branded retry card.
- The Next.js build logs a harmless warning about a Node.js API
  (`process.version`) in `@supabase/supabase-js` not being supported in the
  Edge Runtime. This comes from a version check inside the library that
  never actually executes on Edge — it does not affect Vercel's Edge
  Middleware at runtime, and is a widely reported, benign warning.
