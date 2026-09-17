---
'ts-extended-errors': patch
---

Publish to npm as `ts-extended-errors`, in place of `@rxova/ts-extended-errors` on GitHub Packages.

Install with `npm install ts-extended-errors`; no `.npmrc` scope line or GitHub token is needed. Every
earlier version, 0.1.0 to 0.4.0, is on npm under the new name with the same code. A project on the
old name changes the dependency and its imports from `@rxova/ts-extended-errors` to
`ts-extended-errors`; nothing else about the API changes. Releases now publish from CI through npm
trusted publishing, with provenance.
