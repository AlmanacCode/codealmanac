import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { announceUpdateIfAvailable } from "../src/update/announce.js";
import { getConfigPath, writeConfig } from "../src/config/index.js";
import { writeState } from "../src/update/state.js";
import { withTempHome } from "./helpers.js";

/**
 * Pre-command nag banner. We drive it with a `PassThrough` stream so we
 * can capture the output deterministically without touching the real
 * stderr. Every test forces `color: false` to keep assertions free of
 * ANSI escape sequences.
 */

function captureStderr(): { stream: PassThrough; output: () => string } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (c: Buffer | string) => {
    chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  });
  return {
    stream,
    output: () => Buffer.concat(chunks).toString("utf8"),
  };
}

function statePathIn(home: string): string {
  return join(home, ".almanac", "update-state.json");
}

function configPathIn(home: string): string {
  return join(home, ".almanac", "config.toml");
}

describe("announceUpdateIfAvailable", () => {
  it("prints the banner when latest > installed and not dismissed", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const configPath = configPathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );

      const { stream, output } = captureStderr();
      announceUpdateIfAvailable(stream, {
        statePath,
        configPath,
        installedVersion: "0.1.5",
        color: false,
      });

      expect(output()).toMatch(
        /Almanac 0\.1\.6 available .*you're on 0\.1\.5.*almanac update/,
      );
    });
  });

  it("is silent when the installed version equals latest", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const configPath = configPathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.6",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      const { stream, output } = captureStderr();
      announceUpdateIfAvailable(stream, {
        statePath,
        configPath,
        installedVersion: "0.1.6",
        color: false,
      });
      expect(output()).toBe("");
    });
  });

  it("is silent when the latest version is in dismissed_versions", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const configPath = configPathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: ["0.1.6"],
        },
        statePath,
      );
      const { stream, output } = captureStderr();
      announceUpdateIfAvailable(stream, {
        statePath,
        configPath,
        installedVersion: "0.1.5",
        color: false,
      });
      expect(output()).toBe("");
    });
  });

  it("reappears when a NEWER version than a dismissed one ships", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const configPath = configPathIn(home);
      // User dismissed 0.1.6. Registry has since moved to 0.1.7.
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.7",
          dismissed_versions: ["0.1.6"],
        },
        statePath,
      );
      const { stream, output } = captureStderr();
      announceUpdateIfAvailable(stream, {
        statePath,
        configPath,
        installedVersion: "0.1.5",
        color: false,
      });
      expect(output()).toMatch(/0\.1\.7 available/);
    });
  });

  it("is silent when the state file is missing", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home); // never written
      const configPath = configPathIn(home);
      const { stream, output } = captureStderr();
      announceUpdateIfAvailable(stream, {
        statePath,
        configPath,
        installedVersion: "0.1.5",
        color: false,
      });
      expect(output()).toBe("");
    });
  });

  it("is silent when the state file is malformed JSON", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const configPath = configPathIn(home);
      // Create ~/.almanac/ by writing a sibling file first.
      await writeState(
        {
          last_check_at: 0,
          installed_version: "",
          latest_version: "",
          dismissed_versions: [],
        },
        statePath,
      );
      await writeFile(statePath, "{ this is not json", "utf8");
      const { stream, output } = captureStderr();
      announceUpdateIfAvailable(stream, {
        statePath,
        configPath,
        installedVersion: "0.1.5",
        color: false,
      });
      expect(output()).toBe("");
    });
  });

  it("respects update_notifier: false", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const configPath = configPathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      await writeConfig({ update_notifier: false }, configPath);
      const { stream, output } = captureStderr();
      announceUpdateIfAvailable(stream, {
        statePath,
        configPath,
        installedVersion: "0.1.5",
        color: false,
      });
      expect(output()).toBe("");
    });
  });

  it("respects legacy config.json before migration", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      await writeConfig(
        { update_notifier: false },
        join(home, ".almanac", "config.json"),
      );
      const { stream, output } = captureStderr();
      announceUpdateIfAvailable(stream, {
        statePath,
        configPath: getConfigPath(),
        installedVersion: "0.1.5",
        color: false,
      });
      expect(output()).toBe("");
    });
  });

  it("still fires when update_notifier is explicitly true", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const configPath = configPathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      await writeConfig({ update_notifier: true }, configPath);
      const { stream, output } = captureStderr();
      announceUpdateIfAvailable(stream, {
        statePath,
        configPath,
        installedVersion: "0.1.5",
        color: false,
      });
      expect(output()).toMatch(/0\.1\.6 available/);
    });
  });
});
