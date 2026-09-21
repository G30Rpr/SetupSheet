# Quality of Life Audit — setupsheet.app

**Site:** https://setupsheet.app · **Category:** Community content/marketplace site for sim-racing car setups (UGC database + community)
**Audit date:** 21 September 2026 · **Auditor lens:** product strategy, UX research, competitive analysis
**Scope:** public journeys only — homepage → discovery → setup detail → download/install → contribution → creator/trust surfaces. Signed-in journeys (upload form, notifications, comments, ratings, profile edits) were reviewed in the codebase that ships the site, not by logging in (see Limitations).
**Companion document:** `AUDIT-2026-09-21-setupsheet.app.md` (technical/performance/security audit). Several defects it found were fixed on 21 Sep — uploads over 1 MB no longer fail, junk-id URLs now 404, contrast and skip-link issues resolved, field telemetry shipped. This audit does **not** re-litigate those; it assumes they are done.

---

## 1. Executive Summary

### Overall QoL health score: **56 / 100**

| Dimension | Weight | Score | What drives it |
|---|---|---|---|
| Convenience & efficiency (effort per task) | 30% | 58 | Browsing and downloading are genuinely frictionless and anonymous; the two steps that matter most — *choosing* and *installing* — are where effort piles up |
| Clarity & cognitive load | 15% | 63 | Clear voice, honest copy, good empty-state scaffolding; but rating semantics (percentages, two star widgets), tag soup, and 12 interactive targets per card cost scanability |
| Emotional experience (trust, delight, confidence) | 15% | 52 | No paywall is a real emotional win; "Verified", "Pace/Predictability" and a top-contributor board with three zero-activity rows are claims the data doesn't yet back |
| Discoverability of features | 10% | 64 | `/` to search, compare mode, favorites, follows, request board, version diffs all exist — several are one level deeper than users will look |
| Personalization & smart defaults | 10% | 38 | Filters persist in `localStorage`, but nothing knows your sim, your rig, or your skill; "Trending this week" is global |
| Speed of task completion | 10% | 60 | Browse → download is fast. Browse → *driving the setup* is not: file download, folder hunting, manual value entry |
| Support & recovery | 5% | 48 | Error states contradict empty states; no FAQ, help hub, contact path, or community space |
| Mobile vs desktop | 5% | 55 | Layout is responsive and cards degrade sanely; but filters are five stacked selects and nothing serves the phone-as-second-screen-at-the-rig behaviour this hobby already has |

**Why 56:** the foundations are better than the score suggests — anonymous browsing *and* anonymous downloads, rig-profile filtering, per-game install guides, a values panel with copy-to-clipboard, version history with value diffs, draft autosave, a `/` search shortcut, shareable filter URLs and dark mode are all things most free community setup sites don't have. But QoL is judged at the moments of highest intent, and at those moments SetupSheet asks the most: you must expand a panel to read the numbers, then download a file, then move it into a game folder by hand (or type 30–70 values from a second screen). Meanwhile the market has moved to auto-install and AI-assisted deltas, and this site's social proof (20 setups, one contributor, every setup showing exactly "1 rating") can't yet carry its own trust claims.

### Top 5 highest-impact opportunities

1. **Rig Mode — a phone-first "setup sheet" you actually drive from.** Full-screen, large-type values, tap-to-copy per row, screen-awake, QR handoff from desktop. The hobby already puts phones/tablets at the rig (SimHub, SIM Dashboard, Track Titan's mobile-first UI); no free setup database serves that screen. *(Add · High impact · Low–Med effort)*
2. **Install-assist: turn "How to install" into "Get it into the game".** Copy-path buttons per platform, a pre-structured folder-correct `.zip`, and a copy-all-values block for manual-entry titles. Coach Dave Delta, GO Setups, Garage61 and Apex all auto-install or auto-sync now; VRS is criticised for remaining manual. *(Improve · High impact · Med effort — with a companion sync bridge as the strategic phase 2)*
3. **Trust & rating overhaul.** Define what "Verified" means, attach the evidence (lap video/telemetry/patch validity) to the badge, replace the %-only Pace/Predictability readout with stars + count + *who rated* (rig context), and stop shipping claims like "know exactly what you're getting" when every setup has one rating and zero downloads. *(Improve · High impact · Med effort)*
4. **"My Garage" personalization + saved state.** One-time pick of sims/rig/skill → default filters, a personalized "For your rig" rail, resume-where-you-left-off, and badge/milestone progress. Track Titan onboards with a driver profile and sim preferences for exactly this reason. *(Add · High impact · Med effort)*
5. **Discovery that scales: one search, filter counts, sticky mobile filters, and no dead ends.** Today the in-page search box filters only the ≤128 rows loaded in the browser while the header search hits the server — same-looking box, different coverage. Add result counts per option, a sticky "Filters (n)" affordance on mobile, and "no match → relax this filter" recovery. *(Improve · High impact · Med effort)*

### Biggest competitive gaps and strengths

**Strengths (lean in):**
- **No account required to browse *or* download.** Verified in code: `downloadSetup` validates only the UUID. Garage61 gates advanced filtering/telemetry behind Pro; Delta and VRS are paywalled outright. This is the site's identity — protect it.
- **Rig-profile filtering** (Gamepad / Wheel + 3 Pedals / Wheel + Handbrake / Direct Drive + Load Cell). No competitor researched filters by hardware, yet hardware is the #1 reason a shared setup feels wrong.
- **Per-game install guides with "File import supported" vs "Manual entry only"** honesty, plus version history with **value-level diffs** — closer to engineering practice than any free competitor.
- **A setup request board.** None of the researched competitors let the community *ask* for a missing car/track; they solve demand with pro weekly updates.

**Gaps (fix fast):**
- **Install effort.** The market's answer to "how do I get this into the game" is a sync agent; SetupSheet's is prose.
- **Trust infrastructure.** Ratings are one-dimensional-ish, thinly populated, and shown as percentages; "Verified" is self-attached proof.
- **First-run experience.** No personalization, no "what is this and how do I use it" onboarding, no help hub, no community space beyond the site itself (and no Discord invite even though sign-in *is* Discord).
- **Cold-start surfaces.** A leaderboard where 3 of 4 rows show `0 setups · 0 upvotes` and a requests board that reads "No requests yet" actively undersells a healthy product.

### Quick view — Add / Improve / Remove

| Priority | Add | Improve | Remove / Simplify |
|---|---|---|---|
| **Do first** | Rig Mode (phone sheet + QR handoff) | Empty vs error states; search consistency; install-assist (paths + zip) | Per-card "Report setup" link → overflow menu |
| **Next** | My Garage personalization; milestone notifications; badge progress | Rating clarity (stars, counts, rig context); sort labels/definitions; compare entry points | Three collapsed panels per card on the browse grid |
| **Then** | Duplicate-and-tweak; setup validity per patch/season; help hub + Discord link; 3–4 way compare | Mobile filter affordance; creator pages; leaderboard windows; upload friction for non-parsed games | Duplicate search box copy; zero-activity leaderboard rows |

---

## 2. What to Add

### 2.1 Rig Mode — a phone-first setup sheet you can actually drive from
- **Why it matters:** The last mile of this product happens in a cockpit, often on a phone propped against a wheelbase, with the game running. Today the only rig-friendly artefact is a downloaded file or a downloaded PDF-less page. A one-tap "Rig Mode" (`/setups/<id>?rig=1`) with large type, sectioned values, tap-a-row-to-copy, a "keep screen awake" toggle (Wake Lock API), and no nav chrome removes every remaining step between "I chose this setup" and "the car is set up".
- **Competitive evidence:** The rig second-screen is established behaviour — SimHub serves a browser dashboard to a phone/tablet by IP or QR ([Android Authority](https://www.androidauthority.com/sim-racing-dashboard-software-1101833/)), SIM Dashboard sells itself as a second screen, and Virtual Race Car Engineer's onRails runs live setup engineering as an in-sim overlay. Track Titan promotes a "mobile-friendly UI" as a differentiator. No free setup *database* has a rig view.
- **Impact:** High · **Effort:** Low–Med (one route + a view component; the values data already exists in `setupValues`)

### 2.2 Install-assist: from instructions to a folder-correct bundle
- **Why it matters:** The install guide is genuinely good content (per-game steps, "File import supported" vs "Manual entry only", `Documents\iRacing\setups\<car>\` paths), but it's prose in a collapsed panel. Three cheap upgrades turn it into a flow: (a) a **copy button per path**, (b) a **"Download install bundle"** that zips the setup file *plus* a `README.txt` with the target path, (c) for manual-entry titles, a **"copy all values"** block pre-formatted for the game's setup screen.
- **Competitive evidence:** At the top of this market, installation is automated: Coach Dave Delta "auto-installs setups ... no need to mess around with manual files and folders" ([comparison](https://coachdaveacademy.com/tutorials/best-iracing-setup-subscriptions-in-2026-compared/)), GO Setups ships a GO Fast app, Garage61's agent syncs setups into iRacing's folders (and even syncs paid setup shops' packs to subscribers), and Apex syncs to a folder weekly ([r/iRacing](https://www.reddit.com/r/iRacing/comments/1rf266a/setup_tool_that_autoloads_the_setup_with_the_game/)). VRS is explicitly dinged for "manual only" downloads.
- **Impact:** High · **Effort:** Med (zip generation on the server; the guide content and paths already exist)

### 2.3 My Garage — smart defaults from four answers
- **Why it matters:** A first-time visitor today sees eight sim chips and four rig chips and must self-select every time. Ask once — *which sims, what rig, what skill level* — then default the browse filters, sort "Safest" for beginners, and give the homepage a "Setups for your rig" rail that beats "Trending this week". Store it in `localStorage` for anonymous users (consistent with the existing filter persistence) and on the profile once signed in.
- **Competitive evidence:** Track Titan's documented onboarding is "create an account and complete your driver profile and simulator preferences" before anything else; it markets a personalized feed as a feature. F1Laps filters setups by game version → track → conditions as a guided path rather than a wall of dropdowns.
- **Impact:** High · **Effort:** Med

### 2.4 Milestone notifications, badge progress, and a reason to come back
- **Why it matters:** The notification model today covers comments and request fulfilment only. Contributors get no signal when their setup is downloaded 10 times, upvoted, or crosses a badge tier (Bronze 10 / Silver 50 / Gold 200 — none reachable at current volumes, and invisible in the UI). Add: milestone notifications ("Your Zandvoort setup passed 50 downloads"), a **next-tier progress bar** on profile and leaderboard, and a "first download / first upvote" moment.
- **Competitive evidence:** Community platforms in adjacent hobbies (Strava-style activity feeds, Printables/Thingiverse creator dashboards) treat milestones as the retention engine; sim racing's own "Strava for motorsport" pitch from Track Titan shows where the category is heading.
- **Impact:** Med–High · **Effort:** Low–Med (notification plumbing exists)

### 2.5 Duplicate-and-tweak (fork a setup)
- **Why it matters:** Most uploaded setups are a known setup plus one change (a wet variant, a quali variant). Today an author starts from a blank 30–70 field form or re-uploads a file. "Duplicate this setup → edit values → publish as your version" turns a 10-minute chore into a 1-minute action and multiplies variant coverage — which is exactly the "Race / Quali / Wet" content the market expects.
- **Competitive evidence:** Setup shops standardise on variants (Coach Dave, VRS: "Race, qualifying, wet, and endurance setup variants"); Printables/Thingiverse-style "remix with attribution" is the community-library norm for derivative works.
- **Impact:** Med–High · **Effort:** Med (edit flow and version history already exist)

### 2.6 Value import for games that don't parse
- **Why it matters:** Only Assetto Corsa setups are auto-parsed (`acc-setup-parser.ts`); everything else is manual entry against a form that mirrors the game's setup screen. A "paste your setup screen text" box, a screenshot OCR path, or a JSON/CSV import would cut the biggest contribution barrier for the majority of the eight supported titles.
- **Competitive evidence:** F1Laps' onboarding auto-imports game data and telemetry rather than asking users to type; Garage61 imports from iRacing. Where manual entry is unavoidable, communities share *screenshots* instead — a paste/OCR path meets that behaviour where it lives.
- **Impact:** Med · **Effort:** Med (start with paste-to-parse; OCR later)

### 2.7 Compare 3–4 setups, and compare against *my* setup
- **Why it matters:** Compare is limited to two setups, lives behind a toggle inside the browse grid, and its own page (`/setups/compare`) is a dead end that tells you to go back. Let the compare page host its own pickers, allow 3–4 columns, and add "compare with my saved setup" (favorites already exist) plus "copy the diff".
- **Competitive evidence:** Diffing is a core behaviour in this hobby — the community builds standalone tools for it ("I built a free tool to diff iRacing `.sto` setup files"), and paid platforms make setup-to-reference comparison a headline feature. SetupSheet already has the *best* free implementation of this idea; it just hides it.
- **Impact:** Med–High · **Effort:** Med

### 2.8 Watch a car/track, and get told when a setup lands
- **Why it matters:** The requests board is demand signalling without a subscription mechanism. "Notify me when a GT3 setup for Zandvoort appears" (and "+1 / 7 racers want this" on requests) creates the pull loop the board currently lacks — and makes the empty board an asset rather than an embarrassment.
- **Competitive evidence:** Setup shops *are* that notification — a weekly feed of new setups for your series. No free community site researched does watch/subscribe. Genuine differentiation.
- **Impact:** Med–High · **Effort:** Med

### 2.9 Help hub, FAQ, and an actual community space
- **Why it matters:** Support today = a report form plus "contact the project through the SetupSheet repository" (a developer channel) in the community guidelines. There is no FAQ, no "how do ratings work", no "how do I install this in iRacing" index, no keyboard-shortcut list, and no Discord invite — despite Discord being the sign-in provider and the only identity this site has.
- **Competitive evidence:** Every commercial competitor pairs product with guides, tutorials and a Discord; the community's own sharing happens in Discord servers (e.g. "The ProtoGT discord shares sets" in [r/iRacing](https://www.reddit.com/r/iRacing/comments/1ao6keo/what_setup_shop_if_any_do_you_use_and_why/)). A help hub also captures the install-guide content that's currently trapped inside cards.
- **Impact:** Med · **Effort:** Low

### 2.10 Smaller conveniences worth adding
| Item | Why / evidence | Impact | Effort |
|---|---|---|---|
| **Print / PDF setup sheet** | Rig-side paper and a shareable artifact; every setup shop emails PDFs | Med | Low |
| **QR code on each setup page** | Hand off desktop → phone at the rig in one scan (the SimHub pattern) | Med | Low |
| **Keyboard shortcuts** (`/` exists; add `j/k`, `s` save, `c` compare, `Enter` open) | The `/` shortcut shows the audience exists; power users in this hobby are keyboard-heavy | Low–Med | Low |
| **"Same car, other tracks" + "Same track, other setups" rails** | The detail page currently shows "More <game> setups" only; intent-specific rails close a discovery loop | Med | Low |
| **Stale/season-validity field ("works with patch/season")** | Sim patches invalidate setups; the market's promise is weekly-updated relevance. Version history exists — surface "updated N days ago" and let the author mark "still valid" | Med–High | Med |
| **Opt-in digest ("new setups for your garage")** | Replaces the missing weekly feed; requires email infra or Discord DM | Med | Med |
| **Rig-matched rating filter** ("show ratings from wheel users") | Turns the rig-profile differentiator into a trust feature | Med | Med |

---

## 3. What to Improve

### 3.1 Empty states and error states contradict each other
- **Current problem (observed):** With the database unreachable, `/requests` renders **both** "Couldn't load the requests board right now." **and** "No requests yet · Be the first to ask the community for a setup." On `/setups`, a filter combination that matches nothing shows "No setups yet · Be the first to share one with the community" — the same copy a genuinely empty database would show, and the same copy a database outage would show. A first-time visitor cannot tell "nobody has asked yet" from "we're broken", and in the outage case the site looks abandoned.
- **Recommended change:** Explicit four-state model — *loading* (skeleton), *error* (banner + **Retry** button, empty state suppressed), *filtered-empty* ("No setups match these filters" + one-tap "Clear condition" chips), *globally empty* (today's copy + upload CTA). The code comment in `requests/page.tsx` shows the intent ("an unreachable database has to say so on the empty state") — the implementation just does both at once.
- **Benchmark:** Garage61 and Delta both present "no results" as a filter problem with a way out; a 500-class failure is always an error surface with a retry, never an empty collection.
- **Impact:** High · **Effort:** Low

### 3.2 Two search boxes, two scopes, one confusing URL
- **Current problem (verified in code):** The header search submits to `/setups?q=…` and the server queries the `setup_search` view — complete coverage. The in-page box on `/setups` ("Search by car, track, game, or tag…", with fuzzy matching and suggestions) filters **only the ≤128 rows already loaded in the browser** and deliberately avoids an RSC round trip ("Next router.replace here would trigger a full RSC request") while still writing `?q=` to the URL with `history.replaceState`. Same-looking URL, different result sets: typing a car name that exists at row 200 returns nothing, and refreshing the identical URL can return results. The placeholder copy also differs between the two boxes ("Search track or car" vs "Search cars or tracks" vs the in-page wording).
- **Recommended change:** One search path: debounce the in-page box into the same server query (or show "Searching all setups… / Showing N of the first 128 loaded — press Enter to search everything"), unify the copy, and add result counts.
- **Benchmark:** Garage61 advertises filtering across tens of millions of laps; F1Laps guides you game → track → conditions. Partial search that looks total is worse than a smaller search that says so.
- **Impact:** High · **Effort:** Med (interacts with the payload cap work: the browse index is intentionally capped, so the server must own search)

### 3.3 Rating semantics need a wire-up, not a redesign
- **Current problem (verified in code and on-page):** Two independent 1–5 star widgets ("Pace", "Predictability") whose aggregates render as bare percentages ("Pace 40%", "Predictability 80%") with a progress bar and a count ("1 rating"), next to an unlabelled upvote number ("1"). There is no scale legend, no overall score, no rig or condition context, and no visible indication of *who* rated — so a direct-drive user can't tell whether a gamepad user's "80% predictability" means anything for them.
- **Recommended change:** Show stars (★★★★☆ 4.0) plus count, put the % in a tooltip/legend, label the upvote control with its count ("12 upvotes"), and add "rated by 3 wheel users" context using the rig data that already exists. Keep both dimensions — dual-axis rating is a legitimate differentiator; just make it legible.
- **Benchmark:** SimRacingSetup.com's community database shows ratings out of 5 and lets you filter by average star rating and by lap time; F1Laps displays lap times next to community setups so you can sanity-check quality.
- **Impact:** High · **Effort:** Low–Med

### 3.4 Social proof that hasn't arrived yet
- **Current problem (observed):** The homepage says "Every setup shows Pace and Predictability ratings so you know exactly what you're getting before you download." The featured cards show `0 downloads` and `1 rating` each; the leaderboard lists four contributors, three with `0 setups · 0 upvotes`; a page anywhere says "20 setups". "Verified" is a self-attached video link or telemetry file (the upload form says so explicitly: "Add proof only if you have it") — which is fine, but it's presented with the same visual weight as a validated claim.
- **Recommended change:** Say "new" honestly — hide `0` stats, replace "1 rating" with "Not yet rated" (the component already has that string), show "New" instead of a fake-progress percentage, add a tooltip to "Verified" stating the evidence and link it, and rewrite the homepage claim to what's true today ("community-rated, no paywall, rig-matched") so it becomes true *and* verifiable as the library grows.
- **Benchmark:** Market leaders stake trust on provenance (pro drivers, 10k+ esports pedigree, telemetry validation) and on visible volume ("300+ million laps", "2,500+ pro setups"). A small community's credible move is transparency, not borrowed confidence.
- **Impact:** High · **Effort:** Low

### 3.5 The card is doing too much work
- **Current problem (verified in code):** A browse card carries a compare checkbox, report link, share button, favourite, upvote, download, plus three collapsible panels (**Setup values**, **How to install this setup**, **Version history** with diffs — Version history and Comments are lazy-loaded components), an expandable **Rate this setup** widget with two star rows, two rating bars, rig chip, date, tags and a lap-time/Verified block. That's ~12 interactive targets per card, repeated across a grid. The report link — used by a vanishing minority — is permanently visible on every card.
- **Recommended change:** Progressive disclosure by surface. On the **browse grid** keep: lap time + Verified, car/track, tags, rig, rating stars, download, save, compare — and a compact "Details" link. Move values/install/history/comments to the **detail page**, where they should be *open by default* (values first, install second). Demote "Report setup" into an overflow menu beside Share.
- **Benchmark:** F1Laps and SimRacingSetup keep the browse row scannable and put detail on the setup page; Delta and VRS present one primary action per surface.
- **Impact:** Med–High · **Effort:** Low–Med

### 3.6 Mobile: five selects, no summary, no stickiness
- **Current problem (verified in code):** The filter panel is a `grid-cols-2` block of five selects (Game, Car, Track, Condition, Rig) at the top of the page, followed by Compare/Sort, then cards. On a phone that's five taps + a scroll before you've filtered anything, and once you scroll into results there is no persistent way to see or change what's applied. Filter *state* is excellent (URL-synced, `localStorage`-restored) — the *surface* isn't.
- **Recommended change:** Collapse filters into a sticky "Filters (2)" button opening a bottom sheet on small screens, show applied filters as removable chips above results, and add a "Sort" chip. Keep the desktop grid as-is.
- **Benchmark:** Garage61's and F1Laps' browse flows are filter-first with visible applied state; mobile-first listing patterns universally use a sheet + chips.
- **Impact:** Med–High · **Effort:** Low–Med

### 3.7 Install instructions sit in the wrong place in the hierarchy
- **Current problem:** "How to install this setup" is one of three collapsed panels *inside* the card component — on both the grid and the detail page — sharing visual weight with "Version history" and "Comments". Installation is the second-most-important action in the product (after choosing), and for manual-entry titles it's *the* action.
- **Recommended change:** On the detail page make it a numbered, first-class section directly under the values ("1. Download · 2. Put it here [Copy path] · 3. Load it in-game"), with the "File import supported / Manual entry only" distinction headline-visible. On the grid, omit it entirely.
- **Benchmark:** Coach Dave/GO Setups win on exactly this step; their marketing leads with auto-install, not with file browsing.
- **Impact:** Med–High · **Effort:** Low

### 3.8 Compare is a hidden feature with a dead-end page
- **Current problem (observed on live site + code):** `/setups/compare` renders "Pick two setups to compare · From the Browse Setups page, turn on 'Compare setups' and select two cards…" with a single "Browse Setups" button. It never appears in the header nav. Two setups maximum. No pickers on the page itself.
- **Recommended change:** Host pickers on the compare page (search two/three setups inline), allow 3–4 columns, deep-link comparisons from setup pages ("Compare with…"), and add "my saved setup" as a comparison slot.
- **Benchmark:** Setup diffing is mainstream in this hobby (community-built `.sto` diff tools; Delta/VRS compare against reference laps). SetupSheet's value-level diff is better than most free offerings — surfacing it is cheap.
- **Impact:** Med · **Effort:** Med

### 3.9 Leaderboard and creator pages under-sell the community
- **Current problem (observed):** "Top Contributors — ranked by total upvotes" lists four rows; ranks 2–4 show `0 setups · 0 upvotes`. No time window (weekly/monthly), no per-game view, no explanation of badge tiers (Bronze 10 / Silver 50 / Gold 200 upvotes — defined in code, invisible in UI). Profile pages show Setups / Upvotes / Ratings / Followers counts and a Follow button, but no "best setup", no rig, no activity recency, and no "setups by this author for your car".
- **Recommended change:** Hide zero-activity rows, add week/month windows and a per-game toggle, show tier thresholds with progress, and enrich profiles with rig + best-performing setup + last-uploaded date.
- **Benchmark:** Any community leaderboard that shows zeros reads as a ghost town — the standard is minimum-activity gating plus time windows.
- **Impact:** Med · **Effort:** Low–Med

### 3.10 Upload friction for the seven games that don't parse
- **Current problem (verified in code):** The upload form is strong where it's strong — ACC `.json` files are parsed and prefilled, drafts autosave with "Restored your unsaved draft / Discard", telemetry proof is a separate optional section, and there's a toast/route flow afterwards. For everything else, the values grid mirrors the game's setup screen and must be filled by hand, presumably by alt-tabbing to the game.
- **Recommended change:** Add paste-import and "duplicate an existing setup"; mark which fields are required vs nice-to-have up front (the validation layer already distinguishes them); show a "your setup will be comparable once values are filled" nudge so authors understand why the extra work pays off.
- **Benchmark:** F1Laps and Garage61 avoid manual entry by importing game data; where typing is unavoidable, the best community sites frame it as "how your setup gets found".
- **Impact:** Med · **Effort:** Med

### 3.11 Sort labels don't explain themselves
- **Current problem (verified in code):** Sorting offers Newest, Trending, Most Downloaded, Safest, Fastest. "Trending" is implemented as raw upvote count (not recency-weighted), "Safest" is predictability, "Fastest" is lap time — three non-obvious mappings, with no tooltips and no indication of which is the site default.
- **Recommended change:** One-line descriptors ("Trending — most upvoted", "Safest — highest predictability"), and make "Trending" actually recency-weighted (or rename it "Most upvoted").
- **Benchmark:** Marketplace sorting is expected to be self-explanatory; ambiguous sorts silently train users to ignore the control.
- **Impact:** Low–Med · **Effort:** Low

---

## 4. What to Take Away (or Simplify)

### 4.1 "Report setup" out of the card face and into an overflow menu
- **Why:** It appears on every card of every grid (homepage, browse, profile) — a moderation affordance competing for attention with the purchase-equivalent action (Download). Reporting is rare; hiding it costs nothing and cannot be considered inaccessible because it stays one tap away.
- **Evidence:** Moderation actions are conventionally secondary (overflow menus on Printables/Discord/Reddit); the community guidelines already frame reporting as an exception path.
- **Impact:** Med · **Effort:** Low *(Remove from primary layer, keep the capability)*

### 4.2 Three collapsibles per card on the browse grid
- **Why:** Values, install guide and version history are all *detail-page* concerns, and each collapsed panel is a "what's behind this?" decision the user must process while scanning. Compare's job is comparison; details belong on the detail page.
- **Evidence:** F1Laps/SimRacingSetup cards show a fast scan-line of facts with the setup sheet one click away.
- **Impact:** Med–High · **Effort:** Low–Med *(Simplify — do not delete the panels, move them)*

### 4.3 Duplicate search affordances with different copy
- **Why:** Two boxes, two scopes, three placeholder strings ("Search track or car", "Search cars or tracks", "Search by car, track, game, or tag…"). Consolidating to one vocabulary removes a small but repeated "is this the same search?" tax.
- **Evidence:** Search is the most trust-sensitive control on a content site; inconsistent scope is a classic cause of silent under-recall.
- **Impact:** Med · **Effort:** Low

### 4.4 Two verification badges that mean similar things
- **Why:** Cards can show "Verified" and "Verified Lap" (`isVerifiedLap`, plus a lap-time "Verified" tag). To a new user they read as two unrelated certifications. Pick one badge, one tooltip, one definition; if both concepts matter, name them differently ("Lap proof attached" / "Telemetry attached").
- **Evidence:** Verification only works when users can state what it means; the community guidelines already have the definition — surface it.
- **Impact:** Med · **Effort:** Low

### 4.5 Bare numbers without labels
- **Why:** "1 rating" then a lone "1" (upvotes) then "Rate this setup" is a puzzle, not a summary. Add "12 upvotes", "3 ratings", and consider removing upvotes from cards entirely if they duplicate rating signal.
- **Evidence:** Unlabelled counters are the most common cause of "wait, what does this number mean?" on data-card UIs.
- **Impact:** Med · **Effort:** Low

### 4.6 Homepage CTA repetition
- **Why:** "Upload Your Setup" appears in the header, the hero, the featured-rail footer, the final CTA band, and the empty states nearby — while the primary first-time job is *finding* a setup. Keep the hero CTA focused on Browse, keep Upload in the header, and let one closing band carry the upload pitch.
- **Evidence:** Single-primary-CTA heroes convert better for first-time visitors; secondary CTAs belong at decision points, not stacked.
- **Impact:** Low–Med · **Effort:** Low

---

## 5. Competitive Benchmark Snapshot

### 5.1 Direct and aspirational competitors

| Competitor | Model | What they do better | What they do worse / differently |
|---|---|---|---|
| **Coach Dave Academy — Delta** ($11.99/mo, $109/yr) | Pro setups + AI coaching app | **Auto-install** into game folders; AI "Auto Insights"; 7 sims; weekly updates; race/quali/wet variants; bundles SimGrid Pro | Paywalled; no free community library; no rig-based filtering |
| **VRS / Virtual Racing School** ($4.99–$9.99/mo, free casual tier) | Pro setups (iRacing only) | Driving Analyser telemetry vs pro reference laps; unique oval/dirt/rallycross coverage | Manual file downloads (no auto-install); iRacing-only; no dark mode (per community complaints) |
| **Garage61** (free + Pro ~$6.50–7/mo) | Community telemetry + setups | Setup **sync** into iRacing folders incl. paid-shop packs; massive lap pool; filters by car/track/weather/lap time/setup type | iRacing-only; advanced filtering and others' telemetry are Pro-gated; quality uncurated |
| **Track Titan** (free + $8–20/mo; Hymo setups $12.99–16.99) | AI coaching + pro setups | Onboarding driver profile + sim preferences → personalized experience; mobile-friendly UI; prescriptive AI insights; "Strava of motorsport" positioning | Setups tied to subscription; heavier install/logger setup; no community library |
| **F1Laps** (free + €2.99/€6.99) | Community setup DB + game telemetry | Guided browse (game → track → conditions); lap-time context on setups; auto-import of game data; tiered free product | F1 titles only; telemetry charts paywalled; no rig profiles |
| **SimRacingSetup.com** (free community + pro bundles, $7.99–15.99/mo) | Community + pro setups (F1, ACC…) | Ratings out of 5; **filter/sort by average rating or lap time**; browse by creator; feedback threads to the author | No auto-install; no rig filtering; mixed editorial/commercial content |
| **GO Setups / Grid & Go / Apex / Craig's** ($5–15/mo; Craig's via Twitch Prime) | Pro setup subscriptions | Auto-installers (GO Fast app, Grid & Go via Garage61, Apex folder sync); Virtual Coach overlay (Grid & Go); endurance/special-event packs | Closed libraries; subscription required; no community contributions |
| **Popometer / Virtual Race Car Engineer** (à-la-carte / overlay suite) | Telemetry + setup engineering tools | Best-in-class line/telemetry visualisation (Popometer); in-sim setup engineering with ranked change suggestions (onRails) | Specialist tools, not shareable public libraries |

### 5.2 QoL dimension matrix (SetupSheet vs the field)

Rating: ✅ leads · ➕ matches · ⚠️ partial · ❌ lags

| QoL dimension | SetupSheet | Coach Dave Delta | VRS | Garage61 | Track Titan | F1Laps | SimRacingSetup |
|---|---|---|---|---|---|---|---|
| Browse with no account | ✅ | ❌ | ⚠️ free tier | ✅ | ⚠️ free tier | ✅ | ✅ |
| Download with no account / no paywall | ✅ | ❌ | ⚠️ | ⚠️ Pro-gated in places | ❌ | ⚠️ | ✅ |
| Values readable without downloading | ⚠️ (panel, collapsed) | ✅ in-app | ✅ in-app | ⚠️ permissions vary | ✅ | ✅ on page | ✅ on page |
| Install effort | ❌ manual | ✅ auto-install | ❌ manual | ✅ sync | ⚠️ app setup | ❌ manual (in-game entry) | ❌ manual |
| Hardware/rig-aware matching | ✅ unique | ❌ | ❌ | ⚠️ setup type | ❌ | ❌ | ❌ |
| Filter/search quality | ⚠️ good facets, split search, no counts | ⚠️ app search | ⚠️ | ✅ powerful (Pro-gated) | ⚠️ | ✅ guided | ✅ rating/lap-time filters |
| Ratings & trust signals | ⚠️ dual-axis, thin data, % display | ✅ pro pedigree | ✅ pro + telemetry | ⚠️ community, uncurated | ✅ AI-validated | ⚠️ | ✅ rating filters |
| Personalization / smart defaults | ❌ | ⚠️ app prefs | ⚠️ | ⚠️ | ✅ driver profile | ⚠️ game selection | ❌ |
| Mobile / rig-side convenience | ⚠️ responsive only | ✅ app | ⚠️ | ⚠️ agent + web | ✅ mobile UI | ⚠️ | ⚠️ |
| Support / recovery / community space | ❌ no FAQ, no Discord | ✅ courses, Discord | ✅ Discord/coaching | ✅ Discord + Pro support | ✅ guides | ⚠️ FAQ | ⚠️ blog |
| Telemetry / delta analysis | ❌ (files only) | ✅ | ✅ | ✅ | ✅ | ⚠️ Champion tier | ❌ |
| Free-of-charge library breadth | ✅ 8 sims, free | ❌ | ❌ | ⚠️ iRacing only | ❌ | ⚠️ F1 only | ⚠️ F1-heavy |

### 5.3 Notable patterns and emerging standards

1. **Installation is being automated away.** Auto-install/sync is now a headline differentiator among paid shops and Garage61. Manual file placement is the residual pain point users are actively shopping to remove.
2. **Telemetry is becoming the trust layer.** Reference laps, ghost laps and delta analysis are how the market proves a setup is good; "verified" without data is increasingly a weak signal.
3. **AI turns data into instructions.** Auto Insights / Track Titan / Trophi / TrackPro are competing on *prescriptive* feedback ("brake 5 m later") rather than charts.
4. **Onboarding is a profile, not a homepage.** Track Titan's driver-profile-then-feed pattern is the emerging default; generic "trending" rails are table stakes, not differentiation.
5. **Mobile is a second screen at the rig, not a mobile site.** SimHub/SIM Dashboard behaviour proves the phone/tablet is already at the rig; nobody serves a setup sheet there.
6. **Free community libraries compete on filtering and creator identity.** Star ratings, lap-time filters, and creator pages (SimRacingSetup, F1Laps) are the baseline for a UGC setup database.
7. **Variants are expected content, not a bonus.** Race/quali/wet/endurance is the standard taxonomy; SetupSheet's tags gesture at this but aren't enforced.

**Where SetupSheet leads:** free-and-anonymous access; rig-profile matching; per-game install honesty (file-import vs manual); value-level version diffs; a community request board; `/` search and dark mode polish.
**Where it matches:** faceted browse, favourites/follows, notifications, profile pages, shareable filter URLs.
**Where it lags:** install effort, telemetry/delta depth, personalization, mobile rig convenience, support surfaces, perception of trust at small scale.

---

## 6. Prioritized Roadmap

### Quick wins (low effort, high impact)

| # | Item | Category | Impact | Effort | Competitive rationale |
|---|---|---|---|---|---|
| Q1 | Four-state empty/error model with Retry; remove empty-state-on-error contradiction on `/requests` and `/setups` | Improve | High | Low | Market sites never present an outage as an empty library |
| Q2 | Honest social proof pass: hide `0` counts, "Not yet rated", "New" instead of fabricated %, tooltip on Verified, rewrite the homepage claim | Improve | High | Low | Small libraries win trust through transparency, not borrowed pro-pedigree language |
| Q3 | Rating legibility: stars + count + labelled upvotes + rig context | Improve | High | Low | SimRacingSetup/F1Laps show star ratings with counts; percentages alone are opaque |
| Q4 | Install guide promoted to a numbered section on the detail page, with **copy path** buttons | Improve | High | Low | Installation is the market's #1 friction and SetupSheet's content already exists |
| Q5 | Rig Mode v1 (full-screen values, tap-to-copy, wakes lock, no chrome) + QR handoff from desktop | Add | High | Low–Med | Phone-at-the-rig is proven behaviour; no setup DB serves it |
| Q6 | Demote "Report setup" to the overflow menu; label stray counters | Remove/Simplify | Med | Low | Fewer competing targets per card = faster scanning |
| Q7 | Sort labels + one-line definitions; rename/rework "Trending" | Improve | Low–Med | Low | Ambiguous controls get ignored |
| Q8 | Leaderboard: hide zero-activity rows, add week/month + per-game views, show badge thresholds | Improve | Med | Low | Zero-rows read as abandonment |
| Q9 | Help hub page + Discord invite; unify install guides into an index | Add | Med | Low | Every commercial competitor pairs product with guides and a community space |
| Q10 | Download-install bundle: `.zip` with file + `README.txt` containing the target path | Add | Med–High | Low | Bridges the gap to auto-install without shipping an agent |

### High-impact projects (strong ROI)

| # | Item | Category | Impact | Effort | Competitive rationale |
|---|---|---|---|---|---|
| H1 | Unified server-backed search with debounce, result counts per filter option, and "search all setups" affordance | Improve | High | Med | Garage61 searches tens of millions of laps; a capped client-side search silently under-recalls |
| H2 | My Garage personalization (sims, rig, skill) → default filters, "For your rig" rail, resume state | Add | High | Med | Track Titan's onboarding model; converts a generic homepage into a personal one |
| H3 | Trust v2: verification definitions + evidence display (video/telemetry/patch validity), rig-weighted ratings | Improve | High | Med | Telemetry is the market's trust currency; rig context is a unique, defensible angle |
| H4 | Mobile filter sheet + applied-filter chips + sticky "Filters (n)" | Improve | High | Low–Med | Standard mobile listing pattern; today it's five stacked selects |
| H5 | Compare 3–4 + compare-with-my-setup + pickers on `/setups/compare` + nav entry | Improve/Add | Med–High | Med | Diffing is core hobby behaviour and SetupSheet already has the best free implementation |
| H6 | Duplicate-and-tweak + paste-import for non-parsed games | Add | Med–High | Med | Variants are expected content; manual entry is the top contribution barrier |
| H7 | Milestone notifications, badge progress, weekly/digest hooks | Add | Med–High | Med | Retention engine for UGC; notification plumbing already exists |
| H8 | Watch car/track + "+1" on requests + auto-match existing setups when a request is posted | Add | Med–High | Med | Turns demand signalling into a pull loop nobody else offers |
| H9 | Stale/validity metadata ("works with patch/season", "updated N days ago") + author "still valid" action | Add | Med–High | Med | Weekly-update promises are the paid market's norm; patches silently invalidate setups |

### Strategic / longer-term

| # | Item | Category | Impact | Effort | Competitive rationale |
|---|---|---|---|---|---|
| S1 | Companion sync bridge (small Windows helper or integration with Garage61/iRacing folders) | Add | High | High | Auto-install is the market's direction; a free community site owning this would be a step change |
| S2 | Telemetry/delta layer — partner or integrate (Garage61-style lap comparison, reference laps attached to setups) | Add | High | High | Reference-lap comparison is how the category validates quality |
| S3 | Creator programs: follows with notifications, creator dashboards, "setup packs", verified-pro badges | Add | Med–High | High | Community libraries compete on creator identity and recognition |
| S4 | Indexable game/track landing pages ("Le Mans Ultimate setups at Monza") with structured data | Add | Med–High | Med | F1Laps/SimRacingSetup dominate organic discovery this way; also fixes the sitemap thinness noted in the technical audit |
| S5 | Public API / embeds so creators can share a setup sheet anywhere (Discord embed, forum iframe) | Add | Med | Med | Distribution follows the setups into the places racers already gather |
| S6 | Beginner onboarding path ("first setup in 3 steps", guided tour, glossary of what each value does) | Add | Med–High | Med | The category's biggest addressable audience is newcomers; nobody serves them well in free tools |

---

## 7. Risks & Considerations

### 7.1 Downsides of the proposed removals
- **Card simplification (Q6, 4.2):** a minority of users browse *and* install from the grid without opening a detail page. Removing panels from cards could break that loop. Mitigation: measure grid→detail CTR and downloads-per-session before/after; keep a values **peek** (first 3 rows) on the card as a compromise; keep the install guide one click away.
- **Demoting "Report setup":** keep it in the overflow menu on every surface where it exists today (cards, detail, profiles) so nothing becomes unreachable — moderation coverage is a safety and legal concern, not just UX.
- **Honest social proof (Q2):** showing "New"/"Not yet rated" reduces the number of visible "signals" and can *lower* perceived quality in the short term. Accept it: fabricated confidence converts once and destroys trust permanently, and the site's differentiator is community honesty.
- **Hiding zero-activity leaderboard rows (Q8):** reduces the visible contributor count from 4 to 1. That's honest, but pair it with "Newest contributors" or "First setups" framing so the board isn't a one-name wall.

### 7.2 Implementation notes and dependencies
- **Search unification (H1) depends on the payload cap work** (`SETUPS_BROWSE_LIMIT = 128` on the browse index). The client can no longer be the search authority; that's exactly why the server must own it. Do the server query first, then decide whether the browse index cap can rise or should fall further.
- **Rig Mode (Q5/S1) ships in two steps:** a device feature (Wake Lock, full-screen, big type) needs no infrastructure; a *sync agent* needs Windows code signing, an installer, security messaging ("this puts files in your game folder"), update infrastructure and support capacity. Consider staying agent-free and integrating with Garage61/iRacing folder conventions instead — a partner integration avoids the trust cost of shipping an executable to hobbyists.
- **Personalization (H2) needs a persistence decision:** anonymous users have only `localStorage` (`setupsheet:last-filters` already exists), signed-in users have a profile row. Ship the anonymous version first; migrate to profile on login. Keep it private by default — the privacy policy currently promises no third-party analytics, so personalization must not require third-party scripts (the in-house `TelemetryProvider` is the right instrument).
- **Rating changes (H3) touch existing data:** no schema change is needed for stars (they exist); rig-weighted aggregation can be a read-time computation. Do **not** retroactively alter stored aggregates without a migration plan — display-layer changes are reversible, stored rewrites are not.
- **Verification tightening (Q2/H3) can demote existing setups.** Grandfather what exists, mark it "proof attached" rather than removing a badge, and publish the definition before enforcing it.
- **Notifications (H7) must be rate-limited** (a per-user weekly cap, digest-style batching) or they'll train users to ignore the bell — the opposite of the intended effect.
- **Analytics instrumentation:** the newly shipped `TelemetryProvider` already emits page views and client errors as structured JSON with query strings stripped. Extend it with explicit **task events** (filter applied, compare started, values copied, download started/completed, install guide opened, QR opened, Rig Mode opened) before making any claim about improvement.

### 7.3 How to validate the recommendations
**Quantitative (instrument first, then A/B or sequential):**
- **Core funnel:** setup page views → download starts → downloads completed; values-panel opens per view; install-guide opens per download.
- **Search/filter health:** zero-result searches per session, filter-reset rate (the clearest signal of filter friction), searches that end in a download vs an exit.
- **Contribution funnel:** upload form starts → publishes; time-to-publish; abandonment point per field group; draft-restore usage.
- **Trust signals:** rating participation rate per setup; votes per view; report volume (should stay flat or fall when reporting is demoted).
- **Retention:** D7/D30 return rate for contributors vs browsers; notification open rate after milestones ship.

**Qualitative / testable:**
- **Rig-side task test (the killer test):** 5–8 users, desktop → phone handoff, "get this setup into your game and read the values" — measure time-to-first-copied-value and time-to-in-game. Compare QR → Rig Mode vs the current download-then-hunt-the-folder flow.
- **First-run comprehension:** 5-second test on the homepage — can a new racer say what the site is and what to click? Repeat for "what does Verified mean?" and "what is Predictability?".
- **Filter usability (mobile):** moderated test of the sticky-sheet vs current grid; measure taps and mis-applied filters.
- **Compare tool:** unmoderated task "decide which of these two setups to use" with and without the comparison view; time-to-decision and confidence rating.
- **Competitive teardown sessions:** have 3 racers perform the same task (find and install a GT3 setup for a specific track) on SetupSheet, Garage61 and Delta; log every friction point — this is also the fastest way to keep the roadmap honest about what "modern and considerate" means in this category.

### 7.4 Limitations of this audit
- **No signed-in journey was executed.** Sign-in is Discord OAuth; without an account I could not post a comment or rating, upload a setup, open the notification bell, edit a profile, or see the requests board with data. Those surfaces were reviewed in the source that ships the site (Next.js App Router pages and components) rather than observed in use — claims about them are marked "(verified in code)".
- **The live site is small (20 setups, 1 prolific contributor).** Volume-dependent qualities — search relevance, leaderboard motivation, requests board dynamics, rating credibility — are judged partly on cold-start behaviour rather than steady-state, which is arguably the more useful lens for the next 6 months.
- **No browser rendering.** Content-dependent pages were retrieved as text (no JavaScript execution), so anything client-only was verified against the deployed codebase instead of pixels. Mobile behaviour was assessed from responsive markup/breakpoints (`grid-cols-2 lg:grid-cols-5`, `hidden xl:block`, `md:hidden`), not from a device.
- **No product analytics were available**, so impact estimates are benchmarks-informed judgements, not measurements of this site's own funnels.
- **What additional access would improve this audit:** (a) a signed-in account, so the contribution, notification and moderation flows can be walked; (b) read access to usage analytics (sessions, searches, conversion per step), which would let the roadmap be reordered by measured friction rather than inferred friction; (c) one real mobile session at a rig, to time the install step end-to-end.

---

## 8. Remediation log

### Slice A — honesty, recovery, and legibility (shipped)

Chosen by the site owner as the first of three agreed slices (A → B → C). Scope: Q1, Q2, Q3 (display half), Q6, Q7 from section 6.

| Item | What changed | Verification |
|---|---|---|
| **Q1 empty ≠ error** | `getCachedBrowseRows`/`getSetups` now report a `failed` flag instead of swallowing errors into `[]`, and `app/setups/page.tsx` passes it through. New `RetryButton` (client) + `EmptyState tone="error"` (red, `role="alert"`). An unreachable database now renders "Couldn't load setups / Couldn't load the requests board" with a Try again action — and the result count ("0 setups found") is suppressed so an outage can't read as a filter problem. The filtered-empty state ("No setups match your filters" + Clear filters) is unchanged, and a global-empty library still reads as quiet rather than broken. `Load older setups` failures gained a retry too. | 5 new tests (`empty-state.test.tsx`, `setups-browser-outage.test.tsx`); **live probe with the database actually unreachable**: `/setups` → "Couldn't load setups" + Try again, no "No setups yet"; `/requests` → "Couldn't load the requests board" + Try again, no "No requests yet"; filtered `/setups` → outage state, not the filter-empty copy |
| **Q2 honest social proof** | A file being attached no longer renders a "Verified" badge — it now reads "File included". "Verified Lap" keeps its name and gains an in-place definition ("the author attached a hotlap video or telemetry… not a site verification"). Zero download counts are no longer advertised as "0 downloads" (the row says "Be the first"). Homepage card rewritten from "so you know exactly what you're getting" to "Rated, not ranked by hype… New ones show as unrated until racers have run them", and the featured rail's "Trending this week" (it is an all-time upvote sort) now reads "Most upvoted". | 4 new tests (`setup-card-honesty.test.tsx`); homepage copy confirmed live |
| **Q3 rating legibility** | `RatingBar` prints the 5-star value ("★ 4.3") instead of a bare "85%", with the percentage moved to the tooltip and proper `aria-valuemax`/`aria-label`. Unrated setups no longer draw two 0% bars (which read as "rated badly") — they say "Not yet rated — be the first to say how it drives", and the caption is "3 ratings · average out of 5". The upvote control shows "12 upvotes" instead of an unlabelled counter, and its accessible name carries the count. | 4 new tests (`setup-card-footer.test.tsx`) |
| **Q6 report demoted** | Card actions collapsed into one overflow menu: Share and Report are one tap in, instead of two permanent icons on every card of every grid. | 1 new test asserting the report link is not in the card face |
| **Q7 sort honesty** | Labels now describe the sorts: "Newest first", "Most upvoted" (was "Trending" — the value stays `trending` so shared `?sort=` URLs keep working; there is deliberately no recency weighting), "Most downloaded", "Safest (predictability)", "Fastest lap time". | 1 new test over the exported label list |

Gates after the slice: `tsc --noEmit` clean · `eslint` clean · **41 files / 231 tests pass** (was 37/218) · `next build` passes · performance budget **34 chunks / 407.0 KiB gzip** (was 36/405.9 — the overflow menu reused an already-shipped chunk).

Deferred within the slice's spirit: rig-context rating aggregation ("rated by 3 wheel users") needs a `rig` snapshot on `setup_ratings`, which the owner chose to skip for now (display-only rating fixes).

Still queued: **Slice B** (install-assist: numbered install section, copy-path buttons, downloadable install bundle) and **Slice C** (Rig Mode, QR handoff via `uqr`, print/PDF stylesheet).
