# Combined staging release candidate

Prepared November 23, 2026. **Draft; not permission to create paid resources,
change hosted settings, apply SQL, activate Storage or promote production.**

## Frozen source

Base default: `cc7c41e0df9a3a6435f6144d5f105401a91bb652`.
Combined runtime/test revision: `f837724911002f6c5a0cdd1b1ac8e6469abab814`.
Combined tree: `06707a61a94364d9be44ce82d11a40f465c94be4`.

| Component | Reviewed head                              | Purpose                                   |
| --------- | ------------------------------------------ | ----------------------------------------- |
| #48       | `707a87036b95a08d4442a0ab0cb645348cd25f3a` | Profile RPC / column privileges           |
| #51       | `a2bc2944d987179b2fc6b0f3bf38ef33137054c1` | Fulfillment / competing claims            |
| #52       | `a528d23b5254b47fd98f85ca8f6b7238b7e57da5` | Missing validation constraints            |
| #67       | `b074524b51d5df64b2b22399e08174eee0637691` | RLS identity evaluation                   |
| #68       | `06f78714e11044d1fe141483e60ef8bba24a9dac` | Extension reconciliation; included in #71 |
| #71       | `3cc3db4807a7eef0b22a43124e3fc7df131d9afc` | Quotas / Edge upload gateway / cleanup    |
| #72       | `915cec0026e0febd46a19ca48cbba7114d3fe07c` | Mutation grants / safe rating RPC         |

This candidate combines the drafts once, including their integration conflict
resolutions. Do not apply #68 twice or merge all component PRs and this candidate
as separate alternative releases. Choose one reviewed merge route after staging;
retain the component PRs as review context until then. All remain drafts.

Integration review compared the candidate against each remote component head:
all component migration files are unchanged. The combined SQL harness preserves
validation-drift, field-test, fulfillment and Storage concurrency suites. The
rating RPC coexists with Storage reservation functions in the application and
types. The earlier extension test restores its own legacy policies only inside
a rolled-back scratch transaction, so it can test reconciliation after the
later lifecycle migration deliberately closes client writes. Component heads
were integrated through local merge history; not all remote SHAs are ancestors
of the combined commit, so ancestry alone is not evidence of completeness.

The companion `staging-candidate-files.sha256` captures every tracked file under
`src/`, `scripts/`, `supabase/`, `vendor/` and `.github/workflows/`, plus the
package/lockfile and root application/build/tool configuration, at the combined
revision. Hashes are a source snapshot, **not** a live pending-migration list or
a deployment approval. Added files and changed component/default heads require
a fresh reviewed snapshot; the checksum command alone does not detect additions.

From the candidate checkout:

```sh
sha256sum --check docs/staging-candidate-files.sha256
git diff --exit-code f837724911002f6c5a0cdd1b1ac8e6469abab814 -- src scripts supabase vendor .github/workflows
git status --short
```

Review untracked/new runtime files too. Record the final candidate commit and
CI run URLs after these documentation files are committed. Earlier local
evidence: 706 unit tests and TypeScript passed at the combined revision;
PostgreSQL 17 SQL and real concurrency suites passed with the same SQL/test
files. Fresh combined GitHub CI is required. Browser CI uses an unreachable
placeholder backend and is not hosted acceptance.

## 1. Establish an isolated target

1. Owner selects the Supabase organization. Obtain the current project/branch
   cost, present it and receive explicit cost approval before provisioning.
   An existing recovery project is not implicitly approved for staging reuse.
2. Record a staging project reference distinct from production
   `vbrjblpurbpvpqlepxtc`, its approved region, retention and synthetic-data-only
   purpose. Do not clone production user rows or use production access tokens.
3. Verify the external Supabase GitHub integration's production branch and
   automatic production deployment setting (#66). Its settings are separate
   from the manual migration workflow. Only then review correcting the version
   mismatch (source 16, hosted production 17.6). This candidate keeps 16.
4. Configure separate Preview URL/publishable-or-anon key and nonproduction
   OAuth after target approval. Privileged credentials stay server-side and
   project-scoped. Obtain provider callback URLs from the staging dashboard;
   separately allowlist the exact frontend callback/origin. Record names and
   scopes, never values, in evidence. Do not rely on repository local Auth
   defaults as proof of hosted settings.
5. Verify the Preview's actual network requests point to the staging project,
   public reads/health work, and unrelated cookies do not select production.
   A generated Vercel preview using shared production configuration is not an
   isolated test environment. Do not run this matrix against it.

### Concrete environment handoff

November 23 read-only Vercel metadata still lists one
`NEXT_PUBLIC_SUPABASE_URL` record and one `NEXT_PUBLIC_SUPABASE_ANON_KEY`
record shared by Production and Preview, with no Development records listed.
Integration-managed private keys are Production-only. No values were decrypted
or changed. Split/override the approved Preview scope without changing
Production's values; validate branch overrides and create a fresh build because
public variables are embedded at build time. Existing previews retain their
old build configuration.

| Consumer / scope                                | Exact configuration                                                                                           | Handoff requirement                                                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Preview frontend and server              | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                                   | Both belong to the same approved staging project. The app reads the ANON-named variable even when its value is a supported publishable key; setting only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` does not configure these clients. |
| Vercel Preview server only                      | `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`                                                          | Staging-scoped privileged key for reservation/counter operations; no public prefix. If both exist, the current app chooses the service-role variable first; do not leave a mismatched key.                                        |
| Staging Edge environment                        | `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` default entry or `SUPABASE_SERVICE_ROLE_KEY`; `STORAGE_UPLOAD_ORIGINS` | Verify the project's injected secrets and exact HTTPS origin allowlist. These are Edge settings, not browser variables. Never copy Production secrets.                                                                            |
| Development                                     | Same app variable names using `.env.local.example` as the template                                            | Use a separately approved local/nonproduction target; keep actual values in ignored local files. Do not pull Production secrets for convenience.                                                                                  |
| GitHub production inventory / protected release | `SUPABASE_DB_URL` / `SUPABASE_RELEASE_DB_URL`                                                                 | Distinct credentials with the read/write scope and reviewer protections documented in migration-release-controls.md; neither belongs in Preview.                                                                                  |

OAuth secrets belong in the approved staging Auth/provider configuration, not
in `NEXT_PUBLIC_*` variables. Vercel supplies `VERCEL_ENV`/`VERCEL_URL`; do not
manually force a Preview to identify itself as Production.

## 2. Rehearse the candidate

Use the approved isolated target and synthetic users A/B only. Inspect its
catalog and migration history first, record the actual pending list, and use
the documented runner's ordering. Cold-schema tests and simulated historical
drift are separate cases; neither is a claimed production clone. Do not point
the loopback-only destructive SQL harness at hosted staging.

Apply only after staging schema/data writes are authorized. Deploy the exact
matching `storage-upload` function with project-scoped secrets and exact HTTPS
`STORAGE_UPLOAD_ORIGINS`; verify JWT checks in the handler despite
`verify_jwt=false`. Keep the private Storage rollout gate closed initially.
Exercise its closed-state denials first, then activate it only for the approved
isolated rehearsal. Production activation is a separate decision.

| ID  | Hosted case                                                                              | Required result / evidence                                                                                                                |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| S01 | A/B login, callback, logout, expired token and session rotation                          | Correct account/redirect; no callback or token leakage. Measure revocation behavior rather than assuming access JWTs revoke immediately.  |
| S02 | Anonymous public browsing, health and reporting                                          | Expected public projection, health JSON/no-store; no private base-table grants to bypass a failure.                                       |
| S03 | First/repeated rating, null/known rigs, self/foreign mutation, protected columns         | Invoker RPC works via real PostgREST and refreshed schema cache; aggregates/axes correct; forbidden writes fail.                          |
| S04 | Request/comment/upvote/favorite/follow CRUD and two simultaneous fulfillment claims      | Supported owner operations work; forged fulfillment/timestamps and cross-user operations fail; one fulfillment and matching notification. |
| S05 | Garage/report/download journeys as A/B/anonymous                                         | Private records isolated; public reports intentional; download counts and reminder state remain correct.                                  |
| S06 | Gateway missing/expired/foreign/replayed ticket, anonymous token, CORS                   | Denied without provider upload token leakage; supported owner upload succeeds; direct mint/insert/update/delete denied.                   |
| S07 | Supported setup/telemetry bytes, 5/10 MiB boundaries, oversized/stalled upload           | Exact content round-trip, proper size/signature checks and timeouts; failures do not release uncertain capacity.                          |
| S08 | Concurrent final quota slot, byte budget, legacy/unknown metadata                        | Only allowed reservations succeed; actual reviewed account limits enforced; unknown metadata fails closed.                                |
| S09 | Current/history attachment racing cleanup, absent metadata row, duplicate cleanup claims | Attached objects survive; stale/uncertain claims fail closed; no early quota release; durable retry state verified.                       |
| S10 | Provider success/error/timeout and actual cleanup                                        | Confirm backing bytes and CDN behavior, not just metadata/list results; uncertain operations remain charged/quarantined.                  |
| S11 | Synthetic account erasure and ledger retention                                           | Behavior matches reviewed retention rules; no accidental access to another owner's ledger or blobs.                                       |

Every row starts **NOT RUN**. Record candidate SHA, target reference, UTC run
time, synthetic case IDs, expected/actual status, redacted request correlation
IDs and PASS/FAIL/BLOCKED. Keep tokens, cookies, OAuth codes, signed URLs,
database URLs and private user payloads out of issues/CI artifacts. A skipped
Supabase Preview check is not PASS. Delete only the run's synthetic fixtures
under an approved staging cleanup scope; retain uncertainty for investigation.

## 3. Establish production release controls

- GitHub administrator verifies required CI/review on `SetUpSheet` and required
  reviewers/branch restrictions on `production-database`. Current branch read
  reports protected=false; connector administration is unavailable.
- Configure read-only `SUPABASE_DB_URL` inventory and separate protected
  `SUPABASE_RELEASE_DB_URL` privately. Run the exact-default-SHA dry run and
  inspect its pending list. Missing credentials remain a stop condition.
- Resolve #66's external auto-deploy behavior before fixing its config parser.
  A passing repository workflow does not establish that another integration
  cannot write production.
- Review the proposed 100-object / 1-GiB budget, retention/account erasure,
  legacy size metadata, upload-capability/in-flight drain and service workers.
  Keep the production Storage gate closed until that review and drain finish.
- Record the approved final default SHA, app/function/worker revisions,
  compatibility window, production maintenance sequence and forward-fix plan.
  The owner waived #44's restore exercise; do not re-add it. The existing
  exact-release acknowledgment of unverified recovery still applies.

## 4. Controlled release and verification

Use [migration-release-controls.md](migration-release-controls.md),
[storage-lifecycle.md](storage-lifecycle.md) and
[mutation-column-grants.md](mutation-column-grants.md). Pause conflicting
merges and legacy workers. The migration runner commits **each file** with its
history row; the whole batch is not atomic. Earlier files may remain applied
after a later failure. Inspect before retrying; do not replay the full chain.

The Storage migration closes old client writes. The rating RPC and matching
application must be deployed together under the reviewed maintenance plan;
permission errors must not trigger an unsafe old-write fallback. Verify the
new catalogs and direct-write denials, deploy matching Edge/app/worker origins,
validate flows, then separately approve/perform Storage gate activation after
the verified drain. Reopen uploads only after acceptance. An application
rollback does not reverse SQL and restoring unsafe grants is not a rollback.

After release, record the actual Vercel production SHA and function revision,
run the read-only reporting contract, health and authorized synthetic journeys,
inspect advisors/runtime errors and verify grants/RLS/constraints. Stop on
failed checks; close #40/#42/#43/#45/#46/#47/#66 only against their actual hosted
acceptance evidence. Source merge, a green build or a successful inventory
alone does not close those findings.
