import { describe, expect, it } from 'vitest'

import { groupPages, llmsFull, llmsIndex } from './llms.mjs'

const page = (id, overrides = {}) => ({
  id,
  section: id.includes('/') ? id.split('/')[0] : 'root',
  title: id,
  description: `About ${id}.`,
  mdUrl: `https://rxova.org/${id}.md`,
  htmlUrl: `https://rxova.org/${id}/`,
  body: `Body of ${id}.`,
  ...overrides,
})

const pages = [
  page('index', { section: 'root', title: 'ts-extended-errors' }),
  page('reference/api'),
  page('guides/serialization'),
  page('learn/why'),
]

describe('groupPages', () => {
  it('orders sections editorially, not alphabetically', () => {
    // The sidebar order is a judgement about what to read first. An agent has no
    // reason to get a worse one than a human.
    expect(groupPages(pages).map((g) => g.heading)).toEqual([
      'About',
      'Learn',
      'Guides',
      'Reference',
    ])
  })

  it('gives an unknown directory a heading named after itself', () => {
    // Unlabelled beats missing: a new directory shows up in the index without
    // anyone having to edit SECTIONS first.
    const groups = groupPages([...pages, page('recipes/monorepo')])

    expect(groups.at(-1)).toMatchObject({ heading: 'recipes' })
    expect(groups.at(-1).pages).toHaveLength(1)
  })

  it('drops no page', () => {
    const extra = [...pages, page('recipes/monorepo'), page('under-the-hood/subclassing')]

    expect(groupPages(extra).flatMap((g) => g.pages)).toHaveLength(extra.length)
  })
})

describe('llmsIndex', () => {
  const index = llmsIndex(pages, 'https://rxova.org')

  it('leads with the H1 and the summary blockquote llmstxt.org expects', () => {
    const lines = index.split('\n')

    expect(lines[0]).toBe('# ts-extended-errors')
    expect(lines[2].startsWith('> ')).toBe(true)
  })

  it('gives the install line, since an agent reaching this has not installed it yet', () => {
    expect(index).toContain('npm install ts-extended-errors')
  })

  it('installs from npm, with no registry or token set-up', () => {
    // The package moved from GitHub Packages to npm. An index still carrying the
    // old `.npmrc` scope line would send an agent to a registry that no longer
    // has the package, under a name it no longer publishes.
    expect(index).not.toContain('npm.pkg.github.com')
    expect(index).not.toContain('@rxova/')
  })

  it('states the API facts that change how an agent writes the calling code', () => {
    // Each of the four is a mistake the package's own llms.txt lists as common:
    // context passed positionally, defineError called per-throw, deserializeError
    // called without `classes`, and `.code` read off an `unknown` catch binding.
    expect(index).toContain('options object')
    expect(index).toContain('module\n   scope')
    expect(index).toContain('classes')
    expect(index).toContain('`unknown`')
  })

  it('points at llms-full.txt absolutely', () => {
    // This document is read detached from the site as often as it is fetched
    // from it, and a pasted copy has nothing to resolve a relative path against.
    expect(index).toContain('https://rxova.org/llms-full.txt')
  })

  it('links the .md twins, not the HTML pages', () => {
    expect(index).toContain('- [reference/api](https://rxova.org/reference/api.md): About')
    expect(index).not.toMatch(/\]\(https:\/\/rxova\.org\/reference\/api\/\)/)
  })

  it('omits the colon for a page with no description', () => {
    const bare = llmsIndex([page('index', { description: undefined })], 'https://rxova.org')

    expect(bare).toContain('- [index](https://rxova.org/index.md)\n')
  })
})

describe('llmsFull', () => {
  const full = llmsFull(pages)

  it('inlines every body in the index order', () => {
    const order = ['index', 'learn/why', 'guides/serialization', 'reference/api'].map((id) =>
      full.indexOf(`Body of ${id}.`),
    )

    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('states each page canonical HTML URL, so a reader can cite the page', () => {
    expect(full).toContain('Source: https://rxova.org/reference/api/')
  })

  it('repeats the same summary the index carries', () => {
    expect(full.split('\n')[0]).toBe('# ts-extended-errors')
    expect(full).toContain('> Typed, serializable errors for TypeScript.')
  })
})
