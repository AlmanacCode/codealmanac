import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { run } from "../src/cli.js";
import { runCaptureStatus } from "../src/commands/captureStatus.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

describe("almanac capture status", () => {
  it("reports no capture jobs when the wiki has no run records", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "empty-status");
      await scaffoldWiki(repo);

      const out = await runCaptureStatus({ cwd: repo });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toContain("Capture jobs");
      expect(out.stdout).toContain("No capture jobs found.");
    });
  });

  it("renders running and finished capture records", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "status-records");
      const almanacDir = join(repo, ".almanac");
      await mkdir(almanacDir, { recursive: true });

      await writeFile(
        join(almanacDir, ".capture-sess_running.state.json"),
        JSON.stringify({
          version: 1,
          kind: "capture",
          status: "running",
          sessionId: "sess_running",
          repoRoot: repo,
          pid: 12345,
          model: "claude-sonnet-4-6",
          transcriptPath: join(home, "sess_running.jsonl"),
          startedAt: "2026-05-06T21:00:00.000Z",
          logPath: join(almanacDir, ".capture-sess_running.log"),
          jsonlPath: join(almanacDir, ".capture-sess_running.jsonl"),
        }),
        "utf8",
      );
      await writeFile(
        join(almanacDir, ".capture-sess_done.state.json"),
        JSON.stringify({
          version: 1,
          kind: "capture",
          status: "done",
          sessionId: "sess_done",
          repoRoot: repo,
          pid: 99999,
          model: "claude-opus-4-6",
          transcriptPath: join(home, "sess_done.jsonl"),
          startedAt: "2026-05-06T20:58:00.000Z",
          finishedAt: "2026-05-06T20:59:04.000Z",
          durationMs: 64000,
          logPath: join(almanacDir, ".capture-sess_done.log"),
          jsonlPath: join(almanacDir, ".capture-sess_done.jsonl"),
          summary: {
            created: 1,
            updated: 2,
            archived: 0,
            cost: 0.07,
            turns: 18,
          },
        }),
        "utf8",
      );

      const out = await runCaptureStatus({
        cwd: repo,
        now: () => new Date("2026-05-06T21:03:12.000Z"),
        isPidAlive: (pid) => pid === 12345,
      });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toContain("running  sess_running  claude-sonnet-4-6  3m12s");
      expect(out.stdout).toContain("done     sess_done     claude-opus-4-6    1m04s  2 updated, 1 created");
      expect(out.stdout).toContain("log: .almanac/.capture-sess_running.log");
    });
  });

  it("emits JSON for scripts", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "status-json");
      const almanacDir = join(repo, ".almanac");
      await mkdir(almanacDir, { recursive: true });
      await writeFile(
        join(almanacDir, ".capture-sess_json.state.json"),
        JSON.stringify({
          version: 1,
          kind: "capture",
          status: "running",
          sessionId: "sess_json",
          repoRoot: repo,
          pid: 12345,
          model: "claude-sonnet-4-6",
          transcriptPath: join(home, "sess_json.jsonl"),
          startedAt: "2026-05-06T21:00:00.000Z",
          logPath: join(almanacDir, ".capture-sess_json.log"),
          jsonlPath: join(almanacDir, ".capture-sess_json.jsonl"),
        }),
        "utf8",
      );

      const out = await runCaptureStatus({
        cwd: repo,
        json: true,
        now: () => new Date("2026-05-06T21:00:05.000Z"),
        isPidAlive: () => true,
      });

      const parsed = JSON.parse(out.stdout) as {
        repo: string;
        captures: Array<{ sessionId: string; status: string; elapsedMs: number }>;
      };

      expect(parsed.repo).toBe(repo);
      expect(parsed.captures).toHaveLength(1);
      expect(parsed.captures[0]).toMatchObject({
        sessionId: "sess_json",
        status: "running",
        elapsedMs: 5000,
      });
    });
  });

  it("marks a running record stale when its process is gone", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "stale-status");
      const almanacDir = join(repo, ".almanac");
      await mkdir(almanacDir, { recursive: true });
      await writeFile(
        join(almanacDir, ".capture-sess_stale.state.json"),
        JSON.stringify({
          version: 1,
          kind: "capture",
          status: "running",
          sessionId: "sess_stale",
          repoRoot: repo,
          pid: 12345,
          model: "claude-sonnet-4-6",
          transcriptPath: join(home, "sess_stale.jsonl"),
          startedAt: "2026-05-06T21:00:00.000Z",
          logPath: join(almanacDir, ".capture-sess_stale.log"),
          jsonlPath: join(almanacDir, ".capture-sess_stale.jsonl"),
        }),
        "utf8",
      );

      const out = await runCaptureStatus({
        cwd: repo,
        now: () => new Date("2026-05-06T21:01:00.000Z"),
        isPidAlive: () => false,
      });

      expect(out.stdout).toContain("stale    sess_stale");
      expect(out.stdout).toContain("process ended without a final status");
    });
  });
});

describe("capture status CLI aliases", () => {
  it("routes alm ps and almanac c status to jobs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cli-aliases");
      await scaffoldWiki(repo);
      const originalCwd = process.cwd();
      const originalStdout = process.stdout.write.bind(process.stdout);
      const originalStderr = process.stderr.write.bind(process.stderr);
      const captured: string[] = [];
      const stderr: string[] = [];
      process.chdir(repo);
      process.stdout.write = ((chunk: unknown) => {
        captured.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString());
        return true;
      }) as typeof process.stdout.write;
      process.stderr.write = ((chunk: unknown) => {
        stderr.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString());
        return true;
      }) as typeof process.stderr.write;

      try {
        await run(["/abs/node", "/abs/path/alm", "ps"], {
          announceUpdate: () => {},
          scheduleUpdateCheck: () => {},
          runInternalUpdateCheck: async () => {},
        });
        await run(["/abs/node", "/abs/path/almanac", "c", "status"], {
          announceUpdate: () => {},
          scheduleUpdateCheck: () => {},
          runInternalUpdateCheck: async () => {},
        });
      } finally {
        process.stdout.write = originalStdout;
        process.stderr.write = originalStderr;
        process.chdir(originalCwd);
      }

      expect(captured.join("")).toContain("No jobs found.");
      expect(captured.join("").match(/Jobs/g)).toHaveLength(2);
      expect(stderr.join("")).toContain("almanac ps");
      expect(stderr.join("")).toContain("almanac capture status");
      expect(stderr.join("")).toContain("deprecated");
    });
  });

  it("exposes alm as a package binary alias", async () => {
    const pkg = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as {
      bin: Record<string, string>;
    };

    expect(pkg.bin.alm).toBe("./dist/codealmanac.js");
  });
});
