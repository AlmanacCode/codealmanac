import { describe, expect, it } from "vitest";

import { globalInstallCommand } from "../src/commands/setup/install-path.js";
import { looksEphemeralInstallPath } from "../src/install/ephemeral.js";

describe("looksEphemeralInstallPath", () => {
  it("flags the npm _npx cache", () => {
    expect(
      looksEphemeralInstallPath("/home/dev/.npm/_npx/abc/node_modules/codealmanac", {
        home: "/home/dev",
        env: {},
      }),
    ).toBe(true);
  });

  it("flags Windows %TEMP% npx locations", () => {
    expect(
      looksEphemeralInstallPath(
        "C:\\Users\\dev\\AppData\\Local\\Temp\\_npx\\1\\node_modules\\codealmanac",
        {
          home: "C:\\Users\\dev",
          env: { TEMP: "C:\\Users\\dev\\AppData\\Local\\Temp" },
        },
      ),
    ).toBe(true);
  });

  it("flags the Windows npm-cache _npx location via LOCALAPPDATA", () => {
    expect(
      looksEphemeralInstallPath(
        "C:\\Users\\dev\\AppData\\Local\\npm-cache\\_npx\\a1\\node_modules\\codealmanac",
        {
          home: "C:\\Users\\dev",
          env: { LOCALAPPDATA: "C:\\Users\\dev\\AppData\\Local" },
        },
      ),
    ).toBe(true);
  });

  it("honors npm_config_cache for the npx location", () => {
    expect(
      looksEphemeralInstallPath("D:\\npmcache\\_npx\\a1\\node_modules\\codealmanac", {
        home: "C:\\Users\\dev",
        env: { npm_config_cache: "D:\\npmcache" },
      }),
    ).toBe(true);
  });

  it("does not flag a global install", () => {
    expect(
      looksEphemeralInstallPath("/usr/local/lib/node_modules/codealmanac", {
        home: "/home/dev",
        env: {},
      }),
    ).toBe(false);
  });

  it("treats the empty path as non-ephemeral", () => {
    expect(looksEphemeralInstallPath("", { home: "/home/dev", env: {} })).toBe(false);
  });
});

describe("globalInstallCommand", () => {
  it("runs npm directly on POSIX", () => {
    expect(globalInstallCommand("linux")).toEqual({
      file: "npm",
      args: ["install", "-g", "codealmanac@latest"],
    });
  });

  it("runs npm.cmd through cmd.exe on Windows", () => {
    expect(globalInstallCommand("win32")).toEqual({
      file: "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd install -g codealmanac@latest"],
    });
  });
});
