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
```

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes

- The upload form and setup data are mocked client-side — there's no backend
  yet. `upload-form.tsx` simulates a network request and shows a success
  state; wiring it to a real API/database is the natural next step.
- UI primitives in `src/components/ui` are hand-written in the shadcn/ui
  style (Radix primitives + `class-variance-authority` + Tailwind), so
  `npx shadcn@latest add <component>` continues to work against
  `components.json` if you want to add more.
