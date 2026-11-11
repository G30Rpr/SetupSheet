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

- [ ] Review at 390, 768, 1024, 1280 and 1440 CSS pixels in both dark and light modes
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

## Current evidence (2026-11-11)

- Commit `1855ff84566b26a36b48a5d2a0fe04f1578de38b` had all three GitHub CI jobs succeed, and its Vercel preview was READY.
- A later change fixes immersive Rig Mode's nested header/footer visibility, and `e2e/release-qa.spec.ts` adds automated responsive/browser coverage. **Latest commit CI must be rechecked before release.**
- Manual browser QA, authenticated live-data workflow testing, Web Vitals field verification and explicit production rollback preparedness are **not completed**.
- No merge or production deploy is authorized by this checklist itself.

## References

- Roadmap: https://github.com/G30Rpr/SetupSheet/issues/20
- Review branch PR: https://github.com/G30Rpr/SetupSheet/pull/21
- Earlier green GitHub CI: https://github.com/G30Rpr/SetupSheet/actions/runs/43103685065
