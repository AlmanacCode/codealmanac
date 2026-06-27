import {
  classifyInstallPath,
  detectInstallPath,
  probeBetterSqlite3,
  safeCheckAuth,
} from "./probes.js";
import type {
  Check,
  DiagnosticsAutomationStatus,
  DiagnosticsAuthStatus,
  DiagnosticsGuideStatus,
  DiagnosticsInstructionEntriesStatus,
  DoctorOptions,
} from "./types.js";

export async function gatherInstallChecks(
  options: DoctorOptions,
): Promise<Check[]> {
  const checks: Check[] = [];

  const rawPath = options.installPath ?? detectInstallPath();
  const { installPath, isEphemeral } = classifyInstallPath(rawPath);
  checks.push(describeInstallPath(installPath, isEphemeral));

  const sqlite = options.sqliteProbe ?? probeBetterSqlite3();
  checks.push({
    status: sqlite.ok ? "ok" : "problem",
    key: "install.sqlite",
    message: sqlite.ok
      ? `better-sqlite3 native binding OK (Node ${options.nodeVersion})`
      : `better-sqlite3 native binding failed: ${sqlite.summary}`,
    fix: sqlite.ok
      ? undefined
      : "run: npm rebuild better-sqlite3 (in the install directory)",
  });

  const auth = await safeCheckAuth(options.spawnCli);
  checks.push(describeAuth(auth, options));

  checks.push(describeAutomation(options.automationStatus));
  checks.push(describeGuides(options.guideStatus));
  checks.push(describeInstructionEntries(options.instructionEntriesStatus));

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

function describeAutomation(status: DiagnosticsAutomationStatus): Check {
  if (status.status === "legacy") {
    return {
      status: "problem",
      key: "install.automation",
      message: `legacy automation uses removed command capture sweep at ${status.plistPath}`,
      fix: "run: almanac migrate automation",
    };
  }
  if (status.status === "installed") {
    return {
      status: "ok",
      key: "install.automation",
      message: `sync automation installed at ${status.plistPath}`,
    };
  }
  return {
    status: "info",
    key: "install.automation",
    message: "local sync automation not installed (expected for hosted setup)",
    fix: "run: almanac automation install  (for self-managed local updates)",
  };
}

function describeGuides(status: DiagnosticsGuideStatus): Check {
  if (status.status === "installed") {
    return {
      status: "ok",
      key: "install.guides",
      message: `Agent guides installed (${status.installedNames.join(", ")})`,
    };
  }
  return {
    status: "problem",
    key: "install.guides",
    message: `Agent guides missing (${status.missingNames.join(", ")})`,
    fix: "run: almanac setup --yes",
  };
}

function describeInstructionEntries(
  status: DiagnosticsInstructionEntriesStatus,
): Check {
  return {
    status: status.status === "present" ? "ok" : "problem",
    key: "install.import",
    message: status.status === "present"
      ? "Agent instruction entries present"
      : `Agent instruction entries missing (${status.missing.join(", ")})`,
    fix: status.status === "present" ? undefined : "run: almanac setup --yes",
  };
}
