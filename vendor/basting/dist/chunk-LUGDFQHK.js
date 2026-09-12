// src/types.ts
var RULE_IDS = [
  "RETURN_HARDCODED",
  "IMPL_SPECIAL_CASED",
  "ERROR_SWALLOWED",
  "TYPE_ERROR_SILENCED",
  "STRICTNESS_LOWERED",
  "CHECK_DISABLED_IN_CI",
  "LINT_SILENCED",
  "GUARD_REMOVED"
];
var SEVERITY_ORDER = { high: 3, medium: 2, low: 1 };
var GRADES = ["high", "medium", "low", "off"];

// src/report.ts
var REMEDIES = {
  RETURN_HARDCODED: "Work the value out, or delete the test that only this constant satisfies.",
  IMPL_SPECIAL_CASED: "Handle the general case, not the one the test names.",
  ERROR_SWALLOWED: "Handle the error, or let it propagate.",
  TYPE_ERROR_SILENCED: "Fix the type rather than turning the checker off for it.",
  STRICTNESS_LOWERED: "Put the setting back and make the code meet it.",
  CHECK_DISABLED_IN_CI: "Make the check pass rather than letting it fail quietly.",
  LINT_SILENCED: "Satisfy the rule, or say in the reason why it cannot be.",
  GUARD_REMOVED: "Put the check back, or say what now makes it unnecessary."
};
var MARKS = { high: "\u2717 HIGH ", medium: "! MED  ", low: "\xB7 LOW  " };
function one(finding2) {
  return [
    `${MARKS[finding2.severity] ?? "?"} ${finding2.file}:${finding2.line}  ${finding2.rule}`,
    `     ${finding2.message}`,
    `     | ${finding2.evidence}`,
    `     -> ${REMEDIES[finding2.rule]}`
  ].join("\n");
}
function turnedOff(report) {
  return report.turned_off > 0 ? `${report.turned_off} finding(s) turned off by configuration.` : null;
}
function headline(report) {
  if (report.findings.length === 0) {
    return `basting \u2014 nothing basted (${report.files_seen} file(s))`;
  }
  const parts = [];
  if (report.high > 0) parts.push(`${report.high} high`);
  if (report.medium > 0) parts.push(`${report.medium} medium`);
  if (report.low > 0) parts.push(`${report.low} low`);
  return `basting \u2014 ${report.findings.length} finding(s)  (${parts.join(", ")})`;
}
function full(report) {
  const blocks = [headline(report), ""];
  for (const finding2 of report.findings) blocks.push(one(finding2), "");
  if (report.allowed.length > 0) {
    blocks.push(`This patch silenced ${report.allowed.length} of its own findings.`);
    for (const allowance of report.allowed) {
      blocks.push(`! ${allowance.rule}`, `     ... -- ${allowance.reason}`);
    }
    blocks.push("");
  }
  const off = turnedOff(report);
  if (off !== null) blocks.push(off);
  return blocks.join("\n").trimEnd();
}
function compact(report) {
  const off = turnedOff(report);
  const tail = off === null ? [] : [`basting: ${off}`];
  if (report.findings.length === 0) return ["basting: nothing basted", ...tail].join("\n");
  const lines = report.findings.map(
    (f) => `${f.severity.toUpperCase()} ${f.file}:${f.line} ${f.rule} \u2014 ${f.message}`
  );
  return [`basting: ${report.findings.length} finding(s)`, ...lines, ...tail].join("\n");
}
function json(report) {
  return JSON.stringify(report, null, 2);
}

// src/diff.ts
var OLD_HEADER = /^--- (?:a\/)?(.+)$/;
var NEW_HEADER = /^\+\+\+ (?:b\/)?(.+)$/;
var HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
function parse(diff) {
  const files = [];
  let current = null;
  let oldLine = 0;
  let newLine = 0;
  let pendingOldPath = null;
  for (const raw of diff.split("\n")) {
    const old = raw.match(OLD_HEADER);
    if (old !== null) {
      pendingOldPath = old[1] ?? null;
      continue;
    }
    const next = raw.match(NEW_HEADER);
    if (next !== null) {
      const path = next[1];
      if (path === "/dev/null") {
        const gone = pendingOldPath;
        current = gone === null || gone === "/dev/null" ? null : { path: gone, added: [], removed: [], deleted: true, before: [], after: [] };
        if (current !== null) files.push(current);
      } else if (path === void 0) {
        current = null;
      } else {
        current = { path, added: [], removed: [], deleted: false, before: [], after: [] };
        files.push(current);
      }
      pendingOldPath = null;
      continue;
    }
    const hunk = raw.match(HUNK_HEADER);
    if (hunk !== null) {
      oldLine = Number(hunk[1] ?? 0);
      newLine = Number(hunk[2] ?? 0);
      continue;
    }
    if (current === null) continue;
    if (raw.startsWith("+")) {
      const line = { number: newLine, text: raw.slice(1) };
      current.added.push(line);
      current.after.push(line);
      newLine += 1;
      continue;
    }
    if (raw.startsWith("-")) {
      const line = { number: oldLine, text: raw.slice(1) };
      current.removed.push(line);
      current.before.push(line);
      oldLine += 1;
      continue;
    }
    if (raw.startsWith(" ")) {
      current.before.push({ number: oldLine, text: raw.slice(1) });
      current.after.push({ number: newLine, text: raw.slice(1) });
      oldLine += 1;
      newLine += 1;
      continue;
    }
    if (raw.length === 0) {
      oldLine += 1;
      newLine += 1;
    }
  }
  return files;
}
var TEST_FILE = /(?:^|[/\\])(?:__tests__|__fixtures__|test|tests|spec)[/\\]|[._-](?:test|spec)\.[cm]?[jt]sx?$|_test\.(?:go|py|rb)$|(?:^|[/\\])test_[^/\\]+\.py$|Test\.(?:java|kt|cs)$/;
function isTest(path) {
  return TEST_FILE.test(path);
}
var PROSE = /\.(?:md|mdx|mdc|txt|rst|adoc)$|(?:^|[/\\])llms\.txt$/i;
function isProse(path) {
  return PROSE.test(path);
}
var INERT = /(?:^|[/\\])(?:pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|Pipfile\.lock|uv\.lock|Gemfile\.lock|composer\.lock|go\.sum)$|\.min\.[cm]?js$|\.map$|\.snap$|\.html?$/i;
function isInert(path) {
  return INERT.test(path);
}
function stem(path) {
  const file = path.split(/[/\\]/).pop() ?? path;
  return file.replace(/\.[cm]?[jt]sx?$/, "").replace(/\.(?:py|go|rb|java|kt|cs)$/, "").replace(/[._-]?(?:test|spec)$/i, "").replace(/^test_/i, "").toLowerCase();
}
function code(text) {
  return blankStrings(text).replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
}
function codeOf(lines) {
  const out = /* @__PURE__ */ new Map();
  let inBlock = false;
  for (const line of lines) {
    const trimmed = line.text.trim();
    if (!inBlock && (/^\*(?:\s|$)/.test(trimmed) || /^#(?!\[)/.test(trimmed))) {
      out.set(line.number, "");
      continue;
    }
    const text = blankStrings(line.text);
    let kept = "";
    let i = 0;
    while (i < text.length) {
      if (inBlock) {
        const end = text.indexOf("*/", i);
        if (end === -1) break;
        inBlock = false;
        i = end + 2;
        continue;
      }
      const open = text.indexOf("/*", i);
      const rest = text.indexOf("//", i);
      if (rest !== -1 && (open === -1 || rest < open)) {
        kept += text.slice(i, rest);
        break;
      }
      if (open === -1) {
        kept += text.slice(i);
        break;
      }
      kept += text.slice(i, open);
      inBlock = true;
      i = open + 2;
    }
    out.set(line.number, kept);
  }
  return out;
}
function blankStrings(text) {
  return text.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, "$1$1");
}
function comments(text) {
  const blanked = blankStrings(text);
  const found = [];
  const line = blanked.match(/\/\/.*$/);
  if (line !== null) found.push(line[0]);
  for (const block of blanked.matchAll(/\/\*[\s\S]*?\*\//g)) found.push(block[0]);
  const hash = blanked.match(/#.*$/);
  if (hash !== null) found.push(hash[0]);
  return found.join("\n");
}

// src/rules/literals.ts
var STRING = /(['"`])((?:\\.|(?!\1)[^\\\n]){2,})\1/g;
var NUMBER = /\b-?\d+(?:\.\d+)?\b/g;
var NOISE = /* @__PURE__ */ new Set(["0", "1", "-1", "2", "100", "true", "false", "null", "undefined", ""]);
function literalsIn(lines) {
  const found = /* @__PURE__ */ new Set();
  for (const line of lines) {
    for (const match of line.matchAll(STRING)) {
      const value = match[2];
      if (value !== void 0 && !NOISE.has(value)) found.add(value);
    }
    for (const match of code(line).matchAll(NUMBER)) {
      const value = match[0];
      if (!NOISE.has(value)) found.add(value);
    }
  }
  return found;
}
function expectedByStem(files, isTest2, stem2) {
  const byStem = /* @__PURE__ */ new Map();
  for (const file of files) {
    if (!isTest2(file.path)) continue;
    const key = stem2(file.path);
    const lines = byStem.get(key) ?? [];
    for (const line of file.added) lines.push(line.text);
    byStem.set(key, lines);
  }
  const out = /* @__PURE__ */ new Map();
  for (const [key, lines] of byStem) out.set(key, literalsIn(lines));
  return out;
}

// src/rules/index.ts
function contextFrom(files) {
  return { files, expected: expectedByStem(files, isTest, stem) };
}
function expectedFor(context, path) {
  return context.expected.get(stem(path)) ?? /* @__PURE__ */ new Set();
}
function skip(file) {
  return file.deleted || isProse(file.path) || isInert(file.path);
}
function finding(rule, severity, file, line, message) {
  return { rule, severity, file, line: line.number, message, evidence: line.text.trim() };
}
var BARE_RETURN = /^\s*return\s+(['"`][^'"`]*['"`]|-?\d+(?:\.\d+)?)\s*;?\s*$/;
var COMPARISON = /[=!]==?\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1|[=!]==?\s*(-?\d+(?:\.\d+)?)\b/g;
function quoted(value) {
  const out = [];
  for (const match of value.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const inner = match[2];
    if (inner !== void 0) out.push(inner);
  }
  for (const match of code(value).matchAll(/\b-?\d+(?:\.\d+)?\b/g)) out.push(match[0]);
  return out;
}
var WORD = /^-{0,2}[A-Za-z]+(?:[_.:/-][A-Za-z]+)*$/;
var FILE_NAME = /^[\w.-]+\.(?:html?|mdx?|json|ya?ml|toml|txt|[cm]?[jt]sx?|css)$/;
var HTTP_STATUS = /^[1-5]\d\d$/;
function isVocabulary(value, subject) {
  if (WORD.test(value) || FILE_NAME.test(value)) return true;
  return HTTP_STATUS.test(value) && /status|code/i.test(subject);
}
function subjectBefore(text) {
  return text.match(/[\w$.[\]'"]+\s*$/)?.[0]?.trim() ?? "";
}
function returnHardcoded(context) {
  const findings = [];
  for (const file of context.files) {
    if (isTest(file.path) || skip(file)) continue;
    if (file.removed.length === 0) continue;
    const expected = expectedFor(context, file.path);
    for (const line of file.added) {
      const raw = line.text.match(BARE_RETURN);
      if (raw === null) continue;
      const body = raw[1];
      if (body === void 0) continue;
      for (const value of quoted(body)) {
        if (!expected.has(value)) continue;
        const word = isVocabulary(value, "");
        findings.push(
          finding(
            "RETURN_HARDCODED",
            word ? "medium" : "high",
            file.path,
            line,
            `Returns ${JSON.stringify(value)}, which this patch also writes into a test.` + (word ? " It reads as a domain word, not a sample value, so it does not block." : "")
          )
        );
        break;
      }
    }
  }
  return findings;
}
function implSpecialCased(context) {
  const findings = [];
  for (const file of context.files) {
    if (isTest(file.path) || skip(file)) continue;
    const expected = expectedFor(context, file.path);
    if (expected.size === 0) continue;
    for (const line of file.added) {
      if (!/\b(?:if|elif|case|when|&&|\|\|)\b|\bif\s*\(/.test(line.text)) continue;
      for (const match of line.text.matchAll(COMPARISON)) {
        const value = match[2] ?? match[3];
        if (value === void 0 || !expected.has(value)) continue;
        const before = line.text.slice(0, match.index);
        if (/\btypeof\s+[\w$.[\]'"]+\s*$/.test(before)) continue;
        const word = isVocabulary(value, subjectBefore(before));
        findings.push(
          finding(
            "IMPL_SPECIAL_CASED",
            word ? "medium" : "high",
            file.path,
            line,
            `Branches on ${JSON.stringify(value)}, which this patch also writes into a test.` + (word ? " It reads as a word the code dispatches on, so it does not block." : "")
          )
        );
        break;
      }
    }
  }
  return findings;
}
var EMPTY_CATCH = [
  /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/,
  /\.catch\(\s*(?:\([^)]*\)|\w+)?\s*=>\s*\{\s*\}\s*\)/,
  /\bexcept\b[^:]*:\s*pass\b/,
  /\brescue\b\s*(?:=>\s*\w+)?\s*;\s*end\b/,
  /\bcatch\s*\{\s*\}/
];
function errorSwallowed(context) {
  const findings = [];
  for (const file of context.files) {
    if (isTest(file.path) || skip(file)) continue;
    const after = codeOf(file.after);
    for (let i = 0; i < file.added.length; i += 1) {
      const line = file.added[i];
      if (line === void 0) continue;
      const text = after.get(line.number) ?? "";
      const single = EMPTY_CATCH.some((pattern) => pattern.test(text));
      const next = file.added[i + 1];
      const pair = /\bexcept\b[^:]*:\s*$/.test(text) && next !== void 0 && /^\s*pass\s*$/.test(after.get(next.number) ?? "");
      if (!single && !pair) continue;
      findings.push(
        finding(
          "ERROR_SWALLOWED",
          "high",
          file.path,
          line,
          "The error is caught and nothing is done with it."
        )
      );
    }
  }
  return findings;
}
var TYPE_SILENCERS = [
  [
    /@ts-ignore\b/,
    "`@ts-ignore` turns off the type checker for the next line",
    "comment",
    "counts"
  ],
  [
    /@ts-expect-error\b/,
    "`@ts-expect-error` turns off the type checker for the next line",
    "comment",
    "ordinary"
  ],
  [
    /#\s*type:\s*ignore\b/,
    "`# type: ignore` turns off the type checker for this line",
    "comment",
    "counts"
  ],
  [
    /#\s*pyright:\s*ignore\b/,
    "`# pyright: ignore` turns off the type checker for this line",
    "comment",
    "counts"
  ],
  [/\bas\s+any\b/, "`as any` drops the type rather than satisfying it", "code", "ordinary"],
  [/\bas\s+unknown\s+as\b/, "`as unknown as` launders one type into another", "code", "ordinary"]
];
function typeErrorSilenced(context) {
  const findings = [];
  for (const file of context.files) {
    if (skip(file)) continue;
    const test = isTest(file.path);
    for (const line of file.added) {
      for (const [pattern, describe, where, inTests] of TYPE_SILENCERS) {
        if (test && inTests === "ordinary") continue;
        const target = where === "comment" ? comments(line.text) : code(line.text);
        if (!pattern.test(target)) continue;
        findings.push(finding("TYPE_ERROR_SILENCED", "high", file.path, line, describe));
        break;
      }
    }
  }
  return findings;
}
var LINT_SILENCERS = [
  [/eslint-disable\b/, "`eslint-disable` switches a rule off rather than satisfying it", "comment"],
  [/#\s*noqa\b/, "`# noqa` switches a check off rather than satisfying it", "comment"],
  // A Rust attribute is code, not a comment.
  [/#\[allow\(/, "`#[allow(...)]` switches a lint off rather than satisfying it", "code"],
  // A Java annotation is code, not a comment.
  [
    /@SuppressWarnings\b/,
    // basting-ignore LINT_SILENCED -- the pattern table, not a use
    "`@SuppressWarnings` switches a check off rather than satisfying it",
    "code"
  ],
  [/#pragma\s+warning\s+disable\b/, "`#pragma warning disable` switches a check off", "comment"],
  [/\/\/\s*nolint\b/, "`//nolint` switches a check off rather than satisfying it", "comment"]
];
function lintSilenced(context) {
  const findings = [];
  for (const file of context.files) {
    if (skip(file)) continue;
    for (const line of file.added) {
      for (const [pattern, describe, where] of LINT_SILENCERS) {
        const target = where === "comment" ? comments(line.text) : code(line.text);
        if (!pattern.test(target)) continue;
        findings.push(finding("LINT_SILENCED", "medium", file.path, line, describe));
        break;
      }
    }
  }
  return findings;
}
var STRICT_FLAGS = [
  "strict",
  "strictNullChecks",
  "noImplicitAny",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "noUnusedLocals",
  "noFallthroughCasesInSwitch",
  "alwaysStrict",
  "strictFunctionTypes"
];
function strictnessLowered(context) {
  const findings = [];
  for (const file of context.files) {
    if (skip(file)) continue;
    for (const line of file.added) {
      for (const flag of STRICT_FLAGS) {
        const turnedOff2 = new RegExp(`["']?${flag}["']?\\s*:\\s*false`).test(line.text);
        if (!turnedOff2) continue;
        const wasOn = file.removed.some(
          (old) => new RegExp(`["']?${flag}["']?\\s*:\\s*true`).test(old.text)
        );
        if (!wasOn) continue;
        findings.push(
          finding(
            "STRICTNESS_LOWERED",
            "high",
            file.path,
            line,
            `\`${flag}\` was on and is now off.`
          )
        );
        break;
      }
      const stepped = line.text.match(/["']([\w@/-]+)["']\s*:\s*\[?\s*["'](off|warn)["']/);
      if (stepped !== null) {
        const rule = stepped[1];
        const wasError = rule !== void 0 && file.removed.some(
          (old) => new RegExp(
            `["']${rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\s*:\\s*\\[?\\s*["']error["']`
          ).test(old.text)
        );
        if (wasError) {
          findings.push(
            finding(
              "STRICTNESS_LOWERED",
              "high",
              file.path,
              line,
              `\`${rule ?? "a rule"}\` was an error and is now ${stepped[2] ?? "off"}.`
            )
          );
        }
      }
    }
  }
  return findings;
}
var CI_FILE = /(?:^|[/\\])\.github[/\\]workflows[/\\]|\.(?:ya?ml)$|\.sh$|(?:^|[/\\])Makefile$|package\.json$/;
var CI_ESCAPES = [
  [
    /continue-on-error:\s*true/,
    "`continue-on-error: true` lets the job fail without failing the run",
    "step"
  ],
  [/\|\|\s*true\b/, "`|| true` lets the command fail without failing the step", "command"],
  [/\|\|\s*:\s*(?:$|;|&)/, "`|| :` lets the command fail without failing the step", "command"],
  [/--no-verify\b/, "`--no-verify` skips the commit hooks", "always"],
  [/--passWithNoTests\b/, "`--passWithNoTests` makes an empty run count as a pass", "always"],
  [/\bif:\s*false\b/, "`if: false` stops the step running at all", "always"],
  [/\bset\s\+e\b/, "`set +e` stops errors being fatal", "status"]
];
var CHECK = /\b(?:tests?(?!\s+-[a-zA-Z]\b)|specs?|lint|eslint|prettier|typecheck|type-check|tsc|build|verify|checks?|audit|coverage|vitest|jest|mocha|pytest|tox|mypy|pyright|ruff|flake8|clippy|golangci-lint|rspec|phpunit|gradlew?|mvn|xcodebuild|ctest)\b/i;
function stepAround(lines, at) {
  const index = lines.findIndex((line) => line.number === at);
  const indent = (text) => text.length - text.trimStart().length;
  const opens = (text) => /^\s*-\s/.test(text);
  const own = indent(lines[index]?.text ?? "");
  let start = index;
  while (start > 0 && !opens(lines[start]?.text ?? "")) start -= 1;
  let end = index + 1;
  while (end < lines.length) {
    const text = lines[end]?.text ?? "";
    if (opens(text) || text.trim() !== "" && indent(text) < own) break;
    end += 1;
  }
  return lines.slice(start, end).filter((_, i) => start + i !== index).map((line) => line.text).join("\n");
}
function escapeSeverity(file, line, pattern, reach) {
  if (reach === "command") {
    const rescued = line.text.slice(0, line.text.search(pattern));
    return CHECK.test(rescued) ? "high" : "medium";
  }
  if (reach === "step") {
    const step = stepAround(file.after, line.number);
    if (!/\b(?:run|uses|name):/.test(step)) return "high";
    return CHECK.test(step) ? "high" : "medium";
  }
  if (reach === "status") {
    const later = file.after.filter((other) => other.number > line.number);
    return later.some((other) => /\$\?|PIPESTATUS/.test(other.text)) ? null : "high";
  }
  return "high";
}
function checkDisabledInCi(context) {
  const findings = [];
  for (const file of context.files) {
    if (skip(file) || !CI_FILE.test(file.path)) continue;
    for (const line of file.added) {
      for (const [pattern, describe, reach] of CI_ESCAPES) {
        if (!pattern.test(line.text)) continue;
        const severity = escapeSeverity(file, line, pattern, reach);
        if (severity !== null) {
          const plumbing = severity === "medium" ? ", but what it rescues is not a check" : "";
          findings.push(
            finding("CHECK_DISABLED_IN_CI", severity, file.path, line, describe + plumbing)
          );
        }
        break;
      }
    }
  }
  return findings;
}
var GUARD = /\bthrow\s+\w|\braise\s+\w|\bpanic\(|\bassert\b|\binvariant\(/;
function guardRemoved(context) {
  const findings = [];
  for (const file of context.files) {
    if (isTest(file.path) || skip(file)) continue;
    const after = codeOf(file.after);
    const gained = file.added.some((line) => GUARD.test(after.get(line.number) ?? ""));
    if (gained) continue;
    const before = codeOf(file.before);
    for (const line of file.removed) {
      if (!GUARD.test(before.get(line.number) ?? "")) continue;
      findings.push(
        finding(
          "GUARD_REMOVED",
          "medium",
          file.path,
          line,
          "A check was removed and not replaced."
        )
      );
    }
  }
  return findings;
}
var RULES = [
  returnHardcoded,
  implSpecialCased,
  errorSwallowed,
  typeErrorSilenced,
  strictnessLowered,
  checkDisabledInCi,
  lintSilenced,
  guardRemoved
];
function apply(context) {
  return RULES.flatMap((rule) => rule(context));
}

// src/suppress.ts
var INLINE = /basting-ignore\s+([A-Z_]+)\s*--\s*(.+?)\s*$/;
var TRAILER = /^Basting-Allow:\s*([A-Z_]+)\s*--\s*(.+?)\s*$/gim;
function known(rule) {
  return rule !== void 0 && RULE_IDS.includes(rule);
}
function silencedInline(files, finding2) {
  const file = files.find((candidate) => candidate.path === finding2.file);
  if (file === void 0) return null;
  for (const line of file.added) {
    if (line.number !== finding2.line && line.number !== finding2.line - 1) continue;
    const match = line.text.match(INLINE);
    if (match === null) continue;
    if (match[1] !== finding2.rule) continue;
    return match[2] ?? "";
  }
  return null;
}
function allowancesIn(commitMessages) {
  const found = [];
  for (const match of commitMessages.matchAll(TRAILER)) {
    const rule = match[1];
    const reason = match[2];
    if (!known(rule) || reason === void 0) continue;
    found.push({ rule, reason });
  }
  return found;
}
function sift(findings, files, allowances) {
  const allowed = new Map(allowances.map((allowance) => [allowance.rule, allowance.reason]));
  const kept = [];
  const silenced = [];
  for (const finding2 of findings) {
    const inline = silencedInline(files, finding2);
    if (inline !== null) {
      silenced.push({ finding: finding2, reason: inline });
      continue;
    }
    const trailer = allowed.get(finding2.rule);
    if (trailer !== void 0) {
      silenced.push({ finding: finding2, reason: trailer });
      continue;
    }
    kept.push(finding2);
  }
  return { kept, silenced };
}

// src/analyze.ts
function regrade(finding2, severities) {
  const grade = severities[finding2.rule];
  if (grade === void 0 || grade === "off" || grade === finding2.severity) return finding2;
  return { ...finding2, severity: grade };
}
function inspect(input) {
  const failOn = input.failOn ?? "high";
  const files = parse(input.diff);
  const severities = input.severities ?? {};
  const found = apply(contextFrom(files));
  const live = found.filter((f) => severities[f.rule] !== "off");
  const regraded = live.map((f) => regrade(f, severities));
  const allowances = allowancesIn(input.commitMessages ?? "");
  const { kept, silenced } = sift(regraded, files, allowances);
  kept.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (bySeverity !== 0) return bySeverity;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });
  const count = (severity) => kept.filter((f) => f.severity === severity).length;
  const blocking = kept.filter((f) => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER[failOn]).length;
  const report = {
    schema: 1,
    ok: blocking === 0,
    fail_on: failOn,
    findings: kept,
    high: count("high"),
    medium: count("medium"),
    low: count("low"),
    files_seen: files.length,
    allowed: silenced.map((item) => ({ rule: item.finding.rule, reason: item.reason })),
    severity: { ...severities },
    turned_off: found.length - live.length
  };
  return {
    report,
    dispositions: [
      ...kept.map((finding2) => ({ finding: finding2, disposition: "standing" })),
      ...silenced.map(({ finding: finding2 }) => ({ finding: finding2, disposition: "suppressed" })),
      ...found.filter((f) => severities[f.rule] === "off").map((finding2) => ({ finding: finding2, disposition: "off" }))
    ]
  };
}
function analyze(input) {
  return inspect(input).report;
}

export {
  RULE_IDS,
  GRADES,
  full,
  compact,
  json,
  parse,
  isTest,
  inspect,
  analyze
};
