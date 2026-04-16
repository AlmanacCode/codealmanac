import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `almanac hook install|uninstall|status` — wires the bundled
 * `hooks/almanac-capture.sh` into `~/.claude/settings.json` as a
 * `SessionEnd` hook.
 *
 * Design notes:
 *
 * - **Idempotent.** `install` twice leaves one entry, not two. We match by
 *   `command` string equality — if the user replaces our absolute path
 *   with a symlink pointing at the same script, we'll treat it as foreign.
 *   That's acceptable; the `status` output shows the path we'd use, so the
 *   user can reconcile manually.
 *
 * - **Refuse foreign entries.** If `SessionEnd` is already populated with
 *   a command we don't recognize, we print the existing value and exit
 *   non-zero. Claude Code lets users wire their own hooks (notifications,
 *   git autocommit scripts, etc.) and silently replacing them would be
 *   rude.
 *
 * - **Atomic write.** `settings.json` is small but heavily touched by
 *   Claude Code. Writing via tmp-file + rename avoids corrupting the file
 *   if we crash mid-write.
 *
 * - **Non-interactive.** No prompts, no confirmations. The caller is
 *   already making an intentional choice by running `almanac hook
 *   install`.
 */

export interface HookCommandOptions {
  /**
   * Override the hook script path. Production code leaves this undefined
   * and we resolve the bundled `hooks/almanac-capture.sh`. Tests pass a
   * fixture path to avoid depending on the runtime-install layout.
   */
  hookScriptPath?: string;
  /**
   * Override `~/.claude/settings.json`. Tests sandbox this to a tmpdir;
   * production code leaves it undefined.
   */
  settingsPath?: string;
}

export interface HookCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const HOOK_TIMEOUT_SECONDS = 10;

interface SessionEndEntry {
  type: "command";
  command: string;
  timeout?: number;
}

/**
 * Claude Code's `settings.json` is a free-form JSON object; we only care
 * about the `hooks.SessionEnd` array. Preserve everything else verbatim so
 * we don't drop user settings when we write the file back.
 */
type SettingsJson = Record<string, unknown> & {
  hooks?: Record<string, SessionEndEntry[] | undefined>;
};

export async function runHookInstall(
  options: HookCommandOptions = {},
): Promise<HookCommandResult> {
  const script = resolveHookScriptPath(options);
  if (!script.ok) {
    return { stdout: "", stderr: `almanac: ${script.error}\n`, exitCode: 1 };
  }

  const settingsPath = resolveSettingsPath(options);
  const settings = await readSettings(settingsPath);
  const existing = (settings.hooks?.SessionEnd ?? []).slice();

  // Find any existing entry with our exact command. If found, the install
  // is a no-op (idempotent). If SessionEnd has OTHER commands alongside
  // ours, leave them alone — the user might be composing multiple hooks.
  const ourEntries = existing.filter((e) => e.command === script.path);
  const foreignEntries = existing.filter((e) => e.command !== script.path);

  // If the sole existing entry looks like ours-but-on-a-different-path
  // (e.g. an old install from a different node_modules), replace it so we
  // don't double-fire on session end. Heuristic: command ends with
  // `almanac-capture.sh`. We accept this specific rename; unrelated
  // commands still block.
  const stale = foreignEntries.filter((e) =>
    e.command.endsWith("almanac-capture.sh"),
  );
  const unrelated = foreignEntries.filter(
    (e) => !e.command.endsWith("almanac-capture.sh"),
  );

  if (unrelated.length > 0) {
    const existingStr = unrelated.map((e) => `  - ${e.command}`).join("\n");
    return {
      stdout: "",
      stderr:
        `almanac: SessionEnd hook already has a foreign entry:\n${existingStr}\n` +
        `Remove it manually from ${settingsPath} if you want almanac to manage the hook.\n`,
      exitCode: 1,
    };
  }

  if (ourEntries.length > 0 && stale.length === 0) {
    return {
      stdout: `almanac: SessionEnd hook already installed at ${script.path}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  // Compose the new SessionEnd array: keep our one entry (fresh), drop any
  // stale almanac entries.
  const newEntries: SessionEndEntry[] = [
    {
      type: "command",
      command: script.path,
      timeout: HOOK_TIMEOUT_SECONDS,
    },
  ];

  settings.hooks = { ...(settings.hooks ?? {}), SessionEnd: newEntries };
  await writeSettings(settingsPath, settings);

  return {
    stdout:
      `almanac: SessionEnd hook installed\n` +
      `  script: ${script.path}\n` +
      `  settings: ${settingsPath}\n`,
    stderr: "",
    exitCode: 0,
  };
}

export async function runHookUninstall(
  options: HookCommandOptions = {},
): Promise<HookCommandResult> {
  const settingsPath = resolveSettingsPath(options);

  if (!existsSync(settingsPath)) {
    return {
      stdout: `almanac: SessionEnd hook not installed (no settings file)\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  const settings = await readSettings(settingsPath);
  const existing = (settings.hooks?.SessionEnd ?? []).slice();

  // Remove ONLY our entries — anything else stays. We treat any entry with
  // a command ending in `almanac-capture.sh` as ours (handles the case
  // where the bundled path moved between `npm i` locations).
  const kept = existing.filter((e) => !e.command.endsWith("almanac-capture.sh"));
  const removed = existing.length - kept.length;

  if (removed === 0) {
    return {
      stdout: `almanac: SessionEnd hook not installed\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  if (settings.hooks !== undefined) {
    if (kept.length === 0) {
      // Empty SessionEnd array confuses some linters; drop the key when
      // nothing's left.
      const { SessionEnd: _dropped, ...rest } = settings.hooks;
      void _dropped;
      settings.hooks = rest;
    } else {
      settings.hooks = { ...settings.hooks, SessionEnd: kept };
    }
  }

  await writeSettings(settingsPath, settings);

  return {
    stdout: `almanac: SessionEnd hook removed\n`,
    stderr: "",
    exitCode: 0,
  };
}

export async function runHookStatus(
  options: HookCommandOptions = {},
): Promise<HookCommandResult> {
  const script = resolveHookScriptPath(options);
  const settingsPath = resolveSettingsPath(options);

  if (!existsSync(settingsPath)) {
    return {
      stdout:
        `SessionEnd hook: not installed\n` +
        `settings: ${settingsPath} (does not exist)\n` +
        (script.ok ? `script would be: ${script.path}\n` : ""),
      stderr: "",
      exitCode: 0,
    };
  }

  const settings = await readSettings(settingsPath);
  const existing = settings.hooks?.SessionEnd ?? [];
  const ours = existing.find((e) => e.command.endsWith("almanac-capture.sh"));

  if (ours === undefined) {
    const foreign = existing
      .map((e) => `  - ${e.command}`)
      .join("\n");
    return {
      stdout:
        `SessionEnd hook: not installed\n` +
        `settings: ${settingsPath}\n` +
        (existing.length > 0
          ? `(${existing.length} foreign entr${existing.length === 1 ? "y" : "ies"} present:\n${foreign})\n`
          : "") +
        (script.ok ? `script would be: ${script.path}\n` : ""),
      stderr: "",
      exitCode: 0,
    };
  }

  return {
    stdout:
      `SessionEnd hook: installed\n` +
      `script: ${ours.command}\n` +
      `settings: ${settingsPath}\n`,
    stderr: "",
    exitCode: 0,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function resolveSettingsPath(options: HookCommandOptions): string {
  if (options.settingsPath !== undefined) return options.settingsPath;
  return path.join(homedir(), ".claude", "settings.json");
}

type ScriptResolution =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * Locate the bundled `hooks/almanac-capture.sh`. Mirrors
 * `resolvePromptsDir` from `src/agent/prompts.ts`: two plausible layouts
 * (installed dist vs. source dev), probe each.
 */
function resolveHookScriptPath(options: HookCommandOptions): ScriptResolution {
  if (options.hookScriptPath !== undefined) {
    return { ok: true, path: options.hookScriptPath };
  }

  const here = path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    // Bundled: `.../codealmanac/dist/codealmanac.js` → `../hooks/…`
    path.resolve(here, "..", "hooks", "almanac-capture.sh"),
    // Source: `.../codealmanac/src/commands/hook.ts` → `../../hooks/…`
    path.resolve(here, "..", "..", "hooks", "almanac-capture.sh"),
    // Defensive nested fallback.
    path.resolve(here, "..", "..", "..", "hooks", "almanac-capture.sh"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { ok: true, path: candidate };
    }
  }

  return {
    ok: false,
    error:
      `could not locate hooks/almanac-capture.sh. Tried:\n` +
      candidates.map((c) => `  - ${c}`).join("\n"),
  };
}

async function readSettings(settingsPath: string): Promise<SettingsJson> {
  if (!existsSync(settingsPath)) return {};
  try {
    const raw = await readFile(settingsPath, "utf8");
    if (raw.trim().length === 0) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object") return {};
    return parsed as SettingsJson;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`failed to read ${settingsPath}: ${msg}`);
  }
}

async function writeSettings(
  settingsPath: string,
  settings: SettingsJson,
): Promise<void> {
  const dir = path.dirname(settingsPath);
  await mkdir(dir, { recursive: true });

  // Atomic write: JSON.stringify → tmp file → rename. `rename` within the
  // same filesystem is atomic on POSIX; Claude Code never sees a partial
  // file. Formatted with 2-space indent to match the existing settings.
  const tmp = `${settingsPath}.almanac-tmp-${process.pid}`;
  const body = `${JSON.stringify(settings, null, 2)}\n`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, settingsPath);
}
