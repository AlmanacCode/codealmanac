import { describe, expect, it } from "vitest";

import {
  commandExists,
  quoteWindowsArg,
  resolveExecutable,
} from "../src/process/exec.js";

/**
 * These tests inject `platform`, `env`, and `fileExists` so they exercise
 * Windows resolution logic on any host (CI runs on Linux too). No real
 * subprocess or filesystem is touched.
 */

describe("resolveExecutable — POSIX", () => {
  const env = { PATH: "/usr/local/bin:/usr/bin:/bin" };

  it("finds a bare command on PATH", () => {
    const present = new Set(["/usr/bin/codex"]);
    const resolved = resolveExecutable("codex", {
      platform: "linux",
      env,
      fileExists: (p) => present.has(p),
    });
    expect(resolved).toBe("/usr/bin/codex");
  });

  it("returns undefined when absent", () => {
    const resolved = resolveExecutable("codex", {
      platform: "linux",
      env,
      fileExists: () => false,
    });
    expect(resolved).toBeUndefined();
  });

  it("does not append Windows extensions on POSIX", () => {
    const present = new Set(["/usr/bin/codex.cmd"]);
    const resolved = resolveExecutable("codex", {
      platform: "linux",
      env,
      fileExists: (p) => present.has(p),
    });
    expect(resolved).toBeUndefined();
  });
});

describe("resolveExecutable — Windows", () => {
  const env = {
    Path: "C:\\Windows\\system32;C:\\Users\\dev\\AppData\\Roaming\\npm",
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
  };

  it("resolves an npm .cmd shim from a bare command", () => {
    const shim = "C:\\Users\\dev\\AppData\\Roaming\\npm\\codex.cmd";
    const resolved = resolveExecutable("codex", {
      platform: "win32",
      env,
      fileExists: (p) => p === shim,
    });
    expect(resolved).toBe(shim);
  });

  it("prefers .EXE over .CMD per PATHEXT order", () => {
    const dir = "C:\\Users\\dev\\AppData\\Roaming\\npm";
    const present = new Set([`${dir}\\codex.exe`, `${dir}\\codex.cmd`]);
    const resolved = resolveExecutable("codex", {
      platform: "win32",
      env,
      fileExists: (p) => present.has(p),
    });
    expect(resolved).toBe(`${dir}\\codex.exe`);
  });

  it("reads PATH when Path key is absent", () => {
    const shim = "C:\\bin\\codex.cmd";
    const resolved = resolveExecutable("codex", {
      platform: "win32",
      env: { PATH: "C:\\bin", PATHEXT: ".CMD" },
      fileExists: (p) => p === shim,
    });
    expect(resolved).toBe(shim);
  });

  it("honors an extension already present on the command", () => {
    const shim = "C:\\bin\\codex.cmd";
    const resolved = resolveExecutable("codex.cmd", {
      platform: "win32",
      env: { PATH: "C:\\bin", PATHEXT: ".CMD" },
      fileExists: (p) => p === shim,
    });
    expect(resolved).toBe(shim);
  });

  it("strips surrounding quotes from quoted PATH entries", () => {
    const shim = "C:\\Program Files\\nodejs\\codex.cmd";
    const resolved = resolveExecutable("codex", {
      platform: "win32",
      env: { Path: '"C:\\Program Files\\nodejs"', PATHEXT: ".CMD" },
      fileExists: (p) => p === shim,
    });
    expect(resolved).toBe(shim);
  });

  it("falls back to a default PATHEXT when env lacks one", () => {
    const shim = "C:\\bin\\codex.cmd";
    const resolved = resolveExecutable("codex", {
      platform: "win32",
      env: { Path: "C:\\bin" },
      fileExists: (p) => p === shim,
    });
    expect(resolved).toBe(shim);
  });

  it("returns undefined when only a non-PATHEXT extension exists", () => {
    // npm also drops a bare `codex` (no ext, a shell script) on Windows;
    // it is not directly runnable and must not count as found.
    const resolved = resolveExecutable("codex", {
      platform: "win32",
      env,
      fileExists: (p) => p === "C:\\Users\\dev\\AppData\\Roaming\\npm\\codex",
    });
    expect(resolved).toBeUndefined();
  });
});

describe("quoteWindowsArg", () => {
  it("leaves simple flags untouched", () => {
    expect(quoteWindowsArg("--json")).toBe("--json");
    expect(quoteWindowsArg("mcp_servers={}")).toBe("mcp_servers={}");
  });

  it("quotes args with spaces", () => {
    expect(quoteWindowsArg("hello world")).toBe('"hello world"');
  });

  it("doubles a trailing backslash so it cannot escape the closing quote", () => {
    // C:\a b\  ->  "C:\a b\\"   (the doubled backslash is a literal backslash)
    expect(quoteWindowsArg("C:\\a b\\")).toBe('"C:\\a b\\\\"');
  });

  it("escapes embedded quotes and their preceding backslashes", () => {
    expect(quoteWindowsArg('a"b')).toBe('"a\\"b"');
  });
});

describe("commandExists", () => {
  it("is true when resolvable", () => {
    expect(
      commandExists("codex", {
        platform: "win32",
        env: { Path: "C:\\bin", PATHEXT: ".CMD" },
        fileExists: (p) => p === "C:\\bin\\codex.cmd",
      }),
    ).toBe(true);
  });

  it("is false when not resolvable", () => {
    expect(
      commandExists("codex", {
        platform: "linux",
        env: { PATH: "/usr/bin" },
        fileExists: () => false,
      }),
    ).toBe(false);
  });
});
