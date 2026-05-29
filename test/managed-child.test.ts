import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { spawnManagedChildProcess } from "../src/process/managed-child.js";
import {
  createProcessTreeFixture,
  isProcessAlive,
  waitForDead,
  waitForPids,
} from "./helpers.js";

describe("managed child process cleanup", () => {
  it("terminates a spawned child and grandchild together", async () => {
    const dir = await createProcessTreeFixture("codealmanac-managed-child-");
    const pidFile = join(dir, "pids.txt");
    const managed = spawnManagedChildProcess(
      process.execPath,
      [join(dir, "child.js"), pidFile],
      {
        cwd: dir,
        env: process.env,
        stdio: "ignore",
      },
    );

    try {
      const pids = await waitForPids(pidFile, 2);
      expect(pids).toContain(managed.child.pid);

      await managed.terminate({ graceMs: 100 });

      await waitForDead(pids);
      for (const pid of pids) {
        expect(isProcessAlive(pid)).toBe(false);
      }
    } finally {
      await managed.terminate({ graceMs: 25 }).catch(() => undefined);
    }
  });

  it("escalates when the process tree ignores graceful termination", async () => {
    const dir = await createProcessTreeFixture("codealmanac-managed-child-ignore-");
    const pidFile = join(dir, "pids.txt");
    const managed = spawnManagedChildProcess(
      process.execPath,
      [join(dir, "child.js"), pidFile, "ignore-term"],
      {
        cwd: dir,
        env: process.env,
        stdio: "ignore",
      },
    );

    try {
      const pids = await waitForPids(pidFile, 2);
      await managed.terminate({ graceMs: 50 });

      await waitForDead(pids);
      for (const pid of pids) {
        expect(isProcessAlive(pid)).toBe(false);
      }
    } finally {
      await managed.terminate({ graceMs: 25 }).catch(() => undefined);
    }
  });

  it("terminates the process tree when an attached abort signal fires", async () => {
    const dir = await createProcessTreeFixture("codealmanac-managed-child-abort-");
    const pidFile = join(dir, "pids.txt");
    const managed = spawnManagedChildProcess(
      process.execPath,
      [join(dir, "child.js"), pidFile],
      {
        cwd: dir,
        env: process.env,
        stdio: "ignore",
      },
    );
    const controller = new AbortController();
    managed.attachAbort(controller.signal, { graceMs: 100 });

    try {
      const pids = await waitForPids(pidFile, 2);
      controller.abort();

      await waitForDead(pids);
      for (const pid of pids) {
        expect(isProcessAlive(pid)).toBe(false);
      }
    } finally {
      await managed.terminate({ graceMs: 25 }).catch(() => undefined);
    }
  });

  it("does not expose detached as a caller-controlled option", () => {
    type ManagedOptions = Parameters<typeof spawnManagedChildProcess>[2];
    type HasDetached = "detached" extends keyof ManagedOptions ? true : false;
    const hasDetached: HasDetached = false;

    expect(hasDetached).toBe(false);
  });

  it("fails clearly on Windows instead of using untested cleanup", () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { value: "win32" });

    try {
      expect(() =>
        spawnManagedChildProcess(process.execPath, ["--version"], {
          stdio: "ignore",
        }),
      ).toThrow("managed provider process cleanup is not implemented on Windows");
    } finally {
      if (platform) Object.defineProperty(process, "platform", platform);
    }
  });
});
