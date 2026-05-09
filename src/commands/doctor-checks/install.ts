import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { ClaudeAuthStatus } from "../../agent/providers/claude/index.js";
import {
  hasCodexInstructions,
  resolveCodexAgentsPath,
} from "../../agent/providers/codex-instructions.js";
import {
  IMPORT_LINE,
} from "../setup.js";
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

  const settingsPath =
    options.settingsPath ?? path.join(homedir(), ".claude", "settings.json");
  checks.push(await describeHook(settingsPath));

  const claudeDir = options.claudeDir ?? path.join(homedir(), ".claude");
  checks.push(describeGuides(claudeDir));
  checks.push(await describeImportLine(claudeDir));
  const codexDir = options.codexDir ?? path.join(homedir(), ".codex");
  checks.push(await describeCodexInstructions(codexDir));

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
      message: "could not detect codealmanac install path",
      fix: "reinstall with: npm install -g codealmanac",
    };
  }
  return {
    status: isEphemeral ? "info" : "ok",
    key: "install.path",
    message: isEphemeral
      ? `codealmanac running from ephemeral npx location: ${installPath}`
      : `codealmanac installed at ${installPath}`,
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

async function describeHook(settingsPath: string): Promise<Check> {
  if (!existsSync(settingsPath)) {
    return {
      status: "problem",
      key: "install.hook",
      message: "SessionEnd hook not installed",
      fix: "run: almanac setup --yes",
    };
  }
  try {
    const raw = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as {
      hooks?: {
        SessionEnd?: {
          command?: string;
          hooks?: { command?: string }[];
        }[];
      };
    };
    const entries = parsed.hooks?.SessionEnd ?? [];
    const found = entries.some((e) => {
      if (
        typeof e?.command === "string" &&
        e.command.endsWith("almanac-capture.sh")
      ) {
        return true;
      }
      if (Array.isArray(e?.hooks)) {
        return e.hooks.some(
          (h) =>
            typeof h?.command === "string" &&
            h.command.endsWith("almanac-capture.sh"),
        );
      }
      return false;
    });
    if (!found) {
      return {
        status: "problem",
        key: "install.hook",
        message: "SessionEnd hook not installed",
        fix: "run: almanac setup --yes",
      };
    }
    return {
      status: "ok",
      key: "install.hook",
      message: `SessionEnd hook installed at ${settingsPath}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "problem",
      key: "install.hook",
      message: `could not read ${settingsPath}: ${msg}`,
      fix: "check the file for malformed JSON",
    };
  }
}

function describeGuides(claudeDir: string): Check {
  const mini = path.join(claudeDir, "codealmanac.md");
  const ref = path.join(claudeDir, "codealmanac-reference.md");
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
    haveMini ? null : "codealmanac.md",
    haveRef ? null : "codealmanac-reference.md",
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

async function describeCodexInstructions(codexDir: string): Promise<Check> {
  const agentsFile = await resolveCodexAgentsPath(codexDir);
  if (!existsSync(agentsFile)) {
    return {
      status: "problem",
      key: "install.codexInstructions",
      message: `Codex AGENTS instructions missing (${path.basename(agentsFile)} not found)`,
      fix: "run: almanac setup --yes",
    };
  }
  try {
    const contents = await readFile(agentsFile, "utf8");
    if (hasCodexInstructions(contents)) {
      return {
        status: "ok",
        key: "install.codexInstructions",
        message: `Codex AGENTS instructions present (${path.basename(agentsFile)})`,
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "problem",
      key: "install.codexInstructions",
      message: `could not read ${agentsFile}: ${msg}`,
    };
  }

  return {
    status: "problem",
    key: "install.codexInstructions",
    message: `Codex AGENTS instructions missing (${path.basename(agentsFile)})`,
    fix: "run: almanac setup --yes",
  };
}
