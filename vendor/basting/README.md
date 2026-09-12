<h1 align="center">basting</h1>

<p align="center">The stitch that was never meant to stay in.</p>

A basting stitch is long and loose, put in to hold fabric together before the
real seam goes in. It looks like a seam. It is not one, and it is meant to be
taken out.

basting is a deterministic CLI that reads a git patch and reports the places
where a change made the checks pass without doing the work.

It answers one question about a change:

> Did this pass by teaching the implementation the answer, or by switching a
> check off?

No model calls, no network calls, no telemetry, and zero runtime dependencies,
so `npx basting` on a cold cache is a single small download.

```console
$ npx basting
basting — 3 finding(s)  (2 high, 1 medium)

✗ HIGH  src/token.ts:2  IMPL_SPECIAL_CASED
     Branches on "ada", which this patch also writes into a test.
     | if (user === 'ada') return 'tok_ada_9f2';
     -> Handle the general case, not the one the test names.

✗ HIGH  src/token.ts:6  TYPE_ERROR_SILENCED
     `as any` drops the type rather than satisfying it
     | return check(token as any);
     -> Fix the type rather than turning the checker off for it.

! MED   src/token.ts:5  GUARD_REMOVED
     A check was removed and not replaced.
     | if (!token) throw new Error('missing token');
     -> Put the check back, or say what now makes it unnecessary.
```

## The idea

The sharpest signal available in a patch alone is **a value that appears on both
sides of the wall**: written as an expectation in a test, and written as a
constant in the implementation, in the same change.

On its own, each is ordinary. Together, in one patch, the implementation has
been taught the answer rather than how to work it out.

The rest of the rules are about the other way to go green without doing the
work: turning the checker off.

## Install

```bash
npx basting
```

Or as a dev dependency:

```bash
npm install --save-dev basting
pnpm add -D basting
```

Requires Node.js 20.11 or newer.

## Agent integration

```bash
npx basting init claude
```

`init claude` writes a committed `.claude/settings.json` containing a `Stop`
hook that blocks the turn while a finding at or above the threshold stands. It
**merges** into an existing file, so a hook already there keeps working.

`init codex`, `init cursor` and `init copilot` append an instruction to the file
each of those agents reads. An instruction is advisory — unlike the hook, it
cannot stop a turn.

## Rules

Only `high` fails a run by default.

| Rule                   | Severity | Fires when                                                                                        |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `RETURN_HARDCODED`     | high     | An implementation returns a literal this same patch also writes into a test                       |
| `IMPL_SPECIAL_CASED`   | high     | A new branch compares against a literal this same patch also writes into a test                   |
| `ERROR_SWALLOWED`      | high     | An error is caught and nothing is done with it                                                    |
| `TYPE_ERROR_SILENCED`  | high     | `@ts-ignore`, `@ts-expect-error`, `# type: ignore`, `as any`, `as unknown as`                     |
| `STRICTNESS_LOWERED`   | high     | A strict compiler flag was on and is now off, or a lint rule stepped down from error              |
| `CHECK_DISABLED_IN_CI` | high     | `continue-on-error: true`, `\|\| true`, `--no-verify`, `--passWithNoTests`, `if: false`, `set +e` |
| `LINT_SILENCED`        | medium   | `eslint-disable`, `# noqa`, `#[allow(...)]`, `@SuppressWarnings`, `//nolint`                      |
| `GUARD_REMOVED`        | medium   | A throw, raise, panic or assert was deleted and the file gained none of its own                   |

Markers inside strings and comments do not count — writing _about_ a silencer is
not using one.

`GUARD_REMOVED` is graded medium on purpose: moving a check somewhere better
looks exactly like deleting it, and a patch alone cannot always tell them apart.

## Untracked files

Files git is not tracking yet are read as additions, because adding a file is
the easiest way to introduce a silencer and `git diff` cannot see one. basting
never runs `git add -N` and never writes the index: a tool that stages your work
in order to look at it is a tool that loses your work.

## Acknowledging a finding

Inline, on the finding's line or the one above it:

```ts
// basting-ignore LINT_SILENCED -- vendored, upstream owns this file
```

Or for a whole patch, a commit-message trailer:

```
Basting-Allow: GUARD_REMOVED -- the caller validates now, see #412
```

Both always name a rule and give a reason. There are no wildcards, and the
reason is quoted back to the person rather than disappearing.

## Configuration

`basting.config.json` beside `package.json`, or a `basting` key inside it:

```json
{ "failOn": "high" }
```

## Excluding paths

Some paths hold code that is not this patch's code: recorded patches, captured
fixtures, vendored snapshots. `exclude` lists repository-root-relative prefixes
that are left out of the diff, the untracked files, the file count and every
finding key:

```json
{ "exclude": ["fixtures/recorded", "third_party"] }
```

`.basting` is always excluded. An entry must be a non-empty relative path; an
absolute path, a `..` segment or a leading `:` (git pathspec syntax) is an error.

## Evaluation evidence

Whether a rule earns its place is a question for reviewed outcomes, not for how
often it fired. basting can keep the evidence for that in the repository, next
to the work it describes. Nothing is recorded unless the config asks for it:

```json
{ "evaluation": { "repository": "team/project", "captureDiff": false } }
```

`repository` is a stable name, the same on every machine. It goes into every
record and every finding key. `captureDiff` also keeps the exact patch each run
read.

### What is written

| Path                               | What                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| `.basting/runs/<session>.jsonl`    | one JSON line per `basting check` or `basting hook claude` |
| `.basting/patches/<sha256>.diff`   | the exact patch, when `captureDiff` is on                  |
| `.basting/reviews/<anything>.json` | a person's review of one finding, written by hand          |

A run record (schema 2) holds:

- **Identity:** `run_id`, `session`, `timestamp`, `repository`.
- **Build:** `version`, `build`, a hash of the source the build was made from.
- **Origin:** `source` (`manual`, `hook` or `ci`) and `environment` (`local`,
  `container` or `ci`).
- **Revisions:** `branch`, `base`, `head`, and `patch`, the sha256 of the exact
  diff (null when the diff is empty).
- **Inputs:** `settings` (`base`, `failOn`, `severity`, `exclude`) and `scope`
  (files and commits).
- **Outcome:** `duration_ms`, `status` (`analyzed`, `empty`, `error`),
  `decision` (`pass`, `fail`, `block`, `continuation_report`, `error`),
  `exit_code` and `error`.
- **Findings:** every finding the rules produced, each with a `key` and a
  `disposition`. `standing` means it was in the report, `suppressed` means the
  patch acknowledged it, and `off` means configuration turned its rule off.

A finding's key is a hash of the repository, the patch, the rule, the file and
the evidence. It has no line number, so rerunning the same patch gives the same
finding. A revised patch gives a new key. The summary lists likely pairs as
`possible_duplicates`, and a reviewer links them with `duplicate_of`.

Records hold no absolute paths, and an error is recorded by its category only.
A record that cannot be written is a warning on stderr; it never changes the
exit code. basting never commits the files. That stays your decision.

### Environment

| Variable                  | Effect                                                |
| ------------------------- | ----------------------------------------------------- |
| `BASTING_NO_EVALUATION=1` | record nothing for this run (as `--no-evaluation`)    |
| `BASTING_SESSION_ID`      | group records into one session file                   |
| `BASTING_SOURCE`          | override `source`, e.g. `probe` for a deliberate test |
| `BASTING_ENVIRONMENT`     | override `environment`                                |

Without `BASTING_SESSION_ID`, the Stop hook uses the agent's session ID. Anything
else gets a fresh session. The name is hashed either way, so it never lands in a
record as written.

### Reviewing

One JSON file per reviewed finding, in `.basting/reviews/`:

```json
{
  "schema": 1,
  "finding": "<key from a run record>",
  "label": "useful_correction",
  "reason": "the swallowed error hid a failed write",
  "reviewer": "jk",
  "warranted_block": true,
  "minutes": 4,
  "resolution": "a1b2c3d"
}
```

`label` is one of:

- `useful_correction`, which needs a `resolution` (the fixing commit or other evidence)
- `legitimate_change`
- `false_alarm`
- `missed`, for something no rule reported. Its `finding` is `miss:<patch>:<case>`.

`warranted_block` records whether stopping the work was right, judged apart from
whether the finding was accurate. `duplicate_of` names the key of the review a
finding repeats. Two reviews of one key are an error.

### Summarizing and importing

```sh
basting evaluate                 # markdown summary of .basting
basting evaluate --json          # the same, as JSON
basting evaluate --build <hash>  # one build only; compare builds separately
basting import ./artifact        # records from CI or a container
```

`evaluate` reports runs by source and by environment, distinct patches, and
unreviewed findings. It also gives the count for each label, possible
duplicates, and blocks and continuation reports. For each rule it gives
findings, distinct findings, reviewed findings and labels, plus warranted blocks
out of reviewed high findings. Run counts measure exposure, not saves.

`import` takes a directory holding `runs/` (and optionally `patches/`), a
directory of `.jsonl` files, or one `.jsonl` file. It is idempotent by run ID. A
malformed record, a changed record under a known ID, or a patch whose name is
not its hash fails the import rather than being skipped.

## Scope

basting reads a patch for a specific class of edit — the ones that make a check
pass without satisfying it — and reports them deterministically, so the result
can be used as a gate.

It is not a linter, a code reviewer, or a scope checker. It does not run your
tests, evaluate whether the implementation is correct, or use a model to judge
intent. A finding is a statement about the diff and nothing more.

## License

MIT
