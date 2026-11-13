# Storage MIME compatibility gate (SS-AUD-007)

**Status: test coverage prepared, production bucket unchanged.**

The production `setup-files` bucket has a 10 MiB size ceiling and owner-folder RLS on writes. Its `allowed_mime_types` field is unset. On the read-only audit, the 28 stored objects reported only `application/json` (24) and `application/octet-stream` (4). These observations are **not** a comprehensive inventory of formats other users may upload.

Current application-declared extensions:

| Usage | Extensions |
|---|---|
| Setup | `.sto`, `.json`, `.ini`, `.svm`, `.sav`, `.txt`, `.xml`, `.csv` |
| Telemetry | `.ld`, `.ldx`, `.ibt`, `.vbo`, `.drf`, `.csv`, `.zip`, `.zvp`, `.telemetry` |

- The application validates extension, file size and a minimal signature for some text, JSON, XML and ZIP types. Opaque game formats cannot be certified with this check alone.
- `src/lib/upload-format-compat.test.ts` protects the list of accepted extensions and rejects common unsupported extensions and spoofed ZIP/JSON.
- **No bucket-level MIME restriction is proposed yet.** Browser/OS MIME detection varies for proprietary simulator formats and may produce `application/octet-stream`. A restrictive allowlist could break valid uploads even when their extension is allowed.
- Collect real, non-sensitive fixture files and observed MIME metadata on each supported platform. Verify both direct Storage upload and signed-URL flows on isolated staging. After that, consider an allowlist; keep the test fixture matrix with the code.
- Avoid treating a MIME label alone as proof that an uploaded file is safe. Continue verifying content signatures where formats are documented and preserving server-side path ownership/size limits.

Acceptance: legitimate supported formats work on Windows/browser combinations, malicious/unsupported payloads are rejected at multiple layers, and any eventual Storage bucket constraint is regression tested. Do not change production Storage configuration without validation and approval.
