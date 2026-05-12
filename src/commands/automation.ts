import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { CommandResult } from "../cli/helpers.js";
import { parseDuration } from "../indexer/duration.js";
import { ensureAutomationCaptureSince } from "../update/config.js";

const execFileAsync = promisify(execFile);

export interface AutomationOptions {
  every?: string;
  quiet?: string;
  homeDir?: string;
  plistPath?: string;
  programArguments?: string[];
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
  now?: Date;
  configPath?: string;
}

export interface AutomationStatusOptions {
  homeDir?: string;
  plistPath?: string;
}

type ExecFn = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

const LABEL = "com.codealmanac.capture-sweep";
const DEFAULT_EVERY = "5h";
const DEFAULT_QUIET = "45m";
const LAUNCHD_FALLBACK_PATHS = [
  "/usr/local/bin",
  "/opt/homebrew/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
];

export async function runAutomationInstall(
  options: AutomationOptions = {},
): Promise<CommandResult> {
  const interval = parseInterval(options.every ?? DEFAULT_EVERY);
  if (!interval.ok) {
    return { stdout: "", stderr: `almanac: ${interval.error}\n`, exitCode: 1 };
  }
  const quietValue = options.quiet ?? DEFAULT_QUIET;
  const quiet = parseQuiet(quietValue);
  if (!quiet.ok) {
    return { stdout: "", stderr: `almanac: ${quiet.error}\n`, exitCode: 1 };
  }

  const home = options.homeDir ?? homedir();
  const plist = options.plistPath ?? defaultPlistPath(home);
  const logsDir = path.join(home, ".almanac", "logs");
  await mkdir(path.dirname(plist), { recursive: true });
  await mkdir(logsDir, { recursive: true });

  const programArguments = options.programArguments ?? defaultProgramArguments(quietValue);
  const environmentVariables = {
    PATH: buildLaunchPath(home, options.env?.PATH ?? process.env.PATH),
  };
  await writeFile(
    plist,
    renderPlist({
      programArguments,
      intervalSeconds: interval.seconds,
      environmentVariables,
      stdoutPath: path.join(logsDir, "capture-sweep.out.log"),
      stderrPath: path.join(logsDir, "capture-sweep.err.log"),
    }),
    "utf8",
  );

  const exec = options.exec ?? defaultExec;
  const target = launchctlTarget();
  try {
    await exec("launchctl", ["bootout", target, plist]);
  } catch {
    // Not loaded yet is fine; bootstrap below is the authoritative install.
  }
  try {
    await exec("launchctl", ["bootstrap", target, plist]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      stdout: "",
      stderr: `almanac: automation plist written to ${plist}, but launchctl bootstrap failed: ${msg}\n`,
      exitCode: 1,
    };
  }
  const captureSince = await ensureAutomationCaptureSince(
    (options.now ?? new Date()).toISOString(),
    options.configPath,
  );

  return {
    stdout:
      `almanac: auto-capture automation installed\n` +
      `  interval: ${options.every ?? DEFAULT_EVERY}\n` +
      `  quiet: ${quietValue}\n` +
      `  capturing transcripts after: ${captureSince}\n` +
      `  command: ${programArguments.join(" ")}\n` +
      `  plist: ${plist}\n`,
    stderr: "",
    exitCode: 0,
  };
}

export async function cleanupLegacyHooks(
  options: { homeDir?: string } = {},
): Promise<void> {
  const home = options.homeDir ?? homedir();
  await Promise.all([
    cleanupLegacyHookFile(path.join(home, ".claude", "settings.json")),
    cleanupLegacyHookFile(path.join(home, ".codex", "hooks.json")),
    cleanupLegacyHookFile(path.join(home, ".cursor", "hooks.json")),
    rm(path.join(home, ".claude", "hooks", "almanac-capture.sh"), {
      force: true,
    }),
  ]);
}

export async function runAutomationUninstall(
  options: AutomationOptions = {},
): Promise<CommandResult> {
  const home = options.homeDir ?? homedir();
  const plist = options.plistPath ?? defaultPlistPath(home);
  const exec = options.exec ?? defaultExec;
  if (existsSync(plist)) {
    try {
      await exec("launchctl", ["bootout", launchctlTarget(), plist]);
    } catch {
      // Already unloaded is still a successful uninstall.
    }
    await rm(plist, { force: true });
    return {
      stdout: `almanac: auto-capture automation removed\n  plist: ${plist}\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  return {
    stdout: "almanac: auto-capture automation not installed\n",
    stderr: "",
    exitCode: 0,
  };
}

export async function runAutomationStatus(
  options: AutomationStatusOptions = {},
): Promise<CommandResult> {
  const home = options.homeDir ?? homedir();
  const plist = options.plistPath ?? defaultPlistPath(home);
  if (!existsSync(plist)) {
    return {
      stdout: "auto-capture automation: not installed\n",
      stderr: "",
      exitCode: 0,
    };
  }
  const contents = await readFile(plist, "utf8");
  const interval = contents.match(/<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/)?.[1];
  const quiet = readProgramArgumentAfter(contents, "--quiet");
  return {
    stdout:
      `auto-capture automation: installed\n` +
      `  plist: ${plist}\n` +
      (interval !== undefined ? `  interval: ${interval}s\n` : "") +
      (quiet !== null ? `  quiet: ${quiet}\n` : ""),
    stderr: "",
    exitCode: 0,
  };
}

export function defaultPlistPath(home: string = homedir()): string {
  return path.join(home, "Library", "LaunchAgents", `${LABEL}.plist`);
}

function parseInterval(value: string): { ok: true; seconds: number } | { ok: false; error: string } {
  try {
    const seconds = parseDuration(value);
    if (seconds <= 0) {
      return { ok: false, error: "automation interval must be greater than zero" };
    }
    return { ok: true, seconds };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function parseQuiet(value: string): { ok: true } | { ok: false; error: string } {
  try {
    const seconds = parseDuration(value);
    if (seconds < 0) {
      return { ok: false, error: "quiet window must be zero or greater" };
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function renderPlist(args: {
  programArguments: string[];
  intervalSeconds: number;
  environmentVariables: Record<string, string>;
  stdoutPath: string;
  stderrPath: string;
}): string {
  const programArguments = args.programArguments
    .map((arg) => `    <string>${escapeXml(arg)}</string>`)
    .join("\n");
  const environmentVariables = Object.entries(args.environmentVariables)
    .map(([key, value]) => `    <key>${escapeXml(key)}</key>\n    <string>${escapeXml(value)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
${programArguments}
  </array>
  <key>StartInterval</key>
  <integer>${args.intervalSeconds}</integer>
  <key>EnvironmentVariables</key>
  <dict>
${environmentVariables}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(args.stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(args.stderrPath)}</string>
</dict>
</plist>
`;
}

function readProgramArgumentAfter(contents: string, flag: string): string | null {
  const values = [...contents.matchAll(/<string>([^<]*)<\/string>/g)]
    .map((match) => unescapeXml(match[1] ?? ""));
  const index = values.indexOf(flag);
  return index >= 0 ? values[index + 1] ?? null : null;
}

function defaultProgramArguments(quiet: string = DEFAULT_QUIET): string[] {
  const cliEntry = findPackageCliEntry() ??
    (process.argv[1] !== undefined
      ? path.resolve(process.argv[1])
      : path.resolve(process.cwd(), "dist", "codealmanac.js"));
  return [process.execPath, cliEntry, "capture", "sweep", "--quiet", quiet];
}

function buildLaunchPath(home: string, envPath: string | undefined): string {
  const installPaths = (envPath ?? "")
    .split(":")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const userPaths = [
    path.join(home, ".local", "bin"),
    path.join(home, ".bun", "bin"),
  ];
  return unique([...installPaths, ...userPaths, ...LAUNCHD_FALLBACK_PATHS]).join(":");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function findPackageCliEntry(): string | null {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const pkg = path.join(dir, "package.json");
    const cli = path.join(dir, "dist", "codealmanac.js");
    if (existsSync(pkg) && existsSync(cli)) return cli;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function unescapeXml(value: string): string {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function launchctlTarget(): string {
  return `gui/${userInfo().uid}`;
}

async function defaultExec(
  file: string,
  args: string[],
): Promise<{ stdout?: string; stderr?: string }> {
  return await execFileAsync(file, args);
}

async function cleanupLegacyHookFile(file: string): Promise<void> {
  if (!existsSync(file)) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch {
    return;
  }
  const cleaned = removeLegacyHookValues(parsed);
  if (!cleaned.changed) return;
  await writeFile(file, `${JSON.stringify(cleaned.value, null, 2)}\n`, "utf8");
}

function removeLegacyHookValues(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (Array.isArray(value)) {
    let changed = false;
    const kept: unknown[] = [];
    for (const item of value) {
      const cleaned = removeLegacyHookValues(item);
      changed ||= cleaned.changed;
      if (isLegacyHookCommand(cleaned.value)) {
        changed = true;
        continue;
      }
      if (isEmptyWrappedHook(cleaned.value)) {
        changed = true;
        continue;
      }
      kept.push(cleaned.value);
    }
    return { value: kept, changed };
  }

  if (value === null || typeof value !== "object") {
    return { value, changed: false };
  }

  const obj = value as Record<string, unknown>;
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(obj)) {
    const cleaned = removeLegacyHookValues(child);
    changed ||= cleaned.changed;
    if (isEmptyHookContainer(key, cleaned.value)) {
      changed = true;
      continue;
    }
    next[key] = cleaned.value;
  }
  return { value: next, changed };
}

function isLegacyHookCommand(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const command = (value as Record<string, unknown>).command;
  return typeof command === "string" && command.includes("almanac-capture.sh");
}

function isEmptyWrappedHook(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const hooks = (value as Record<string, unknown>).hooks;
  return Array.isArray(hooks) && hooks.length === 0;
}

function isEmptyHookContainer(key: string, value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0 &&
      (key === "SessionEnd" || key === "Stop" || key === "sessionEnd");
  }
  if (key !== "hooks") return false;
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  );
}
