// The llms.txt pair: https://llmstxt.org
//
// `llms.txt` is an index — headings and links, small enough that fetching it
// costs nothing and an agent can decide what else to read. `llms-full.txt` is
// every page inlined, for the case where one fetch should be the whole thing.
//
// Both are built from `docsPages()`, the same enumeration the `.md` twins use,
// so the three surfaces cannot disagree about what pages exist. Everything here
// is pure — the endpoints in src/pages are three-line adapters — because the
// shape of these documents is the part worth testing, and checking it needs no
// Astro.
//
// This file matters more than its size suggests. A library about error handling
// is one an agent reaches for while writing a `catch` block, and the summary
// below is the paragraph it sees first. If it is vague the agent guesses at the
// API; if it is precise the agent knows before its first tool call that the
// second constructor argument is an options object and that `deserializeError`
// needs to be told which classes to rebuild.

/**
 * The library's own summary, as the blockquote llmstxt.org puts under the H1.
 *
 * Written here rather than lifted from a page's frontmatter: the home page is a
 * landing page aimed at a person who has just arrived, and has no twin. This is the paragraph
 * a model needs first — what the package exports, what it refuses to do, and
 * the few facts that change how the calling code is written.
 */
const SUMMARY = [
  'A zero-dependency error model for TypeScript applications that use native',
  'exceptions but need typed context, cause-chain inspection, and reliable JSON',
  'round trips. `ExtendedError` is a base class',
  'that keeps `name`, `code`, `context` and `stack` correct through subclassing;',
  '`defineError` declares such a class in one line and builds taxonomies through',
  'its `base` option; five helpers search the `cause` chain; `serializeError` and',
  '`deserializeError` take an error through JSON and rebuild it as the classes it',
  'was. Every function accepts `unknown`, because a `catch` binding is `unknown`',
  'and JavaScript permits throwing anything. No runtime dependencies and no',
  'Node.js APIs, so it runs in browsers and workers as well as on Node >= 20.19.',
  'Ships ESM and CommonJS with type declarations. Published to npm. MIT.',
]

/**
 * Directory name -> heading, in reading order.
 *
 * Mirrors the sidebar in astro.config.mjs, because that order is a real
 * editorial judgement about what to read first and there is no reason for an
 * agent to get a worse one than a human. A directory missing from this map still
 * gets a heading — see `groupPages` — so adding one is not a silent omission,
 * just an unlabelled section.
 */
const SECTIONS = [
  ['root', 'About'],
  ['learn', 'Learn'],
  ['guides', 'Guides'],
  ['reference', 'Reference'],
  ['under-the-hood', 'Under the hood'],
]

/**
 * One entry. The description is what makes the index worth fetching: a bare list
 * of links tells an agent nothing about which one answers its question.
 */
const link = (page, note) => `- [${page.title}](${page.mdUrl})${note ? `: ${note}` : ''}`

/** Group pages by section, in the order a reader should meet them. */
export function groupPages(pages) {
  const bySection = new Map()
  for (const page of pages) {
    if (!bySection.has(page.section)) bySection.set(page.section, [])
    bySection.get(page.section).push(page)
  }

  const groups = []
  const take = (key, heading) => {
    const found = bySection.get(key)
    if (found?.length) groups.push({ heading, pages: found })
    bySection.delete(key)
  }

  for (const [key, heading] of SECTIONS) take(key, heading)

  // A directory the map does not know, named after itself: an unlabelled section
  // beats a missing one.
  for (const key of [...bySection.keys()].sort()) take(key, key)

  return groups
}

/**
 * The index.
 *
 * Links point at the `.md` twins rather than the HTML pages. An agent following
 * a link from here wants the content, not the chrome — and sending it to HTML
 * when a markdown twin exists wastes the fetch this file exists to save.
 */
export function llmsIndex(pages, origin) {
  const lines = [
    '# ts-extended-errors',
    '',
    ...SUMMARY.map((l) => `> ${l}`),
    '',
    'Every link below is raw markdown. The human page is the same URL without the',
    '`.md` suffix.',
    '',
    // Absolute, not "the file beside this one". This document is read detached
    // from the site as often as it is fetched from it, and a reader that has it
    // pasted into a prompt has nothing to resolve a relative reference against.
    `Everything inlined in one fetch: ${origin}/llms-full.txt`,
    '',
    '## Install',
    '',
    '    npm install ts-extended-errors',
    '',
    'No peer dependencies. The package also ships its own `llms.txt` inside the',
    'tarball, so after an install it can be read from',
    '`node_modules/ts-extended-errors/llms.txt` with no network access.',
    '',
    '## If you are writing calling code',
    '',
    'Five facts prevent most of the mistakes:',
    '',
    '1. The second constructor argument is an options object, so context goes in',
    '   `{ context: { userId } }` rather than being passed directly.',
    '2. `defineError` returns a new class on every call, so call it once at module',
    '   scope and export the result — two calls produce two classes and',
    '   `instanceof` between them is false.',
    "3. `deserializeError` chooses a class by the payload's `name`, from the",
    '   built-ins plus whatever is passed in `classes`. Without `classes` your own',
    '   classes come back as a plain `ExtendedError` carrying the right name.',
    '4. In a `catch`, the binding is `unknown`. Use `toError`, `isExtendedError` or',
    '   `findCauseOf` rather than reading `.code` off it.',
    '5. “Typed” describes an error after narrowing. TypeScript does not include',
    '   thrown errors in a function signature; use a union or `Result` when each',
    '   caller must see an expected failure in the return type.',
    '',
  ]

  for (const { heading, pages: group } of groupPages(pages)) {
    lines.push(`## ${heading}`, '')
    for (const page of group) lines.push(link(page, page.description))
    lines.push('')
  }

  return lines.join('\n')
}

/** Everything inlined, in the same order the index lists it. */
export function llmsFull(pages) {
  const ordered = groupPages(pages).flatMap((g) => g.pages)
  const head = ['# ts-extended-errors', '', ...SUMMARY.map((l) => `> ${l}`), ''].join('\n')

  return [
    head,
    ...ordered.map((page) =>
      ['---', '', `# ${page.title}`, '', `Source: ${page.htmlUrl}`, '', page.body, ''].join('\n'),
    ),
  ].join('\n')
}
