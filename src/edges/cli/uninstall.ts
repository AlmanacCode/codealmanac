import path from "node:path";

import {
  removeSetupImportLine,
  removeSetupManagedBlock,
  uninstallSetup,
} from "../../services/setup/index.js";
import {
  renderAutomationKept,
  renderConfirmationPrompt,
  renderGuidesKept,
  renderUninstallComplete,
  renderUninstallResult,
  renderUninstallStart,
  type UninstallRenderOptions,
} from "./uninstall-render.js";

type AutomationExecFn = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

/**
 * `almanac uninstall` — the reverse of `setup`.
 *
 * Idempotent and order-insensitive: each step is a no-op if that
 * artifact was never installed. We remove exactly the things setup added,
 * nothing else:
 *
 *   1. The `@~/.claude/almanac.md` line from `~/.claude/CLAUDE.md`.
 *      Other content stays untouched. If removing our line leaves the
 *      file empty, we delete the file so our fingerprint doesn't persist
 *      as zero bytes.
 *   2. The guide files `~/.claude/almanac.md` and
 *      `~/.claude/almanac-reference.md`. Legacy `codealmanac*.md` guide
 *      files are removed too.
 *   3. Managed global instruction entries for Codex, Cursor, Windsurf,
 *      and OpenCode.
 *   4. The scheduled sync/Garden launchd jobs and legacy hook files.
 *
 * Flags:
 *   --yes           skip confirmations; remove everything
 *   --keep-automation leave the scheduler alone
 *   --keep-guides   leave the guides + CLAUDE.md import alone
 *
 * Non-interactive (no TTY) → behaves as if `--yes` was passed. Same
 * contract as `setup`.
 */

export interface UninstallOptions {
  yes?: boolean;
  keepAutomation?: boolean;
  keepGuides?: boolean;
  homeDir: string;

  // ─── Injection points ────────────────────────────────────────────
  automationPlistPath?: string;
  gardenPlistPath?: string;
  automationExec?: AutomationExecFn;
  claudeDir?: string;
  codexDir?: string;
  cursorDir?: string;
  windsurfDir?: string;
  opencodeDir?: string;
  isTTY: boolean;
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  color?: boolean;
}

export interface UninstallResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runUninstall(
  options: UninstallOptions,
): Promise<UninstallResult> {
  const out = options.stdout;
  const interactive = options.isTTY && options.yes !== true;
  const claudeDir = options.claudeDir ?? path.join(options.homeDir, ".claude");
  const codexDir = options.codexDir ?? path.join(options.homeDir, ".codex");
  const cursorDir = options.cursorDir ?? path.join(options.homeDir, ".cursor");
  const windsurfDir = options.windsurfDir ?? path.join(options.homeDir, ".codeium", "windsurf");
  const opencodeDir = options.opencodeDir ?? path.join(options.homeDir, ".config", "opencode");
  const renderOptions = { color: options.color };

  out.write(renderUninstallStart());

  // Scheduler removal.
  let removeAutomation = true;
  if (options.keepAutomation === true) {
    removeAutomation = false;
  } else if (interactive) {
    removeAutomation = await confirm(
      options.stdin,
      out,
      "Remove scheduled sync and Garden automation?",
      true,
      renderOptions,
    );
  }
  if (!removeAutomation) {
    out.write(renderAutomationKept(renderOptions));
  }

  // Guide + import removal.
  let removeGuides = true;
  if (options.keepGuides === true) {
    removeGuides = false;
  } else if (interactive) {
    removeGuides = await confirm(
      options.stdin,
      out,
      "Remove agent instructions?",
      true,
      renderOptions,
    );
  }
  if (!removeGuides) {
    out.write(renderGuidesKept(renderOptions));
  }

  const result = await uninstallSetup({
    removeAutomation,
    removeGuides,
    homeDir: options.homeDir,
    automationPlistPath: options.automationPlistPath,
    gardenPlistPath: options.gardenPlistPath,
    automationExec: options.automationExec,
    claudeDir,
    codexDir,
    cursorDir,
    windsurfDir,
    opencodeDir,
  });

  out.write(renderUninstallResult(result, renderOptions));
  out.write(renderUninstallComplete(renderOptions));

  return { stdout: "", stderr: "", exitCode: 0 };
}

/**
 * Remove the import line from a CLAUDE.md body. Match is line-anchored
 * (trimmed equality) so we don't munge a line that happens to include
 * the token as part of a longer string. Returns the unchanged body (and
 * `changed: false`) if the line isn't present — this is what makes the
 * command safe to run repeatedly.
 */
export function removeImportLine(contents: string): {
  changed: boolean;
  body: string;
} {
  return removeSetupImportLine(contents);
}

export function removeManagedBlock(
  contents: string,
  start: string,
  end: string,
): { changed: boolean; body: string } {
  return removeSetupManagedBlock(contents, start, end);
}

function confirm(
  input: NodeJS.ReadableStream,
  out: NodeJS.WritableStream,
  question: string,
  defaultYes: boolean,
  renderOptions: UninstallRenderOptions,
): Promise<boolean> {
  return new Promise((resolve) => {
    out.write(renderConfirmationPrompt(question, defaultYes, renderOptions));

    let buf = "";
    const onData = (chunk: Buffer): void => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      input.removeListener("data", onData);
      input.pause();

      const answer = buf.slice(0, nl).trim().toLowerCase();
      const accepted =
        answer.length === 0
          ? defaultYes
          : answer === "y" || answer === "yes";
      resolve(accepted);
    };

    input.resume();
    input.on("data", onData);
  });
}
