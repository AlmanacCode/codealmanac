import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { runHookUninstall } from "./hook.js";
import { IMPORT_LINE } from "./setup.js";

/**
 * `almanac uninstall` — the reverse of `setup`.
 *
 * Idempotent and order-insensitive: each step is a no-op if that
 * artifact was never installed. We remove exactly the things setup added,
 * nothing else:
 *
 *   1. The `@~/.claude/codealmanac.md` line from `~/.claude/CLAUDE.md`.
 *      Other content stays untouched. If removing our line leaves the
 *      file empty, we delete the file so our fingerprint doesn't persist
 *      as zero bytes.
 *   2. The guide files `~/.claude/codealmanac.md` and
 *      `~/.claude/codealmanac-reference.md`.
 *   3. The SessionEnd hook entry (delegated to `runHookUninstall`, which
 *      already knows how to leave foreign entries alone).
 *
 * Flags:
 *   --yes           skip confirmations; remove everything
 *   --keep-hook     leave the hook alone
 *   --keep-guides   leave the guides + CLAUDE.md import alone
 *
 * Non-interactive (no TTY) → behaves as if `--yes` was passed. Same
 * contract as `setup`.
 */

export interface UninstallOptions {
  yes?: boolean;
  keepHook?: boolean;
  keepGuides?: boolean;

  // ─── Injection points ────────────────────────────────────────────
  settingsPath?: string;
  hookScriptPath?: string;
  claudeDir?: string;
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

  out.write("\n");

  // Hook removal.
  let removeHook = true;
  if (options.keepHook === true) {
    removeHook = false;
  } else if (interactive) {
    removeHook = await confirm(
      out,
      "Remove the SessionEnd hook from ~/.claude/settings.json?",
      true,
    );
  }
  if (removeHook) {
    const res = await runHookUninstall({
      settingsPath: options.settingsPath,
      hookScriptPath: options.hookScriptPath,
    });
    if (res.exitCode !== 0) {
      return { stdout: "", stderr: res.stderr, exitCode: res.exitCode };
    }
    out.write(`  ${BLUE}\u25c7${RST}  ${res.stdout.trim()}\n`);
  } else {
    out.write(`  ${DIM}\u25cb  Hook kept${RST}\n`);
  }

  // Guide + import removal.
  let removeGuides = true;
  if (options.keepGuides === true) {
    removeGuides = false;
  } else if (interactive) {
    removeGuides = await confirm(
      out,
      "Remove the guides + CLAUDE.md import line?",
      true,
    );
  }
  if (removeGuides) {
    const summary = await removeGuideFiles(claudeDir);
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
): Promise<RemoveGuidesResult> {
  const touched: string[] = [];

  const mini = path.join(claudeDir, "codealmanac.md");
  const ref = path.join(claudeDir, "codealmanac-reference.md");
  const claudeMd = path.join(claudeDir, "CLAUDE.md");

  if (existsSync(mini)) {
    await rm(mini, { force: true });
    touched.push("codealmanac.md");
  }
  if (existsSync(ref)) {
    await rm(ref, { force: true });
    touched.push("codealmanac-reference.md");
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
    if (lines[i]!.trim() === IMPORT_LINE) indices.push(i);
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
