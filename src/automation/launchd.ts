import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const LAUNCHD_FALLBACK_PATHS = [
  "/usr/local/bin",
  "/opt/homebrew/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
];

export interface LaunchdJobDefinition {
  label: string;
  plistPath: string;
  programArguments: string[];
  intervalSeconds: number;
  environmentVariables: Record<string, string>;
  stdoutPath: string;
  stderrPath: string;
  workingDirectory?: string;
}

export type ExecFn = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

export interface LaunchdPlistStatus {
  installed: boolean;
  plistPath: string;
  contents: string | null;
  intervalSeconds: number | null;
}

export function launchdTarget(): string {
  return `gui/${userInfo().uid}`;
}

export function automationLogsDir(home: string = homedir()): string {
  return path.join(home, ".almanac", "logs");
}

export function buildLaunchPath(home: string, envPath: string | undefined): string {
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

export async function ensureLaunchdDirs(jobs: LaunchdJobDefinition[]): Promise<void> {
  await Promise.all([
    ...jobs.map((job) => mkdir(path.dirname(job.plistPath), { recursive: true })),
    ...unique(jobs.flatMap((job) => [path.dirname(job.stdoutPath), path.dirname(job.stderrPath)]))
      .map((dir) => mkdir(dir, { recursive: true })),
  ]);
}

export async function writeLaunchdPlist(job: LaunchdJobDefinition): Promise<void> {
  await writeFile(job.plistPath, renderLaunchdPlist(job), "utf8");
}

export async function bootstrapLaunchdJob(
  plistPath: string,
  exec: ExecFn = defaultExec,
): Promise<void> {
  const target = launchdTarget();
  try {
    await exec("launchctl", ["bootout", target, plistPath]);
  } catch {
    // Not loaded yet is fine; bootstrap below is the authoritative install.
  }
  await exec("launchctl", ["bootstrap", target, plistPath]);
}

export async function removeLaunchdJob(
  plistPath: string,
  exec: ExecFn = defaultExec,
): Promise<boolean> {
  if (!existsSync(plistPath)) return false;
  try {
    await exec("launchctl", ["bootout", launchdTarget(), plistPath]);
  } catch {
    // Already unloaded is still a successful uninstall.
  }
  await rm(plistPath, { force: true });
  return true;
}

export async function readLaunchdPlistStatus(
  plistPath: string,
): Promise<LaunchdPlistStatus> {
  if (!existsSync(plistPath)) {
    return { installed: false, plistPath, contents: null, intervalSeconds: null };
  }
  const contents = await readFile(plistPath, "utf8");
  return {
    installed: true,
    plistPath,
    contents,
    intervalSeconds: readStartInterval(contents),
  };
}

export function readProgramArgumentAfter(contents: string, flag: string): string | null {
  const values = [...contents.matchAll(/<string>([^<]*)<\/string>/g)]
    .map((match) => unescapeXml(match[1] ?? ""));
  const index = values.indexOf(flag);
  return index >= 0 ? values[index + 1] ?? null : null;
}

function renderLaunchdPlist(args: LaunchdJobDefinition): string {
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
  <string>${escapeXml(args.label)}</string>
  <key>ProgramArguments</key>
  <array>
${programArguments}
  </array>
  <key>StartInterval</key>
  <integer>${args.intervalSeconds}</integer>
${args.workingDirectory !== undefined
    ? `  <key>WorkingDirectory</key>\n  <string>${escapeXml(args.workingDirectory)}</string>\n`
    : ""}  <key>EnvironmentVariables</key>
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

function readStartInterval(contents: string): number | null {
  const value = contents.match(/<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/)?.[1];
  return value === undefined ? null : Number(value);
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

async function defaultExec(
  file: string,
  args: string[],
): Promise<{ stdout?: string; stderr?: string }> {
  return await execFileAsync(file, args);
}
