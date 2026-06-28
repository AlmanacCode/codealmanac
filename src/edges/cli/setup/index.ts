export {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  hasCodexInstructions,
} from "../../../services/setup/index.js";
import { readSetupWikiState } from "../../../services/wiki/setup-state.js";
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
import { printNextSteps } from "./next-steps.js";
import { isSetupInterrupted } from "./input.js";
import {
  blue,
  makeSetupTheme,
  printBadge,
  printBanner,
  stepDone,
  whiteBold,
  writeSetupDivider,
} from "./output.js";
import { buildSetupPlan } from "./setup-plan.js";
import type {
  SetupOptions,
  SetupResult,
} from "./types.js";

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
export type {
  AutomationExecFn,
  SetupOptions,
  SetupResult,
} from "./types.js";

// Entry point.

export async function runSetup(
  options: SetupOptions,
): Promise<SetupResult> {
  const cwd = options.cwd;
  const out = options.stdout;
  const theme = makeSetupTheme(options.color !== false);
  const interactive = options.isTTY && options.yes !== true;

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

  printBanner(out, theme);
  printBadge(out, theme);

  let nextStepsMode: "hosted" | "self-managed" = "hosted";
  try {
    const plan = await buildSetupPlan({ out, theme, interactive, options });
    nextStepsMode = plan.selfManagedAutomation ? "self-managed" : "hosted";

    const guides = await runGuidesSetupStep({
      out,
      theme,
      options,
      targets: plan.instructionTargets,
    });
    if (!guides.ok) {
      return { stdout: "", stderr: guides.stderr, exitCode: guides.exitCode };
    }

    const globalInstall = await runGlobalInstallStep({
      input: options.stdin,
      out,
      theme,
      interactive,
      options,
    });

    if (plan.cliAutoUpdate) {
      if (globalInstall.ephemeral && !globalInstall.durableGlobalInstall) {
        skipAutoUpdateSetupStep(out, theme);
      } else {
        const update = await runAutoUpdateSetupStep({
          out,
          theme,
          options: {
            cwd,
            homeDir: options.homeDir,
            pathEnvironment: options.pathEnvironment,
            cliProgramArguments: options.cliProgramArguments,
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
        input: options.stdin,
        out,
        theme,
        interactive,
        requested: options.agent,
        requestedModel: options.model,
        spawnCli: options.spawnCli,
        environment: options.environment,
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
        theme,
        `Agent: ${whiteBold(theme, agentChoice.provider)}` +
          ` (${agentChoice.model ?? "provider default"})`,
      );
      writeSetupDivider(out, theme);

      const automation = await runAutomationSetupStep({
        out,
        theme,
        interactive,
        options: { ...options, cwd },
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
        theme,
        interactive,
        options: { autoCommit: plan.autoCommit },
      });
    } else if (plan.autoCommit === false) {
      await runAutoCommitSetupStep({
        out,
        theme,
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

  stepDone(out, theme, blue(theme, "Setup complete"));
  out.write("\n");

  // Detect whether the current working directory is inside a repo that
  // already has a wiki with pages. This fixes Bug #6 from
  // codealmanac-known-bugs.md: Engineer B clones a repo that already has
  // `.almanac/pages/` (committed by Engineer A) and gets told to run
  // `almanac init`, which is wrong — the wiki already exists.
  const wikiState = readSetupWikiState(cwd);
  printNextSteps(out, theme, wikiState.existingPageCount, nextStepsMode);

  return { stdout: "", stderr: "", exitCode: 0 };
}

function globalUpdateProgramArguments(): string[] {
  return ["/usr/bin/env", "almanac", "update"];
}
