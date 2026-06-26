import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  buildSetupPlan,
  SETUP_DEFAULTS,
} from "../src/cli/commands/setup/setup-plan.js";

function setupOutput(): {
  out: PassThrough;
  stdout: () => string;
} {
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on("data", (chunk: Buffer) => chunks.push(chunk));
  return {
    out,
    stdout: () => Buffer.concat(chunks).toString("utf8"),
  };
}

describe("setup plan", () => {
  it("uses launch defaults in non-interactive setup", async () => {
    const { out } = setupOutput();

    await expect(buildSetupPlan({
      out,
      interactive: false,
      options: {},
    })).resolves.toEqual({
      syncAutomation: SETUP_DEFAULTS.syncAutomation,
      cliAutoUpdate: SETUP_DEFAULTS.cliAutoUpdate,
      agentInstructions: SETUP_DEFAULTS.agentInstructions,
      autoCommit: SETUP_DEFAULTS.autoCommit,
    });
  });

  it("skip flags disable automation and instructions gates", async () => {
    const { out } = setupOutput();

    await expect(buildSetupPlan({
      out,
      interactive: false,
      options: {
        skipAutomation: true,
        skipGuides: true,
      },
    })).resolves.toMatchObject({
      syncAutomation: false,
      cliAutoUpdate: false,
      agentInstructions: false,
      autoCommit: false,
    });
  });

  it("explicit setup flags enable their gates", async () => {
    const { out } = setupOutput();

    await expect(buildSetupPlan({
      out,
      interactive: false,
      options: {
        automationEvery: "2h",
        autoUpdate: true,
        autoCommit: true,
      },
    })).resolves.toMatchObject({
      syncAutomation: true,
      cliAutoUpdate: true,
      agentInstructions: true,
      autoCommit: true,
    });
  });

  it("explicit auto-commit opt-out keeps the gate false", async () => {
    const { out } = setupOutput();

    await expect(buildSetupPlan({
      out,
      interactive: false,
      options: {
        autoCommit: false,
      },
    })).resolves.toMatchObject({
      autoCommit: false,
    });
  });

  it("interactive answers override shown gate defaults", async () => {
    const { out, stdout } = setupOutput();
    let answeredUpdate = false;
    let answeredGuides = false;
    out.on("data", () => {
      const text = stdout();
      if (!answeredUpdate && text.includes("Keep the Almanac CLI updated automatically?")) {
        answeredUpdate = true;
        queueMicrotask(() => process.stdin.emit("data", Buffer.from("n\n")));
      }
      if (!answeredGuides && text.includes("Add Almanac instructions for your AI agents?")) {
        answeredGuides = true;
        queueMicrotask(() => process.stdin.emit("data", Buffer.from("\n")));
      }
    });

    await expect(buildSetupPlan({
      out,
      interactive: true,
      options: {},
    })).resolves.toMatchObject({
      syncAutomation: false,
      cliAutoUpdate: false,
      agentInstructions: true,
      autoCommit: false,
    });
    expect(answeredUpdate).toBe(true);
    expect(answeredGuides).toBe(true);
  });
});
