import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkClaudeAuth,
  type ClaudeAuthStatus,
  type SpawnCliFn,
  UNAUTHENTICATED_MESSAGE,
} from "../agent/providers/claude/index.js";
import {
  buildProviderSetupView,
  getProviderDefaultModel,
  parseAgentSelection,
} from "../agent/provider-view.js";
import type { ProviderSetupView } from "../agent/provider-view.js";
import {
  isAgentProviderId,
  readConfig,
  writeConfig,
  type AgentProviderId,
} from "../update/config.js";
import { runHookInstall } from "./hook.js";
import {
  detectCurrentInstallPath,
  detectEphemeral,
  spawnGlobalInstall,
} from "./setup/install-path.js";
import {
  countExistingPages,
  printNextSteps,
} from "./setup/next-steps.js";

/**
 * `codealmanac setup` — the MCP-style branded TUI that runs when a user
 * invokes the bare `codealmanac` binary (or `almanac setup` / `codealmanac
 * setup` explicitly).
 *
 * Model: `mcp-ts/src/setup.ts` from openalmanac. Same ASCII banner + badge
 * + step-indicator style, same interactive + `--yes` + non-interactive
 * modes.
 *
 * Three things get installed:
 *
 *   1. The `SessionEnd` hook in `~/.claude/settings.json` (delegated to
 *      `runHookInstall` from `./hook.ts`).
 *   2. The short "how to use codealmanac" guide at
 *      `~/.claude/codealmanac.md`, sourced from `guides/mini.md` in the
 *      package.
 *   3. The full reference at `~/.claude/codealmanac-reference.md`,
 *      sourced from `guides/reference.md`.
 *   4. An `@~/.claude/codealmanac.md` import line in `~/.claude/CLAUDE.md`
 *      so Claude Code picks up the short guide globally.
 *
 * Everything is idempotent — running setup again is safe. `--skip-hook`
 * and `--skip-guides` opt out of the individual installs. `--yes` or a
 * non-TTY stdin skips all prompts and installs everything.
 */

export interface SetupOptions {
  /** Install everything without prompting. */
  yes?: boolean;
  /** Don't install the SessionEnd hook. */
  skipHook?: boolean;
  /** Don't install the CLAUDE.md guides. */
  skipGuides?: boolean;
  /** Set the default agent provider during setup. */
  agent?: string;

  // ─── Injection points (tests only) ────────────────────────────────
  /** Override the subprocess spawner for `claude auth status`. */
  spawnCli?: SpawnCliFn;
  /** Override `~/.claude/settings.json` path. */
  settingsPath?: string;
  /** Override the bundled hook script path. */
  hookScriptPath?: string;
  /** Override the stable hooks directory for the hook script copy. */
  stableHooksDir?: string;
  /** Override `~/.claude/` dir for guide install. */
  claudeDir?: string;
  /** Override the directory containing `mini.md` / `reference.md`. */
  guidesDir?: string;
  /** Override interactivity; defaults to `process.stdin.isTTY`. */
  isTTY?: boolean;
  /** Stdout sink; defaults to `process.stdout`. */
  stdout?: NodeJS.WritableStream;
  /**
   * Override the install-path probe result. When `null` the probe is
   * bypassed (tests that don't care about the ephemeral-path step).
   * When a string it's treated as the detected install path.
   */
  installPath?: string | null;
  /**
   * Override the npm global install spawner (tests inject a no-op to
   * avoid actually spawning npm during CI).
   */
  spawnGlobalInstall?: () => Promise<void>;
}

export interface SetupResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ─── ANSI helpers ────────────────────────────────────────────────────

const RST = "\x1b[0m";
const DIM = "\x1b[2m";
const WHITE_BOLD = "\x1b[1;37m";
const BLUE = "\x1b[38;5;75m";
const ACCENT_BG = "\x1b[48;5;252m\x1b[38;5;16m";

const GRADIENT = [
  "\x1b[38;5;255m",
  "\x1b[38;5;253m",
  "\x1b[38;5;251m",
  "\x1b[38;5;249m",
  "\x1b[38;5;246m",
  "\x1b[38;5;243m",
];

// `codealmanac` 11-letter ASCII banner. Chosen for tasteful rendering —
// same banner used in the MCP setup wizard design, retooled letters for
// the word "codealmanac". Each glyph is 6 lines tall.
//
// If you tweak this, keep it to ≤80 visual columns wide so it fits in
// narrow terminals (80 cols is the classic default).
const LOGO_LINES = [
  "  ___ ___  ___  ___   _   _    __  __   _   _  _   _   ___ ",
  " / __/ _ \\|   \\| __| /_\\ | |  |  \\/  | /_\\ | \\| | /_\\ / __|",
  "| (_| (_) | |) | _| / _ \\| |__| |\\/| |/ _ \\| .` |/ _ \\ (__ ",
  " \\___\\___/|___/|___/_/ \\_\\____|_|  |_/_/ \\_\\_|\\_/_/ \\_\\___|",
  "                                                           ",
  "        a living wiki for codebases, for your agent         ",
];

const BAR = `  ${DIM}\u2502${RST}`;

function printBanner(out: NodeJS.WritableStream): void {
  out.write("\n");
  for (let i = 0; i < LOGO_LINES.length; i++) {
    const color = GRADIENT[Math.min(i, GRADIENT.length - 1)] ?? "";
    out.write(`${color}${LOGO_LINES[i]}${RST}\n`);
  }
  out.write(`\n${WHITE_BOLD}  Install the hook + agent guides${RST}\n`);
}

function printBadge(out: NodeJS.WritableStream): void {
  out.write(`\n   ${ACCENT_BG} codealmanac ${RST}\n\n`);
}

function stepDone(out: NodeJS.WritableStream, msg: string): void {
  out.write(`  ${BLUE}\u25c7${RST}  ${msg}\n`);
}

function stepActive(out: NodeJS.WritableStream, msg: string): void {
  out.write(`  ${BLUE}\u25c6${RST}  ${msg}\n`);
}

function stepSkipped(out: NodeJS.WritableStream, msg: string): void {
  out.write(`  ${DIM}\u25cb  ${msg}${RST}\n`);
}

// ─── Entry point ─────────────────────────────────────────────────────

export async function runSetup(
  options: SetupOptions = {},
): Promise<SetupResult> {
  const out = options.stdout ?? process.stdout;
  const isTTY =
    options.isTTY ?? (process.stdin.isTTY === true);
  const interactive = isTTY && options.yes !== true;

  // No-op fast path. When the caller explicitly skipped every install
  // step, rendering the full banner + step markers + "Setup complete"
  // box is actively misleading — nothing was actually set up. Emit a
  // single terse line and exit so the user gets honest feedback and
  // piped callers (CI, scripts) don't parse through nine lines of ANSI
  // to conclude nothing happened.
  if (options.skipHook === true && options.skipGuides === true) {
    out.write(
      "codealmanac: nothing to install — use --help to see what setup does\n",
    );
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  printBanner(out);
  printBadge(out);

  // Step 1: auth status. We report what we find; we don't block. The user
  // can still install the hook + guides without being logged in — they'll
  // hit the auth wall on first `capture`, not on setup.
  const auth = await safeCheckAuth(options.spawnCli);
  reportAuth(out, auth);
  out.write(BAR + "\n");

  const agentChoice = await chooseDefaultAgent({
    out,
    interactive,
    requested: options.agent,
    spawnCli: options.spawnCli,
  });
  if (!agentChoice.ok) {
    return {
      stdout: "",
      stderr: `almanac: ${agentChoice.error}\n`,
      exitCode: 1,
    };
  }
  stepDone(
    out,
    `Default agent: ${WHITE_BOLD}${agentChoice.provider}${RST}` +
      (agentChoice.model === null ? "" : ` (${agentChoice.model})`),
  );
  out.write(BAR + "\n");

  // Step 1b: ephemeral install detection. When codealmanac was invoked via
  // `npx codealmanac` (no prior `npm i -g`), the binary lives inside an
  // npx cache directory or pnpm store that can be evicted at any time.
  // `almanac` is also not on PATH, so the user can't use it after setup.
  //
  // When we detect an ephemeral location, we offer (or, on --yes, perform)
  // a `npm install -g codealmanac` to make the install permanent.
  //
  // This is Bug #2 from codealmanac-known-bugs.md.
  const ephem = options.installPath !== undefined
    ? (options.installPath !== null
        ? detectEphemeral(options.installPath)
        : false)
    : detectEphemeral(detectCurrentInstallPath());
  if (ephem) {
    let globalAction: InstallDecision = "install";
    if (interactive) {
      globalAction = await confirm(
        out,
        `Running from an ephemeral npx location. Install globally so 'almanac' stays on PATH?`,
        true,
      );
    }
    if (globalAction === "install") {
      stepActive(out, "Installing codealmanac globally…");
      try {
        await (options.spawnGlobalInstall ?? spawnGlobalInstall)();
        stepDone(out, "codealmanac installed globally (almanac now on PATH)");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        stepActive(out, `Global install failed: ${msg}`);
        out.write(
          `  ${DIM}You can retry manually: npm install -g codealmanac${RST}\n`,
        );
      }
    } else {
      stepSkipped(
        out,
        `Global install ${DIM}skipped — almanac will not be on PATH after this session${RST}`,
      );
    }
    out.write(BAR + "\n");
  }

  // Step 2: install the hook (default yes).
  let hookAction: InstallDecision = "install";
  if (options.skipHook === true) {
    hookAction = "skip";
  } else if (interactive) {
    hookAction = await confirm(
      out,
      "Install auto-capture hooks for Claude, Codex, and Cursor?",
      true,
    );
  }

  let hookResultLine = "";
  if (hookAction === "install") {
    const res = await runHookInstall({
      source: "all",
      settingsPath: options.settingsPath,
      hookScriptPath: options.hookScriptPath,
      stableHooksDir: options.stableHooksDir,
    });
    if (res.exitCode !== 0) {
      stepActive(out, `SessionEnd hook: ${res.stderr.trim()}`);
      return {
        stdout: "",
        stderr: res.stderr,
        exitCode: res.exitCode,
      };
    }
    hookResultLine = res.stdout.includes("already installed")
      ? `Auto-capture hooks ${DIM}already installed${RST}`
      : `Auto-capture hooks installed`;
    stepDone(out, hookResultLine);
  } else {
    stepSkipped(out, `SessionEnd hook ${DIM}skipped${RST}`);
  }
  out.write(BAR + "\n");

  // Step 3: install the guides.
  let guidesAction: InstallDecision = "install";
  if (options.skipGuides === true) {
    guidesAction = "skip";
  } else if (interactive) {
    guidesAction = await confirm(
      out,
      "Install the codealmanac usage guides into ~/.claude/ and import them from CLAUDE.md?",
      true,
    );
  }

  let guidesSummary: string;
  if (guidesAction === "install") {
    try {
      const summary = await installGuides({
        claudeDir: options.claudeDir ?? path.join(homedir(), ".claude"),
        guidesDir: options.guidesDir ?? resolveGuidesDir(),
      });
      guidesSummary = summary.anyChanges
        ? `Guides installed (${summary.filesWritten.join(", ")})`
        : `Guides ${DIM}already installed${RST}`;
      stepDone(out, guidesSummary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        stdout: "",
        stderr: `almanac: guide install failed: ${msg}\n`,
        exitCode: 1,
      };
    }
  } else {
    stepSkipped(out, `Guides ${DIM}skipped${RST}`);
  }
  out.write(BAR + "\n");

  stepDone(out, `${BLUE}Setup complete${RST}`);
  out.write("\n");

  // Detect whether the current working directory is inside a repo that
  // already has a wiki with pages. This fixes Bug #6 from
  // codealmanac-known-bugs.md: Engineer B clones a repo that already has
  // `.almanac/pages/` (committed by Engineer A) and gets told to run
  // `almanac bootstrap`, which is wrong — the wiki already exists.
  const existingPageCount = countExistingPages(process.cwd());
  printNextSteps(out, existingPageCount);

  return { stdout: "", stderr: "", exitCode: 0 };
}

// ─── Auth reporting ──────────────────────────────────────────────────

async function safeCheckAuth(
  spawnCli?: SpawnCliFn,
): Promise<ClaudeAuthStatus> {
  try {
    return await checkClaudeAuth(spawnCli);
  } catch {
    return { loggedIn: false };
  }
}

type AgentChoice =
  | { ok: true; provider: AgentProviderId; model: string | null }
  | { ok: false; error: string };

async function chooseDefaultAgent(args: {
  out: NodeJS.WritableStream;
  interactive: boolean;
  requested?: string;
  spawnCli?: SpawnCliFn;
}): Promise<AgentChoice> {
  const config = await readConfig();
  let view: ProviderSetupView | null = null;
  let selected = args.requested ?? config.agent.default;
  if (args.interactive || args.requested !== undefined) {
    view = await buildProviderSetupView({ config, spawnCli: args.spawnCli });
  }
  if (args.interactive && args.requested === undefined && view !== null) {
    args.out.write("  Choose default agent:\n");
    view.choices.forEach((choice, index) => {
      const tag = choice.recommended ? " recommended" : "";
      const status = choice.ready ? "ready" : "not ready";
      const detail = choice.account ?? choice.fixCommand ?? choice.detail;
      args.out.write(
        `    ${index + 1}. ${choice.label.padEnd(6)} ${status.padEnd(9)}${tag}  ${detail}\n`,
      );
    });
    selected = await promptText(
      args.out,
      "Default agent",
      view.recommendedProvider,
    );
    const number = Number.parseInt(selected, 10);
    if (
      Number.isInteger(number) &&
      number >= 1 &&
      number <= view.choices.length
    ) {
      selected = view.choices[number - 1]?.id ?? selected;
    }
  }
  const parsed = parseAgentSelection(selected);
  if (parsed.provider === null || !isAgentProviderId(parsed.provider)) {
    return {
      ok: false,
      error:
        `unknown agent '${selected}'. Expected one of: claude, codex, cursor.`,
    };
  }
  const provider = parsed.provider;
  let selectedChoice = view?.choices.find((choice) => choice.id === provider);
  if (
    args.interactive &&
    selectedChoice !== undefined &&
    !selectedChoice.ready &&
    selectedChoice.fixCommand?.startsWith("run: ") === true
  ) {
    const command = selectedChoice.fixCommand.slice("run: ".length);
    const runLogin = await confirm(
      args.out,
      `${selectedChoice.label} is not ready. Run '${command}' now?`,
      true,
    );
    if (runLogin === "install") {
      const login = await runLoginCommand(command);
      if (login.ok) {
        view = await buildProviderSetupView({ config, spawnCli: args.spawnCli });
        selectedChoice = view.choices.find((choice) => choice.id === provider);
      } else {
        stepActive(args.out, `${selectedChoice.label} login failed: ${login.error}`);
      }
    }
  }
  const recommendedModel = getProviderDefaultModel(provider);
  const model =
    parsed.model ?? config.agent.models[provider] ?? recommendedModel;
  await writeConfig({
    ...config,
    agent: {
      ...config.agent,
      default: provider,
      models: {
        ...config.agent.models,
        [provider]: model,
      },
    },
  });
  if (!args.interactive || args.requested !== undefined) {
    const detail = selectedChoice?.ready === true
      ? "ready"
      : selectedChoice?.fixCommand ?? selectedChoice?.detail ?? "status unknown";
    stepDone(args.out, `Agent readiness: ${detail}`);
  }
  return { ok: true, provider, model };
}

async function runLoginCommand(command: string): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
    });
    child.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      resolve({ ok: false, error: `exited ${code ?? 1}` });
    });
  });
}

function reportAuth(
  out: NodeJS.WritableStream,
  auth: ClaudeAuthStatus,
): void {
  if (auth.loggedIn) {
    const who = auth.email ?? "Claude account";
    const plan =
      auth.subscriptionType !== undefined
        ? ` ${DIM}(${auth.subscriptionType})${RST}`
        : "";
    stepDone(out, `Claude auth: ${WHITE_BOLD}${who}${RST}${plan}`);
    return;
  }
  if (
    process.env.ANTHROPIC_API_KEY !== undefined &&
    process.env.ANTHROPIC_API_KEY.length > 0
  ) {
    stepDone(out, `Claude auth: ${WHITE_BOLD}ANTHROPIC_API_KEY${RST} set`);
    return;
  }
  // Not blocking — just report and show the two paths.
  stepActive(out, `Claude auth: ${DIM}not signed in${RST}`);
  for (const line of UNAUTHENTICATED_MESSAGE.split("\n")) {
    out.write(`  ${DIM}\u2502   ${line}${RST}\n`);
  }
}

// ─── Guide installation ──────────────────────────────────────────────

interface InstallGuidesOptions {
  claudeDir: string;
  guidesDir: string;
}

interface InstallGuidesResult {
  anyChanges: boolean;
  filesWritten: string[];
}

/**
 * Copy the two guide files into `~/.claude/` and append an `@import`
 * line to `~/.claude/CLAUDE.md`. Every step is idempotent:
 *
 *   - Guide files are compared by bytes before we write. If the content
 *     matches the bundled version, we skip (so `setup` doesn't cause a
 *     spurious mtime bump on every invocation).
 *   - The import line is appended only if `CLAUDE.md` doesn't already
 *     contain the exact `@~/.claude/codealmanac.md` token on a line by
 *     itself. We don't try to parse the file — any mention of the token
 *     on a non-comment line is treated as "already present".
 *
 * Returns a summary the caller uses to decide whether to say "installed"
 * or "already installed" in the TUI.
 */
async function installGuides(
  options: InstallGuidesOptions,
): Promise<InstallGuidesResult> {
  await mkdir(options.claudeDir, { recursive: true });

  const srcMini = path.join(options.guidesDir, "mini.md");
  const srcRef = path.join(options.guidesDir, "reference.md");
  if (!existsSync(srcMini)) {
    throw new Error(`missing bundled guide: ${srcMini}`);
  }
  if (!existsSync(srcRef)) {
    throw new Error(`missing bundled guide: ${srcRef}`);
  }

  const destMini = path.join(options.claudeDir, "codealmanac.md");
  const destRef = path.join(options.claudeDir, "codealmanac-reference.md");

  const miniChanged = await copyIfChanged(srcMini, destMini);
  const refChanged = await copyIfChanged(srcRef, destRef);

  const claudeMd = path.join(options.claudeDir, "CLAUDE.md");
  const importChanged = await ensureImport(claudeMd);

  const filesWritten: string[] = [];
  if (miniChanged) filesWritten.push("codealmanac.md");
  if (refChanged) filesWritten.push("codealmanac-reference.md");
  if (importChanged) filesWritten.push("CLAUDE.md");

  return { anyChanges: filesWritten.length > 0, filesWritten };
}

async function copyIfChanged(src: string, dest: string): Promise<boolean> {
  const srcBytes = await readFile(src);
  if (existsSync(dest)) {
    try {
      const destBytes = await readFile(dest);
      if (srcBytes.equals(destBytes)) return false;
    } catch {
      // Fall through to write.
    }
  }
  await copyFile(src, dest);
  return true;
}

/** The exact import line we manage. Changing this requires updating
 * uninstall too. */
export const IMPORT_LINE = "@~/.claude/codealmanac.md";

/**
 * Append the import line to `~/.claude/CLAUDE.md` if it isn't already
 * present. Creates the file if absent. Returns true when we wrote, false
 * when the line was already there.
 *
 * We match on `@~/.claude/codealmanac.md` appearing on any non-empty
 * line (trimmed). This catches both the bare line we write and any
 * user-edited variant (comments, trailing whitespace). We deliberately
 * do NOT try to repair a user who deleted the newline — that's their
 * file to shape.
 */
async function ensureImport(claudeMdPath: string): Promise<boolean> {
  let existing = "";
  if (existsSync(claudeMdPath)) {
    existing = await readFile(claudeMdPath, "utf8");
  }
  if (hasImportLine(existing)) return false;

  const sep =
    existing.length === 0 ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  const body = `${existing}${sep}${IMPORT_LINE}\n`;
  await writeFile(claudeMdPath, body, "utf8");
  return true;
}

export function hasImportLine(contents: string): boolean {
  // Match line-starts-with-token rather than exact-line equality so a
  // user who annotated the import line (`@~/.claude/codealmanac.md #
  // codealmanac`) doesn't cause us to re-append a duplicate below.
  // The trailing-character check rules out accidental matches on a
  // longer line like `@~/.claude/codealmanac.md-extra`.
  const lines = contents.split(/\r?\n/).map((l) => l.trim());
  return lines.some((line) => {
    if (line === IMPORT_LINE) return true;
    if (!line.startsWith(IMPORT_LINE)) return false;
    const next = line[IMPORT_LINE.length];
    return next === " " || next === "\t";
  });
}

// ─── Interactive prompt ──────────────────────────────────────────────

type InstallDecision = "install" | "skip";

/**
 * Minimal `[Y/n]` prompt. No raw mode, no cursor — just readline. The
 * MCP setup uses a fancy arrow-key TUI for multi-choice; we only have
 * binary decisions here, so a line-reader prompt is clearer and doesn't
 * fight with the step-indicator rendering above it.
 */
function confirm(
  out: NodeJS.WritableStream,
  question: string,
  defaultYes: boolean,
): Promise<InstallDecision> {
  return new Promise((resolve) => {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    out.write(`  ${BLUE}\u25c6${RST}  ${question} ${DIM}${hint}${RST} `);

    let buf = "";
    const onData = (chunk: Buffer): void => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      process.stdin.removeListener("data", onData);
      process.stdin.pause();

      const answer = buf.slice(0, nl).trim().toLowerCase();
      const accepted =
        answer.length === 0
          ? defaultYes
          : answer === "y" || answer === "yes";
      resolve(accepted ? "install" : "skip");
    };

    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

function promptText(
  out: NodeJS.WritableStream,
  question: string,
  defaultValue: string,
): Promise<string> {
  return new Promise((resolve) => {
    out.write(
      `  ${BLUE}\u25c6${RST}  ${question} ${DIM}[${defaultValue}]${RST} `,
    );

    let buf = "";
    const onData = (chunk: Buffer): void => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      process.stdin.removeListener("data", onData);
      process.stdin.pause();

      const answer = buf.slice(0, nl).trim().toLowerCase();
      resolve(answer.length === 0 ? defaultValue : answer);
    };

    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

// ─── Guides path resolution ──────────────────────────────────────────

/**
 * Locate `guides/` relative to the installed package. Mirrors
 * `resolvePromptsDir` from `src/agent/prompts.ts`.
 *
 * Two runtime layouts to handle:
 *
 *   1. **Bundled dist.** `dist/codealmanac.js` → walk one level up →
 *      `guides/`.
 *   2. **Source (tests / tsx).** `src/commands/setup.ts` → walk two
 *      levels up → `guides/`.
 *
 * We also try `createRequire` to resolve the package root from the
 * `codealmanac/package.json` manifest, as a belt-and-suspenders fallback
 * for unusual install layouts (monorepo hoisting, etc.). That path is
 * only exercised when the direct walk-up fails.
 */
export function resolveGuidesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "..", "guides"), // dist layout
    path.resolve(here, "..", "..", "guides"), // src layout
    path.resolve(here, "..", "..", "..", "guides"),
  ];
  for (const dir of candidates) {
    if (looksLikeGuidesDir(dir)) return dir;
  }
  // Fallback: resolve via the package.json of the currently-running
  // codealmanac. createRequire lets us ask Node's resolver rather than
  // guessing at directory layouts.
  try {
    const require = createRequire(import.meta.url);
    const pkgJson = require.resolve("codealmanac/package.json");
    const guides = path.join(path.dirname(pkgJson), "guides");
    if (looksLikeGuidesDir(guides)) return guides;
  } catch {
    // Ignore — we'll throw with the candidate list below.
  }
  throw new Error(
    "could not locate bundled guides/ directory. Tried:\n" +
      candidates.map((c) => `  - ${c}`).join("\n"),
  );
}

function looksLikeGuidesDir(dir: string): boolean {
  return existsSync(path.join(dir, "mini.md"));
}
