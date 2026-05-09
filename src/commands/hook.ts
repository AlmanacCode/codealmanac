import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  copyToStableHooksDir,
  resolveHookScriptPath,
  resolveSettingsPath,
  type ScriptResolution,
} from "./hook/script.js";
import { isCursorEnabled } from "../update/config.js";

/**
 * `almanac hook install|uninstall|status` — wires the bundled
 * `hooks/almanac-capture.sh` into `~/.claude/settings.json` as a
 * `SessionEnd` hook.
 *
 * Design notes:
 *
 * - **Schema.** Claude Code validates `settings.json` against a strict
 *   schema: each entry in an event array (like `SessionEnd`) is a
 *   `{matcher, hooks: [...]}` container, and the actual command objects
 *   live in the nested `hooks` array. v0.1.0–v0.1.4 wrote command objects
 *   directly at the event-array level; newer Claude Code versions now
 *   reject that shape. We produce the wrapped form on install, and when
 *   encountering a legacy unwrapped entry that we recognize as ours (by
 *   `command` ending in `almanac-capture.sh`) we migrate it on next
 *   install. `SessionEnd` never uses the `matcher` field to discriminate
 *   anything — we always emit an empty `matcher: ""` (matches
 *   everything, which is what session-end lifecycle hooks want).
 *
 * - **Idempotent.** `install` twice leaves one entry, not two. We match by
 *   `command` string equality on the inner `hooks[]` entries. If the user
 *   replaces our absolute path with a symlink pointing at the same
 *   script, we'll treat it as foreign. That's acceptable; the `status`
 *   output shows the path we'd use, so the user can reconcile manually.
 *
 * - **Refuse foreign entries.** If `SessionEnd` is already populated with
 *   a command we don't recognize, we print the existing value and exit
 *   non-zero. Claude Code lets users wire their own hooks (notifications,
 *   git autocommit scripts, etc.) and silently replacing them would be
 *   rude. Foreign wrapped containers that don't reference our script are
 *   preserved byte-for-byte.
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
  /** Which agent app to install hooks for. Default keeps legacy Claude behavior. */
  source?: "claude" | "codex" | "cursor" | "all";
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
  /**
   * Override the stable hooks directory where we copy the script.
   * Defaults to `~/.claude/hooks/`. Tests sandbox this to a tmpdir.
   *
   * Bug #1 fix: we always copy the bundled script to this stable path
   * before writing it into settings.json. This way the settings entry
   * points at a user-owned location that survives npm version bumps,
   * npx cache evictions, and nvm version switches — instead of an
   * ephemeral path inside ~/.npm/_npx/<sha>/... or the nvm-versioned
   * node_modules/.
   */
  stableHooksDir?: string;
}

export interface HookCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const HOOK_TIMEOUT_SECONDS = 10;

/** A single command invocation inside a wrapper's `hooks[]` array. */
interface HookCommand {
  type: "command";
  command: string;
  timeout?: number;
}

/** A wrapped SessionEnd entry per Claude Code's schema. */
interface WrappedEntry {
  matcher: string;
  hooks: HookCommand[];
}

/**
 * What we read from `settings.hooks.SessionEnd`. During a read we may
 * encounter the legacy unwrapped shape (`HookCommand` directly) written
 * by v0.1.0–v0.1.4 — we recognize and migrate it. Unknown entries we
 * can't classify are preserved as-is via `unknown`.
 */
type RawEntry = WrappedEntry | HookCommand | unknown;

/**
 * Claude Code's `settings.json` is a free-form JSON object; we only care
 * about the `hooks.SessionEnd` array. Preserve everything else verbatim
 * so we don't drop user settings when we write the file back.
 */
type SettingsJson = Record<string, unknown> & {
  hooks?: Record<string, RawEntry[] | undefined>;
};

/**
 * Heuristic: does this command path look like one we installed?
 *
 * We match on the filename `almanac-capture.sh` regardless of the parent
 * directory. This covers:
 *   - the stable path: `~/.claude/hooks/almanac-capture.sh`
 *   - legacy paths from v0.1.0–v0.1.5: inside the nvm node_modules or
 *     npx cache
 * The stable path is what new installs produce; legacy paths are what
 * we migrate when the user runs `almanac hook install` again.
 */
function isOurCommandPath(command: string): boolean {
  return command.endsWith("almanac-capture.sh");
}

/**
 * Classify a raw SessionEnd entry. Wrapped entries are the canonical
 * shape; unwrapped-command entries are legacy output from v0.1.0–v0.1.4.
 * Anything else (random user JSON) is `unknown` and we leave it alone.
 */
type Classified =
  | { kind: "wrapped"; entry: WrappedEntry }
  | { kind: "legacy"; entry: HookCommand }
  | { kind: "unknown"; entry: unknown };

function classifyEntry(raw: RawEntry): Classified {
  if (raw === null || typeof raw !== "object") {
    return { kind: "unknown", entry: raw };
  }
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.hooks)) {
    // Wrapped shape. `matcher` may be absent in hand-edited files; treat
    // absent as "" so we don't throw on slightly malformed input.
    const matcher = typeof obj.matcher === "string" ? obj.matcher : "";
    const hooks: HookCommand[] = [];
    for (const h of obj.hooks as unknown[]) {
      if (h !== null && typeof h === "object") {
        const ho = h as Record<string, unknown>;
        if (ho.type === "command" && typeof ho.command === "string") {
          const cmd: HookCommand = {
            type: "command",
            command: ho.command,
          };
          if (typeof ho.timeout === "number") cmd.timeout = ho.timeout;
          hooks.push(cmd);
        }
      }
    }
    return { kind: "wrapped", entry: { matcher, hooks } };
  }
  if (obj.type === "command" && typeof obj.command === "string") {
    // Legacy unwrapped shape — v0.1.0–v0.1.4 wrote this form.
    const cmd: HookCommand = {
      type: "command",
      command: obj.command as string,
    };
    if (typeof obj.timeout === "number") cmd.timeout = obj.timeout;
    return { kind: "legacy", entry: cmd };
  }
  return { kind: "unknown", entry: raw };
}

/** True when the entry references our script and is safely ours to manage. */
function isOurWrapped(entry: WrappedEntry): boolean {
  return entry.hooks.some((h) => isOurCommandPath(h.command));
}

export async function runHookInstall(
  options: HookCommandOptions = {},
): Promise<HookCommandResult> {
  const bundled = resolveHookScriptPath(options);
  if (!bundled.ok) {
    return { stdout: "", stderr: `almanac: ${bundled.error}\n`, exitCode: 1 };
  }

  // Copy the bundled hook script to a stable user-owned location before
  // writing that path into settings.json. This is the Bug #1 fix:
  //
  //   OLD behavior: settings.json pointed at the bundled path (inside
  //   ~/.nvm/versions/node/<ver>/lib/node_modules/codealmanac/hooks/... or
  //   ~/.npm/_npx/<sha>/node_modules/codealmanac/hooks/...). When the user
  //   switches Node versions or the npx cache is evicted, the path breaks
  //   silently and captures stop firing.
  //
  //   NEW behavior: we copy almanac-capture.sh to ~/.claude/hooks/ (same
  //   directory Claude Code uses for its own built-in hooks, always present)
  //   and point settings.json there. The stable path is independent of
  //   Node version and npm cache state. When the user upgrades codealmanac,
  //   `almanac hook install` copies a fresh script and updates settings.json
  //   if the path changed.
  //
  // When `hookScriptPath` is explicitly provided (test injection), the
  // caller has already specified the destination path — skip the copy and
  // use that path directly. The stable-copy concern only applies to the
  // production flow where we resolved from the bundled package layout.
  const script: ScriptResolution = options.hookScriptPath !== undefined
    ? bundled // already the caller-provided path, no copy needed
    : await copyToStableHooksDir(bundled.path, options);
  if (!script.ok) {
    return { stdout: "", stderr: `almanac: ${script.error}\n`, exitCode: 1 };
  }

  const source = options.source ?? "claude";
  if (source === "all") {
    const results = [
      await installClaudeHook(options, script.path),
      await installGenericHook({
        label: "Codex Stop",
        settingsPath: path.join(homedir(), ".codex", "hooks.json"),
        eventName: "Stop",
        shape: "wrapped",
        scriptPath: script.path,
      }),
    ];
    if (isCursorEnabled()) {
      results.push(await installGenericHook({
        label: "Cursor sessionEnd",
        settingsPath: path.join(homedir(), ".cursor", "hooks.json"),
        eventName: "sessionEnd",
        shape: "flat",
        scriptPath: script.path,
      }));
    }
    const failed = results.find((r) => r.exitCode !== 0);
    if (failed !== undefined) return failed;
    return {
      stdout: results.map((r) => r.stdout.trimEnd()).join("\n") + "\n",
      stderr: "",
      exitCode: 0,
    };
  }
  if (source === "codex") {
    return await installGenericHook({
      label: "Codex Stop",
      settingsPath: path.join(homedir(), ".codex", "hooks.json"),
      eventName: "Stop",
      shape: "wrapped",
      scriptPath: script.path,
    });
  }
  if (source === "cursor") {
    if (!isCursorEnabled()) {
      return {
        stdout: "",
        stderr:
          "almanac: cursor hooks are disabled. Set CODEALMANAC_ENABLE_CURSOR=1 to enable experimental Cursor support.\n",
        exitCode: 1,
      };
    }
    return await installGenericHook({
      label: "Cursor sessionEnd",
      settingsPath: path.join(homedir(), ".cursor", "hooks.json"),
      eventName: "sessionEnd",
      shape: "flat",
      scriptPath: script.path,
    });
  }

  return await installClaudeHook(options, script.path);
}

async function installClaudeHook(
  options: HookCommandOptions,
  scriptPath: string,
): Promise<HookCommandResult> {

  const settingsPath = resolveSettingsPath(options);
  const settings = await readSettings(settingsPath);
  const existing = (settings.hooks?.SessionEnd ?? []).slice();

  // Walk existing entries and split them into buckets:
  //   - `preserved`  — foreign wrapped/unknown entries we leave alone.
  //   - `oursAlready` — a wrapped entry that already points at OUR exact
  //                     script path (makes install a no-op).
  //   - `oursStale`   — a wrapped or legacy entry that references our
  //                     capture script but at a different absolute path
  //                     (old install, `npm i` moved us) or in the legacy
  //                     unwrapped shape. We'll collapse these into a
  //                     single fresh entry at the new path.
  const preserved: RawEntry[] = [];
  let oursAlready: WrappedEntry | null = null;
  const staleCount = { n: 0 };

  for (const raw of existing) {
    const c = classifyEntry(raw);
    if (c.kind === "wrapped") {
      if (!isOurWrapped(c.entry)) {
        preserved.push(raw);
        continue;
      }
      // Entry belongs to us. Does it already point at the exact script
      // path? If every command in its `hooks[]` that looks like ours is
      // already at `script.path`, it's up to date.
      const exactMatch = c.entry.hooks.some(
        (h) => h.command === scriptPath,
      );
      if (exactMatch && oursAlready === null) {
        oursAlready = c.entry;
      } else {
        staleCount.n += 1;
      }
    } else if (c.kind === "legacy") {
      if (isOurCommandPath(c.entry.command)) {
        // Legacy unwrapped entry of ours — always migrate to wrapped.
        staleCount.n += 1;
      } else {
        // Foreign legacy entry (user had their own script before
        // settings.json required wrapping). Leave it alone.
        preserved.push(raw);
      }
    } else {
      // Unknown shape — we can't classify it. Preserve verbatim.
      preserved.push(raw);
    }
  }

  // If every non-ours entry is a foreign unwrapped command (not a
  // wrapped one) we refuse to touch the file — Claude Code's newer
  // schema will already reject such files, but surfacing it here lets
  // the user clean up before we stack our entry on top. Wrapped foreign
  // entries are fine to leave alongside ours.
  const foreignLegacy = preserved.filter((raw) => {
    const c = classifyEntry(raw);
    return c.kind === "legacy";
  });
  if (foreignLegacy.length > 0) {
    const lines = foreignLegacy
      .map((raw) => {
        const c = classifyEntry(raw);
        if (c.kind === "legacy") return `  - ${c.entry.command}`;
        return "  - <unrecognized>";
      })
      .join("\n");
    return {
      stdout: "",
      stderr:
        `almanac: SessionEnd has a foreign legacy entry:\n${lines}\n` +
        `Remove or rewrap it manually in ${settingsPath} before installing.\n`,
      exitCode: 1,
    };
  }

  if (oursAlready !== null && staleCount.n === 0) {
    return {
      stdout: `almanac: SessionEnd hook already installed at ${scriptPath}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  // Build the fresh wrapped entry and append to preserved foreign
  // entries. Stale entries of ours are dropped (we only ever want a
  // single active entry; multiple copies of the capture hook would
  // double-fire on session end).
  const fresh: WrappedEntry = {
    matcher: "",
    hooks: [
        {
          type: "command",
          command: scriptPath,
          timeout: HOOK_TIMEOUT_SECONDS,
        },
    ],
  };

  const newEntries: RawEntry[] = [...preserved, fresh];

  settings.hooks = { ...(settings.hooks ?? {}), SessionEnd: newEntries };
  await writeSettings(settingsPath, settings);

  return {
    stdout:
      `almanac: SessionEnd hook installed\n` +
      `  script: ${scriptPath}\n` +
      `  settings: ${settingsPath}\n`,
    stderr: "",
    exitCode: 0,
  };
}

async function installGenericHook(args: {
  label: string;
  settingsPath: string;
  eventName: string;
  shape: "flat" | "wrapped";
  scriptPath: string;
}): Promise<HookCommandResult> {
  const settings = await readSettings(args.settingsPath);
  const hooksObj =
    settings.hooks !== undefined &&
    settings.hooks !== null &&
    typeof settings.hooks === "object"
      ? settings.hooks
      : {};
  const existing = Array.isArray(hooksObj[args.eventName])
    ? (hooksObj[args.eventName] as RawEntry[])
    : [];
  const kept = existing.filter((entry) => !entryHasOurCommand(entry));
  const already = existing.some((entry) =>
    entryHasExactCommand(entry, args.scriptPath),
  );
  if (already && kept.length === existing.length - 1) {
    return {
      stdout: `almanac: ${args.label} hook already installed at ${args.scriptPath}\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  const fresh =
    args.shape === "wrapped"
      ? {
          hooks: [
            {
              type: "command",
              command: args.scriptPath,
              timeout: HOOK_TIMEOUT_SECONDS,
            },
          ],
        }
      : {
          command: args.scriptPath,
          timeout: HOOK_TIMEOUT_SECONDS,
        };
  hooksObj[args.eventName] = [
    ...kept,
    fresh,
  ];
  settings.hooks = hooksObj;
  await writeSettings(args.settingsPath, settings);
  if (args.label.startsWith("Codex ")) {
    await ensureCodexHooksFeature(path.join(homedir(), ".codex", "config.toml"));
  }
  return {
    stdout:
      `almanac: ${args.label} hook installed\n` +
      `  script: ${args.scriptPath}\n` +
      `  settings: ${args.settingsPath}\n`,
    stderr: "",
    exitCode: 0,
  };
}

function entryHasOurCommand(entry: unknown): boolean {
  return collectHookCommands(entry).some(isOurCommandPath);
}

function entryHasExactCommand(entry: unknown, command: string): boolean {
  return collectHookCommands(entry).some((candidate) => candidate === command);
}

function collectHookCommands(entry: unknown): string[] {
  if (entry === null || typeof entry !== "object") return [];
  const obj = entry as Record<string, unknown>;
  const direct = typeof obj.command === "string" ? [obj.command] : [];
  const nested = Array.isArray(obj.hooks)
    ? obj.hooks.flatMap((hook) => collectHookCommands(hook))
    : [];
  return [...direct, ...nested];
}

async function ensureCodexHooksFeature(configPath: string): Promise<void> {
  let body = "";
  if (existsSync(configPath)) {
    body = await readFile(configPath, "utf8");
  }
  if (/^\s*codex_hooks\s*=\s*true\s*$/m.test(body)) return;

  const next = setTomlFeatureFlag(body, "codex_hooks", true);
  await mkdir(path.dirname(configPath), { recursive: true });
  const tmp = `${configPath}.almanac-tmp-${process.pid}`;
  await writeFile(tmp, next.endsWith("\n") ? next : `${next}\n`, "utf8");
  await rename(tmp, configPath);
}

function setTomlFeatureFlag(
  body: string,
  key: string,
  value: boolean,
): string {
  const desired = `${key} = ${value ? "true" : "false"}`;
  const lines = body.split(/\r?\n/);
  let featuresStart = -1;
  let featuresEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\[features\]\s*$/.test(lines[i] ?? "")) {
      featuresStart = i;
      continue;
    }
    if (featuresStart !== -1 && i > featuresStart && /^\s*\[.*\]\s*$/.test(lines[i] ?? "")) {
      featuresEnd = i;
      break;
    }
  }

  if (featuresStart === -1) {
    const prefix = body.trim().length === 0 ? "" : `${body.trimEnd()}\n\n`;
    return `${prefix}[features]\n${desired}\n`;
  }

  const keyPattern = new RegExp(`^\\s*${escapeRegex(key)}\\s*=`);
  for (let i = featuresStart + 1; i < featuresEnd; i++) {
    if (keyPattern.test(lines[i] ?? "")) {
      lines[i] = desired;
      return lines.join("\n");
    }
  }

  lines.splice(featuresStart + 1, 0, desired);
  return lines.join("\n");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  const kept: RawEntry[] = [];
  let removed = 0;

  for (const raw of existing) {
    const c = classifyEntry(raw);
    if (c.kind === "wrapped") {
      // Filter out our command(s) from the inner hooks array. Keep
      // anything else in the array intact — a foreign wrapper that
      // happened to include our script alongside its own commands
      // (unusual, but survivable) loses our entry and keeps theirs.
      const innerKept = c.entry.hooks.filter(
        (h) => !isOurCommandPath(h.command),
      );
      const innerRemoved = c.entry.hooks.length - innerKept.length;
      removed += innerRemoved;
      if (innerKept.length === 0) {
        // Only drop the outer wrapper when it was entirely ours. A
        // foreign wrapper that never contained our script stays verbatim
        // below (handled by `innerRemoved === 0`, which leaves
        // `innerKept.length === c.entry.hooks.length`, hence we fall
        // through to the else-branch).
        if (innerRemoved === 0) kept.push(raw);
        // else: fully owned by us, drop the container.
      } else if (innerRemoved === 0) {
        // Untouched foreign wrapper — preserve the raw object to keep
        // any fields (like matcher) byte-for-byte.
        kept.push(raw);
      } else {
        // Partial: rebuild with just the kept inner entries, preserving
        // the original matcher string.
        kept.push({ matcher: c.entry.matcher, hooks: innerKept });
      }
    } else if (c.kind === "legacy") {
      if (isOurCommandPath(c.entry.command)) {
        removed += 1;
      } else {
        kept.push(raw);
      }
    } else {
      kept.push(raw);
    }
  }

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

    // If `hooks` itself is now empty (user had only our SessionEnd entry
    // and no other hook categories), drop the `hooks` key entirely so
    // uninstall leaves the settings file in the same shape it would be
    // in had we never run install. An empty `"hooks": {}` is an obvious
    // breadcrumb in commit diffs.
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
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

  // Walk the array looking for any entry (wrapped or legacy) that
  // references our capture script. Gathering foreign entries separately
  // lets us show them to the user if nothing of ours was found.
  let ourCommand: string | null = null;
  const foreignSummary: string[] = [];
  for (const raw of existing) {
    const c = classifyEntry(raw);
    if (c.kind === "wrapped") {
      for (const h of c.entry.hooks) {
        if (isOurCommandPath(h.command)) {
          ourCommand ??= h.command;
        } else {
          foreignSummary.push(h.command);
        }
      }
    } else if (c.kind === "legacy") {
      if (isOurCommandPath(c.entry.command)) {
        ourCommand ??= c.entry.command;
      } else {
        foreignSummary.push(c.entry.command);
      }
    }
  }

  if (ourCommand === null) {
    const foreignLines = foreignSummary
      .map((c) => `  - ${c}`)
      .join("\n");
    return {
      stdout:
        `SessionEnd hook: not installed\n` +
        `settings: ${settingsPath}\n` +
        (foreignSummary.length > 0
          ? `(${foreignSummary.length} foreign entr${foreignSummary.length === 1 ? "y" : "ies"} present:\n${foreignLines})\n`
          : "") +
        (script.ok ? `script would be: ${script.path}\n` : ""),
      stderr: "",
      exitCode: 0,
    };
  }

  return {
    stdout:
      `SessionEnd hook: installed\n` +
      `script: ${ourCommand}\n` +
      `settings: ${settingsPath}\n`,
    stderr: "",
    exitCode: 0,
  };
}

// ─── Settings JSON helpers ───────────────────────────────────────────

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
