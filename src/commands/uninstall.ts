import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { cleanupLegacyHooks, runAutomationUninstall } from "./automation.js";
import {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  IMPORT_LINE,
} from "./setup.js";

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
 *   4. The scheduled capture/Garden platform scheduler jobs and legacy hook files.
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
  gardenPlistPath?: string;
  platform?: NodeJS.Platform;
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
const LEGACY_IMPORT_LINE = "@~/.claude/codealmanac.md";
const LEGACY_CODEX_INSTRUCTIONS_START = "<!-- codealmanac:start -->";
const LEGACY_CODEX_INSTRUCTIONS_END = "<!-- codealmanac:end -->";

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
      "Remove scheduled capture and Garden automation?",
      true,
    );
  }
  if (removeAutomation) {
    await cleanupLegacyHooks();
    const res = await runAutomationUninstall({
      plistPath: options.automationPlistPath,
      gardenPlistPath: options.gardenPlistPath,
      platform: options.platform,
      exec: options.automationExec,
    });
    if (res.exitCode !== 0) {
      return { stdout: "", stderr: res.stderr, exitCode: res.exitCode };
    }
    out.write(`  ${BLUE}\u25c7${RST}  ${res.stdout.trim()}\n`);
  } else {
    out.write(`  ${DIM}\u25cb  Scheduled automation kept${RST}\n`);
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
    const summary = await removeGuideFiles(claudeDir, codexDir);
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

interface RemoveGuidesResult {
  anyChanges: boolean;
  filesTouched: string[];
}

async function removeGuideFiles(
  claudeDir: string,
  codexDir: string,
): Promise<RemoveGuidesResult> {
  const touched: string[] = [];

  const guideFiles = [
    "almanac.md",
    "almanac-reference.md",
    "codealmanac.md",
    "codealmanac-reference.md",
  ];
  const claudeMd = path.join(claudeDir, "CLAUDE.md");

  for (const file of guideFiles) {
    const fullPath = path.join(claudeDir, file);
    if (existsSync(fullPath)) {
      await rm(fullPath, { force: true });
      touched.push(file);
    }
  }

  if (existsSync(claudeMd)) {
    const existing = await readFile(claudeMd, "utf8");
    const { changed, body } = removeImportLine(existing);
    if (changed) {
      // If the file is now content-free, delete it outright so our
      // installation leaves no trace. A user who was using CLAUDE.md
      // before we touched it still has their content; only the case
      // where CLAUDE.md contained nothing but our line gets cleaned up.
      if (body.trim().length === 0) {
        await rm(claudeMd, { force: true });
        touched.push("CLAUDE.md (deleted)");
      } else {
        await writeFile(claudeMd, body, "utf8");
        touched.push("CLAUDE.md");
      }
    }
  }

  for (const agentsFile of [
    path.join(codexDir, "AGENTS.md"),
    path.join(codexDir, "AGENTS.override.md"),
  ]) {
    if (!existsSync(agentsFile)) continue;
    const existing = await readFile(agentsFile, "utf8");
    const first = removeManagedBlock(
      existing,
      CODEX_INSTRUCTIONS_START,
      CODEX_INSTRUCTIONS_END,
    );
    const second = removeManagedBlock(
      first.body,
      LEGACY_CODEX_INSTRUCTIONS_START,
      LEGACY_CODEX_INSTRUCTIONS_END,
    );
    if (!first.changed && !second.changed) continue;
    if (second.body.trim().length === 0) {
      await rm(agentsFile, { force: true });
      touched.push(`${path.basename(agentsFile)} (deleted)`);
    } else {
      await writeFile(agentsFile, second.body, "utf8");
      touched.push(path.basename(agentsFile));
    }
  }

  return { anyChanges: touched.length > 0, filesTouched: touched };
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
  const eol = contents.includes("\r\n") ? "\r\n" : "\n";
  const lines = contents.split(/\r?\n/);

  const indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (isManagedImportLine(line)) indices.push(i);
  }
  if (indices.length === 0) return { changed: false, body: contents };

  // Remove the line(s). Iterate from the end so earlier indices stay
  // valid as we splice.
  for (let i = indices.length - 1; i >= 0; i--) {
    lines.splice(indices[i]!, 1);
  }

  let body = lines.join(eol);

  // Cleanup: collapse any double-blank that our removal created at the
  // spot the line used to live. A best-effort tidy — we don't try to
  // normalize the whole file.
  body = body.replace(/\n\n\n+/g, "\n\n");

  return { changed: true, body };
}

function isManagedImportLine(line: string): boolean {
  return (
    isImportLineFor(line, IMPORT_LINE) ||
    isImportLineFor(line, LEGACY_IMPORT_LINE)
  );
}

function isImportLineFor(line: string, importLine: string): boolean {
  if (line === importLine) return true;
  const rest = line.slice(importLine.length);
  return line.startsWith(importLine) && /^[\t ]/.test(rest);
}

export function removeManagedBlock(
  contents: string,
  start: string,
  end: string,
): { changed: boolean; body: string } {
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return { changed: false, body: contents };
  }

  const afterEnd = endIndex + end.length;
  let body = `${contents.slice(0, startIndex)}${contents.slice(afterEnd)}`;
  body = body.replace(/\n\n\n+/g, "\n\n");
  body = body.replace(/^\n+/, "");
  return { changed: true, body };
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
