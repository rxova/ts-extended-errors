/**
 * The wire contract.
 *
 * `schema: 1` JSON with snake_case fields is the public API. Rule IDs are
 * frozen: appending one is a minor release, changing what an existing one means
 * is a major, because somebody's config names it.
 */
declare const RULE_IDS: readonly ["RETURN_HARDCODED", "IMPL_SPECIAL_CASED", "ERROR_SWALLOWED", "TYPE_ERROR_SILENCED", "STRICTNESS_LOWERED", "CHECK_DISABLED_IN_CI", "LINT_SILENCED", "GUARD_REMOVED"];
type RuleId = (typeof RULE_IDS)[number];
/**
 * `high` means a reviewer who saw it would not have merged the change.
 * `medium` is worth reading before they do. `low` is context.
 */
type Severity = 'high' | 'medium' | 'low';
/**
 * What a repository may set a rule to. A grade is a policy about a rule; a
 * severity is a fact about a finding. `off` is a grade and never a severity:
 * a finding that is turned off does not exist, and is only counted.
 */
type Grade = Severity | 'off';
declare const GRADES: readonly Grade[];
interface Finding {
    rule: RuleId;
    severity: Severity;
    file: string;
    line: number;
    message: string;
    /** The line of the patch this is about, verbatim. */
    evidence: string;
}
interface Report {
    schema: 1;
    ok: boolean;
    fail_on: Severity;
    findings: Finding[];
    high: number;
    medium: number;
    low: number;
    files_seen: number;
    allowed: {
        rule: RuleId;
        reason: string;
    }[];
    /** The per-rule grades in force, as configured. Empty when there are none. */
    severity: Partial<Record<RuleId, Grade>>;
    /** Findings dropped because configuration turned their rule off. */
    turned_off: number;
}

interface AnalyzeInput {
    /** A unified diff. */
    diff: string;
    failOn?: Severity;
    /** Commit messages in the range, for `Basting-Allow:` trailers. */
    commitMessages?: string;
    /**
     * Per-rule grades that replace the built-in ones.
     *
     * `--fail-on` is one lever for every rule: lowering it to let one noisy rule
     * through lets all of them through. An override moves one rule and nothing
     * else. `off` is there because a rule a repository has judged to say nothing
     * would otherwise cost an acknowledgement per finding, forever.
     */
    severities?: Partial<Record<RuleId, Grade>>;
}
/** The whole engine. One patch in, one report out. */
declare function analyze(input: AnalyzeInput): Report;

/**
 * A unified-diff parser, hand-written because this package has no runtime
 * dependencies.
 *
 * Unlike a parser that only needs line numbers, the rules here read what the
 * lines *say* — a hardcoded return and a swallowed error are both statements
 * about content — so added and removed lines are kept with their text.
 */
interface Line {
    number: number;
    text: string;
}
interface DiffFile {
    path: string;
    added: Line[];
    removed: Line[];
    /** The file is gone from the tree after this patch. */
    deleted: boolean;
    /**
     * Each side of every hunk in order — unchanged lines and changed ones — with
     * that side's numbering. Some changes only mean something next to what did
     * not change: `set +e` followed by a line that reads `$?`, or a deleted line
     * that sat inside a comment opened above it.
     */
    before: Line[];
    after: Line[];
}
declare function parse(diff: string): DiffFile[];
declare function isTest(path: string): boolean;

declare function full(report: Report): string;
declare function compact(report: Report): string;
declare function json(report: Report): string;

export { type AnalyzeInput, type DiffFile, type Finding, GRADES, type Grade, type Line, RULE_IDS, type Report, type RuleId, type Severity, analyze, compact, full, isTest, json, parse as parseDiff };
