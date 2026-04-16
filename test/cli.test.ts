import { describe, expect, it, vi } from "vitest";

import { run, tryParseSetupShortcut } from "../src/cli.js";
import type { SetupResult } from "../src/commands/setup.js";

/**
 * Unit tests for the `codealmanac` bare-binary routing logic.
 *
 * `tryParseSetupShortcut` — the pure arg parser — gets exhaustive
 * coverage of the accepted flag set and rejection of everything else.
 *
 * `run` gets a handful of integration checks that verify the shortcut
 * fires only under the right conditions (codealmanac invocation +
 * setup-compatible args) and never otherwise. We inject a stub
 * `runSetup` so the tests don't spawn the real wizard, and stub the
 * update side effects so no fetches/background spawns happen.
 */

describe("tryParseSetupShortcut", () => {
  it("returns an empty options object when no args are supplied", () => {
    expect(tryParseSetupShortcut([])).toEqual({});
  });

  it("recognizes --yes and its short form -y", () => {
    expect(tryParseSetupShortcut(["--yes"])).toEqual({ yes: true });
    expect(tryParseSetupShortcut(["-y"])).toEqual({ yes: true });
  });

  it("recognizes --skip-hook and --skip-guides in any order", () => {
    expect(tryParseSetupShortcut(["--skip-hook"])).toEqual({ skipHook: true });
    expect(tryParseSetupShortcut(["--skip-guides"])).toEqual({
      skipGuides: true,
    });
    expect(
      tryParseSetupShortcut(["--skip-guides", "--skip-hook"]),
    ).toEqual({ skipHook: true, skipGuides: true });
  });

  it("accepts the full flag combo (`--yes --skip-hook --skip-guides`)", () => {
    expect(
      tryParseSetupShortcut(["--yes", "--skip-hook", "--skip-guides"]),
    ).toEqual({ yes: true, skipHook: true, skipGuides: true });
  });

  it("returns null for unrecognized flags", () => {
    expect(tryParseSetupShortcut(["--help"])).toBeNull();
    expect(tryParseSetupShortcut(["--version"])).toBeNull();
    expect(tryParseSetupShortcut(["-h"])).toBeNull();
    expect(tryParseSetupShortcut(["--unknown"])).toBeNull();
  });

  it("returns null for subcommands", () => {
    expect(tryParseSetupShortcut(["setup"])).toBeNull();
    expect(tryParseSetupShortcut(["doctor"])).toBeNull();
    expect(tryParseSetupShortcut(["search", "foo"])).toBeNull();
  });

  it("returns null when a subcommand appears alongside valid flags", () => {
    // We never reinterpret `codealmanac setup --yes` as the shortcut
    // path — commander handles that flow. The shortcut exists solely
    // to patch bare-invocation flag forwarding.
    expect(tryParseSetupShortcut(["setup", "--yes"])).toBeNull();
    expect(tryParseSetupShortcut(["doctor", "--yes"])).toBeNull();
  });
});

describe("run() — codealmanac-setup shortcut routing", () => {
  it("routes bare `codealmanac --yes` to runSetup with { yes: true }", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await run(
      ["/abs/node", "/abs/path/codealmanac", "--yes"],
      {
        runSetup: setupMock as never,
        announceUpdate: () => {},
        scheduleUpdateCheck: () => {},
        runInternalUpdateCheck: async () => {},
      },
    );

    expect(setupMock).toHaveBeenCalledTimes(1);
    expect(setupMock).toHaveBeenCalledWith({ yes: true });
  });

  it("forwards --skip-hook alongside --yes", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await run(
      ["/abs/node", "/abs/path/codealmanac", "--yes", "--skip-hook"],
      {
        runSetup: setupMock as never,
        announceUpdate: () => {},
        scheduleUpdateCheck: () => {},
        runInternalUpdateCheck: async () => {},
      },
    );

    expect(setupMock).toHaveBeenCalledWith({ yes: true, skipHook: true });
  });

  it("does NOT shortcut when the binary name is `almanac`", async () => {
    // `almanac --yes` without a subcommand isn't a setup invocation —
    // it's a commander error ("unknown option '--yes'"). We verify
    // runSetup was NOT called. Commander will write to stderr;
    // capture + silence it.
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    // Commander prints to stderr + throws via `exitOverride` or process.exit;
    // we swallow either to keep the test surface clean.
    const origErr = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;
    const origExit = process.exit;
    process.exit = ((code?: number): never => {
      throw new Error(`process.exit called with ${code}`);
    }) as typeof process.exit;

    try {
      await run(
        ["/abs/node", "/abs/path/almanac", "--yes"],
        {
          runSetup: setupMock as never,
          announceUpdate: () => {},
          scheduleUpdateCheck: () => {},
          runInternalUpdateCheck: async () => {},
        },
      ).catch(() => {
        // Swallow — commander's unknown-option error bubbles here.
      });
    } finally {
      process.stderr.write = origErr;
      process.exit = origExit;
    }

    expect(setupMock).not.toHaveBeenCalled();
  });

  it("does NOT shortcut for `codealmanac doctor`", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    // doctor needs args parsing; we let commander run it normally. The
    // point of THIS test is only that setupMock isn't invoked.
    const origStdout = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      await run(
        ["/abs/node", "/abs/path/codealmanac", "doctor", "--install-only"],
        {
          runSetup: setupMock as never,
          announceUpdate: () => {},
          scheduleUpdateCheck: () => {},
          runInternalUpdateCheck: async () => {},
        },
      );
    } finally {
      process.stdout.write = origStdout;
    }

    expect(setupMock).not.toHaveBeenCalled();
  });

  it("does NOT shortcut for `codealmanac --yes doctor` (subcommand present)", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    const origStdout = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      // `--yes` before `doctor` isn't valid for doctor, but commander
      // handles that — we only care that the shortcut didn't eat it.
      await run(
        ["/abs/node", "/abs/path/codealmanac", "--yes", "doctor"],
        {
          runSetup: setupMock as never,
          announceUpdate: () => {},
          scheduleUpdateCheck: () => {},
          runInternalUpdateCheck: async () => {},
        },
      ).catch(() => {
        // Commander may reject the arg order; that's fine.
      });
    } finally {
      process.stdout.write = origStdout;
    }

    expect(setupMock).not.toHaveBeenCalled();
  });

  it("invokes the update announcer once per command", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const announceMock = vi.fn<(stderr: NodeJS.WritableStream) => void>();

    await run(
      ["/abs/node", "/abs/path/codealmanac", "--yes"],
      {
        runSetup: setupMock as never,
        announceUpdate: announceMock,
        scheduleUpdateCheck: () => {},
        runInternalUpdateCheck: async () => {},
      },
    );

    // Banner prints before the shortcut action fires. One call total.
    expect(announceMock).toHaveBeenCalledTimes(1);
    expect(announceMock).toHaveBeenCalledWith(process.stderr);
  });

  it("routes the `--internal-check-updates` worker path to runInternalUpdateCheck and nothing else", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const announceMock = vi.fn<(stderr: NodeJS.WritableStream) => void>();
    const scheduleMock = vi.fn<(argv: string[]) => void>();
    const internalMock = vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined as never);

    await run(
      ["/abs/node", "/abs/path/codealmanac", "--internal-check-updates"],
      {
        runSetup: setupMock as never,
        announceUpdate: announceMock,
        scheduleUpdateCheck: scheduleMock,
        runInternalUpdateCheck: internalMock,
      },
    );

    expect(internalMock).toHaveBeenCalledTimes(1);
    // None of the foreground hooks should fire in the worker path —
    // no banner, no self-scheduled child, no setup routing. This is the
    // fork-bomb prevention: workers don't spawn more workers.
    expect(announceMock).not.toHaveBeenCalled();
    expect(scheduleMock).not.toHaveBeenCalled();
    expect(setupMock).not.toHaveBeenCalled();
  });
});
