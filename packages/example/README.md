# @repo/example

A placeholder package. Rename it (directory and `name`) or copy it for each new package.

- Source in `src/`, tests in `src/**/__tests__/`, `src/index.ts` re-exports only.
- `vitest.config.ts` and `tsdown.config.ts` are one-liners over `@repo/config`; change the shared
  preset there, not here.

```ts
import { greet } from '@repo/example'

greet('Ada') // 'Hello, Ada.'
```
