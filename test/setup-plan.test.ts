import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  buildSetupPlan,
  SETUP_DEFAULTS,
} from "../src/cli/commands/setup/setup-plan.js";
import { makeSetupTheme } from "../src/cli/commands/setup/output.js";
import type { SetupOptions } from "../src/cli/commands/setup/index.js";
import { DEFAULT_SETUP_INSTRUCTION_TARGETS } from "../src/services/setup/index.js";

const TEST_CWD = "/tmp/codealmanac-setup-plan";

function setupOptions(options: Omit<SetupOptions, "cwd"> = {}): SetupOptions {
  return { ...options, cwd: TEST_CWD };
}

function setupOutput(): {
  out: PassThrough;
  theme: ReturnType<typeof makeSetupTheme>;
  stdout: () => string;
} {
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on("data", (chunk: Buffer) => chunks.push(chunk));
  return {
    out,
    theme: makeSetupTheme(false),
    stdout: () => Buffer.concat(chunks).toString("utf8"),
  };
}

describe("setup plan", () => {
  it("uses launch defaults in non-interactive setup", async () => {
    const { out, theme } = setupOutput();

    await expect(buildSetupPlan({
      out,
      theme,
      interactive: false,
      options: setupOptions(),
    })).resolves.toEqual({
      instructionTargets: [...DEFAULT_SETUP_INSTRUCTION_TARGETS],
      cliAutoUpdate: SETUP_DEFAULTS.cliAutoUpdate,
      selfManagedAutomation: SETUP_DEFAULTS.selfManagedAutomation,
      autoCommit: SETUP_DEFAULTS.autoCommit,
    });
  });

  it("skip flags disable automation and instructions gates", async () => {
    const { out, theme } = setupOutput();

    await expect(buildSetupPlan({
      out,
      theme,
      interactive: false,
      options: setupOptions({
        skipAutomation: true,
        skipGuides: true,
      }),
    })).resolves.toMatchObject({
      instructionTargets: [],
      cliAutoUpdate: false,
      selfManagedAutomation: false,
      autoCommit: false,
    });
  });

  it("explicit setup flags enable their gates", async () => {
    const { out, theme } = setupOutput();

    await expect(buildSetupPlan({
      out,
      theme,
      interactive: false,
      options: setupOptions({
        automationEvery: "2h",
        autoUpdate: true,
        autoCommit: true,
      }),
    })).resolves.toMatchObject({
      instructionTargets: [...DEFAULT_SETUP_INSTRUCTION_TARGETS],
      selfManagedAutomation: true,
      cliAutoUpdate: true,
      autoCommit: true,
    });
  });

  it("explicit auto-commit opt-out keeps the gate false", async () => {
    const { out, theme } = setupOutput();

    await expect(buildSetupPlan({
      out,
      theme,
      interactive: false,
      options: setupOptions({
        autoCommit: false,
      }),
    })).resolves.toMatchObject({
      autoCommit: false,
    });
  });

  it("interactive answers override shown gate defaults", async () => {
    const { out, theme, stdout } = setupOutput();
    let answeredTargets = false;
    let answeredUpdate = false;
    let answeredAutomation = false;
    out.on("data", () => {
      const text = stdout();
      if (!answeredTargets && text.includes("Select targets")) {
        answeredTargets = true;
        queueMicrotask(() => process.stdin.emit("data", Buffer.from("\n")));
      }
      if (!answeredUpdate && text.includes("Keep the Almanac CLI updated automatically?")) {
        answeredUpdate = true;
        queueMicrotask(() => process.stdin.emit("data", Buffer.from("n\n")));
      }
      if (!answeredAutomation && text.includes("Do you want to handle automations yourself?")) {
        answeredAutomation = true;
        queueMicrotask(() => process.stdin.emit("data", Buffer.from("\n")));
      }
    });

    await expect(buildSetupPlan({
      out,
      theme,
      interactive: true,
      options: setupOptions(),
    })).resolves.toMatchObject({
      instructionTargets: [...DEFAULT_SETUP_INSTRUCTION_TARGETS],
      cliAutoUpdate: false,
      selfManagedAutomation: false,
      autoCommit: false,
    });
    expect(answeredTargets).toBe(true);
    expect(answeredUpdate).toBe(true);
    expect(answeredAutomation).toBe(true);
  });

  it("interactive target selection can intentionally choose no targets", async () => {
    const { out, theme, stdout } = setupOutput();
    let answeredTargets = false;
    let answeredUpdate = false;
    let answeredAutomation = false;
    out.on("data", () => {
      const text = stdout();
      if (!answeredTargets && text.includes("Select targets")) {
        answeredTargets = true;
        queueMicrotask(() => process.stdin.emit("data", Buffer.from("none\n")));
      }
      if (!answeredUpdate && text.includes("Keep the Almanac CLI updated automatically?")) {
        answeredUpdate = true;
        queueMicrotask(() => process.stdin.emit("data", Buffer.from("\n")));
      }
      if (!answeredAutomation && text.includes("Do you want to handle automations yourself?")) {
        answeredAutomation = true;
        queueMicrotask(() => process.stdin.emit("data", Buffer.from("\n")));
      }
    });

    await expect(buildSetupPlan({
      out,
      theme,
      interactive: true,
      options: setupOptions(),
    })).resolves.toMatchObject({
      instructionTargets: [],
      cliAutoUpdate: true,
      selfManagedAutomation: false,
      autoCommit: false,
    });
    expect(answeredTargets).toBe(true);
  });
});
