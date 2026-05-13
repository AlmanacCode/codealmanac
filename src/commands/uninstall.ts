import { homedir } from "node:os";
import path from "node:path";

import {
  removeAgentInstructions,
  removeClaudeImportLine,
  removeManagedBlock as removeManagedInstructionBlock,
} from "../agent/install-targets.js";
import { cleanupLegacyHooks, runAutomationUninstall } from "./automation.js";

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
 *   3. The managed Almanac block from Codex's global AGENTS file.
 *   4. The scheduled auto-capture launchd job and legacy hook files.
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

  // ─── Injection points ────────────────────────────────────────────
  automationPlistPath?: string;
  automationExec?: AutomationExecFn;
  claudeDir?: string;
  codexDir?: string;
  isTTY?: boolean;
  stdout?: NodeJS.WritableStream;
}

export interface UninstallResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const BLUE = "\x1b[38;5;75m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

export async function runUninstall(
  options: UninstallOptions = {},
): Promise<UninstallResult> {
  const out = options.stdout ?? process.stdout;
  const isTTY =
    options.isTTY ?? (process.stdin.isTTY === true);
  const interactive = isTTY && options.yes !== true;
  const claudeDir = options.claudeDir ?? path.join(homedir(), ".claude");
  const codexDir = options.codexDir ?? path.join(homedir(), ".codex");

  out.write("\n");

  // Scheduler removal.
  let removeAutomation = true;
  if (options.keepAutomation === true) {
    removeAutomation = false;
  } else if (interactive) {
    removeAutomation = await confirm(
      out,
      "Remove the auto-capture automation?",
      true,
    );
  }
  if (removeAutomation) {
    await cleanupLegacyHooks();
    const res = await runAutomationUninstall({
      plistPath: options.automationPlistPath,
      exec: options.automationExec,
    });
    if (res.exitCode !== 0) {
      return { stdout: "", stderr: res.stderr, exitCode: res.exitCode };
    }
    out.write(`  ${BLUE}\u25c7${RST}  ${res.stdout.trim()}\n`);
  } else {
    out.write(`  ${DIM}\u25cb  Auto-capture automation kept${RST}\n`);
  }

  // Guide + import removal.
  let removeGuides = true;
  if (options.keepGuides === true) {
    removeGuides = false;
  } else if (interactive) {
    removeGuides = await confirm(
      out,
      "Remove agent instructions?",
      true,
    );
  }
  if (removeGuides) {
    const summary = await removeAgentInstructions({ claudeDir, codexDir });
    if (summary.anyChanges) {
      out.write(
        `  ${BLUE}\u25c7${RST}  Guides removed (${summary.filesTouched.join(", ")})\n`,
      );
    } else {
      out.write(`  ${DIM}\u25cb  Guides not installed${RST}\n`);
    }
  } else {
    out.write(`  ${DIM}\u25cb  Guides kept${RST}\n`);
  }

  out.write(`\n  ${BLUE}\u25c7${RST}  ${BLUE}Uninstall complete${RST}\n\n`);

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
  return removeClaudeImportLine(contents);
}

export function removeManagedBlock(
  contents: string,
  start: string,
  end: string,
): { changed: boolean; body: string } {
  return removeManagedInstructionBlock(contents, start, end);
}

function confirm(
  out: NodeJS.WritableStream,
  question: string,
  defaultYes: boolean,
): Promise<boolean> {
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
      resolve(accepted);
    };

    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}
