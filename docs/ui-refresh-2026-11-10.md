# UI review follow-through — November 10, 2026

## Implemented

- Brighter secondary text in the dark palette; quieter decorative grid.
- Compact homepage hero and clearer introductory copy.
- Primary navigation visible from desktop widths, including Garage.
- Responsive footer wrapping.
- More legible card hierarchy, wrapping lap metadata, distinct session tags, and reported game version on browse cards.
- File-only metadata retained on details instead of repeated on browse cards.
- Game/car/track filters first; secondary filters in an expandable section that opens for active secondary filters.
- Explain uploader-rig filtering versus personal-rig sorting. Label the unpersonalized default as Recommended.
- Car and track filters for Engineer's community suggestions, with explicit limits on what those suggestions imply.
- Plain-language Engineer copy, clearer Garage purpose, upload preparation checklist, and an example request in the empty state.
- Remove duplicate screen-reader score definitions on unrated detail pages.

## Remaining review items

- Visual QA at mobile and desktop sizes, keyboard navigation, and a real-account upload/download/install check. The managed preview cannot start this project's `next dev`: it appends Vite-specific `--host` and `--strictPort` options. No application-script workaround was committed.
- The detail-page two-column download/install layout remains a separate structural change: download, installation, values, media, and author actions currently share one card component.
- Existing labels such as Silverstone National require confirmation from uploaders or original game files; no production records were edited or lap-layout assumptions made.
- Fuel, tyre, and temperature context can be supplied in author notes now. Structured fields, conflicting-tag validation, and last-tested dates need a coordinated schema/upload/edit rollout, including legacy records.
- Rating participation, broader car/track coverage, verified compatibility, additional visual assets, and contributor recruitment need real community input. No ratings, test evidence, imagery, or compatibility claims were invented.
- Rig controls are clarified but retain separate filtering and ranking functions. Fully consolidating the legacy category filter and two-axis preference needs a deliberate compatibility decision for existing shared URLs.

## Release

Work is isolated on `codex/ui-design-refresh`, targeting `SetUpSheet`. No merge or production deployment is part of this change. CI and a usable preview should be checked before merging.
