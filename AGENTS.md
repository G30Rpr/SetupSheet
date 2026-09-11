<!-- BEGIN:nextjs-agent-rules -->
# Next.js version note

This project runs a standard, published Next.js release — `next ^16.3.3`
(App Router, with `src/proxy.ts` as the middleware entry point) — and there is
no custom fork and no `node_modules/next/dist/docs/` folder to consult; that
path does not exist in this package. If you're unsure about an API, check the
version pinned in `package.json` against the public Next.js docs for that
version, and watch for App Router breaking changes when upgrading across major
versions.

Version-specific APIs this codebase depends on and that changed in 16:
`revalidateTag(tag, "max")` takes an expire argument, CSP nonces are read via
`headers()`, `generateMetadata`/`generateImageMetadata` run on every route, and
a `notFound()` thrown mid-render cannot set the HTTP status once the root layout
has started streaming (see AUDIT_REPORT.md §2.1).
<!-- END:nextjs-agent-rules -->
