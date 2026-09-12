#!/usr/bin/env node
import {
  GRADES,
  RULE_IDS,
  compact,
  full,
  inspect,
  json
} from "./chunk-LUGDFQHK.js";

// src/cli.ts
import { readFileSync as readFileSync4 } from "fs";
import { join as join5, resolve } from "path";

// src/config.ts
import { readFileSync } from "fs";
import { isAbsolute, join } from "path";
var DEFAULTS = { failOn: "high", severity: {}, exclude: [] };
var SEVERITIES = /* @__PURE__ */ new Set(["high", "medium", "low"]);
var KEYS = /* @__PURE__ */ new Set(["failOn", "severity", "exclude", "evaluation"]);
var ConfigError = class extends Error {
  name = "ConfigError";
};
function isRule(value) {
  return RULE_IDS.includes(value);
}
function isGrade(value) {
  return typeof value === "string" && GRADES.includes(value);
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseGrade(spec) {
  const [rule, grade, ...rest] = spec.split("=");
  if (rule === void 0 || !isRule(rule) || rest.length > 0) {
    throw new ConfigError(`--severity needs a known rule, as RULE=grade: ${spec}`);
  }
  if (!isGrade(grade)) {
    throw new ConfigError(`--severity grade must be high, medium, low or off: ${spec}`);
  }
  return [rule, grade];
}
function parseExclude(value) {
  if (!Array.isArray(value)) {
    throw new ConfigError("exclude must be an array of repository-relative paths");
  }
  return value.map((entry) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new ConfigError("exclude entries must be non-empty strings");
    }
    if (entry.startsWith(":")) {
      throw new ConfigError(`exclude entries cannot start with ":": ${entry}`);
    }
    if (isAbsolute(entry) || /^[A-Za-z]:/.test(entry) || entry.startsWith("\\")) {
      throw new ConfigError(`exclude entries must be relative to the repository root: ${entry}`);
    }
    if (entry.split(/[\\/]/).includes("..")) {
      throw new ConfigError(`exclude entries cannot contain "..": ${entry}`);
    }
    return entry;
  });
}
function parseEvaluation(value) {
  const expected = 'evaluation must name a stable repository, e.g. {"repository":"team/project"}';
  if (!isObject(value)) throw new ConfigError(expected);
  for (const key of Object.keys(value)) {
    if (key !== "repository" && key !== "captureDiff") {
      throw new ConfigError(`evaluation has an unknown key: ${key}`);
    }
  }
  const { repository, captureDiff } = value;
  if (typeof repository !== "string" || !/^[\w.-]+(?:\/[\w.-]+)*$/.test(repository)) {
    throw new ConfigError(expected);
  }
  if (captureDiff === void 0) return { repository };
  if (typeof captureDiff !== "boolean") {
    throw new ConfigError("evaluation.captureDiff must be true or false");
  }
  return { repository, captureDiff };
}
function fileAt(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function load(root2) {
  const own = fileAt(join(root2, "basting.config.json"));
  const inPackage = fileAt(join(root2, "package.json"));
  const nested = inPackage === null ? null : inPackage["basting"];
  const source = own ?? (isObject(nested) ? nested : null);
  const config = { ...DEFAULTS, severity: {}, exclude: [] };
  if (source === null) return config;
  if ("failOn" in source) {
    const value = source["failOn"];
    if (typeof value !== "string" || !SEVERITIES.has(value)) {
      throw new ConfigError(`failOn must be one of high, medium, low \u2014 got ${String(value)}`);
    }
    config.failOn = value;
  }
  if ("severity" in source) {
    const value = source["severity"];
    if (!isObject(value)) {
      throw new ConfigError("severity must be an object of RULE_ID to grade");
    }
    for (const [rule, grade] of Object.entries(value)) {
      if (!isRule(rule)) throw new ConfigError(`severity names an unknown rule: ${rule}`);
      if (!isGrade(grade)) {
        throw new ConfigError(`severity.${rule} must be high, medium, low or off`);
      }
      config.severity[rule] = grade;
    }
  }
  if ("exclude" in source) config.exclude = parseExclude(source["exclude"]);
  if ("evaluation" in source) config.evaluation = parseEvaluation(source["evaluation"]);
  for (const key of Object.keys(source)) {
    if (!KEYS.has(key)) throw new ConfigError(`unknown config key: ${key}`);
  }
  return config;
}

// src/evaluation.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readdirSync, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "fs";
import { basename, join as join3 } from "path";

// src/record.ts
import { createHash, randomUUID } from "crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join as join2 } from "path";

// src/git.ts
import { execFileSync } from "child_process";
function git(args, cwd, quiet = false) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64e6,
    stdio: quiet ? ["ignore", "pipe", "ignore"] : ["ignore", "pipe", "pipe"]
  });
}
var GitError = class extends Error {
  name = "GitError";
};
var OWN_DIR = ".basting";
function pathspecs(exclude) {
  return ["--", ".", ...[OWN_DIR, ...exclude].map((path) => `:(top,exclude)${path}`)];
}
function root(cwd) {
  try {
    return git(["rev-parse", "--show-toplevel"], cwd).trim();
  } catch {
    throw new GitError("not a git repository");
  }
}
function resolveBase(cwd) {
  for (const candidate of ["origin/main", "origin/master", "main", "master"]) {
    try {
      const merged = git(["merge-base", candidate, "HEAD"], cwd, true).trim();
      const head = git(["rev-parse", "HEAD"], cwd, true).trim();
      if (merged.length > 0 && merged !== head) return merged;
    } catch {
      continue;
    }
  }
  return "HEAD";
}
function revision(ref, cwd) {
  try {
    const sha = git(["rev-parse", "--verify", `${ref}^{commit}`], cwd, true).trim();
    return sha.length > 0 ? sha : null;
  } catch {
    return null;
  }
}
function branch(cwd) {
  try {
    const name = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd, true).trim();
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}
function commits(base, cwd) {
  try {
    const count = Number(git(["rev-list", "--count", `${base}..HEAD`], cwd, true).trim());
    return Number.isInteger(count) ? count : 0;
  } catch {
    return 0;
  }
}
function listFiles(args, cwd) {
  try {
    return git(args, cwd, true).split("\n").filter((path) => path.length > 0);
  } catch {
    return [];
  }
}
function untracked(cwd, exclude) {
  return listFiles(["ls-files", "--others", "--exclude-standard", ...pathspecs(exclude)], cwd);
}
function hasCommits(cwd) {
  try {
    git(["rev-parse", "--verify", "HEAD"], cwd, true);
    return true;
  } catch {
    return false;
  }
}
function asAddition(path, cwd) {
  try {
    return git(["diff", "--no-color", "--no-ext-diff", "--no-index", "/dev/null", path], cwd, true);
  } catch (error) {
    const stdout = error.stdout;
    return typeof stdout === "string" ? stdout : "";
  }
}
function diff(base, cwd, exclude = []) {
  if (!hasCommits(cwd)) {
    const everything = [
      ...listFiles(["ls-files", ...pathspecs(exclude)], cwd),
      ...untracked(cwd, exclude)
    ];
    return [...new Set(everything)].map((path) => asAddition(path, cwd)).join("\n");
  }
  let tracked;
  try {
    tracked = git(["diff", "--no-color", "--no-ext-diff", base, ...pathspecs(exclude)], cwd);
  } catch {
    throw new GitError(`could not diff against ${base}`);
  }
  const additions = untracked(cwd, exclude).map((path) => asAddition(path, cwd));
  return [tracked, ...additions].join("\n");
}
function messages(base, cwd) {
  try {
    return git(["log", "--format=%B", `${base}..HEAD`], cwd, true);
  } catch {
    return "";
  }
}

// src/record.ts
var DECISIONS = [
  "pass",
  "fail",
  "block",
  "continuation_report",
  "error"
];
var VERSION = true ? "0.1.0" : "source";
var BUILD = true ? "71349463aa3284c6b5040d44be8bb0c519ea8a744fb1ea668e2ee5770c5941c7" : "source";
function fingerprint(text) {
  return createHash("sha256").update(text).digest("hex");
}
function findingKey(repository, patch, finding) {
  return fingerprint(
    JSON.stringify([repository, patch, finding.rule, finding.file, finding.evidence])
  );
}
function evaluationIdentity(env, session) {
  return {
    run_id: randomUUID(),
    // Hashed, so a session name cannot carry a path or a credential into a
    // committed record, or become a path itself. With no session at all, each
    // invocation writes its own shard.
    session: fingerprint(env.BASTING_SESSION_ID || session || randomUUID()).slice(0, 24),
    environment: env.BASTING_ENVIRONMENT || (env.CI ? "ci" : env.container || existsSync("/.dockerenv") ? "container" : "local")
  };
}
function persistEvaluation(root2, record, warn) {
  try {
    const directory = join2(root2, OWN_DIR, "runs");
    mkdirSync(directory, { recursive: true });
    appendFileSync(join2(directory, `${record.session}.jsonl`), `${JSON.stringify(record)}
`);
  } catch {
    warn(
      `basting: evaluation record could not be saved; export or mount ${OWN_DIR} before this session ends.
`
    );
  }
}
function captureEvaluationDiff(root2, diff2, warn) {
  try {
    const directory = join2(root2, OWN_DIR, "patches");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join2(directory, `${fingerprint(diff2)}.diff`), diff2);
  } catch {
    warn("basting: evaluation diff could not be saved.\n");
  }
}

// src/evaluation.ts
var LABELS = ["useful_correction", "legitimate_change", "false_alarm", "missed"];
var MISS = /^miss:[^:\s]+:\S/;
function object(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonempty(value) {
  return typeof value === "string" && value.trim() !== "";
}
function check(condition, message) {
  if (!condition) throw new Error(message);
}
function parseEvaluationRun(value) {
  const input = value;
  check(
    object(value) && value.schema === 2 && nonempty(value.run_id) && nonempty(value.repository) && nonempty(value.session) && nonempty(value.version) && nonempty(value.build) && nonempty(value.source) && nonempty(value.environment) && typeof value.timestamp === "string" && Number.isFinite(Date.parse(value.timestamp)) && ["analyzed", "empty", "error"].includes(String(value.status)) && DECISIONS.includes(String(value.decision)) && Number.isInteger(value.exit_code) && typeof value.duration_ms === "number" && value.duration_ms >= 0 && object(value.settings) && Array.isArray(value.findings),
    "Invalid schema-2 evaluation run"
  );
  for (const item of value.findings) {
    check(
      object(item) && nonempty(item.key) && ["standing", "suppressed", "off"].includes(String(item.disposition)) && object(item.finding) && RULE_IDS.includes(String(item.finding.rule)) && ["high", "medium", "low"].includes(String(item.finding.severity)) && nonempty(item.finding.file) && typeof item.finding.evidence === "string",
      "Invalid evaluation finding"
    );
  }
  return input;
}
function parseEvaluationReview(value) {
  const input = value;
  check(
    object(value) && value.schema === 1 && nonempty(value.finding) && LABELS.includes(String(value.label)) && nonempty(value.reason) && nonempty(value.reviewer) && typeof value.warranted_block === "boolean" && typeof value.minutes === "number" && Number.isFinite(value.minutes) && value.minutes >= 0 && (value.duplicate_of === void 0 || nonempty(value.duplicate_of)) && (value.resolution === void 0 || nonempty(value.resolution)),
    "Invalid evaluation review"
  );
  check(
    value.label !== "useful_correction" || nonempty(value.resolution),
    "A useful correction needs a resolving commit or evidence reference"
  );
  check(
    value.label !== "missed" || MISS.test(String(value.finding)),
    "A missed finding needs a stable miss:<patch>:<case> key"
  );
  return input;
}
function readRunFile(path) {
  return readFileSync2(path, "utf8").split("\n").filter((line) => line.trim()).map((line, index) => {
    try {
      return parseEvaluationRun(JSON.parse(line));
    } catch (error) {
      throw new Error(`${path}:${index + 1}: invalid evaluation record`, { cause: error });
    }
  });
}
function files(directory, extension) {
  if (!existsSync2(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(extension)).map((entry) => join3(directory, entry.name)).sort();
}
function readEvaluation(directory) {
  return {
    runs: files(join3(directory, "runs"), ".jsonl").flatMap(readRunFile),
    reviews: files(join3(directory, "reviews"), ".json").map((path) => {
      try {
        return parseEvaluationReview(JSON.parse(readFileSync2(path, "utf8")));
      } catch (error) {
        throw new Error(`${path}: invalid evaluation review`, { cause: error });
      }
    })
  };
}
function importEvaluation(source, directory) {
  const paths = source.endsWith(".jsonl") ? [source] : files(existsSync2(join3(source, "runs")) ? join3(source, "runs") : source, ".jsonl");
  check(paths.length > 0, "No .jsonl artifacts found");
  const runs = paths.flatMap(readRunFile);
  const patches = files(join3(source, "patches"), ".diff").map((path) => {
    const diff2 = readFileSync2(path, "utf8");
    const name = `${fingerprint(diff2)}.diff`;
    check(basename(path) === name, `Snapshot hash mismatch: ${path}`);
    return { name, diff: diff2 };
  });
  const destination = join3(directory, "runs");
  mkdirSync2(destination, { recursive: true });
  const existing = new Map(
    files(destination, ".jsonl").flatMap(readRunFile).map((record) => [record.run_id, JSON.stringify(record)])
  );
  if (patches.length > 0) {
    mkdirSync2(join3(directory, "patches"), { recursive: true });
    for (const patch of patches) writeFileSync2(join3(directory, "patches", patch.name), patch.diff);
  }
  let added = 0;
  for (const record of runs) {
    const content = JSON.stringify(record);
    const previous = existing.get(record.run_id);
    if (previous !== void 0) {
      check(previous === content, `Conflicting run ID: ${record.run_id}`);
      continue;
    }
    const path = join3(destination, `import-${fingerprint(record.run_id)}.jsonl`);
    writeFileSync2(path, `${content}
`, { flag: "wx" });
    existing.set(record.run_id, content);
    added++;
  }
  return added;
}
function tally(values) {
  const out = {};
  for (const value of [...values].sort()) out[value] = (out[value] ?? 0) + 1;
  return out;
}
function evaluationSummary(records, reviews) {
  const runs = /* @__PURE__ */ new Map();
  for (const record of records) {
    const previous = runs.get(record.run_id);
    check(
      !previous || JSON.stringify(previous) === JSON.stringify(record),
      `Conflicting run ID: ${record.run_id}`
    );
    runs.set(record.run_id, record);
  }
  const all = [...runs.values()];
  const organic = all.filter((r) => r.source !== "probe").sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.run_id.localeCompare(b.run_id));
  const detections = /* @__PURE__ */ new Map();
  const occurrences = /* @__PURE__ */ new Map();
  const related = /* @__PURE__ */ new Map();
  for (const run3 of organic) {
    for (const item of run3.findings) {
      const f = item.finding;
      detections.set(item.key, item);
      occurrences.set(f.rule, (occurrences.get(f.rule) ?? 0) + 1);
      const signature = fingerprint(JSON.stringify([run3.repository, f.rule, f.file, f.evidence]));
      const keys = related.get(signature) ?? /* @__PURE__ */ new Set();
      keys.add(item.key);
      related.set(signature, keys);
    }
  }
  const labeled = /* @__PURE__ */ new Map();
  for (const review of reviews) {
    check(!labeled.has(review.finding), `Duplicate review: ${review.finding}`);
    check(
      review.label === "missed" || detections.has(review.finding),
      `Unknown finding: ${review.finding}`
    );
    labeled.set(review.finding, review);
  }
  for (const review of reviews) {
    if (review.duplicate_of !== void 0) {
      const target = labeled.get(review.duplicate_of);
      check(
        target && target.finding !== review.finding && !target.duplicate_of,
        `duplicate_of must name one canonical review: ${review.finding}`
      );
    }
  }
  const canonical = reviews.filter((r) => !r.duplicate_of);
  const high = (r) => detections.get(r.finding)?.finding.severity === "high";
  const reviewedHigh = canonical.filter(high);
  const warranted = reviewedHigh.filter((r) => r.warranted_block).length;
  const labelled = (list, label) => list.filter((r) => r.label === label).length;
  const byRule = RULE_IDS.map((rule) => {
    const reviewed = canonical.filter((r) => detections.get(r.finding)?.finding.rule === rule);
    const ruleHigh = reviewed.filter(high);
    return {
      rule,
      findings: occurrences.get(rule) ?? 0,
      distinct: [...detections.values()].filter((f) => f.finding.rule === rule).length,
      reviewed: reviewed.length,
      useful: labelled(reviewed, "useful_correction"),
      legitimate: labelled(reviewed, "legitimate_change"),
      false_alarms: labelled(reviewed, "false_alarm"),
      reviewed_high: ruleHigh.length,
      warranted_blocks: ruleHigh.filter((r) => r.warranted_block).length
    };
  }).filter((r) => r.findings > 0);
  return {
    runs: runs.size,
    organic_runs: organic.length,
    probe_runs: runs.size - organic.length,
    by_source: tally(all.map((r) => r.source)),
    by_environment: tally(all.map((r) => r.environment)),
    builds: [...new Set(organic.map((r) => `${r.version}/${r.build}`))].sort(),
    distinct_patches: new Set(
      organic.filter((r) => r.status === "analyzed" && r.patch !== null).map((r) => `${r.repository}:${r.patch}`)
    ).size,
    distinct_findings: detections.size,
    unreviewed: [...detections.keys()].filter((key) => !labeled.has(key)).length,
    useful_corrections: labelled(canonical, "useful_correction"),
    legitimate_changes: labelled(canonical, "legitimate_change"),
    false_alarms: labelled(canonical, "false_alarm"),
    identified_misses: labelled(canonical, "missed"),
    reviewed_high: reviewedHigh.length,
    warranted_blocks: warranted,
    block_precision: reviewedHigh.length ? warranted / reviewedHigh.length : null,
    review_minutes: reviews.reduce((total, r) => total + r.minutes, 0),
    blocks: organic.filter((r) => r.decision === "block").length,
    continuation_reports: organic.filter((r) => r.decision === "continuation_report").length,
    errors: organic.filter((r) => r.status === "error").length,
    empty: organic.filter((r) => r.status === "empty").length,
    by_rule: byRule,
    findings: [...detections.values()],
    possible_duplicates: [...related.values()].filter((keys) => keys.size > 1).map((keys) => [...keys])
  };
}
function evaluate(directory, build) {
  const data = readEvaluation(directory);
  if (build === void 0) return evaluationSummary(data.runs, data.reviews);
  const runs = data.runs.filter((r) => r.build === build);
  check(runs.length > 0, `No evaluation records for build ${build}`);
  const keys = new Set(runs.flatMap((r) => r.findings.map((f) => f.key)));
  return evaluationSummary(
    runs,
    data.reviews.filter((r) => keys.has(r.finding))
  );
}
function counts(values) {
  const entries = Object.entries(values);
  return entries.length ? entries.map(([name, n]) => `${name} ${n}`).join(", ") : "none";
}
function evaluationMarkdown(summary) {
  const precision = summary.block_precision === null ? "unmeasured" : `${Math.round(summary.block_precision * 100)}%`;
  return [
    "# basting evaluation",
    "",
    `${summary.organic_runs} organic runs; ${summary.probe_runs} probe runs; ${summary.distinct_patches} distinct nonempty patches.`,
    "",
    `Runs by source: ${counts(summary.by_source)}. Runs by environment: ${counts(summary.by_environment)}.`,
    "",
    "| Measure | Count |",
    "| --- | ---: |",
    `| Distinct findings | ${summary.distinct_findings} |`,
    `| Unreviewed | ${summary.unreviewed} |`,
    `| Useful corrections | ${summary.useful_corrections} |`,
    `| Legitimate changes | ${summary.legitimate_changes} |`,
    `| False alarms | ${summary.false_alarms} |`,
    `| Identified misses | ${summary.identified_misses} |`,
    `| Possible duplicates | ${summary.possible_duplicates.length} |`,
    `| Actual blocks | ${summary.blocks} |`,
    `| Continuation reports | ${summary.continuation_reports} |`,
    `| Errors / empty runs | ${summary.errors} / ${summary.empty} |`,
    `| Review minutes | ${summary.review_minutes} |`,
    "",
    `Blocking warranted: ${precision} (${summary.warranted_blocks} of ${summary.reviewed_high} reviewed high findings).`,
    "",
    "Run counts are exposure, not saves. No success verdict is inferred from detections. Compare builds separately before changing policy.",
    "",
    "| Rule | Findings | Distinct | Reviewed | Useful | Legitimate | False alarms | Warranted blocks |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summary.by_rule.map(
      (r) => `| ${r.rule} | ${r.findings} | ${r.distinct} | ${r.reviewed} | ${r.useful} | ${r.legitimate} | ${r.false_alarms} | ${r.warranted_blocks}/${r.reviewed_high} |`
    ),
    "",
    `Builds: ${summary.builds.join(", ") || "none"}`,
    ""
  ].join("\n");
}

// src/run.ts
import { performance } from "perf_hooks";
function decide(report, mode, continuation) {
  if (report.ok) return { exitCode: 0, decision: "pass" };
  if (mode === "check") return { exitCode: 1, decision: "fail" };
  return continuation ? { exitCode: 0, decision: "continuation_report" } : { exitCode: 2, decision: "block" };
}
function run(options) {
  const started = performance.now();
  const { config, mode } = options;
  const env = options.env ?? process.env;
  const warn = options.warn ?? ((message) => {
    process.stderr.write(message);
  });
  const failOn = options.failOn ?? config.failOn;
  const severities = options.severities ?? config.severity;
  const recording = config.evaluation !== void 0 && options.noEvaluation !== true && env.BASTING_NO_EVALUATION !== "1";
  const record = {
    schema: 2,
    ...evaluationIdentity(env, options.session),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    repository: config.evaluation?.repository ?? "",
    version: VERSION,
    build: BUILD,
    source: env.BASTING_SOURCE || (env.CI ? "ci" : mode === "hook" ? "hook" : "manual"),
    branch: null,
    base: null,
    head: null,
    patch: null,
    settings: {
      base: options.base ?? "auto",
      failOn,
      severity: { ...severities },
      exclude: [...config.exclude]
    },
    scope: null,
    duration_ms: 0,
    status: "error",
    decision: "error",
    // A hook that cannot read a patch says so and lets the turn end.
    exit_code: mode === "hook" ? 0 : 2,
    error: null,
    findings: []
  };
  let root2 = options.cwd;
  try {
    root2 = root(options.cwd);
    record.branch = branch(root2);
    record.head = revision("HEAD", root2);
    const base = options.base ?? resolveBase(root2);
    record.base = revision(base, root2);
    const diff2 = diff(base, root2, config.exclude);
    const patch = diff2.trim() === "" ? null : fingerprint(diff2);
    record.patch = patch;
    if (recording && patch !== null && config.evaluation?.captureDiff === true) {
      captureEvaluationDiff(root2, diff2, warn);
    }
    const { report, dispositions } = inspect({
      diff: diff2,
      failOn,
      commitMessages: messages(base, root2),
      severities
    });
    const { exitCode, decision } = decide(report, mode, options.continuation === true);
    record.scope = { files: report.files_seen, commits: commits(base, root2) };
    record.status = report.files_seen === 0 ? "empty" : "analyzed";
    record.decision = decision;
    record.exit_code = exitCode;
    record.findings = patch === null ? [] : dispositions.map(({ finding, disposition }) => ({
      key: findingKey(record.repository, patch, finding),
      finding,
      disposition
    }));
    return { report, exitCode, decision };
  } catch (error) {
    record.error = error instanceof Error ? error.name : "UnknownError";
    throw error;
  } finally {
    record.duration_ms = Math.round(performance.now() - started);
    if (recording) persistEvaluation(root2, record, warn);
  }
}

// src/hook.ts
function payloadOf(text) {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
function run2(payloadText, config, cwd, options = {}) {
  const payload = payloadOf(payloadText);
  let result;
  try {
    result = run({
      ...options,
      cwd,
      config,
      mode: "hook",
      continuation: payload.stop_hook_active === true,
      session: typeof payload.session_id === "string" ? payload.session_id : void 0
    });
  } catch {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "basting: could not read a patch; this turn was NOT gated.\n"
    };
  }
  const { report, decision, exitCode } = result;
  if (decision === "continuation_report") {
    return {
      exitCode,
      stdout: "",
      stderr: `${compact(report)}
basting: reporting without blocking \u2014 this turn is already a hook continuation.
`
    };
  }
  if (report.findings.length === 0 && decision === "pass") {
    return { exitCode, stdout: "", stderr: "" };
  }
  return { exitCode, stdout: "", stderr: `${compact(report)}
` };
}

// src/init.ts
import { mkdirSync as mkdirSync3, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { dirname, join as join4 } from "path";
var HOOK_COMMAND = "npx -y basting hook claude";
function read(path) {
  try {
    const parsed = JSON.parse(readFileSync3(path, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function withHook(settings) {
  const next = { ...settings };
  const hooks = { ...next.hooks ?? {} };
  const stop = [...hooks["Stop"] ?? []];
  const already = stop.some(
    (group) => (group.hooks ?? []).some((entry) => entry.command.includes("basting"))
  );
  if (already) return { settings, added: false };
  stop.push({ hooks: [{ type: "command", command: HOOK_COMMAND }] });
  hooks["Stop"] = stop;
  next.hooks = hooks;
  return { settings: next, added: true };
}
function initClaude(root2) {
  const path = join4(root2, ".claude", "settings.json");
  const { settings, added } = withHook(read(path));
  if (!added) return `basting: already wired into ${path}`;
  mkdirSync3(dirname(path), { recursive: true });
  writeFileSync3(path, `${JSON.stringify(settings, null, 2)}
`);
  return `basting: Stop hook written to ${path}`;
}
var INSTRUCTION = `## Before you finish

Run \`npx -y basting --compact\` before reporting a task complete. If it reports
any HIGH finding, fix the cause rather than the check, then run it again.`;
var INSTRUCTION_FILES = {
  codex: "AGENTS.md",
  cursor: join4(".cursor", "rules", "basting.mdc"),
  copilot: join4(".github", "copilot-instructions.md")
};
function initInstruction(root2, agent) {
  const relative = INSTRUCTION_FILES[agent];
  if (relative === void 0) throw new Error(`unknown agent: ${agent}`);
  const path = join4(root2, relative);
  let existing = "";
  try {
    existing = readFileSync3(path, "utf8");
  } catch {
    existing = "";
  }
  if (existing.includes("basting --compact")) return `basting: already present in ${path}`;
  mkdirSync3(dirname(path), { recursive: true });
  const separator = existing.length === 0 || existing.endsWith("\n\n") ? "" : "\n";
  writeFileSync3(path, `${existing}${separator}
${INSTRUCTION}
`);
  return `basting: instruction appended to ${path}`;
}

// src/cli.ts
var USAGE = `basting \u2014 the stitch that was never meant to stay in

  basting check             read the patch and report
  basting hook claude       run as a Claude Code Stop hook (reads stdin)
  basting init <agent>      wire basting in (claude, codex, cursor, copilot)
  basting config            print the configuration in force
  basting evaluate [dir]    summarize .basting runs and human reviews
  basting import <path>     add CI or container evaluation records to .basting

Options for check:
  --base <ref>              compare against this ref (default: the fork point)
  --fail-on <severity>      high (default), medium, low
  --severity <RULE=grade>   grade one rule high, medium, low or off (repeatable)
  --compact                 one line per finding
  --json                    the wire format
  --no-evaluation           do not record this run (also for hook claude)

Options for evaluate:
  --json                    the summary as JSON
  --build <hash>            only records from one build

Exit codes: 0 nothing blocking, 1 a finding at or above --fail-on, 2 a usage error.
`;
function parse(argv) {
  const options = {
    base: null,
    failOn: null,
    severities: null,
    compact: false,
    json: false,
    noEvaluation: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--compact") options.compact = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--no-evaluation") options.noEvaluation = true;
    else if (arg === "--base") {
      const value = argv[++i];
      if (value === void 0) throw new ConfigError("--base needs a ref");
      options.base = value;
    } else if (arg === "--fail-on") {
      const value = argv[++i];
      if (value !== "high" && value !== "medium" && value !== "low") {
        throw new ConfigError("--fail-on takes high, medium or low");
      }
      options.failOn = value;
    } else if (arg === "--severity") {
      const value = argv[++i];
      if (value === void 0) throw new ConfigError("--severity needs RULE=grade");
      const [rule, grade] = parseGrade(value);
      options.severities = { ...options.severities, [rule]: grade };
    } else if (arg !== void 0 && arg.startsWith("-")) {
      throw new ConfigError(`unknown option: ${arg}`);
    }
  }
  return options;
}
function check2(argv) {
  const options = parse(argv);
  const root2 = root(process.cwd());
  const { report, exitCode } = run({
    cwd: root2,
    config: load(root2),
    mode: "check",
    base: options.base ?? void 0,
    failOn: options.failOn ?? void 0,
    severities: options.severities ?? void 0,
    noEvaluation: options.noEvaluation
  });
  if (options.json) process.stdout.write(`${json(report)}
`);
  else if (options.compact) process.stdout.write(`${compact(report)}
`);
  else process.stdout.write(`${full(report)}
`);
  return exitCode;
}
function evaluateCommand(argv) {
  let target;
  let asJson = false;
  let build;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") asJson = true;
    else if (arg === "--build") {
      const value = argv[++i];
      if (value === void 0) throw new ConfigError("--build needs a build hash");
      build = value;
    } else if (arg !== void 0 && arg.startsWith("-")) {
      throw new ConfigError(`unknown option: ${arg}`);
    } else if (target === void 0) target = arg;
    else throw new ConfigError("evaluate takes one directory");
  }
  const directory = target === void 0 ? join5(root(process.cwd()), OWN_DIR) : resolve(process.cwd(), target);
  const summary = evaluate(directory, build);
  process.stdout.write(
    asJson ? `${JSON.stringify(summary, null, 2)}
` : evaluationMarkdown(summary)
  );
  return 0;
}
function importCommand(argv) {
  const [source, ...rest] = argv;
  if (source === void 0 || rest.length > 0) {
    throw new ConfigError("import takes one file or directory");
  }
  const added = importEvaluation(
    resolve(process.cwd(), source),
    join5(root(process.cwd()), OWN_DIR)
  );
  process.stdout.write(`basting: imported ${added} evaluation records.
`);
  return 0;
}
function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === void 0 || command === "check") return check2(rest);
  if (command === "hook") {
    if (rest[0] !== "claude") {
      process.stderr.write("basting: the only hook is `basting hook claude`.\n");
      return 2;
    }
    const noEvaluation = rest.slice(1).includes("--no-evaluation");
    let payload = "";
    try {
      payload = readFileSync4(0, "utf8");
    } catch {
      payload = "";
    }
    const outcome = run2(payload, load(process.cwd()), process.cwd(), { noEvaluation });
    if (outcome.stdout.length > 0) process.stdout.write(outcome.stdout);
    if (outcome.stderr.length > 0) process.stderr.write(outcome.stderr);
    return outcome.exitCode;
  }
  if (command === "evaluate") return evaluateCommand(rest);
  if (command === "import") return importCommand(rest);
  if (command === "init") {
    const agent = rest[0];
    if (agent === "claude") {
      process.stdout.write(`${initClaude(process.cwd())}
`);
      return 0;
    }
    if (agent !== void 0 && agent in INSTRUCTION_FILES) {
      process.stdout.write(`${initInstruction(process.cwd(), agent)}
`);
      return 0;
    }
    process.stderr.write("basting: init takes claude, codex, cursor or copilot.\n");
    return 2;
  }
  if (command === "config") {
    const config = load(root(process.cwd()));
    const isDefault = config.failOn === DEFAULTS.failOn ? "  (default)" : "";
    process.stdout.write(`fail-on     ${config.failOn}${isDefault}
`);
    const grades = Object.entries(config.severity);
    if (grades.length === 0) process.stdout.write("severity    built-in grades  (default)\n");
    for (const [rule, grade] of grades) process.stdout.write(`severity    ${rule}=${grade}
`);
    process.stdout.write(`exclude     ${[OWN_DIR, ...config.exclude].join(", ")}
`);
    const evaluation = config.evaluation;
    if (evaluation === void 0) process.stdout.write("evaluation  off  (default)\n");
    else {
      const diffs = evaluation.captureDiff === true ? ", capturing diffs" : "";
      process.stdout.write(`evaluation  ${evaluation.repository}${diffs}
`);
    }
    return 0;
  }
  if (command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(USAGE);
    return 0;
  }
  process.stderr.write(`basting: unknown command: ${command}

${USAGE}`);
  return 2;
}
try {
  process.exit(main());
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`basting: ${message}
`);
  process.exit(2);
}
