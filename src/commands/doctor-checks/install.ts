import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import {
  codexInstructionBlockPresent,
  hasClaudeImportLine,
} from "../../agent/install-targets.js";
import type { ClaudeAuthStatus } from "../../agent/readiness/providers/claude/index.js";
import { defaultPlistPath, windowsManifestPath } from "../automation.js";
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
    platform: options.platform ?? process.platform,
    home: options.automationHome ?? homedir(),
    plistPath: options.automationPlistPath,
    windowsTaskExists: options.windowsTaskExists ?? defaultWindowsTaskExists,
  }));

  const claudeDir = options.claudeDir ?? path.join(homedir(), ".claude");
  const codexDir = options.codexDir ?? path.join(homedir(), ".codex");
  checks.push(describeGuides(claudeDir));
  checks.push(await describeInstructionEntries({ claudeDir, codexDir }));

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
  platform: NodeJS.Platform;
  home: string;
  plistPath?: string;
  windowsTaskExists: (taskName: string) => boolean;
}): Check {
  if (args.platform === "win32") {
    return describeWindowsAutomation(args.home, args.windowsTaskExists);
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

function describeWindowsAutomation(
  home: string,
  windowsTaskExists: (taskName: string) => boolean,
): Check {
  const manifestPath = windowsManifestPath("capture", home);
  const taskName = readWindowsTaskName(manifestPath);
  if (taskName === null) {
    return {
      status: "problem",
      key: "install.automation",
      message: existsSync(manifestPath)
        ? `auto-capture automation manifest is invalid (${manifestPath})`
        : "auto-capture automation not installed",
      fix: "run: almanac automation install",
    };
  }
  if (!windowsTaskExists(taskName)) {
    return {
      status: "problem",
      key: "install.automation",
      message: `auto-capture manifest exists but the Windows Task Scheduler task is missing (${taskName})`,
      fix: "run: almanac automation install",
    };
  }
  return {
    status: "ok",
    key: "install.automation",
    message: `auto-capture automation installed with Windows Task Scheduler (${taskName})`,
  };
}

function readWindowsTaskName(manifestPath: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      scheduler?: unknown;
      taskName?: unknown;
    };
    if (parsed.scheduler === "windows-task-scheduler" && typeof parsed.taskName === "string") {
      return parsed.taskName;
    }
  } catch {
    return null;
  }
  return null;
}

function defaultWindowsTaskExists(taskName: string): boolean {
  if (process.platform !== "win32") return true;
  const result = spawnSync("schtasks", ["/Query", "/TN", taskName], {
    encoding: "utf8",
  });
  return result.status === 0;
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

async function describeInstructionEntries(dirs: {
  claudeDir: string;
  codexDir: string;
}): Promise<Check> {
  const missing: string[] = [];
  const claudeMd = path.join(dirs.claudeDir, "CLAUDE.md");
  if (!existsSync(claudeMd)) {
    missing.push("CLAUDE.md import");
  } else {
    try {
      const { readFile } = await import("node:fs/promises");
      if (!hasClaudeImportLine(await readFile(claudeMd, "utf8"))) {
        missing.push("CLAUDE.md import");
      }
    } catch {
      missing.push("CLAUDE.md import");
    }
  }
  if (!await codexInstructionBlockPresent(dirs.codexDir)) {
    missing.push("Codex AGENTS.md instructions");
  }
  const ok = missing.length === 0;
  return {
    status: ok ? "ok" : "problem",
    key: "install.import",
    message: ok
      ? "Agent instruction entries present"
      : `Agent instruction entries missing (${missing.join(", ")})`,
    fix: ok ? undefined : "run: almanac setup --yes",
  };
}
