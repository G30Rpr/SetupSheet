# SetupSheet launch checklist

Updated: 2026-08-28

This checklist separates repository-complete work from actions that require the deployed Supabase, hosting, or search-console environments.

## Repository-complete

- [x] TypeScript, ESLint, unit tests, and production build pass.
- [x] Public Supabase reads are cached without caching viewer state.
- [x] Browse and profile cursor pagination are implemented.
- [x] Author-aware browse search uses the RLS-safe `setup_search` view.
- [x] Setup `updated_at`, profile aggregates, search indexes, and report/deletion tables have migrations.
- [x] Setup/comment reporting intake is private to the reporter and rate-limited.
- [x] Account/data-deletion requests are user-scoped and require manual operator completion.
- [x] Privacy Policy, Terms of Use, and Community Guidelines are linked from the footer.
- [x] Canonical metadata, JSON-LD, robots, sitemap, OG images, semantic headings, and internal links are implemented.
- [x] File extension, size, and recognizable content/signature checks are implemented.

## Supabase deployment

Apply migrations in numeric order. If `0022` is already applied, run:

```text
0023_profile_setup_stats.sql
0024_setup_search_view.sql
0025_account_deletion_requests.sql
0026_content_reports.sql
```

Then verify:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'setups'
  and column_name = 'updated_at';

select extname from pg_extension where extname = 'pg_trgm';

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('account_deletion_requests', 'content_reports');

select * from public.leaderboard limit 1;
select id, author_username from public.setup_search limit 1;
```

Run the repository migration harness in CI:

```bash
npm run test:db
```

## Hosting and security operations

- [ ] Deploy the current branch and confirm the environment contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Configure shared edge/WAF limits for uploads, Server Actions, anonymous download-counter traffic, and repeated auth failures.
- [ ] Configure upload quarantine/malware scanning if arbitrary community files are accepted at scale.
- [ ] Replace repository-based privacy contact language with a monitored legal/privacy contact.
- [ ] Define an operator SLA and procedure for `account_deletion_requests` and `content_reports`.
- [ ] Review the final privacy policy and terms with appropriate legal counsel.

## Browser and performance validation

- [ ] Install Chromium in CI and run `npm run test:e2e`.
- [ ] Run Lighthouse or PageSpeed on mobile and desktop for `/`, `/setups`, a populated `/setups/[id]`, and `/profile/[userId]`.
- [ ] Record LCP element/time, INP, CLS, TTFB, HTML/RSC size, JavaScript long tasks, and image bytes.
- [ ] Establish budgets and monitor real-user Web Vitals after launch.
- [x] Repository chunk budget command is available as `npm run build:budget`.

## Search and content validation

- [ ] Submit `https://setupsheet.app/sitemap.xml` in Google Search Console.
- [ ] Run Rich Results Test and Schema Markup Validator against a populated setup and public profile.
- [ ] Confirm canonical URLs, robots directives, sitemap URLs, and OG images on the deployed origin.
- [ ] Monitor Search Console duplicate, excluded, soft-404, and indexed-page reports.
- [ ] Add game/car/track landing pages and setup tutorials when content growth becomes a priority.
