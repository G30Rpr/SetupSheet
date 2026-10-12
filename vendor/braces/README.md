# Local `braces` security patch

This directory contains the MIT-licensed `braces` 3.0.3 source, with a small local patch for the stack-exhaustion advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The upstream advisory currently lists no patched release.

`lib/parse.js` rejects patterns whose nested brace/parenthesis AST depth exceeds 512. This bounds the recursive `compile`, `expand`, and `stringify` walkers before they can exhaust the Node.js call stack. The regression test is `src/lib/braces-depth-limit.test.ts`.

The package version `3.0.4+setupsheet.0` identifies this local patch; it is not an upstream release. The root package manifest pins the patched copy for the lint dependency chain. Revisit and remove this vendor override once an official upstream release addresses the advisory and passes the same regression checks.

The upstream MIT license is preserved in `LICENSE`.
