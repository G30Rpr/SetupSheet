# Recovery verification: operator handoff

This tooling does not restore a database, run migrations, change a hosted project, or satisfy the recovery gate by itself. Use a trusted computer. Never upload database exports, encryption identities, connection URIs, or service keys to GitHub or chat.

## Local export with minimal manual steps

Prerequisites: Python 3.10+, Supabase CLI **3.1.0**, Docker running, PostgreSQL **17+** client tools (`psql`), and `age` / `age-keygen`. Windows operators can use WSL2 with Docker Desktop integration. Use your existing database password; resetting production credentials is not required.

1. Create an age identity with `age-keygen -o /private/path/recovery-identity.txt`, or use an existing identity. Obtain its public recipient with `age-keygen -y /private/path/recovery-identity.txt`. Keep the private identity separate from backup storage and ensure it has an independently recoverable protected copy.
2. From your local checkout of this tooling, run:

   ```bash
   python3 scripts/prepare-recovery-backup.py \
     --output /private/independent-backup-directory \
     --recipient age1YOUR_PUBLIC_RECIPIENT
   ```

3. Enter the production **postgres** connection URI from Dashboard → Connect, then the production **legacy service_role** key when prompted locally. Use a direct connection or the **session** pooler on port 5432. The helper refuses Recovery, arbitrary hosts, transaction poolers and connection overrides. Passwords containing URI special characters must be URL-encoded in the URI. Do not paste either credential into chat or a shell command.
4. A successful run creates encrypted roles, schema, data and migration-history SQL files; each Storage object's bytes; and an encrypted manifest with object paths, original metadata, byte hashes, buckets and counts. No plaintext SQL or object files are written by the helper. CLI subprocess arguments briefly contain the URI, so use a trusted single-user workstation and do not enable process tracing or command debugging. The Supabase CLI itself may maintain its normal local metadata.
5. Keep the whole timestamped directory in independent private storage. An `INCOMPLETE` marker means the export failed. `COMPLETE.json` means **export complete, restore unverified**. It is not a release approval.
6. Prove that the independently stored copy decrypts with your separately retained identity:

   ```bash
   python3 scripts/verify-recovery-export.py \
     /private/backup/setupsheet-TIMESTAMP \
     --identity /private/path/recovery-identity.txt
   ```

   This reads and decrypts every artifact without saving plaintext, checks the ciphertext copy hashes and each Storage object's plaintext SHA-256/size, and refuses incomplete sets. It does not restore SQL or validate application access. The public ciphertext checksum list alone does not replace decryptability or a restore test.

The exports use the [official managed-project CLI roles/schema/data workflow](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), with migration history captured separately. Read the current guide before operating. CLI flags changed in v3 (`--remote=<URI>` replaces older `--db-url` examples).

## Consistency and scope

The helper compares Storage inventories before and after downloading and refuses an observed change, checks byte sizes, and calculates hashes. Separate roles/schema/data exports are **not one atomic snapshot**; this inventory check cannot detect every concurrent application update. Use a coordinated application write pause for the release backup, or an independently reviewed consistent-snapshot mechanism. A rehearsal can reveal restore problems before scheduling that pause.

The helper stops if Vault secrets are present. Supabase encryption root keys, Discord OAuth credentials, Auth/SMTP settings, deployed functions and external service configuration are separate recovery concerns. An empty Vault table does not prove no encrypted columns exist.

The managed export intentionally filters platform objects. Review application customizations on `auth` / `storage` separately, particularly `on_auth_user_created` and Storage RLS policies. The encrypted manifest includes their catalog inventory; it is not an automatic managed-schema restore script. Compare source/target managed columns and required extensions before importing. Do not blindly overwrite platform-owned objects or their internal migration history.

## Restore and verify

Only restore into SetupSheet Recovery (`hhckfwvspmexobzfxnak`), after confirming it is isolated from production callbacks, webhooks, mail, scheduled cleanup and application traffic. Configure a separate Discord application for staging. Never point a staging frontend at production credentials or restored production data at a publicly accessible preview.

Follow the official managed-project restore order, with `ON_ERROR_STOP=1` and an all-or-nothing transaction where supported. Restore application migration history separately and recreate application-managed triggers/policies as reviewed. Recovery has a newer Postgres patch and newer managed services than production; successful provisioning alone is not compatibility evidence.

The SQL inventory can be run on source and Recovery using locally configured libpq credentials:

```bash
psql -XAtq -v ON_ERROR_STOP=1 -f scripts/recovery-inventory.sql > private-inventory.jsonl
```

It runs in a repeatable-read, read-only transaction. Compare exact table counts, constraints, RLS, policies, grants, view options, function execution privileges, managed-schema columns and migration history against backup-time evidence. It selects no individual user records. Use baseline equality before applying proposed migrations; expected changes afterward must be explained by the migration diff.

Recover actual objects through the Storage API, preserving original bucket/path and required metadata. Do not count inserted `storage.objects` rows as restored files. Confirm file ownership and access rules after API uploads, since privileged uploads may not recreate the original owner automatically. Verify hashes and download a setup and telemetry sample through the app.

Then test Discord signup/login, profile ownership, uploads/downloads, public reports and private Garage access, including anonymous and cross-user denial cases. Confirm Auth services still operate with restored users. Record restore duration, backup timestamp, accepted recovery point and retention privately. Share only sanitized pass/fail results.

## Release controls still required

- Production currently records versions `0001`–`0041` plus historical timestamp migrations. The next migration deployment can also apply **0042 and 0043**, which already exist on `SetUpSheet`; rehearse these before 0044–0048.
- Stacked order: #22 → #23 → #24 → #25 → #31 → #32. Retarget/review each subsequent PR against the updated production branch and check its exact final SHA after predecessors merge. Check that an already-applied migration has not changed contents.
- `deploy-migrations.yml` auto-applies pending migrations on qualifying pushes. Vercel deploys independently; an app rollback does not undo SQL. Prove compatibility across the app/migration deployment window and verify server-only download-counter credentials before #24.
- At inspection, GitHub's `Production` environment had no protection rules, and the migration job did not reference an Environment. Adding approval settings alone will not gate that job. Branch-protection inspection returned 403, so its state is unknown. Prepare the coordinated gate/order change before release; do not casually disable migration delivery.
- Run `43095573533` reported `queued` with no jobs, while cancellation returned “completed” and force-cancellation returned HTTP 409 (“not been queued yet”). Its API state remained queued. Resolve the discrepancy in GitHub Actions and confirm no stale production deployment can run before approving a release. No cancellation is claimed successful.
- The workflow's current “dry run” creates the migration tracking schema/table before checking its flag. It is **not strictly read-only**. This review did not trigger it.
- Prefer reviewed forward-fix SQL for a failed migration. A destructive production restore requires a separate decision about writes since the backup. Stop subsequent merges on any failed deployment or health check.

No database-changing PR is cleared to merge by this handoff.
