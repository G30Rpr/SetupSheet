# Cold bootstrap under managed PostgreSQL permissions

The historical Garage migrations pass when a fixture uses SUPERUSER, but a
fresh managed Supabase project uses a non-superuser `postgres` operator.
Staging exposed three gaps: 0030's redundant ALTER ROLE of protected flags,
0031/0032's ownership transfers without schema CREATE for the target role, and
replacement of writer-owned functions without inherited ownership privileges.

`scripts/prepare-managed-bootstrap.mjs` prepares a transaction body for one
reviewed source file. It does not connect to a database, execute SQL, modify
source migrations, grant release permission or reconcile migration history.
By default it emits JSON containing the original and executed SHA-256 hashes,
the adaptation list and SQL. `--sql` emits only the transaction body:

```sh
node scripts/prepare-managed-bootstrap.mjs --operator postgres 0030_garage_private_workflow.sql
```

Use only for approved **cold, isolated targets**, with no Auth users or Storage
objects, and an explicitly selected non-superuser operator. Execute each body
in its own transaction. Target identity, credentials, pending-file inventory,
history entries and approvals belong to the delivery procedure, not this
offline helper. It is not a SQL sanitizer and must only consume reviewed
repository migrations. Existing-data upgrades use the normal forward migration
process; do not edit applied files or replay a historical chain over them.

The adaptations match the empty-staging installation:

- Reviewed historical outer BEGIN/COMMIT pairs are supplied by the runner.
  Unexpected boundaries fail preparation.
- 0005 locks the setups table and asserts that the removed game has no rows,
  replacing a legacy deletion that is unnecessary on an empty target.
- 0030 preserves restrictive CREATE ROLE flags, asserts them instead of trying
  to ALTER protected attributes, and uses transaction-local
  `createrole_self_grant='set'` for the trusted creator's ownership transfer.
  Temporary operator inheritance remains active through the subsequent EXECUTE
  revokes/grants: without owner privileges, PostgreSQL can warn and leave the
  default anonymous EXECUTE grant intact. Inheritance is removed before commit.
- Later files temporarily let the trusted operator inherit the minimal writer
  role for owned-routine updates. 0031/0032 temporarily grant writer CREATE on
  public for their ownership transfers. These permissions are restored before
  commit, with postflight checks. No API role receives writer membership.
  The baseline routine's authenticated-only EXECUTE contract is reconciled
  while ownership privileges are active, including when resuming an earlier
  partial bootstrap whose revokes only produced warnings.

Every body checks the current operator is not a superuser, refuses populated
Auth/Storage targets, and uses a five-second lock timeout. Writer checks enforce
no login, inheritance, superuser, database/role creation, replication or RLS
bypass; no lasting schema CREATE; no API membership; and no lasting operator
inheritance. A failed statement rolls back its transaction's temporary grants.

## Regression checks

```sh
npm run test:bootstrap
# Dedicated plain loopback PostgreSQL 16+ fixture only:
npm run test:db:managed
```

The SQL harness refuses remote/service overrides, existing API/writer roles
and an existing test database. A fixture administrator creates a scratch
database and non-superuser CREATEROLE operator; the platform shim and **every
source migration** then execute under that operator. It checks final role and
RLS state, function ownership, positive owner Garage/baseline creation,
cross-user isolation and anonymous execution denial. Fixture users and the uid
helper change roll back; the scratch database and fixture roles are removed.

CI runs this on PostgreSQL 16 and 17, alongside the existing unmodified-source
migration suite. The latter remains important: the preparation path does not
prove that historical SQL itself runs unmodified under managed permissions.
The shim approximates managed schemas/privileges and does not test hosted
Auth, PostgREST, Storage, OAuth or provider settings. The fixture's SET ROLE is
test scaffolding; its session administrator remains privileged, while SQL and
object creation are checked against a non-superuser current_user.

The test deliberately restores a stale anonymous baseline EXECUTE grant after
0030 to reproduce partial-bootstrap drift; the next non-superuser transaction
must remove it. Warning-only ineffective privilege statements fail the harness.

The previously prepared hosted staging resume bundle pins its own 33-file
checkpoint and target. Adding this helper does not apply its remaining files,
change that checkpoint, activate Storage or promote production. See #49/#74
for actual hosted progress and unresolved release gates.
