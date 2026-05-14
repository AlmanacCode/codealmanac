import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

import { parseAutomationInstallFlags, run, tryParseSetupShortcut } from "../src/cli.js";
import { configureGroupedHelp } from "../src/cli/help.js";
import { resolveSearchOutputMode } from "../src/cli/register-query-commands.js";
import { registerCommands } from "../src/cli/register-commands.js";
import {
  formatForegroundEvent,
  initStartMessage,
  lifecycleForegroundEventHandler,
} from "../src/cli/register-wiki-lifecycle-commands.js";
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

  it("recognizes --skip-automation and --skip-guides in any order", () => {
    expect(tryParseSetupShortcut(["--skip-automation"])).toEqual({
      skipAutomation: true,
    });
    expect(tryParseSetupShortcut(["--skip-guides"])).toEqual({
      skipGuides: true,
    });
    expect(
      tryParseSetupShortcut(["--skip-guides", "--skip-automation"]),
    ).toEqual({ skipAutomation: true, skipGuides: true });
  });

  it("recognizes --agent for the setup shortcut", () => {
    expect(tryParseSetupShortcut(["--agent", "codex"])).toEqual({
      agent: "codex",
    });
    expect(tryParseSetupShortcut(["--yes", "--agent", "cursor"])).toEqual({
      yes: true,
      agent: "cursor",
    });
  });

  it("recognizes --model for the setup shortcut", () => {
    expect(tryParseSetupShortcut(["--agent", "claude", "--model", "opus"]))
      .toEqual({
        agent: "claude",
        model: "opus",
      });
    expect(tryParseSetupShortcut(["--yes", "--model", "gpt-5.3-codex"]))
      .toEqual({
        yes: true,
        model: "gpt-5.3-codex",
      });
  });

  it("recognizes --auto-capture-every and --auto-capture-quiet", () => {
    expect(tryParseSetupShortcut(["--auto-capture-every", "2h"]))
      .toEqual({ automationEvery: "2h" });
    expect(tryParseSetupShortcut(["--auto-capture-quiet", "1s"]))
      .toEqual({ automationQuiet: "1s" });
    expect(tryParseSetupShortcut(["--auto-capture-every=2h"]))
      .toEqual({ automationEvery: "2h" });
    expect(tryParseSetupShortcut(["--auto-capture-quiet=1s"]))
      .toEqual({ automationQuiet: "1s" });
  });

  it("recognizes scheduled Garden setup options", () => {
    expect(tryParseSetupShortcut(["--garden-every", "2d"]))
      .toEqual({ gardenEvery: "2d" });
    expect(tryParseSetupShortcut(["--garden-every=2d"]))
      .toEqual({ gardenEvery: "2d" });
    expect(tryParseSetupShortcut(["--garden-off"]))
      .toEqual({ gardenOff: true });
  });

  it("accepts the full setup flag combo", () => {
    expect(
      tryParseSetupShortcut([
        "--yes",
        "--skip-automation",
        "--skip-guides",
        "--auto-capture-every",
        "2h",
        "--auto-capture-quiet",
        "1s",
        "--garden-every",
        "2d",
      ]),
    ).toEqual({
      yes: true,
      skipAutomation: true,
      skipGuides: true,
      automationEvery: "2h",
      automationQuiet: "1s",
      gardenEvery: "2d",
    });
  });

  it("returns null for unrecognized flags", () => {
    expect(tryParseSetupShortcut(["--help"])).toBeNull();
    expect(tryParseSetupShortcut(["--version"])).toBeNull();
    expect(tryParseSetupShortcut(["-h"])).toBeNull();
    expect(tryParseSetupShortcut(["--unknown"])).toBeNull();
  });

  it("returns null when setup shortcut flags miss required values", () => {
    expect(tryParseSetupShortcut(["--agent"])).toBeNull();
    expect(tryParseSetupShortcut(["--agent", "--model"])).toBeNull();
    expect(tryParseSetupShortcut(["--model"])).toBeNull();
    expect(tryParseSetupShortcut(["--model", "--yes"])).toBeNull();
    expect(tryParseSetupShortcut(["--garden-every"])).toBeNull();
    expect(tryParseSetupShortcut(["--garden-every", "--yes"])).toBeNull();
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

describe("parseAutomationInstallFlags", () => {
  it("recognizes split and equals-style automation duration flags", () => {
    expect(parseAutomationInstallFlags([
      "--every=5h",
      "--quiet=45m",
      "--garden-every=1w",
      "--garden-off",
    ])).toEqual({
      ok: true,
      options: {
        every: "5h",
        quiet: "45m",
        gardenEvery: "1w",
        gardenOff: true,
      },
    });
    expect(parseAutomationInstallFlags(["--garden-every", "2d"])).toEqual({
      ok: true,
      options: { gardenEvery: "2d" },
    });
  });

  it("rejects missing values for automation duration flags", () => {
    expect(parseAutomationInstallFlags(["--garden-every"])).toEqual({
      ok: false,
      error: "missing value for --garden-every",
    });
  });
});

describe("registerCommands", () => {
  function findCommand(root: Command, path: string[]): Command {
    let current = root;
    for (const name of path) {
      const next = current.commands.find((cmd) => cmd.name() === name);
      if (next === undefined) {
        throw new Error(`missing command ${path.join(" ")}`);
      }
      current = next;
    }
    return current;
  }

  function optionFlags(command: Command): string[] {
    return command.options.map((option) => option.flags);
  }

  it("keeps the expected command groups, subcommands, and representative options wired", () => {
    const program = new Command();
    registerCommands(program);

    expect(program.commands.map((cmd) => cmd.name())).toEqual([
      "serve",
      "search",
      "show",
      "health",
      "list",
      "tag",
      "untag",
      "topics",
      "init",
      "capture",
      "ingest",
      "garden",
      "jobs",
      "ps",
      "automation",
      "reindex",
      "agents",
      "config",
      "set",
      "setup",
      "doctor",
      "update",
      "uninstall",
    ]);

    expect(findCommand(program, ["topics"]).commands.map((cmd) => cmd.name()))
      .toEqual([
        "list",
        "show",
        "create",
        "link",
        "unlink",
        "rename",
        "delete",
        "describe",
      ]);
    expect(findCommand(program, ["automation"]).commands.map((cmd) => cmd.name()))
      .toEqual(["install", "uninstall", "status"]);
    expect(findCommand(program, ["capture"]).commands.map((cmd) => cmd.name()))
      .toEqual(["sweep", "status"]);
    expect(findCommand(program, ["jobs"]).commands.map((cmd) => cmd.name()))
      .toEqual(["list", "show", "logs", "attach", "cancel"]);
    expect(findCommand(program, ["agents"]).commands.map((cmd) => cmd.name()))
      .toEqual(["list", "doctor", "use", "model"]);
    expect(findCommand(program, ["config"]).commands.map((cmd) => cmd.name()))
      .toEqual(["list", "get", "set", "unset"]);

    expect(optionFlags(findCommand(program, ["setup"]))).toContain("-y, --yes");
    expect(optionFlags(findCommand(program, ["setup"]))).toContain(
      "--agent <agent>",
    );
    expect(optionFlags(findCommand(program, ["setup"]))).toContain(
      "--model <model>",
    );
    expect(optionFlags(findCommand(program, ["doctor"]))).toContain("--json");
    expect(optionFlags(findCommand(program, ["init"]))).toContain(
      "--using <provider[/model]>",
    );
    expect(optionFlags(findCommand(program, ["init"]))).toContain("--verbose");
    expect(optionFlags(findCommand(program, ["capture"]))).toContain(
      "--foreground",
    );
    expect(optionFlags(findCommand(program, ["capture"]))).toContain("--verbose");
    expect(optionFlags(findCommand(program, ["ingest"]))).toContain(
      "--using <provider[/model]>",
    );
    expect(optionFlags(findCommand(program, ["ingest"]))).toContain("--verbose");
    expect(optionFlags(findCommand(program, ["garden"]))).toContain("--json");
    expect(optionFlags(findCommand(program, ["garden"]))).toContain("--verbose");
    expect(optionFlags(findCommand(program, ["topics", "show"]))).toContain(
      "--descendants",
    );
    expect(optionFlags(findCommand(program, ["search"]))).toContain(
      "--mentions <path>",
    );
    expect(optionFlags(findCommand(program, ["search"]))).toContain(
      "--summaries",
    );
    expect(optionFlags(findCommand(program, ["search"]))).toContain(
      "--verbose",
    );
    expect(optionFlags(findCommand(program, ["show"]))).toContain(
      "--verbose",
    );
    expect(optionFlags(findCommand(program, ["list"]))).toContain(
      "--verbose",
    );
    expect(optionFlags(findCommand(program, ["serve"]))).toContain(
      "--port <n>",
    );
    expect(optionFlags(findCommand(program, ["list"]))).toContain(
      "--drop <name>",
    );
  });

  it("places legacy commands in a Deprecated help group", () => {
    const program = new Command();
    program.name("almanac");
    registerCommands(program);
    configureGroupedHelp(program);

    const help = program.helpInformation();

    expect(help).toMatch(/Setup:[\s\S]*agents\s+list supported AI agent providers and readiness/);
    expect(help).toMatch(/Setup:[\s\S]*config\s+read and write Almanac settings/);
    expect(help).toContain("Deprecated:");
    expect(help).toMatch(/set <key> \[value\.\.\.\]\s+configure Almanac defaults/);
    expect(help).toMatch(/ps \[options\]\s+deprecated alias for jobs/);
  });
});

describe("resolveSearchOutputMode", () => {
  it("keeps search slug-only by default even for TTY output", () => {
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    });

    try {
      expect(resolveSearchOutputMode({})).toBe("slugs");
    } finally {
      Object.defineProperty(process.stdout, "isTTY", {
        value: original,
        configurable: true,
      });
    }
  });

  it("maps --verbose to summary output", () => {
    expect(resolveSearchOutputMode({ verbose: true })).toBe("summaries");
  });
});

describe("formatForegroundEvent", () => {
  it("suppresses provider error events so final command errors are not duplicated", () => {
    expect(
      formatForegroundEvent({
        type: "error",
        error: "Codex model gpt-5.5 requires a newer Codex CLI.",
      }),
    ).toBeNull();
    expect(
      formatForegroundEvent({
        type: "done",
        error: "Claude is not authenticated in this environment.",
      }),
    ).toBeNull();
  });

  it("still formats foreground text, tool, and done events", () => {
    expect(formatForegroundEvent({ type: "text", content: " hello \n" })).toBe(
      "hello",
    );
    expect(formatForegroundEvent({ type: "tool_use", tool: "Bash" })).toBe(
      "[tool] Bash",
    );
    expect(
      formatForegroundEvent({
        type: "tool_use",
        tool: "Read",
        display: {
          kind: "read",
          title: "Reading file",
          path: ".almanac/pages/farzapedia.md",
        },
      }),
    ).toBe("[tool] Reading file .almanac/pages/farzapedia.md");
    expect(
      formatForegroundEvent({
        type: "tool_result",
        display: {
          kind: "shell",
          title: "Ran command",
          command: "almanac health",
          status: "completed",
          exitCode: 0,
        },
      }),
    ).toBe("[tool] Ran command almanac health exit 0");
    expect(formatForegroundEvent({ type: "done" })).toBe("[done]");
  });
});

describe("lifecycleForegroundEventHandler", () => {
  it("suppresses foreground event streaming unless --verbose is set", () => {
    expect(lifecycleForegroundEventHandler({ verbose: false })).toBeUndefined();
    expect(lifecycleForegroundEventHandler({})).toBeUndefined();
    expect(typeof lifecycleForegroundEventHandler({ verbose: true })).toBe(
      "function",
    );
  });
});

describe("initStartMessage", () => {
  it("prints a start line only for attached non-json init runs", () => {
    expect(initStartMessage({})).toBe(
      "Analyzing codebase... This usually takes 5-10 minutes.\n",
    );
    expect(initStartMessage({ verbose: true })).toBe(
      "Analyzing codebase... This usually takes 5-10 minutes.\n",
    );
    expect(initStartMessage({ background: true })).toBeNull();
    expect(initStartMessage({ json: true })).toBeNull();
  });
});

describe("run() — codealmanac-setup shortcut routing", () => {
  const ORIGINAL_INVOKED_AS = process.env.CODEALMANAC_INVOKED_AS;

  afterEach(() => {
    if (ORIGINAL_INVOKED_AS === undefined) {
      delete process.env.CODEALMANAC_INVOKED_AS;
    } else {
      process.env.CODEALMANAC_INVOKED_AS = ORIGINAL_INVOKED_AS;
    }
  });

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

  it("forwards --skip-automation alongside --yes", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await run(
      ["/abs/node", "/abs/path/codealmanac", "--yes", "--skip-automation"],
      {
        runSetup: setupMock as never,
        announceUpdate: () => {},
        scheduleUpdateCheck: () => {},
        runInternalUpdateCheck: async () => {},
      },
    );

    expect(setupMock).toHaveBeenCalledWith({
      yes: true,
      skipAutomation: true,
    });
  });

  it("routes bare `codealmanac` through the global bootstrapper when provided", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const bootstrapMock = vi
      .fn<(opts: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await run(
      ["/abs/node", "/abs/path/codealmanac", "--yes"],
      {
        runSetup: setupMock as never,
        runCodealmanacBootstrap: bootstrapMock as never,
        announceUpdate: () => {},
        scheduleUpdateCheck: () => {},
        runInternalUpdateCheck: async () => {},
      },
    );

    expect(bootstrapMock).toHaveBeenCalledWith({
      setupOptions: { yes: true },
      setupArgs: ["--yes"],
    });
    expect(setupMock).not.toHaveBeenCalled();
  });

  it("honors the launcher-preserved codealmanac invocation name", async () => {
    process.env.CODEALMANAC_INVOKED_AS = "codealmanac";
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const bootstrapMock = vi
      .fn<(opts: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await run(
      ["/abs/node", "/pkg/dist/codealmanac.js", "--yes"],
      {
        runSetup: setupMock as never,
        runCodealmanacBootstrap: bootstrapMock as never,
        announceUpdate: () => {},
        scheduleUpdateCheck: () => {},
        runInternalUpdateCheck: async () => {},
      },
    );

    expect(bootstrapMock).toHaveBeenCalledWith({
      setupOptions: { yes: true },
      setupArgs: ["--yes"],
    });
    expect(setupMock).not.toHaveBeenCalled();
  });

  it("routes explicit `codealmanac setup --yes` before heavy command registration", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await run(
      ["/abs/node", "/abs/path/codealmanac", "setup", "--yes"],
      {
        runSetup: setupMock as never,
        announceUpdate: () => {},
        scheduleUpdateCheck: () => {},
        runInternalUpdateCheck: async () => {},
      },
    );

    expect(setupMock).toHaveBeenCalledTimes(1);
    expect(setupMock).toHaveBeenCalledWith({
      yes: true,
    });
  });

  it("routes bare `almanac --yes` to setup", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await run(
      ["/abs/node", "/abs/path/almanac", "--yes"],
      {
        runSetup: setupMock as never,
        announceUpdate: () => {},
        scheduleUpdateCheck: () => {},
        runInternalUpdateCheck: async () => {},
      },
    );

    expect(setupMock).toHaveBeenCalledWith({ yes: true });
  });

  it("does NOT shortcut for `codealmanac doctor`", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const doctorMock = vi
      .fn()
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
          runDoctor: doctorMock as never,
          announceUpdate: () => {},
          scheduleUpdateCheck: () => {},
          runInternalUpdateCheck: async () => {},
        },
      );
    } finally {
      process.stdout.write = origStdout;
    }

    expect(setupMock).not.toHaveBeenCalled();
    expect(doctorMock).toHaveBeenCalledWith({
      cwd: process.cwd(),
      installOnly: true,
      json: false,
      wikiOnly: false,
    });
  });

  it("does NOT shortcut for `codealmanac --yes doctor` (subcommand present)", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    const origStdout = process.stdout.write.bind(process.stdout);
    const origStderr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
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
      process.stderr.write = origStderr;
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
