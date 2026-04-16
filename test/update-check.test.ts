import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { checkForUpdate } from "../src/update/check.js";
import { writeState } from "../src/update/state.js";
import { withTempHome } from "./helpers.js";

/**
 * Unit tests for the registry-check module. Every test injects `fetchFn`
 * and `statePath` so we never hit the real registry and never touch the
 * real `~/.almanac/update-state.json`.
 */

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function pathIn(home: string): string {
  return join(home, ".almanac", "update-state.json");
}

describe("checkForUpdate", () => {
  it("writes a fresh state file on first run", async () => {
    await withTempHome(async (home) => {
      const statePath = pathIn(home);
      const fetchFn = vi
        .fn()
        .mockResolvedValue(makeJsonResponse({ "dist-tags": { latest: "0.1.6" } }));
      const now = 1_700_000_000;

      const result = await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
        now: () => now,
      });

      expect(result.fetched).toBe(true);
      expect(result.fetchFailed).toBe(false);
      expect(result.state.latest_version).toBe("0.1.6");
      expect(result.state.installed_version).toBe("0.1.5");
      expect(result.state.last_check_at).toBe(now);

      const raw = await readFile(statePath, "utf8");
      const parsed = JSON.parse(raw);
      expect(parsed.latest_version).toBe("0.1.6");
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(fetchFn.mock.calls[0]![0]).toMatch(
        /registry\.npmjs\.org\/codealmanac/,
      );
    });
  });

  it("skips the fetch when the last check is within the cache window", async () => {
    await withTempHome(async (home) => {
      const statePath = pathIn(home);
      // Seed state with a check 1 hour ago (within the default 24h window).
      const now = 1_700_000_000;
      await writeState(
        {
          last_check_at: now - 3600,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      const fetchFn = vi.fn();

      const result = await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
        now: () => now,
      });

      expect(result.fetched).toBe(false);
      expect(result.state.latest_version).toBe("0.1.6");
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  it("refetches after the cache window expires", async () => {
    await withTempHome(async (home) => {
      const statePath = pathIn(home);
      const now = 1_700_000_000;
      await writeState(
        {
          last_check_at: now - 25 * 3600, // 25h old
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      const fetchFn = vi
        .fn()
        .mockResolvedValue(makeJsonResponse({ "dist-tags": { latest: "0.1.7" } }));

      const result = await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
        now: () => now,
      });

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result.state.latest_version).toBe("0.1.7");
    });
  });

  it("bypasses the cache when force: true", async () => {
    await withTempHome(async (home) => {
      const statePath = pathIn(home);
      const now = 1_700_000_000;
      await writeState(
        {
          last_check_at: now - 60, // one minute ago
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      const fetchFn = vi
        .fn()
        .mockResolvedValue(makeJsonResponse({ "dist-tags": { latest: "0.1.8" } }));

      const result = await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
        now: () => now,
        force: true,
      });

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result.state.latest_version).toBe("0.1.8");
    });
  });

  it("preserves dismissed_versions across a refetch", async () => {
    await withTempHome(async (home) => {
      const statePath = pathIn(home);
      const now = 1_700_000_000;
      await writeState(
        {
          last_check_at: now - 25 * 3600,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: ["0.1.6"],
        },
        statePath,
      );
      const fetchFn = vi
        .fn()
        .mockResolvedValue(makeJsonResponse({ "dist-tags": { latest: "0.1.7" } }));

      const result = await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
        now: () => now,
      });

      expect(result.state.dismissed_versions).toEqual(["0.1.6"]);
    });
  });

  it("records failure and bumps last_check_at when the registry rejects", async () => {
    await withTempHome(async (home) => {
      const statePath = pathIn(home);
      const now = 1_700_000_000;
      const fetchFn = vi.fn().mockResolvedValue(
        new Response("", { status: 503 }),
      );

      const result = await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
        now: () => now,
      });

      expect(result.fetched).toBe(true);
      expect(result.fetchFailed).toBe(true);
      expect(result.state.last_fetch_failed_at).toBe(now);
      expect(result.state.last_check_at).toBe(now);
      // No latest_version to report on a failed first run.
      expect(result.state.latest_version).toBe("");
    });
  });

  it("does not overwrite a known latest_version on fetch failure", async () => {
    await withTempHome(async (home) => {
      const statePath = pathIn(home);
      const now = 1_700_000_000;
      await writeState(
        {
          last_check_at: now - 25 * 3600,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      const fetchFn = vi.fn().mockRejectedValue(new Error("network down"));

      const result = await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
        now: () => now,
      });

      expect(result.fetchFailed).toBe(true);
      // Preserved across the failure.
      expect(result.state.latest_version).toBe("0.1.6");
    });
  });

  it("aborts and records failure when fetch exceeds timeoutMs", async () => {
    await withTempHome(async (home) => {
      const statePath = pathIn(home);
      const now = 1_700_000_000;

      // Simulate a fetch that never resolves until aborted. We return a
      // promise that rejects when `signal` fires, mimicking real fetch
      // behavior with an abort.
      const fetchFn = vi.fn(
        (_input: unknown, init?: { signal?: AbortSignal }) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (signal !== undefined) {
              signal.addEventListener("abort", () =>
                reject(new Error("aborted")),
              );
            }
          }),
      );

      const result = await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
        now: () => now,
        timeoutMs: 20,
      });

      expect(result.fetchFailed).toBe(true);
    });
  });

  it("handles a registry body without dist-tags.latest as a failure", async () => {
    await withTempHome(async (home) => {
      const statePath = pathIn(home);
      const fetchFn = vi
        .fn()
        .mockResolvedValue(makeJsonResponse({ "dist-tags": {} }));

      const result = await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
        now: () => 1_700_000_000,
      });

      expect(result.fetchFailed).toBe(true);
    });
  });

  it("tolerates an unwriteable state path (never throws)", async () => {
    await withTempHome(async (home) => {
      // Aim the state path at a directory that doesn't exist AND
      // whose parent isn't writable — actually, `writeState` will
      // try `mkdir recursive` so we have to use a readonly parent.
      // Simplest workaround: write a file where the directory needs
      // to be, so mkdir fails.
      const badParent = join(home, "readonly-file");
      await writeFile(badParent, "i am a file", "utf8");
      const statePath = join(badParent, "update-state.json");
      const fetchFn = vi
        .fn()
        .mockResolvedValue(makeJsonResponse({ "dist-tags": { latest: "9.9.9" } }));

      // Must NOT throw — the return is the only signal the caller has.
      const result = await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
      });

      expect(result.state.latest_version).toBe("9.9.9");
    });
  });

  it("creates ~/.almanac/ if it doesn't exist", async () => {
    await withTempHome(async (home) => {
      const dotAlmanac = join(home, ".almanac");
      const statePath = join(dotAlmanac, "update-state.json");
      // No mkdir — writeState should create it.
      const fetchFn = vi
        .fn()
        .mockResolvedValue(makeJsonResponse({ "dist-tags": { latest: "1.0.0" } }));

      await checkForUpdate({
        installedVersion: "0.1.5",
        fetchFn: fetchFn as typeof fetch,
        statePath,
      });

      // The directory AND the file exist now.
      const raw = await readFile(statePath, "utf8");
      expect(raw.length).toBeGreaterThan(0);
      await mkdir(dotAlmanac, { recursive: true }); // idempotent sanity
    });
  });
});
