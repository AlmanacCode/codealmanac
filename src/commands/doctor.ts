import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type Database from "better-sqlite3";

import {
  checkClaudeAuth,
  type ClaudeAuthStatus,
  type SpawnCliFn,
} from "../agent/auth.js";
import { ensureFreshIndex } from "../indexer/index.js";
import { findNearestAlmanacDir } from "../paths.js";
import { openIndex } from "../indexer/schema.js";
import { findEntry } from "../registry/index.js";
import { readConfig } from "../update/config.js";
import { readStateForDoctor } from "../update/schedule.js";
import { isNewer } from "../update/semver.js";
import { runHealth, type HealthReport } from "./health.js";
import { IMPORT_LINE } from "./setup.js";

/**
 * `almanac doctor` — install + wiki health report.
 *
 * Separate from `almanac health` (which checks graph integrity of a
 * specific wiki). `doctor` answers the "is this install even set up
 * correctly?" question that users hit when first trying the tool or when
 * sessions silently stop getting captured.
 *
 * The report has two sections:
 *   - **Install** — host-level things: the binary, the native SQLite
 *     binding, Claude auth, the SessionEnd hook, the CLAUDE.md guides
 *     and import line. These are shared across every wiki on the
 *     machine.
 *   - **Current wiki** — whether the current cwd is inside a wiki,
 *     whether it's registered, how many pages/topics, index freshness,
 *     last-capture age, and any `almanac health` problems.
 *
 * **Side effect:** doctor refreshes the current wiki's `index.db` before
 * reading counts so the report matches reality. We used to claim
 * "read-only", but the `almanac health` probe already called
 * `ensureFreshIndex` transitively, and skipping the refresh up front
 * made page/topic counts lie when the wiki had drifted. Refreshing
 * here means the report stays honest; the cost is one rebuild on a
 * stale index, which is what every other query command does too.
 *
 * Exit code is always 0 — doctor is a report, not a test. Callers that
 * want a pass/fail gate can parse `--json` and count the ✗ entries.
 */

export interface DoctorOptions {
  cwd: string;

  /** Emit structured JSON instead of the colored report. */
  json?: boolean;
  /** Skip the wiki section; only run install checks. */
  installOnly?: boolean;
  /** Skip the install section; only run wiki checks. */
  wikiOnly?: boolean;

  // ─── Injection points (tests) ──────────────────────────────────────
  /** Override Claude auth probe. */
  spawnCli?: SpawnCliFn;
  /** Override `~/.claude/settings.json` path. */
  settingsPath?: string;
  /** Override `~/.claude/` directory. */
  claudeDir?: string;
  /** Override the bundled hooks directory lookup. */
  hookScriptPath?: string;
  /** Override the `codealmanac` install path detector. */
  installPath?: string;
  /** Override the reported codealmanac version. */
  versionOverride?: string;
  /** Override the reported Node version (for binding-mismatch tests). */
  nodeVersion?: string;
  /** Override the update-state.json path (tests sandbox to tmpdir). */
  updateStatePath?: string;
  /** Override the config.json path (tests sandbox to tmpdir). */
  updateConfigPath?: string;
  /**
   * Override the better-sqlite3 probe result. When provided, doctor
   * skips the real native-binding load and returns this instead.
   */
  sqliteProbe?: SqliteProbeResult;
  /** Override the health probe runner (tests inject a canned report). */
  runHealthFn?: typeof runHealth;
  /** Stdout sink. Tests capture here; production uses process.stdout. */
  stdout?: NodeJS.WritableStream;
  /** Test-only clock for "last capture: Xh ago" rendering. */
  now?: () => Date;
}

export interface DoctorResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ─── ANSI helpers ─────────────────────────────────────────────────────

const RST = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[38;5;35m";
const RED = "\x1b[38;5;167m";
const BLUE = "\x1b[38;5;75m";

// ─── Check types ──────────────────────────────────────────────────────

export type CheckStatus = "ok" | "problem" | "info";

/** One line in the report. Structured so `--json` can emit it directly. */
export interface Check {
  status: CheckStatus;
  message: string;
  /** Optional "how do I fix this" hint shown below the status line. */
  fix?: string;
  /** Machine-readable key — stable across versions, safe for scripting. */
  key: string;
}

export interface DoctorReport {
  version: string;
  install: Check[];
  updates: Check[];
  wiki: Check[];
}

interface SqliteProbeResult {
  ok: boolean;
  /** Human-readable summary of the probe outcome. */
  summary: string;
}

// ─── Entry point ──────────────────────────────────────────────────────

export async function runDoctor(
  options: DoctorOptions,
): Promise<DoctorResult> {
  const version =
    options.versionOverride ?? readPackageVersion() ?? "unknown";

  const install: Check[] = options.wikiOnly === true
    ? []
    : await gatherInstallChecks(options);

  // Updates are part of the install story — suppressed in `--wiki-only`.
  // We intentionally don't gate behind `--install-only` being false; a
  // user asking for install-only likely wants to know their update
  // status too.
  const updates: Check[] = options.wikiOnly === true
    ? []
    : await gatherUpdateChecks(options, version);

  const wiki: Check[] = options.installOnly === true
    ? []
    : await gatherWikiChecks(options);

  const report: DoctorReport = { version, install, updates, wiki };

  if (options.json === true) {
    return {
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  return {
    stdout: formatReport(report, options),
    stderr: "",
    exitCode: 0,
  };
}

// ─── Install section ──────────────────────────────────────────────────

async function gatherInstallChecks(
  options: DoctorOptions,
): Promise<Check[]> {
  const checks: Check[] = [];

  // 1. Install path.
  const installPath = options.installPath ?? detectInstallPath();
  checks.push({
    status: installPath !== null ? "ok" : "problem",
    key: "install.path",
    message:
      installPath !== null
        ? `codealmanac installed at ${installPath}`
        : "could not detect codealmanac install path",
    fix: installPath === null
      ? "reinstall with: npm install -g codealmanac"
      : undefined,
  });

  // 2. better-sqlite3 native binding.
  const nodeVersion = options.nodeVersion ?? process.version;
  const sqlite = options.sqliteProbe ?? probeBetterSqlite3();
  checks.push({
    status: sqlite.ok ? "ok" : "problem",
    key: "install.sqlite",
    message: sqlite.ok
      ? `better-sqlite3 native binding OK (Node ${nodeVersion})`
      : `better-sqlite3 native binding failed: ${sqlite.summary}`,
    fix: sqlite.ok
      ? undefined
      : "run: npm rebuild better-sqlite3 (in the install directory)",
  });

  // 3. Claude auth.
  const auth = await safeCheckAuth(options.spawnCli);
  checks.push(describeAuth(auth));

  // 4. SessionEnd hook.
  const settingsPath =
    options.settingsPath ?? path.join(homedir(), ".claude", "settings.json");
  checks.push(await describeHook(settingsPath));

  // 5. Guides.
  const claudeDir = options.claudeDir ?? path.join(homedir(), ".claude");
  checks.push(describeGuides(claudeDir));

  // 6. CLAUDE.md import line.
  checks.push(await describeImportLine(claudeDir));

  return checks;
}

function describeAuth(auth: ClaudeAuthStatus): Check {
  if (auth.loggedIn) {
    if (auth.authMethod === "apiKey") {
      return {
        status: "ok",
        key: "install.auth",
        message: "claude auth: ANTHROPIC_API_KEY set",
      };
    }
    const who = auth.email ?? "Claude account";
    const plan =
      auth.subscriptionType !== undefined
        ? ` (${auth.subscriptionType} subscription)`
        : "";
    return {
      status: "ok",
      key: "install.auth",
      message: `claude auth: ${who}${plan}`,
    };
  }
  if (
    process.env.ANTHROPIC_API_KEY !== undefined &&
    process.env.ANTHROPIC_API_KEY.length > 0
  ) {
    return {
      status: "ok",
      key: "install.auth",
      message: "claude auth: ANTHROPIC_API_KEY set",
    };
  }
  return {
    status: "problem",
    key: "install.auth",
    message: "claude auth: not signed in",
    fix: "run: claude auth login --claudeai  (or export ANTHROPIC_API_KEY)",
  };
}

async function describeHook(settingsPath: string): Promise<Check> {
  if (!existsSync(settingsPath)) {
    return {
      status: "problem",
      key: "install.hook",
      message: "SessionEnd hook not installed",
      fix: "run: almanac setup --yes",
    };
  }
  try {
    const raw = await readFile(settingsPath, "utf8");
    // Each SessionEnd entry is either:
    //   - a wrapped container `{matcher, hooks: [{type, command, …}]}`
    //     (the current Claude Code schema), OR
    //   - a legacy unwrapped `{type, command, …}` from codealmanac
    //     v0.1.0–v0.1.4.
    // We accept both so a user upgrading across the migration boundary
    // doesn't see a spurious "hook missing" flag until they re-run
    // setup.
    const parsed = JSON.parse(raw) as {
      hooks?: {
        SessionEnd?: {
          command?: string;
          hooks?: { command?: string }[];
        }[];
      };
    };
    const entries = parsed.hooks?.SessionEnd ?? [];
    const found = entries.some((e) => {
      if (
        typeof e?.command === "string" &&
        e.command.endsWith("almanac-capture.sh")
      ) {
        return true; // Legacy shape.
      }
      if (Array.isArray(e?.hooks)) {
        return e.hooks.some(
          (h) =>
            typeof h?.command === "string" &&
            h.command.endsWith("almanac-capture.sh"),
        );
      }
      return false;
    });
    if (!found) {
      return {
        status: "problem",
        key: "install.hook",
        message: "SessionEnd hook not installed",
        fix: "run: almanac setup --yes",
      };
    }
    return {
      status: "ok",
      key: "install.hook",
      message: `SessionEnd hook installed at ${settingsPath}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "problem",
      key: "install.hook",
      message: `could not read ${settingsPath}: ${msg}`,
      fix: "check the file for malformed JSON",
    };
  }
}

function describeGuides(claudeDir: string): Check {
  const mini = path.join(claudeDir, "codealmanac.md");
  const ref = path.join(claudeDir, "codealmanac-reference.md");
  const haveMini = existsSync(mini);
  const haveRef = existsSync(ref);
  if (haveMini && haveRef) {
    return {
      status: "ok",
      key: "install.guides",
      message: `Agent guides installed (${path.basename(mini)}, ${path.basename(ref)})`,
    };
  }
  const missing = [
    haveMini ? null : "codealmanac.md",
    haveRef ? null : "codealmanac-reference.md",
  ].filter((s): s is string => s !== null);
  return {
    status: "problem",
    key: "install.guides",
    message: `Agent guides missing (${missing.join(", ")})`,
    fix: "run: almanac setup --yes",
  };
}

async function describeImportLine(claudeDir: string): Promise<Check> {
  const claudeMd = path.join(claudeDir, "CLAUDE.md");
  if (!existsSync(claudeMd)) {
    return {
      status: "problem",
      key: "install.import",
      message: "CLAUDE.md import not present (no ~/.claude/CLAUDE.md)",
      fix: "run: almanac setup --yes",
    };
  }
  try {
    const contents = await readFile(claudeMd, "utf8");
    // Match line-starts-with-token — mirrors setup.ts's hasImportLine.
    const lines = contents.split(/\r?\n/).map((l) => l.trim());
    const present = lines.some((line) => {
      if (line === IMPORT_LINE) return true;
      if (!line.startsWith(IMPORT_LINE)) return false;
      const next = line[IMPORT_LINE.length];
      return next === " " || next === "\t";
    });
    if (present) {
      return {
        status: "ok",
        key: "install.import",
        message: "CLAUDE.md import present",
      };
    }
    return {
      status: "problem",
      key: "install.import",
      message: "CLAUDE.md import line missing",
      fix: "run: almanac setup --yes",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "problem",
      key: "install.import",
      message: `could not read ${claudeMd}: ${msg}`,
    };
  }
}

// ─── Updates section ──────────────────────────────────────────────────

/**
 * Build the "## Updates" section of the doctor report.
 *
 * The data comes from `~/.almanac/update-state.json` (written by the
 * post-command background worker) and `~/.almanac/config.json` (the
 * notifier toggle). Doctor never touches the registry itself — that's
 * a side effect, and `almanac update --check` is the command for
 * forcing a registry call.
 *
 * Report lines:
 *   1. `update.status` — ok when on latest, problem when outdated.
 *      Missing state file is shown as an `info` line pointing at
 *      `almanac update --check` (first-run state: we literally don't
 *      know yet).
 *   2. `update.last_check` — info, human-readable age.
 *   3. `update.notifier` — info, enabled/disabled.
 *   4. `update.dismissed` — info, only present when the user has
 *      dismissed one or more versions.
 */
async function gatherUpdateChecks(
  options: DoctorOptions,
  installedVersion: string,
): Promise<Check[]> {
  const checks: Check[] = [];
  const state = readStateForDoctor(options.updateStatePath);
  const config = await readConfig(options.updateConfigPath);

  if (state === null || state.latest_version.length === 0) {
    checks.push({
      status: "info",
      key: "update.status",
      message: `on ${installedVersion}; no update check has run yet`,
      fix: "run: almanac update --check",
    });
  } else if (isNewer(state.latest_version, installedVersion)) {
    const dismissed = state.dismissed_versions.includes(state.latest_version)
      ? " (dismissed — run `almanac update` to install anyway)"
      : "";
    checks.push({
      status: "problem",
      key: "update.status",
      message:
        `${state.latest_version} available (you're on ${installedVersion})${dismissed}`,
      fix: "run: almanac update",
    });
  } else {
    checks.push({
      status: "ok",
      key: "update.status",
      message: `on latest (${installedVersion})`,
    });
  }

  if (state !== null && state.last_check_at > 0) {
    const now = (options.now?.() ?? new Date()).getTime();
    const ageMs = now - state.last_check_at * 1000;
    const failedSuffix =
      state.last_fetch_failed_at !== undefined &&
      state.last_fetch_failed_at === state.last_check_at
        ? " (last attempt failed — will retry next invocation)"
        : "";
    checks.push({
      status: "info",
      key: "update.last_check",
      message: `last checked: ${formatDuration(ageMs)} ago${failedSuffix}`,
    });
  } else {
    checks.push({
      status: "info",
      key: "update.last_check",
      message: "last checked: never",
    });
  }

  checks.push({
    status: "info",
    key: "update.notifier",
    message: `update notifier: ${config.update_notifier ? "enabled" : "disabled"}`,
    fix: config.update_notifier
      ? undefined
      : "run: almanac update --enable-notifier",
  });

  if (state !== null && state.dismissed_versions.length > 0) {
    checks.push({
      status: "info",
      key: "update.dismissed",
      message: `dismissed versions: ${state.dismissed_versions.join(", ")}`,
    });
  }

  return checks;
}

// ─── Wiki section ─────────────────────────────────────────────────────

async function gatherWikiChecks(options: DoctorOptions): Promise<Check[]> {
  const checks: Check[] = [];
  const repoRoot = findNearestAlmanacDir(options.cwd);

  if (repoRoot === null) {
    checks.push({
      status: "info",
      key: "wiki.none",
      message: "No wiki in current directory",
      fix: "run: almanac bootstrap  (to create one in this repo)",
    });
    return checks;
  }

  checks.push({
    status: "info",
    key: "wiki.repo",
    message: `repo: ${repoRoot}`,
  });

  // Refresh the index up front so the page/topic counts below reflect
  // on-disk reality. `runHealth` would refresh transitively anyway —
  // doing it here explicitly means both the counts AND the health
  // summary agree on what they're counting. Any error during freshness
  // is swallowed; a broken index is a wiki-local concern we let the
  // per-check errors below report.
  try {
    await ensureFreshIndex({ repoRoot });
  } catch {
    // non-fatal: counts below will report whatever's in index.db (or
    // trigger their own error path), and the health check will
    // surface the real failure mode.
  }

  // Registry check. A malformed `~/.almanac/registry.json` must not crash
  // doctor — that's the exact failure mode doctor exists to surface. Wrap
  // the read in try/catch and translate a parse error into a `problem`
  // entry with the error message as the fix hint.
  let entry: Awaited<ReturnType<typeof findEntry>>;
  try {
    entry = await findEntry({ path: repoRoot });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    checks.push({
      status: "problem",
      key: "wiki.registered",
      message: `could not read registry: ${msg}`,
      fix: "inspect ~/.almanac/registry.json; remove or fix the malformed entry",
    });
    entry = null;
  }
  if (entry !== null) {
    checks.push({
      status: "ok",
      key: "wiki.registered",
      message: `registered as '${entry.name}'`,
    });
  } else if (checks[checks.length - 1]?.key !== "wiki.registered") {
    // Only push the "not yet registered" info line when the corrupt-
    // registry branch above didn't already push its own entry.
    checks.push({
      status: "info",
      key: "wiki.registered",
      message: "not yet registered (will register on first command)",
    });
  }

  const almanacDir = path.join(repoRoot, ".almanac");
  const dbPath = path.join(almanacDir, "index.db");

  // Page + topic counts. We open the DB directly rather than running the
  // indexer — doctor shouldn't cause a reindex as a side effect.
  let pageCount: number | null = null;
  let topicCount: number | null = null;
  if (existsSync(dbPath)) {
    try {
      const db = openIndex(dbPath);
      try {
        pageCount = countRows(db, "pages");
        topicCount = countRows(db, "topics");
      } finally {
        db.close();
      }
    } catch {
      pageCount = null;
    }
  }

  if (pageCount !== null) {
    checks.push({
      status: "info",
      key: "wiki.pages",
      message: `pages: ${pageCount}`,
    });
  }
  if (topicCount !== null) {
    checks.push({
      status: "info",
      key: "wiki.topics",
      message: `topics: ${topicCount}`,
    });
  }

  // Index freshness.
  checks.push(describeIndexFreshness(dbPath));

  // Last capture summary.
  checks.push(describeLastCapture(almanacDir, options.now));

  // Health summary — delegate to the real `runHealth` (injectable for
  // tests). We only need the JSON report to count problems; any error
  // running health turns into an info line so doctor keeps working.
  const healthFn = options.runHealthFn ?? runHealth;
  try {
    const healthRes = await healthFn({
      cwd: repoRoot,
      json: true,
    });
    const problems = countHealthProblems(healthRes.stdout);
    if (problems === 0) {
      checks.push({
        status: "ok",
        key: "wiki.health",
        message: "almanac health reports 0 problems",
      });
    } else {
      checks.push({
        status: "problem",
        key: "wiki.health",
        message: `almanac health reports ${problems} problem${problems === 1 ? "" : "s"}`,
        fix: "run: almanac health",
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    checks.push({
      status: "info",
      key: "wiki.health",
      message: `could not run almanac health: ${msg}`,
    });
  }

  return checks;
}

function countRows(db: Database.Database, table: string): number {
  // Table names can't be parameterized; we whitelist via the callers.
  const row = db
    .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)
    .get();
  return row?.n ?? 0;
}

function describeIndexFreshness(dbPath: string): Check {
  if (!existsSync(dbPath)) {
    return {
      status: "info",
      key: "wiki.index",
      message: "index: not built yet (run any query command)",
    };
  }
  try {
    const dbMtime = statSync(dbPath).mtimeMs;
    const age = Date.now() - dbMtime;
    return {
      status: "info",
      key: "wiki.index",
      message: `index: rebuilt ${formatDuration(age)} ago`,
    };
  } catch {
    return {
      status: "info",
      key: "wiki.index",
      message: "index: present",
    };
  }
}

function describeLastCapture(
  almanacDir: string,
  nowFn?: () => Date,
): Check {
  if (!existsSync(almanacDir)) {
    return {
      status: "info",
      key: "wiki.capture",
      message: "last capture: never",
    };
  }
  let entries: string[];
  try {
    entries = readdirSync(almanacDir);
  } catch {
    return {
      status: "info",
      key: "wiki.capture",
      message: "last capture: unknown",
    };
  }
  const captures = entries
    // Match both sidecar formats. `.capture-<sid>.log` is the hook's
    // stdout redirect (human-readable, what you want to tail). The
    // newer `.capture-<stem>.jsonl` is the SDK message stream written
    // by `capture.ts` itself — the only thing present when `almanac
    // capture` is invoked by hand (no hook, nothing redirecting
    // stdout). Reporting either extension as "last capture" means
    // doctor stays truthful in both the hook and manual invocation
    // paths.
    .filter(
      (e) =>
        e.startsWith(".capture-") &&
        (e.endsWith(".log") || e.endsWith(".jsonl")),
    )
    .map((e) => {
      try {
        return {
          name: e,
          mtime: statSync(path.join(almanacDir, e)).mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((e): e is { name: string; mtime: number } => e !== null);
  if (captures.length === 0) {
    return {
      status: "info",
      key: "wiki.capture",
      message: "last capture: never",
    };
  }
  captures.sort((a, b) => b.mtime - a.mtime);
  const latest = captures[0]!;
  const now = (nowFn?.() ?? new Date()).getTime();
  const age = now - latest.mtime;
  return {
    status: "info",
    key: "wiki.capture",
    message: `last capture: ${formatDuration(age)} ago (${latest.name})`,
  };
}

// Single `createRequire` instance — used by `detectInstallPath` and
// `probeBetterSqlite3`. Instantiating per call is cheap but not free.
const req = createRequire(import.meta.url);

/**
 * Problem-bearing keys in `HealthReport`. Kept as an explicit list
 * rather than `Object.values(parsed)` so that if a future health check
 * adds a non-problem array (a scope summary, a histogram, etc.), we
 * don't silently double-count it here.
 *
 * Each key maps 1:1 to a category in `health.ts` — when that file grows
 * a new problem category, add it here and the doctor summary will pick
 * it up. Forgetting costs one category of under-counting, caught by the
 * doctor tests.
 */
const HEALTH_PROBLEM_KEYS: (keyof HealthReport)[] = [
  "orphans",
  "stale",
  "dead_refs",
  "broken_links",
  "broken_xwiki",
  "empty_topics",
  "empty_pages",
  "slug_collisions",
];

function countHealthProblems(jsonStdout: string): number {
  try {
    const report = JSON.parse(jsonStdout) as Partial<HealthReport>;
    let total = 0;
    for (const key of HEALTH_PROBLEM_KEYS) {
      const arr = report[key];
      if (Array.isArray(arr)) total += arr.length;
    }
    return total;
  } catch {
    return 0;
  }
}

// ─── Probes ───────────────────────────────────────────────────────────

/**
 * Detect where codealmanac is installed by walking up from the running
 * module until we find a `package.json` whose `name` is `codealmanac`.
 *
 * `require.resolve("codealmanac")` doesn't work here — when codealmanac
 * runs as its own binary, it's not a dependency of anything that can
 * resolve it. But the currently-executing module IS inside the install
 * directory, so `import.meta.url` → walk up → find `package.json` →
 * verify name. Works for `npm i -g`, `npx`, local `node_modules/`, and
 * dev-from-source alike.
 */
function detectInstallPath(): string | null {
  try {
    const here = fileURLToPath(import.meta.url);
    let dir = path.dirname(here);
    // Walk up at most 5 levels — `dist/codealmanac.js` is one level deep
    // in a typical install; `src/commands/doctor.ts` is two levels deep
    // in dev. 5 is generous enough for exotic bundlers without risking
    // runaway traversal.
    for (let i = 0; i < 5; i++) {
      const pkgPath = path.join(dir, "package.json");
      if (existsSync(pkgPath)) {
        try {
          const raw = readFileSync(pkgPath, "utf-8");
          const pkg = JSON.parse(raw) as { name?: unknown };
          if (pkg.name === "codealmanac") return dir;
        } catch {
          // ignore — keep walking
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  } catch {
    // `import.meta.url` unavailable (unusual); fall back to null.
    return null;
  }
}

/**
 * Probe the better-sqlite3 native binding by opening an in-memory DB.
 * A mismatched Node ABI throws `NODE_MODULE_VERSION` here; we catch
 * and return a summary the caller can show with a "rebuild" hint.
 */
function probeBetterSqlite3(): SqliteProbeResult {
  try {
    // Open an in-memory DB — the cheapest way to force the native
    // binding to actually load. `:memory:` doesn't touch disk.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = req("better-sqlite3") as typeof import("better-sqlite3");
    const db = new Database(":memory:");
    db.close();
    return { ok: true, summary: "native binding loads cleanly" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Tidy the message — the full stack from a NODE_MODULE_VERSION
    // error is 20+ lines, useless to most users.
    const firstLine = msg.split("\n")[0] ?? msg;
    return { ok: false, summary: firstLine };
  }
}

async function safeCheckAuth(
  spawnCli?: SpawnCliFn,
): Promise<ClaudeAuthStatus> {
  try {
    return await checkClaudeAuth(spawnCli);
  } catch {
    return { loggedIn: false };
  }
}

function readPackageVersion(): string | null {
  try {
    const pkg = req("../../package.json") as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall through.
  }
  try {
    const pkg = req("../package.json") as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall through.
  }
  return null;
}

// ─── Formatting ───────────────────────────────────────────────────────

function formatReport(report: DoctorReport, options: DoctorOptions): string {
  const color = options.stdout === undefined && process.stdout.isTTY === true;
  const lines: string[] = [];
  lines.push(`codealmanac v${report.version}`);
  lines.push("");
  if (report.install.length > 0) {
    lines.push(color ? `${BOLD}## Install${RST}` : "## Install");
    for (const c of report.install) {
      lines.push(formatCheck(c, color));
    }
    lines.push("");
  }
  if (report.updates.length > 0) {
    lines.push(color ? `${BOLD}## Updates${RST}` : "## Updates");
    for (const c of report.updates) {
      lines.push(formatCheck(c, color));
    }
    lines.push("");
  }
  if (report.wiki.length > 0) {
    lines.push(color ? `${BOLD}## Current wiki${RST}` : "## Current wiki");
    for (const c of report.wiki) {
      lines.push(formatCheck(c, color));
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function formatCheck(c: Check, color: boolean): string {
  const { icon, tint } = iconFor(c.status, color);
  const head = `  ${tint}${icon}${color ? RST : ""} ${c.message}`;
  if (c.fix === undefined) return head;
  const fixLine = color
    ? `    ${DIM}${c.fix}${RST}`
    : `    ${c.fix}`;
  return `${head}\n${fixLine}`;
}

function iconFor(
  status: CheckStatus,
  color: boolean,
): { icon: string; tint: string } {
  switch (status) {
    case "ok":
      return { icon: "\u2713", tint: color ? GREEN : "" };
    case "problem":
      return { icon: "\u2717", tint: color ? RED : "" };
    case "info":
      return { icon: "\u25c7", tint: color ? BLUE : "" };
  }
}

function formatDuration(ms: number): string {
  if (ms < 0) return "just now";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
