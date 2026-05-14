import { homedir } from "node:os";
import path from "node:path";

import {
  type SpawnCliFn,
} from "../agent/readiness/providers/claude/index.js";
import {
  installAgentInstructions,
} from "../agent/install-targets.js";
export {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  hasCodexInstructions,
} from "../agent/readiness/providers/codex-instructions.js";
import {
  writeConfig,
} from "../config/index.js";
import { cleanupLegacyHooks, runAutomationInstall } from "./automation.js";
import { chooseDefaultAgent, type AgentChoice } from "./setup/agent-choice.js";
import {
  detectCurrentInstallPath,
  detectEphemeral,
  spawnGlobalInstall,
} from "./setup/install-path.js";
export { IMPORT_LINE, hasImportLine } from "./setup/guides.js";
import { resolveGuidesDir } from "./setup/guides.js";
import {
  countExistingPages,
  printNextSteps,
} from "./setup/next-steps.js";
import {
  BAR,
  BLUE,
  DIM,
  type InstallDecision,
  RST,
  WHITE_BOLD,
  confirm,
  isSetupInterrupted,
  printBadge,
  printBanner,
  stepActive,
  stepDone,
  stepSkipped,
} from "./setup/output.js";

type AutomationExecFn = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

/**
 * `almanac setup` — the MCP-style branded TUI that runs when a user
 * invokes bare `almanac`, explicit `almanac setup`, or the compatibility
 * `codealmanac` npx bootstrap alias.
 *
 * Model: `mcp-ts/src/setup.ts` from openalmanac. Same ASCII banner + badge
 * + step-indicator style, same interactive + `--yes` + non-interactive
 * modes.
 *
 * Setup installs:
 *
 *   1. macOS launchd jobs that periodically run `almanac capture sweep`
 *      and `almanac garden`.
 *   2. The short "how to use Almanac" guide at
 *      `~/.claude/almanac.md`, sourced from `guides/mini.md` in the
 *      package.
 *   3. The full reference at `~/.claude/almanac-reference.md`,
 *      sourced from `guides/reference.md`.
 *   4. An `@~/.claude/almanac.md` import line in `~/.claude/CLAUDE.md`
 *      so Claude Code picks up the short guide globally.
 *   5. An inline managed Almanac section in `~/.codex/AGENTS.md`
 *      (or `AGENTS.override.md` when that is the active non-empty file).
 *      Codex does not expand Claude-style `@file` imports in AGENTS files,
 *      so the instructions must live inline to be model-visible.
 *
 * Everything is idempotent — running setup again is safe.
 * `--skip-automation` and `--skip-guides` opt out of the individual
 * installs. `--yes` or a non-TTY stdin skips all prompts and installs
 * everything.
 */

export interface SetupOptions {
  /** Install everything without prompting. */
  yes?: boolean;
  /** Don't install the scheduled auto-capture job. */
  skipAutomation?: boolean;
  /** Configure the scheduled auto-capture interval. Defaults to 5h. */
  automationEvery?: string;
  /** Configure the scheduled auto-capture quiet window. Defaults to 45m. */
  automationQuiet?: string;
  /** Configure the scheduled Garden interval. Defaults to 2d. */
  gardenEvery?: string;
  /** Don't install the scheduled Garden job. */
  gardenOff?: boolean;
  /** Don't install the CLAUDE.md guides. */
  skipGuides?: boolean;
  /** Allow lifecycle runs to commit wiki source changes automatically. */
  autoCommit?: boolean;
  /** Set the default agent provider during setup. */
  agent?: string;
  /** Set the default model for the selected provider during setup. */
  model?: string;

  // ─── Injection points (tests only) ────────────────────────────────
  /** Override the subprocess spawner for `claude auth status`. */
  spawnCli?: SpawnCliFn;
  /** Override the launchd plist path. */
  automationPlistPath?: string;
  /** Override the Garden launchd plist path. */
  gardenPlistPath?: string;
  /** Override launchctl execution. */
  automationExec?: AutomationExecFn;
  /** Override `~/.claude/` dir for guide install. */
  claudeDir?: string;
  /** Override `~/.codex/` dir for Codex instruction install. */
  codexDir?: string;
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
  if (
    options.skipAutomation === true &&
    options.skipGuides === true &&
    options.autoCommit !== true
  ) {
    out.write(
      "almanac: nothing to install — use --help to see what setup does\n",
    );
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  printBanner(out);
  printBadge(out);

  let agentChoice: AgentChoice;
  try {
    agentChoice = await chooseDefaultAgent({
      out,
      interactive,
      requested: options.agent,
      requestedModel: options.model,
      spawnCli: options.spawnCli,
    });
  } catch (err: unknown) {
    if (isSetupInterrupted(err)) {
      return {
        stdout: "",
        stderr: "almanac: setup cancelled\n",
        exitCode: 130,
      };
    }
    throw err;
  }
  if (!agentChoice.ok) {
    return {
      stdout: "",
      stderr: `almanac: ${agentChoice.error}\n`,
      exitCode: 1,
    };
  }
  stepDone(
    out,
    `Agent: ${WHITE_BOLD}${agentChoice.provider}${RST}` +
      ` (${agentChoice.model ?? "provider default"})`,
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
  let durableGlobalInstall = false;
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
      stepActive(out, "Installing Almanac package globally…");
      try {
        await (options.spawnGlobalInstall ?? spawnGlobalInstall)();
        durableGlobalInstall = true;
        stepDone(out, "Almanac installed globally (almanac now on PATH)");
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

  // Step 2: install the scheduler (default yes).
  let automationAction: InstallDecision = "install";
  if (options.skipAutomation === true) {
    automationAction = "skip";
  } else if (interactive) {
    automationAction = await confirm(
      out,
      "Keep your codebase wiki up to date automatically?",
      true,
    );
  }

  if (automationAction === "install") {
    if (ephem && !durableGlobalInstall) {
      stepSkipped(
        out,
        `Auto-capture automation ${DIM}skipped — requires a durable Almanac install${RST}`,
      );
    } else {
      await cleanupLegacyHooks();
      const res = await runAutomationInstall({
        every: options.automationEvery,
        quiet: options.automationQuiet,
        gardenEvery: options.gardenEvery,
        gardenOff: options.gardenOff,
        cwd: process.cwd(),
        programArguments: ephem
          ? globalAlmanacProgramArguments(options.automationQuiet)
          : undefined,
        gardenProgramArguments: ephem
          ? globalGardenProgramArguments()
          : undefined,
        plistPath: options.automationPlistPath,
        gardenPlistPath: options.gardenPlistPath,
        exec: options.automationExec,
      });
      if (res.exitCode !== 0) {
        stepActive(out, `Auto-capture automation: ${res.stderr.trim()}`);
        return {
          stdout: "",
          stderr: res.stderr,
          exitCode: res.exitCode,
        };
      }
      stepDone(out, `Auto-capture automation installed`);
    }
  } else {
    stepSkipped(out, `Auto-capture automation ${DIM}skipped${RST}`);
  }
  out.write(BAR + "\n");

  // Step 3: install the guides.
  let guidesAction: InstallDecision = "install";
  if (options.skipGuides === true) {
    guidesAction = "skip";
  } else if (interactive) {
    guidesAction = await confirm(
      out,
      "Add Almanac instructions for your AI agents?",
      true,
    );
  }

  let guidesSummary: string;
  if (guidesAction === "install") {
    try {
      const summary = await installAgentInstructions({
        claudeDir: options.claudeDir ?? path.join(homedir(), ".claude"),
        codexDir: options.codexDir ?? path.join(homedir(), ".codex"),
        guidesDir: options.guidesDir ?? resolveGuidesDir(),
      });
      guidesSummary = summary.anyChanges
        ? `Agent instructions added`
        : `Agent instructions ${DIM}already added${RST}`;
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
    stepSkipped(out, `Agent instructions ${DIM}skipped${RST}`);
  }
  out.write(BAR + "\n");

  let autoCommitAction: InstallDecision = "skip";
  if (options.autoCommit === true) {
    autoCommitAction = "install";
  } else if (interactive) {
    autoCommitAction = await confirm(
      out,
      "Commit Almanac wiki updates automatically?",
      false,
    );
  }

  if (autoCommitAction === "install") {
    await writeConfig({ auto_commit: true });
    stepDone(out, "Auto-commit enabled");
  } else {
    if (interactive) await writeConfig({ auto_commit: false });
    stepSkipped(out, `Auto-commit ${DIM}disabled${RST}`);
  }
  out.write(BAR + "\n");

  stepDone(out, `${BLUE}Setup complete${RST}`);
  out.write("\n");

  // Detect whether the current working directory is inside a repo that
  // already has a wiki with pages. This fixes Bug #6 from
  // codealmanac-known-bugs.md: Engineer B clones a repo that already has
  // `.almanac/pages/` (committed by Engineer A) and gets told to run
  // `almanac init`, which is wrong — the wiki already exists.
  const existingPageCount = countExistingPages(process.cwd());
  printNextSteps(out, existingPageCount);

  return { stdout: "", stderr: "", exitCode: 0 };
}

function globalAlmanacProgramArguments(quiet = "45m"): string[] {
  return ["/usr/bin/env", "almanac", "capture", "sweep", "--quiet", quiet];
}

function globalGardenProgramArguments(): string[] {
  return ["/usr/bin/env", "almanac", "garden"];
}
