# SetupSheet UI/UX redesign — release gate

This is the operational checklist for roadmap #20 and draft PR #21. Do not merge to `SetUpSheet`, promote a Vercel preview to production, or change domain aliases until release gates pass. The app's production domain is `setupsheet.app`.

## Automated requirements

- [ ] Latest commit: GitHub CI `lint-test-build` succeeded (ESLint, TypeScript, Vitest, Next build, gzip performance budget, npm audit)
- [ ] Latest commit: GitHub CI `db-migrations` succeeded
- [ ] Latest commit: GitHub CI `e2e` succeeded (includes browser-level responsive smoke tests)
- [ ] Latest commit: Vercel preview reports READY
- [ ] CI output reviewed for skipped tests, unexpected warnings and budget reports

## Human/manual preview verification

**Vercel deployment protection is enabled on preview deployments.** Log into the authorized Vercel account to review them; do not weaken production or preview security to run QA.

- [ ] Review at 320, 390, 768, 1024, 1280 and 1440 CSS pixels in both dark and light modes
- [ ] No unintended horizontal scrolling or clipping; header/nav, search/filter and card grid remain usable
- [ ] Keyboard: skip-to-content, search shortcut, menu/drawer Escape/focus, filter toggles, combobox options, action controls
- [ ] Screen reader: correct headings, labels, status/error announcements, landmark order
- [ ] Zoom to 200% and reflow down to 320 CSS px
- [ ] Reduced motion preference; focus contrast and low-vision color contrast
- [ ] iOS Safari + Android Chrome: Rig Mode, clipboard permissions, optional screen wake lock behavior and exit
- [ ] Anonymous: homepage → search/filter → setup detail → download/installation guide; no login required
- [ ] Authenticated: Discord sign-in, upload file/manual, author note, proof, submit, published setup link, editing and draft restore
- [ ] Failure: upload interruption/retry, partial file cleanup, unavailable DB, request submission, missing setup and fallback flows
- [ ] Same-title setup comparison, mismatched-context warning, no fabricated validation claims
- [ ] Verify Help/Privacy/Terms/Guidelines content exists and all links work. Legal text must remain previously approved content (no fabricated copy).
- [ ] Inspect staging performance/telemetry and p75 LCP, INP and CLS from real traffic; do not substitute bundle-size success for real-world metrics
- [ ] Verify latest changes do not add new SQL migrations, secrets or access restrictions without explicit review

## Production rollout and rollback

1. Review CI, current diff, and a protected preview for the **same commit SHA**.
2. Check that the production branch and Vercel project match the intended `SetUpSheet` deployment configuration.
3. Record the last known healthy production deployment and rollback target.
4. Merge the approved PR and verify production automatically deploys from the intended branch; otherwise perform an explicit Vercel production promotion after reviewing protections and environment variables.
5. Immediately smoke-test `setupsheet.app` anonymously and authenticated (especially download, upload, browse and detail), and check runtime logs.
6. If critical flows regress, rollback to the recorded deployment; capture the failure and revert the PR as appropriate.

## Verified production baseline and rollback (2026-11-12)

Source: authenticated Vercel deployment/project/domain metadata. These deployments are reported **READY**, but this is not a substitute for a live functional smoke test.

- Vercel project: `prj_L99cD7T2yYK6AukZRyhrOhF8Xjwk`; team `team_Mpb9vYnQGYDp39jc8q8SnxHE`
- Domain: `setupsheet.app`, verified and mapped to the project
- Production Git branch: `SetUpSheet`
- Current production deployment ID: `dpl_9FTZrzs8cNJkYPaihRN4gNuY2ijF`
- Current production URL: `https://setupsheet-jxdmzndmt-g30-rpr.vercel.app`
- Current production Git SHA: `f0e030fcfb6ce58edad46af78e3237fbaf416ea5`
- Earlier READY rollback candidate: `dpl_H1vCFnGD79Ac3rE9X5ewfWk2U8GB` (Git SHA `53e3e6c7aebf73abca80246d6160b67e1b5c9c03`)
- Both candidates were marked `isRollbackCandidate: true` when inspected. **Recheck immediately before release** in case deployments or aliases have changed.
- Preview deployments are protected by Vercel SSO. Do not disable the protection or publish credentials.
- `.github/workflows/deploy-migrations.yml` triggers production SQL migration deployment only if `supabase/migrations/**` or that workflow file changes on `SetUpSheet`. Confirm the final PR does not modify those files.
- Hobby runtime logs retain a limited recent interval. A 30-minute production error log aggregation returned no log groups, which is **insufficient to claim no errors**.

## Current automated evidence

- `40c2001dc7a9a0af5a597b803c68ea2a211efdba` passed lint/build, database and Playwright CI: https://github.com/G30Rpr/SetupSheet/actions/runs/43105380896
- `c4996073bb4ccea06a77fc14bc8bbbb4c136bb21` passed all three CI jobs including browser tests: https://github.com/G30Rpr/SetupSheet/actions/runs/43119258855
- New Playwright Pixel 7 **Chromium touch emulation** adds mobile drawer, Browse filters and Help/upload-gate tests. Touch emulation is not a physical Android or iPhone test.
- After each follow-up code edit, **recheck the exact final SHA** before any merge or production deployment.

## Outstanding manual/real-environment checks

- Authenticated flows with real staging data are not tested by CI: its Supabase URL is deliberately unreachable.
- Physical iOS Safari/Android Chrome, assistive technology and clipboard/wake lock checks are still required.
- Core Web Vitals p75 requires appropriate field data; a passing JavaScript bundle budget does not establish field performance.
- Production rollback candidate is recorded above but rollback itself must be pre-approved; do not exercise against live production as a test.
- No merge, production deploy or rollback is authorized by this checklist.

## References

- Roadmap: https://github.com/G30Rpr/SetupSheet/issues/20
- Review branch PR: https://github.com/G30Rpr/SetupSheet/pull/21
- Earlier green GitHub CI: https://github.com/G30Rpr/SetupSheet/actions/runs/43103685065
