import { baseVitestConfig } from '@rxova/repo-config/vitest'

export default baseVitestConfig({
  root: import.meta.dirname,
  // Types only: no executable lines worth a threshold.
  exclude: ['src/types.ts'],
  // `text` for the CI log, `html` for the uploaded coverage artifact.
  reporter: ['text', 'html', 'json-summary'],
})
