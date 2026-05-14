import {
  type SpawnCliFn,
} from "../agent/readiness/providers/claude/index.js";
export {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  hasCodexInstructions,
} from "../agent/instructions/codex.js";
import { chooseDefaultAgent, type AgentChoice } from "./setup/agent-choice.js";
import { runAutoCommitSetupStep } from "./setup/auto-commit-step.js";
import { runAutomationSetupStep } from "./setup/automation-step.js";
export { IMPORT_LINE, hasImportLine } from "./setup/guides.js";
import { runGlobalInstallStep } from "./setup/global-install-step.js";
import { runGuidesSetupStep } from "./setup/guides-step.js";
import {
  countExistingPages,
  printNextSteps,
} from "./setup/next-steps.js";
import {
  BAR,
  BLUE,
  RST,
  WHITE_BOLD,
  isSetupInterrupted,
  printBadge,
  printBanner,
  stepDone,
} from "./setup/output.js";

export type AutomationExecFn = (
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
  /** Install scheduled Almanac self-update. */
  autoUpdate?: boolean;
  /** Configure the scheduled self-update interval. Defaults to 1d. */
  autoUpdateEvery?: string;
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
  /** Override the update launchd plist path. */
  updatePlistPath?: string;
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

  const globalInstall = await runGlobalInstallStep({ out, interactive, options });
  const automation = await runAutomationSetupStep({
    out,
    interactive,
    options,
    ephemeral: globalInstall.ephemeral,
    durableGlobalInstall: globalInstall.durableGlobalInstall,
  });
  if (!automation.ok) {
    return { stdout: "", stderr: automation.stderr, exitCode: automation.exitCode };
  }
  const guides = await runGuidesSetupStep({ out, interactive, options });
  if (!guides.ok) {
    return { stdout: "", stderr: guides.stderr, exitCode: guides.exitCode };
  }
  await runAutoCommitSetupStep({ out, interactive, options });

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
