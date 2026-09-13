# Changesets

A pull request that changes `@rxova/ts-extended-errors` adds one of these: run `pnpm changeset`, pick the
bump, and commit the file it writes. The summary becomes the changelog entry.

Once CI passes on `main`, the Release workflow gathers them into a `chore: version packages` pull
request. Merging that one publishes to GitHub Packages.
