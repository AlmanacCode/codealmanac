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
import { findNearestAlmanacDir } from "../paths.js";
import { openIndex } from "../indexer/schema.js";
import { findEntry } from "../registry/index.js";
import { runHealth } from "./health.js";
import { IMPORT_LINE } from "./setup.js";

/**
 * `almanac doctor` — install + wiki health report.
 *
 * Separate from `almanac health` (which checks graph integrity of a
 * specific wiki). `doctor` answers the "is this install even set up
 * correctly?" question that users hit when first trying the tool or when
 * sessions silently stop getting captured. It's read-only: every check
 * reports a state; none of them mutate.
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

  const wiki: Check[] = options.installOnly === true
    ? []
    : await gatherWikiChecks(options);

  const report: DoctorReport = { version, install, wiki };

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
    const parsed = JSON.parse(raw) as {
      hooks?: { SessionEnd?: { command?: string }[] };
    };
    const entries = parsed.hooks?.SessionEnd ?? [];
    const ours = entries.find(
      (e) =>
        typeof e.command === "string" &&
        e.command.endsWith("almanac-capture.sh"),
    );
    if (ours === undefined) {
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

  // Registry check.
  const entry = await findEntry({ path: repoRoot });
  if (entry !== null) {
    checks.push({
      status: "ok",
      key: "wiki.registered",
      message: `registered as '${entry.name}'`,
    });
  } else {
    // Auto-register runs on every query command — so if a user has ever
    // run `almanac search` in this repo, it's registered. If we see no
    // entry here it means they haven't. Run `almanac doctor` itself
    // doesn't auto-register (by design — doctor is a report, not a
    // mutator).
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
    .filter((e) => e.startsWith(".capture-") && e.endsWith(".log"))
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

function countHealthProblems(jsonStdout: string): number {
  try {
    const report = JSON.parse(jsonStdout) as Record<string, unknown[]>;
    let total = 0;
    for (const arr of Object.values(report)) {
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
