import { getCollection } from "astro:content";
import { docsPages, type LlmsOptions } from "@rxova/docs-kit";

/** Every page as Markdown: the one list the `.md` twins and both llms files share. */
export const pages = async () =>
  docsPages(await getCollection("docs"), {
    origin: import.meta.env.SITE,
    base: import.meta.env.BASE_URL,
  });

/**
 * The llms.txt header and sections, in the sidebar's reading order.
 *
 * The summary is written for a model rather than lifted from `index.md`, which
 * opens with a sentence aimed at a person who has just arrived. It is the
 * paragraph an agent sees first while writing a `catch` block: what the package
 * exports, what it refuses to do, and the facts that change the calling code.
 */
export const llms: LlmsOptions = {
  project: "ts-extended-errors",
  summary: [
    "A zero-dependency error model for TypeScript applications that use native",
    "exceptions but need typed context, cause-chain inspection, and reliable JSON",
    "round trips. `ExtendedError` is a base class",
    "that keeps `name`, `code`, `context` and `stack` correct through subclassing;",
    "`defineError` declares such a class in one line and builds taxonomies through",
    "its `base` option; five helpers search the `cause` chain; `serializeError` and",
    "`deserializeError` take an error through JSON and rebuild it as the classes it",
    "was. Every function accepts `unknown`, because a `catch` binding is `unknown`",
    "and JavaScript permits throwing anything. No runtime dependencies and no",
    "Node.js APIs, so it runs in browsers and workers as well as on Node >= 22.12.",
    "Ships ESM and CommonJS with type declarations. Published to npm. MIT.",
  ],
  sections: [
    ["root", "About"],
    ["learn", "Learn"],
    ["guides", "Guides"],
    ["reference", "Reference"],
    ["under-the-hood", "Under the hood"],
  ],
};

/** Between the llms.txt header and the sections: how to install it, and the mistakes to avoid. */
export const preamble = [
  "## Install",
  "",
  "    npm install ts-extended-errors",
  "",
  "No peer dependencies. The package also ships its own `llms.txt` inside the",
  "tarball, so after an install it can be read from",
  "`node_modules/ts-extended-errors/llms.txt` with no network access.",
  "",
  "## If you are writing calling code",
  "",
  "Five facts prevent most of the mistakes:",
  "",
  "1. The second constructor argument is an options object, so context goes in",
  "   `{ context: { userId } }` rather than being passed directly.",
  "2. `defineError` returns a new class on every call, so call it once at module",
  "   scope and export the result — two calls produce two classes and",
  "   `instanceof` between them is false.",
  "3. `deserializeError` chooses a class by the payload's `name`, from the",
  "   built-ins plus whatever is passed in `classes`. Without `classes` your own",
  "   classes come back as a plain `ExtendedError` carrying the right name.",
  "4. In a `catch`, the binding is `unknown`. Use `toError`, `isExtendedError` or",
  "   `findCauseOf` rather than reading `.code` off it.",
  "5. “Typed” describes an error after narrowing. TypeScript does not include",
  "   thrown errors in a function signature; use a union or `Result` when each",
  "   caller must see an expected failure in the return type.",
  "",
];
