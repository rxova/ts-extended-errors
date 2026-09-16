---
'@rxova/ts-extended-errors': patch
---

Point the tarball's `llms.txt` and README at the documentation site.

The package now has docs at https://rxova.org/packages/ts-extended-errors/, built from `apps/docs` in
this repository. Both files ship inside the tarball, so an agent that installed the package and read
`node_modules/@rxova/ts-extended-errors/llms.txt` had no way to find them.

`llms.txt` gains the site, its `llms.txt` index and its `llms-full.txt`; the README's "For coding
agents" section says the same for a reader. Nothing about the API or the published files changes.
