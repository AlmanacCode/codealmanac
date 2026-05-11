import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";
import { Command } from "commander";

import { run, tryParseSetupShortcut } from "../src/cli.js";
import { configureGroupedHelp } from "../src/cli/help.js";
import { registerCommands } from "../src/cli/register-commands.js";
import { formatForegroundEvent } from "../src/cli/register-wiki-lifecycle-commands.js";
import type { SetupResult } from "../src/commands/setup.js";
import { withTempHome } from "./helpers.js";

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

  it("returns null when setup shortcut flags miss required values", () => {
    expect(tryParseSetupShortcut(["--agent"])).toBeNull();
    expect(tryParseSetupShortcut(["--agent", "--model"])).toBeNull();
    expect(tryParseSetupShortcut(["--model"])).toBeNull();
    expect(tryParseSetupShortcut(["--model", "--yes"])).toBeNull();
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
      "hook",
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
    expect(findCommand(program, ["hook"]).commands.map((cmd) => cmd.name()))
      .toEqual(["install", "uninstall", "status"]);
    expect(optionFlags(findCommand(program, ["hook", "install"]))).toContain(
      "--source <source>",
    );
    expect(optionFlags(findCommand(program, ["hook", "uninstall"]))).toContain(
      "--source <source>",
    );
    expect(findCommand(program, ["capture"]).commands.map((cmd) => cmd.name()))
      .toEqual(["status"]);
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
    expect(optionFlags(findCommand(program, ["capture"]))).toContain(
      "--foreground",
    );
    expect(optionFlags(findCommand(program, ["ingest"]))).toContain(
      "--using <provider[/model]>",
    );
    expect(optionFlags(findCommand(program, ["garden"]))).toContain("--json");
    expect(optionFlags(findCommand(program, ["topics", "show"]))).toContain(
      "--descendants",
    );
    expect(optionFlags(findCommand(program, ["search"]))).toContain(
      "--mentions <path>",
    );
    expect(optionFlags(findCommand(program, ["search"]))).toContain(
      "--summaries",
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

describe("run() — almanac setup shortcut routing", () => {
  it("routes bare `almanac --yes` to runSetup with { yes: true }", async () => {
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

    expect(setupMock).toHaveBeenCalledTimes(1);
    expect(setupMock).toHaveBeenCalledWith({ yes: true });
  });

  it("forwards setup shortcut flags for bare `almanac`", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await run(
      [
        "/abs/node",
        "/abs/path/almanac",
        "--yes",
        "--skip-hook",
        "--skip-guides",
        "--agent",
        "codex",
        "--model",
        "gpt-5.3-codex",
      ],
      {
        runSetup: setupMock as never,
        announceUpdate: () => {},
        scheduleUpdateCheck: () => {},
        runInternalUpdateCheck: async () => {},
      },
    );

    expect(setupMock).toHaveBeenCalledWith({
      yes: true,
      skipHook: true,
      skipGuides: true,
      agent: "codex",
      model: "gpt-5.3-codex",
    });
  });

  it("routes bare compatibility `codealmanac` through the global bootstrapper when provided", async () => {
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

  it("routes explicit `almanac setup --yes` before heavy command registration", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await run(
      ["/abs/node", "/abs/path/almanac", "setup", "--yes"],
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

  it("does NOT shortcut for `almanac doctor`", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    const origStdout = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      await run(
        ["/abs/node", "/abs/path/almanac", "doctor", "--install-only"],
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

  it("forwards --source for sqlite-free hook uninstall", async () => {
    await withTempHome(async (home) => {
      const scriptPath = join(home, "hooks", "almanac-capture.sh");
      await mkdir(join(home, ".claude"), { recursive: true });
      await mkdir(join(home, ".codex"), { recursive: true });
      await mkdir(join(home, ".cursor"), { recursive: true });
      await writeFile(
        join(home, ".claude", "settings.json"),
        JSON.stringify({
          hooks: {
            SessionEnd: [
              {
                matcher: "",
                hooks: [{ type: "command", command: scriptPath }],
              },
            ],
          },
        }),
        "utf8",
      );
      await writeFile(
        join(home, ".codex", "hooks.json"),
        JSON.stringify({
          hooks: {
            Stop: [{ hooks: [{ type: "command", command: scriptPath }] }],
          },
        }),
        "utf8",
      );
      await writeFile(
        join(home, ".cursor", "hooks.json"),
        JSON.stringify({
          hooks: {
            sessionEnd: [{ command: scriptPath }],
          },
        }),
        "utf8",
      );

      const origStdout = process.stdout.write.bind(process.stdout);
      process.stdout.write = (() => true) as typeof process.stdout.write;
      try {
        await run(
          [
            "/abs/node",
            "/abs/path/almanac",
            "hook",
            "uninstall",
            "--source",
            "all",
          ],
          {
            announceUpdate: () => {},
            scheduleUpdateCheck: () => {},
            runInternalUpdateCheck: async () => {},
          },
        );
      } finally {
        process.stdout.write = origStdout;
      }

      const claude = JSON.parse(
        await readFile(join(home, ".claude", "settings.json"), "utf8"),
      ) as Record<string, unknown>;
      const codex = JSON.parse(
        await readFile(join(home, ".codex", "hooks.json"), "utf8"),
      ) as Record<string, unknown>;
      const cursor = JSON.parse(
        await readFile(join(home, ".cursor", "hooks.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(claude).not.toHaveProperty("hooks");
      expect(codex).not.toHaveProperty("hooks");
      expect(cursor).not.toHaveProperty("hooks");
    });
  });

  it("does NOT shortcut for `almanac search foo`", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    const origErr = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      await run(
        ["/abs/node", "/abs/path/almanac", "search", "foo"],
        {
          runSetup: setupMock as never,
          announceUpdate: () => {},
          scheduleUpdateCheck: () => {},
          runInternalUpdateCheck: async () => {},
        },
      ).catch(() => {
        // This can fail because the test cwd may not contain .almanac.
      });
    } finally {
      process.stderr.write = origErr;
    }

    expect(setupMock).not.toHaveBeenCalled();
  });

  it("does NOT shortcut for `almanac --yes doctor` (subcommand present)", async () => {
    const setupMock = vi
      .fn<(opts?: unknown) => Promise<SetupResult>>()
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    const origStdout = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      // `--yes` before `doctor` isn't valid for doctor, but commander
      // handles that — we only care that the shortcut didn't eat it.
      await run(
        ["/abs/node", "/abs/path/almanac", "--yes", "doctor"],
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
