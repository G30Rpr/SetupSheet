# Unused-index review

Read-only snapshot: November 20, 2026. No indexes were dropped.

The performance advisor reports 28 unused indexes. A direct catalog inventory
found 39 public indexes with zero recorded scans: 11 unique indexes and 28
nonunique indexes. Eight of the 11 unique indexes back declared constraints;
the other three still enforce uniqueness independently and must not be treated
as expendable. Database-wide `pg_stat_database.stats_reset` was June 30, 2026
00:57:20 UTC. Per-object counters can be reset independently, and index creation
time is not established by that timestamp, so it does not prove that each index
has had a representative observation window.

Retain all 28 nonunique candidates for now. Their combined allocated size in
this snapshot is 368 KiB. This is allocated index size, not a measured estimate
of maintenance cost or storage savings after deletion.

| Index                                      | Size (KiB) | Reason to retain pending workload evidence                                                                                           |
| ------------------------------------------ | ---------: | ------------------------------------------------------------------------------------------------------------------------------------ |
| `account_deletion_requests_created_at_idx` |          8 | Operational listing/order path; representative admin workload is unverified.                                                         |
| `content_reports_status_created_at_idx`    |          8 | Operational listing/order path; representative admin workload is unverified.                                                         |
| `field_test_reports_garage_session_id_idx` |          8 | Leading columns match foreign key(s): `field_test_reports_garage_session_id_fkey`. Protect related-row lookup/cascade paths.         |
| `garage_laps_revision_idx`                 |          8 | Leading columns match foreign key(s): `garage_laps_session_id_revision_id_fkey`. Protect related-row lookup/cascade paths.           |
| `garage_laps_session_created_idx`          |          8 | Session-scoped chronological reads in `src/lib/supabase/garage.ts`.                                                                  |
| `garage_revisions_session_created_idx`     |          8 | Leading columns match foreign key(s): `garage_revisions_session_id_fkey`. Protect related-row lookup/cascade paths.                  |
| `garage_run_plan_revision_idx`             |          8 | Leading columns match foreign key(s): `garage_run_plan_items_session_id_revision_id_fkey`. Protect related-row lookup/cascade paths. |
| `garage_run_plan_session_created_idx`      |          8 | Session-scoped chronological reads in `src/lib/supabase/garage.ts`.                                                                  |
| `notifications_actor_id_idx`               |         16 | Leading columns match foreign key(s): `notifications_actor_id_fkey`. Protect related-row lookup/cascade paths.                       |
| `notifications_setup_id_idx`               |         16 | Leading columns match foreign key(s): `notifications_setup_id_fkey`. Protect related-row lookup/cascade paths.                       |
| `profiles_username_trgm_idx`               |         24 | Trigram search index; validate representative search plans before removal.                                                           |
| `setup_comments_user_id_idx`               |          8 | Leading columns match foreign key(s): `setup_comments_user_id_fkey`. Protect related-row lookup/cascade paths.                       |
| `setup_download_events_pair_idx`           |          8 | Leading columns match foreign key(s): `setup_download_events_user_id_fkey`. Protect related-row lookup/cascade paths.                |
| `setup_download_events_setup_idx`          |          8 | Leading columns match foreign key(s): `setup_download_events_setup_id_fkey`. Protect related-row lookup/cascade paths.               |
| `setup_favorites_setup_id_idx`             |          8 | Leading columns match foreign key(s): `setup_favorites_setup_id_fkey`. Protect related-row lookup/cascade paths.                     |
| `setup_requests_fulfilled_by_idx`          |          8 | Leading columns match foreign key(s): `setup_requests_fulfilled_by_fkey`. Protect related-row lookup/cascade paths.                  |
| `setup_requests_fulfilled_setup_id_idx`    |          8 | Leading columns match foreign key(s): `setup_requests_fulfilled_setup_id_fkey`. Protect related-row lookup/cascade paths.            |
| `setup_requests_requester_id_idx`          |          8 | Leading columns match foreign key(s): `setup_requests_requester_id_fkey`. Protect related-row lookup/cascade paths.                  |
| `setup_upvotes_setup_id_idx`               |         16 | Leading columns match foreign key(s): `setup_upvotes_setup_id_fkey`. Protect related-row lookup/cascade paths.                       |
| `setup_versions_edited_by_idx`             |          8 | Leading columns match foreign key(s): `setup_versions_edited_by_fkey`. Protect related-row lookup/cascade paths.                     |
| `setup_versions_file_path_idx`             |          8 | Current/history object reference lookups in `0028_setup_files_gc.sql`.                                                               |
| `setup_versions_telemetry_file_path_idx`   |          8 | Current/history object reference lookups in `0028_setup_files_gc.sql`.                                                               |
| `setups_car_trgm_idx`                      |         32 | Trigram search index; validate representative search plans before removal.                                                           |
| `setups_description_trgm_idx`              |         24 | Trigram search index; validate representative search plans before removal.                                                           |
| `setups_file_path_idx`                     |         16 | Current/history object reference lookups in `0028_setup_files_gc.sql`.                                                               |
| `setups_game_trgm_idx`                     |         40 | Trigram search index; validate representative search plans before removal.                                                           |
| `setups_telemetry_file_path_idx`           |          8 | Current/history object reference lookups in `0028_setup_files_gc.sql`.                                                               |
| `setups_track_trgm_idx`                    |         32 | Trigram search index; validate representative search plans before removal.                                                           |

Fifteen indexes have leading keys matching declared foreign keys. PostgreSQL
does not require these indexes for constraint correctness, but removing them
can make parent deletes/updates and dependent-row checks scan whole child
tables. A matching key prefix is evidence for retention, not proof that the
planner uses that index or that another index cannot cover the same work.

The file-reference indexes support the current/version-history checks in
`supabase/migrations/0028_setup_files_gc.sql`. Garage reads filter by session
and order by created_at in `src/lib/supabase/garage.ts`. Search index use needs
representative predicates, cardinality and planner evidence; an empty or small
table may correctly use a sequential scan.

Before proposing any drop: inventory overlapping keys, predicates and operator
classes; sample the relevant application/admin workloads; compare EXPLAIN plans
and write overhead on synthetic staging data; establish per-index observation
windows; and record a targeted reversal migration. Do not run EXPLAIN ANALYZE
on production writes or reset live counters for this review. Future candidates
must retain foreign-key, uniqueness, retention and moderation behavior.
