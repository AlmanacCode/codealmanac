import type { SpawnCliFn } from "../../../agent/types.js";
import type { InstructionTargetId } from "../../../agent/install-targets.js";
export {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  hasCodexInstructions,
} from "../../../agent/instructions/codex.js";
import { chooseDefaultAgent } from "./agent-choice.js";
import { runAutoCommitSetupStep } from "./auto-commit-step.js";
import {
  runAutoUpdateSetupStep,
  skipAutoUpdateSetupStep,
} from "./auto-update-step.js";
import { runAutomationSetupStep } from "./automation-step.js";
export { IMPORT_LINE, hasImportLine } from "./guides.js";
import { runGlobalInstallStep } from "./global-install-step.js";
import { runGuidesSetupStep } from "./guides-step.js";
import {
  countExistingPages,
  printNextSteps,
} from "./next-steps.js";
import {
  BAR,
  BLUE,
  RST,
  WHITE_BOLD,
  isSetupInterrupted,
  printBadge,
  printBanner,
  stepDone,
} from "./output.js";
import { buildSetupPlan } from "./setup-plan.js";

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
 * Setup configures:
 *
 *   1. Global agent instructions for the selected tools.
 *   2. A durable global install when running from an ephemeral `npx` path.
 *   3. Scheduled Almanac CLI self-update by default.
 *   4. Optional self-managed local sync/Garden automation, only when the
 *      user opts into handling automations themselves or passes explicit
 *      automation flags.
 *   5. Optional auto-commit for local lifecycle runs, only behind the
 *      self-managed automation branch or explicit `--auto-commit`.
 *
 * Everything is idempotent — running setup again is safe. `--yes` or a
 * non-TTY stdin skips prompts and uses setup-plan defaults.
 */

export interface SetupOptions {
  /** Install everything without prompting. */
  yes?: boolean;
  /** Don't install the scheduled sync job. */
  skipAutomation?: boolean;
  /** Configure the scheduled sync interval. Defaults to 5h. */
  automationEvery?: string;
  /** Configure the scheduled sync quiet window. Defaults to 45m. */
  automationQuiet?: string;
  /** Configure the scheduled Garden interval. Defaults to 4h. */
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
  /** Override `~/.cursor/` dir for Cursor instruction install. */
  cursorDir?: string;
  /** Override `~/.codeium/windsurf/` dir for Windsurf instruction install. */
  windsurfDir?: string;
  /** Override `~/.config/opencode/` dir for OpenCode instruction install. */
  opencodeDir?: string;
  /** Override selected global instruction targets (tests/internal callers). */
  instructionTargets?: InstructionTargetId[];
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
    options.autoCommit === undefined
  ) {
    out.write(
      "almanac: nothing to install — use --help to see what setup does\n",
    );
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  printBanner(out);
  printBadge(out);

  let nextStepsMode: "hosted" | "self-managed" = "hosted";
  try {
    const plan = await buildSetupPlan({ out, interactive, options });
    nextStepsMode = plan.selfManagedAutomation ? "self-managed" : "hosted";

    const guides = await runGuidesSetupStep({
      out,
      options,
      targets: plan.instructionTargets,
    });
    if (!guides.ok) {
      return { stdout: "", stderr: guides.stderr, exitCode: guides.exitCode };
    }

    const globalInstall = await runGlobalInstallStep({ out, interactive, options });

    if (plan.cliAutoUpdate) {
      if (globalInstall.ephemeral && !globalInstall.durableGlobalInstall) {
        skipAutoUpdateSetupStep(out);
      } else {
        const update = await runAutoUpdateSetupStep({
          out,
          options: {
            autoUpdateEvery: options.autoUpdateEvery,
            updatePlistPath: options.updatePlistPath,
            updateProgramArguments: globalInstall.ephemeral
              ? globalUpdateProgramArguments()
              : undefined,
            automationExec: options.automationExec,
          },
        });
        if (!update.ok) {
          return { stdout: "", stderr: update.stderr, exitCode: update.exitCode };
        }
      }
    }

    if (plan.selfManagedAutomation) {
      const agentChoice = await chooseDefaultAgent({
        out,
        interactive,
        requested: options.agent,
        requestedModel: options.model,
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
        `Agent: ${WHITE_BOLD}${agentChoice.provider}${RST}` +
          ` (${agentChoice.model ?? "provider default"})`,
      );
      out.write(BAR + "\n");

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
    }

    if (plan.selfManagedAutomation || plan.autoCommit || options.autoCommit === false) {
      await runAutoCommitSetupStep({
        out,
        interactive,
        options: { autoCommit: plan.autoCommit },
      });
    } else if (plan.autoCommit === false) {
      await runAutoCommitSetupStep({
        out,
        interactive: false,
        options: { autoCommit: false },
      });
    }
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

  stepDone(out, `${BLUE}Setup complete${RST}`);
  out.write("\n");

  // Detect whether the current working directory is inside a repo that
  // already has a wiki with pages. This fixes Bug #6 from
  // codealmanac-known-bugs.md: Engineer B clones a repo that already has
  // `.almanac/pages/` (committed by Engineer A) and gets told to run
  // `almanac init`, which is wrong — the wiki already exists.
  const existingPageCount = countExistingPages(process.cwd());
  printNextSteps(out, existingPageCount, nextStepsMode);

  return { stdout: "", stderr: "", exitCode: 0 };
}

function globalUpdateProgramArguments(): string[] {
  return ["/usr/bin/env", "almanac", "update"];
}
