# November 11 SetupSheet audit checklist

- [x] Remove the explicit transaction from migration 0041 so the deploy runner can apply it.
- [x] Commit each production migration and its history entry in one transaction.
- [x] Restrict the rating weight helper, including databases that already applied 0041.
- [ ] Verify GitHub CI and migration application on a fresh database.
- [ ] Verify production migration history and configure SUPABASE_DB_URL in GitHub Actions.
- [x] Add a CI guard for transaction wrappers in new migrations.
- [x] Refresh weighted ratings when field-test eligibility changes and backfill existing aggregates.
- [x] Reload Browse results when filters change and preserve tied rows during search pagination.
- [x] Store rating reminder dismissals independently of download events.
- [ ] Triage the nine moderate development dependency advisories.
