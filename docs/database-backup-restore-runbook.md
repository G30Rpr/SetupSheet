# SetupSheet: encrypted backup and isolated restore (operator-only)

**Status: instructions prepared; no backup has been taken or verified by ChatGPT.**

Audit blocker: [issue #26](https://github.com/G30Rpr/SetupSheet/issues/26). Supabase Free does not provide automatic daily backups or PITR. The SQL schema changes in audit PRs #22–#25 must remain unmerged until a usable backup **and a tested restore** exist.

## 1. Prepare safely

- Use a trusted workstation or isolated operator environment with PostgreSQL `pg_dump`, `pg_restore`, and `age` installed. Don't run this process in public GitHub Actions or on a shared runner.
- Generate or use an existing **age recipient public key**. Store the matching private identity separately; do not share it in GitHub or a chat.
- Supply `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` (or a secure libpq password source), `AGE_RECIPIENT`, and an absolute `SETUPSHEET_BACKUP_DIR`. Obtain database connection parameters from the Supabase dashboard. Never paste credentials into ticket comments, stdout, or PR descriptions.
- Use a role permitted to dump `public`, `auth`, and `storage` schemas. Confirm the selected connection does not run through a transaction pooler for pg_dump.
- Disconnect other user-facing services from the **isolated restore target**. Never restore over the production database.

## 2. Create encrypted database backup

Execute on an operator-controlled machine:

```bash
bash scripts/backup-supabase-encrypted.sh
```

The script writes only encrypted ciphertext to the specified directory. It removes partial output on failure and avoids printing secrets. The dump includes `public`, `auth`, and `storage` **database schemas**, not actual Storage object bytes or external secrets. A database dump is *not* a full snapshot of the Supabase project configuration, OAuth provider secrets, or deployed Vercel environment.

## 3. Restore test — mandatory before release

1. Provision an **isolated local or explicitly approved staging database** with a compatible PostgreSQL version and Supabase bootstrap schemas/extensions, or use Supabase-supported restore guidance for the target.
2. Decrypt the encrypted dump to a secure local pipe/temp file **only in the isolated operator environment**. Handle the private age identity as a secret.
3. Inspect the archive metadata with `pg_restore --list`. Use `pg_restore` on the isolated destination only, observing role/extension requirements. On full Supabase restores, follow [Supabase backup restore documentation](https://supabase.com/docs/guides/platform/backups) and avoid overwriting managed auth/storage schema definitions blindly.
4. Verify counts for `public.profiles`, `public.setups`, and `auth.users`; check foreign keys, migrations, RLS policies and a safe fake-user login scenario in the isolated environment.
5. Confirm an independent backup of Storage object **bytes** using the Storage API, preserving bucket names, object paths, checksums, size, metadata and access restrictions. Test recovering a sample object in isolated storage.
6. Record UTC completion time, encrypted backup location, results of restore, expected recovery point and recovery time objectives in a private operator record. Do **not** upload the dump, identity, personally identifying records, or database URLs to GitHub.

## Operator-only encrypted restore verification

A second helper, `scripts/verify-supabase-backup.sh`, decrypts the archive in a pipe, checks its PostgreSQL custom-format table of contents, and attempts an all-or-nothing restore into a **pre-existing disposable local PostgreSQL database**. It refuses remote hosts and database names that do not begin with `setupsheet_restore_`. The operator must set:

- `SETUPSHEET_BACKUP_FILE`: absolute path of the encrypted `.dump.age` file
- `AGE_IDENTITY_FILE`: local secret age identity file (never put in GitHub or chat)
- `RESTORE_PGHOST=127.0.0.1`, `RESTORE_PGUSER`, `RESTORE_PGDATABASE=setupsheet_restore_<identifier>`, optionally `RESTORE_PGPORT` and `RESTORE_PGPASSWORD` (or `RESTORE_PGPASSFILE`)
- `RESTORE_CONFIRM_ISOLATED=RESTORE_TO_DISPOSABLE_LOCAL_DB`

Then execute `bash scripts/verify-supabase-backup.sh` on the trusted operator machine.

**Important limitations:** A raw custom-format dump of managed Supabase schemas may require a compatible Supabase local bootstrap, extensions and roles. A successful `pg_restore --list` validates decryptability and archive readability **but does not prove restoration**. A schema/role/extension conflict means the restore has *failed*; do not declare backup verified. Supabase's [official CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) also describes a roles/schema/data sequence and special steps for managed Auth, Storage, Vault, and migration history. Use that supported sequence when a raw custom-format restore cannot recreate the target.

An isolated restore of database rows does **not** validate actual Storage object bytes or re-create Discord OAuth settings. Those require their own independent checks before marking issue #26 complete.

## Automatic migration deployment hazard

**Critical:** Existing `.github/workflows/deploy-migrations.yml` applies pending database migrations automatically on pushes to `SetUpSheet`. Merging a migration PR is therefore an actual production database change, not merely code review. Never merge PRs #22–#25 or #32 before the encrypted backup and isolated restore have been verified and recorded, and the production deployment order has been approved. See [issue #36](https://github.com/G30Rpr/SetupSheet/issues/36) for the workflow release-control gap. Do not disable the automatic runner without a coordinated app/migration deployment process: that previously caused schema drift and outages.

## 4. Audit migration deployment gate

- Confirm the current `SetUpSheet` branch, exact latest security PR SHAs, and all GitHub `db-migrations` and end-to-end checks pass.
- Approve and apply PRs #22 → #23 → #24 → #25 in order, verifying the migration deployment pipeline between each. Document forward-fix commands for each schema change.
- After production release, check public browse/download, Discord login, upload, ratings, private Garage operations, report counts and Vercel/Supabase error logs.
- **Rollback caveat:** Vercel application rollback will not undo Postgres schema migrations. Do not restore an older database snapshot over new user uploads without deliberate data-loss approval.

## Operational review

Revalidate the backup procedure against current Supabase documentation and the project's actual database role/platform before executing. Running this script is a privileged operator action; it is not automatic.
