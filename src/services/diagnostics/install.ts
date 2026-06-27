import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { checkAgentInstructions } from "../../agent/install-targets.js";
import { detectLegacyCaptureSweepAutomation } from "../../platform/automation/legacy-capture.js";
import {
  defaultCapturePlistPath,
  defaultSyncPlistPath,
} from "../../platform/automation/tasks.js";
import {
  classifyInstallPath,
  detectInstallPath,
  probeBetterSqlite3,
  safeCheckAuth,
} from "./probes.js";
import type { Check, DiagnosticsAuthStatus, DoctorOptions } from "./types.js";

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
  checks.push(describeAuth(auth, options));

  const home = homedir();
  const plistPath = options.automationPlistPath ?? defaultSyncPlistPath(home);
  const legacyPlistPath =
    options.legacyAutomationPlistPath ?? defaultCapturePlistPath(home);
  checks.push(await describeAutomation(plistPath, legacyPlistPath, home));

  const claudeDir = options.claudeDir ?? path.join(homedir(), ".claude");
  const codexDir = options.codexDir ?? path.join(homedir(), ".codex");
  const cursorDir = options.cursorDir ?? path.join(homedir(), ".cursor");
  const windsurfDir = options.windsurfDir ?? path.join(homedir(), ".codeium", "windsurf");
  const opencodeDir = options.opencodeDir ?? path.join(homedir(), ".config", "opencode");
  checks.push(describeGuides(claudeDir));
  checks.push(await describeInstructionEntries({
    claudeDir,
    codexDir,
    cursorDir,
    windsurfDir,
    opencodeDir,
  }));

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

function describeAuth(
  auth: DiagnosticsAuthStatus,
  options: Pick<DoctorOptions, "claudeApiKeySet">,
): Check {
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
  if (options.claudeApiKeySet) {
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

async function describeAutomation(
  plistPath: string,
  legacyPlistPath: string,
  home: string,
): Promise<Check> {
  const legacy = await detectLegacyCaptureSweepAutomation({
    homeDir: home,
    plistPath: legacyPlistPath,
  });
  if (legacy !== null) {
    return {
      status: "problem",
      key: "install.automation",
      message: `legacy automation uses removed command capture sweep at ${legacy.plistPath}`,
      fix: "run: almanac migrate automation",
    };
  }
  if (existsSync(plistPath)) {
    return {
      status: "ok",
      key: "install.automation",
      message: `sync automation installed at ${plistPath}`,
    };
  }
  return {
    status: "info",
    key: "install.automation",
    message: "local sync automation not installed (expected for hosted setup)",
    fix: "run: almanac automation install  (for self-managed local updates)",
  };
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
  cursorDir: string;
  windsurfDir: string;
  opencodeDir: string;
}): Promise<Check> {
  const check = await checkAgentInstructions(dirs);
  const missing = check.missing;
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
