import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { ClaudeAuthStatus } from "../../agent/providers/claude/index.js";
import {
  defaultPlistPath,
  defaultWindowsCaptureManifestPath,
} from "../automation.js";
import { IMPORT_LINE } from "../setup.js";
import {
  classifyInstallPath,
  detectInstallPath,
  probeBetterSqlite3,
  safeCheckAuth,
} from "./probes.js";
import type { Check, DoctorOptions } from "./types.js";

export async function gatherInstallChecks(
  options: DoctorOptions,
): Promise<Check[]> {
  const checks: Check[] = [];

  const rawPath = options.installPath ?? detectInstallPath();
  const { installPath, isEphemeral } = classifyInstallPath(rawPath);
  checks.push(describeInstallPath(installPath, isEphemeral));

  const nodeVersion = options.nodeVersion ?? process.version;
  const sqlite = options.sqliteProbe ?? probeBetterSqlite3();
  checks.push({
    status: sqlite.ok ? "ok" : "problem",
    key: "install.sqlite",
    message: sqlite.ok
      ? `better-sqlite3 native binding OK (Node ${nodeVersion})`
      : `better-sqlite3 native binding failed: ${sqlite.summary}`,
    fix: sqlite.ok
      ? undefined
      : "run: npm rebuild better-sqlite3 (in the install directory)",
  });

  const auth = await safeCheckAuth(options.spawnCli);
  checks.push(describeAuth(auth));

  checks.push(describeAutomation({
    home: homedir(),
    platform: options.platform ?? process.platform,
    plistPath: options.automationPlistPath,
  }));

  const claudeDir = options.claudeDir ?? path.join(homedir(), ".claude");
  checks.push(describeGuides(claudeDir));
  checks.push(await describeImportLine(claudeDir));

  return checks;
}

function describeInstallPath(
  installPath: string | null,
  isEphemeral: boolean,
): Check {
  if (installPath === null) {
    return {
      status: "problem",
      key: "install.path",
      message: "could not detect Almanac install path",
      fix: "reinstall with: npm install -g codealmanac",
    };
  }
  return {
    status: isEphemeral ? "info" : "ok",
    key: "install.path",
    message: isEphemeral
      ? `Almanac running from ephemeral npx location: ${installPath}`
      : `Almanac installed at ${installPath}`,
    fix: isEphemeral
      ? "run: npm install -g codealmanac  (to make the install permanent)"
      : undefined,
  };
}

function describeAuth(auth: ClaudeAuthStatus): Check {
  if (auth.loggedIn) {
    if (auth.authMethod === "apiKey") {
      return {
        status: "ok",
        key: "install.auth",
        message: "claude auth: ANTHROPIC_API_KEY set",
      };
    }
    const who = auth.email ?? "Claude account";
    const plan =
      auth.subscriptionType !== undefined
        ? ` (${auth.subscriptionType} subscription)`
        : "";
    return {
      status: "ok",
      key: "install.auth",
      message: `claude auth: ${who}${plan}`,
    };
  }
  if (
    process.env.ANTHROPIC_API_KEY !== undefined &&
    process.env.ANTHROPIC_API_KEY.length > 0
  ) {
    return {
      status: "ok",
      key: "install.auth",
      message: "claude auth: ANTHROPIC_API_KEY set",
    };
  }
  return {
    status: "problem",
    key: "install.auth",
    message: "claude auth: not signed in",
    fix: "run: claude auth login --claudeai  (or export ANTHROPIC_API_KEY)",
  };
}

function describeAutomation(args: {
  home: string;
  platform: NodeJS.Platform;
  plistPath?: string;
}): Check {
  if (args.platform === "win32") {
    const manifestPath = defaultWindowsCaptureManifestPath(args.home);
    if (existsSync(manifestPath)) {
      const taskName = readWindowsTaskName(manifestPath);
      return {
        status: "ok",
        key: "install.automation",
        message: `auto-capture automation installed with Windows Task Scheduler (${taskName ?? manifestPath})`,
      };
    }
    return {
      status: "problem",
      key: "install.automation",
      message: "auto-capture automation not installed",
      fix: "run: almanac automation install",
    };
  }
  const plistPath = args.plistPath ?? defaultPlistPath(args.home);
  if (existsSync(plistPath)) {
    return {
      status: "ok",
      key: "install.automation",
      message: `auto-capture automation installed at ${plistPath}`,
    };
  }
  return {
    status: "problem",
    key: "install.automation",
    message: "auto-capture automation not installed",
    fix: "run: almanac automation install",
  };
}

function readWindowsTaskName(manifestPath: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as { taskName?: unknown };
    return typeof parsed.taskName === "string" ? parsed.taskName : null;
  } catch {
    return null;
  }
}

function describeGuides(claudeDir: string): Check {
  const mini = path.join(claudeDir, "almanac.md");
  const ref = path.join(claudeDir, "almanac-reference.md");
  const haveMini = existsSync(mini);
  const haveRef = existsSync(ref);
  if (haveMini && haveRef) {
    return {
      status: "ok",
      key: "install.guides",
      message: `Agent guides installed (${path.basename(mini)}, ${path.basename(ref)})`,
    };
  }
  const missing = [
    haveMini ? null : "almanac.md",
    haveRef ? null : "almanac-reference.md",
  ].filter((s): s is string => s !== null);
  return {
    status: "problem",
    key: "install.guides",
    message: `Agent guides missing (${missing.join(", ")})`,
    fix: "run: almanac setup --yes",
  };
}

async function describeImportLine(claudeDir: string): Promise<Check> {
  const claudeMd = path.join(claudeDir, "CLAUDE.md");
  if (!existsSync(claudeMd)) {
    return {
      status: "problem",
      key: "install.import",
      message: "CLAUDE.md import not present (no ~/.claude/CLAUDE.md)",
      fix: "run: almanac setup --yes",
    };
  }
  try {
    const contents = await readFile(claudeMd, "utf8");
    const lines = contents.split(/\r?\n/).map((l) => l.trim());
    const present = lines.some((line) => {
      if (line === IMPORT_LINE) return true;
      if (!line.startsWith(IMPORT_LINE)) return false;
      const next = line[IMPORT_LINE.length];
      return next === " " || next === "\t";
    });
    if (present) {
      return {
        status: "ok",
        key: "install.import",
        message: "CLAUDE.md import present",
      };
    }
    return {
      status: "problem",
      key: "install.import",
      message: "CLAUDE.md import line missing",
      fix: "run: almanac setup --yes",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "problem",
      key: "install.import",
      message: `could not read ${claudeMd}: ${msg}`,
    };
  }
}
