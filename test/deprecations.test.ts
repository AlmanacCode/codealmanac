import { describe, expect, it } from "vitest";

import { run } from "../src/cli.js";
import { readConfig } from "../src/update/config.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

async function captureCli(
  argv: string[],
  cwd?: string,
): Promise<{ stdout: string; stderr: string }> {
  const originalCwd = process.cwd();
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  const stdout: string[] = [];
  const stderr: string[] = [];
  if (cwd !== undefined) process.chdir(cwd);
  process.stdout.write = ((chunk: unknown) => {
    stdout.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString());
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown) => {
    stderr.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString());
    return true;
  }) as typeof process.stderr.write;

  try {
    await run(argv, {
      announceUpdate: () => {},
      scheduleUpdateCheck: () => {},
      runInternalUpdateCheck: async () => {},
    });
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    if (cwd !== undefined) process.chdir(originalCwd);
  }

  return { stdout: stdout.join(""), stderr: stderr.join("") };
}

describe("deprecated CLI surfaces", () => {
  it("warns for legacy agent setters but not canonical agents commands", async () => {
    await withTempHome(async () => {
      const legacyDefault = await captureCli([
        "/abs/node",
        "/abs/path/almanac",
        "set",
        "default-agent",
        "codex",
      ]);
      expect(legacyDefault.stderr).toContain("deprecated");
      expect(legacyDefault.stderr).toContain("almanac agents use <provider>");

      const legacyModel = await captureCli([
        "/abs/node",
        "/abs/path/almanac",
        "set",
        "model",
        "claude",
        "claude-opus-4-6",
      ]);
      expect(legacyModel.stderr).toContain("deprecated");
      expect(legacyModel.stderr).toContain("almanac agents model <provider> <model>");

      const canonical = await captureCli([
        "/abs/node",
        "/abs/path/almanac",
        "agents",
        "use",
        "codex",
      ]);
      expect(canonical.stderr).not.toContain("deprecated");

      const config = await readConfig();
      expect(config.agent.default).toBe("codex");
      expect(config.agent.models.claude).toBe("claude-opus-4-6");
    });
  });

  it("warns for ps but not capture status", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "capture-status-deprecation");
      await scaffoldWiki(repo);

      const legacy = await captureCli([
        "/abs/node",
        "/abs/path/almanac",
        "ps",
      ], repo);
      expect(legacy.stdout).toContain("No capture jobs found.");
      expect(legacy.stderr).toContain("deprecated");
      expect(legacy.stderr).toContain("almanac capture status");

      const canonical = await captureCli([
        "/abs/node",
        "/abs/path/almanac",
        "capture",
        "status",
      ], repo);
      expect(canonical.stdout).toContain("No capture jobs found.");
      expect(canonical.stderr).not.toContain("deprecated");
    });
  });

  it("warns for show --raw but not show --body", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "show-raw-deprecation");
      await scaffoldWiki(repo);
      await writePage(repo, "checkout-flow", "---\ntitle: Checkout Flow\n---\n\n# Checkout Flow\n");

      const legacy = await captureCli([
        "/abs/node",
        "/abs/path/almanac",
        "show",
        "checkout-flow",
        "--raw",
      ], repo);
      const canonical = await captureCli([
        "/abs/node",
        "/abs/path/almanac",
        "show",
        "checkout-flow",
        "--body",
      ], repo);

      expect(legacy.stdout).toBe(canonical.stdout);
      expect(legacy.stderr).toContain("deprecated");
      expect(legacy.stderr).toContain("almanac show <slug> --body");
      expect(canonical.stderr).not.toContain("deprecated");
    });
  });
});
