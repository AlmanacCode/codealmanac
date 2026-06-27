import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import type {
  DiagnosticsSpawnCliFn,
  DiagnosticsSpawnedProcess,
  DoctorReport,
} from "../src/services/diagnostics/index.js";
import { formatReport } from "../src/cli/commands/doctor/format.js";
import {
  runDoctor as runDoctorCommand,
  type DoctorOptions,
} from "../src/cli/commands/doctor/index.js";
import {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
} from "../src/cli/commands/setup/index.js";
import { IMPORT_LINE } from "../src/cli/commands/setup/index.js";
import {
  makeRepo,
  scaffoldWiki,
  withTempHome,
  writePage,
} from "./helpers.js";

function fakeSpawnCli(stdout: string): DiagnosticsSpawnCliFn {
  return (): DiagnosticsSpawnedProcess => {
    const stdoutCbs: ((d: string) => void)[] = [];
    const closeCbs: ((c: number | null) => void)[] = [];
    queueMicrotask(() => {
      for (const cb of stdoutCbs) cb(stdout);
      for (const cb of closeCbs) cb(0);
    });
    return {
      stdout: {
        on: (event, cb) => {
          if (event === "data") stdoutCbs.push(cb as (d: string) => void);
        },
      },
      stderr: { on: () => {} },
      on: (event, cb) => {
        if (event === "close") closeCbs.push(cb as (c: number | null) => void);
      },
      kill: () => {},
    };
  };
}

const LOGGED_IN_STDOUT = JSON.stringify({
  loggedIn: true,
  email: "user@example.com",
  subscriptionType: "Pro",
});
const LOGGED_OUT_STDOUT = JSON.stringify({ loggedIn: false });
const SQLITE_OK = { ok: true, summary: "native binding loads cleanly" };

function runDoctor(
  options: Omit<DoctorOptions, "claudeApiKeySet"> & {
    claudeApiKeySet?: boolean;
  },
) {
  return runDoctorCommand({
    claudeApiKeySet: false,
    ...options,
  });
}

async function scaffoldHealthyInstall(home: string): Promise<{
  claudeDir: string;
  plistPath: string;
}> {
  const claudeDir = join(home, ".claude");
  const plistPath = join(home, "Library", "LaunchAgents", "com.codealmanac.sync.plist");
  await mkdir(claudeDir, { recursive: true });
  await mkdir(dirname(plistPath), { recursive: true });
  await writeFile(plistPath, "<plist></plist>\n", "utf8");
  await writeFile(join(claudeDir, "almanac.md"), "# mini guide\n", "utf8");
  await writeFile(
    join(claudeDir, "almanac-reference.md"),
    "# reference guide\n",
    "utf8",
  );
  await writeFile(join(claudeDir, "CLAUDE.md"), `# CLAUDE.md\n\n${IMPORT_LINE}\n`, "utf8");
  await mkdir(join(home, ".codex"), { recursive: true });
  await writeFile(
    join(home, ".codex", "AGENTS.md"),
    `${CODEX_INSTRUCTIONS_START}\n# mini guide\n${CODEX_INSTRUCTIONS_END}\n`,
    "utf8",
  );
  await mkdir(join(home, ".cursor", "rules", "almanac"), { recursive: true });
  await writeFile(
    join(home, ".cursor", "rules", "almanac", "RULE.md"),
    "---\nalwaysApply: true\n---\n\n# mini guide\n",
    "utf8",
  );
  await mkdir(join(home, ".codeium", "windsurf", "memories"), { recursive: true });
  await writeFile(
    join(home, ".codeium", "windsurf", "memories", "global_rules.md"),
    "<!-- almanac:start -->\n# mini guide\n<!-- almanac:end -->\n",
    "utf8",
  );
  await mkdir(join(home, ".config", "opencode"), { recursive: true });
  await writeFile(
    join(home, ".config", "opencode", "AGENTS.md"),
    "<!-- almanac:start -->\n# mini guide\n<!-- almanac:end -->\n",
    "utf8",
  );
  return { claudeDir, plistPath };
}

describe("almanac doctor", () => {
  it("formatter stays plain by default and colors only when requested", () => {
    const report: DoctorReport = {
      version: "0.1.3",
      install: [
        {
          status: "ok",
          key: "install.path",
          message: "install path ok",
          fix: "run: almanac doctor",
        },
      ],
      agents: [],
      updates: [],
      wiki: [],
    };

    const plain = formatReport(report);
    const colored = formatReport(report, { color: true });

    expect(plain).not.toContain("\x1b[");
    expect(colored).toContain("\x1b[");
  });

  it("emits stable install keys in JSON mode", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyInstall(home);
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a-page", "---\ntopics: [t]\n---\n\n# A\n\nbody.\n");

      const r = await runDoctor({
        cwd: repo,
        json: true,
        automationPlistPath: env.plistPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake/path/codealmanac",
        versionOverride: "0.1.3",
      });

      expect(r.exitCode).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.version).toBe("0.1.3");
      expect(parsed.install.map((c: { key: string }) => c.key)).toEqual([
        "install.path",
        "install.sqlite",
        "install.auth",
        "install.automation",
        "install.guides",
        "install.import",
      ]);
      for (const check of parsed.install) {
        expect(check.status).toBe("ok");
      }
    });
  });

  it("reports missing local automation as optional for hosted setup", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyInstall(home);
      const missingPlist = join(home, "missing.plist");

      const r = await runDoctor({
        cwd: home,
        json: true,
        automationPlistPath: missingPlist,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });

      const parsed = JSON.parse(r.stdout);
      const automation = parsed.install.find(
        (c: { key: string }) => c.key === "install.automation",
      );
      expect(automation.status).toBe("info");
      expect(automation.message).toContain("expected for hosted setup");
      expect(automation.fix).toMatch(/almanac automation install/);
    });
  });

  it("flags legacy capture sweep automation and suggests migration", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyInstall(home);
      const legacyPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.capture-sweep.plist",
      );
      await mkdir(dirname(legacyPlistPath), { recursive: true });
      await writeFile(
        legacyPlistPath,
        `<plist version="1.0">
<dict>
  <key>ProgramArguments</key>
  <array>
    <string>almanac</string>
    <string>capture</string>
    <string>sweep</string>
  </array>
</dict>
</plist>
`,
        "utf8",
      );

      const r = await runDoctor({
        cwd: home,
        json: true,
        automationPlistPath: env.plistPath,
        legacyAutomationPlistPath: legacyPlistPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });

      const parsed = JSON.parse(r.stdout);
      const automation = parsed.install.find(
        (c: { key: string }) => c.key === "install.automation",
      );
      expect(automation.status).toBe("problem");
      expect(automation.message).toContain(
        "legacy automation uses removed command capture sweep",
      );
      expect(automation.fix).toBe("run: almanac migrate automation");
    });
  });

  it("reports auth problems without hiding other install checks", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyInstall(home);
      const r = await runDoctor({
        cwd: home,
        json: true,
        automationPlistPath: env.plistPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_OUT_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });

      const parsed = JSON.parse(r.stdout);
      const auth = parsed.install.find(
        (c: { key: string }) => c.key === "install.auth",
      );
      const automation = parsed.install.find(
        (c: { key: string }) => c.key === "install.automation",
      );
      expect(auth.status).toBe("problem");
      expect(automation.status).toBe("ok");
    });
  });

  it("accepts ANTHROPIC_API_KEY presence from the caller", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyInstall(home);

      const r = await runDoctor({
        cwd: home,
        claudeApiKeySet: true,
        json: true,
        automationPlistPath: env.plistPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_OUT_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });

      const parsed = JSON.parse(r.stdout);
      const auth = parsed.install.find(
        (c: { key: string }) => c.key === "install.auth",
      );
      expect(auth.status).toBe("ok");
      expect(auth.message).toBe("claude auth: ANTHROPIC_API_KEY set");
    });
  });
});
