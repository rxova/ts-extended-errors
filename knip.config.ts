import type { KnipConfig } from 'knip'

/**
 * Unused files, exports and dependencies, as a gate rather than a report.
 *
 * The `export` keyword is the point: an export nothing imports still has to be
 * kept working, still shows up in completions, and still reads as part of the
 * contract. Nothing else in this repository notices one.
 *
 * Entry points are inferred from each package's manifest, so what follows is
 * only what inference cannot know.
 */
export default {
  // Advice nobody has to act on is advice that stops being read.
  treatConfigHintsAsErrors: true,
  workspaces: {
    'apps/docs': {
      // Reached only as a string: the Starlight preset from @rxova/astro-ui lists
      // `@rxova/brand/fonts.css` in `customCss`, which Vite resolves from this
      // site's root. Knip reads imports, so the path is invisible to it.
      ignoreDependencies: ['@rxova/brand'],
    },
  },
} satisfies KnipConfig
