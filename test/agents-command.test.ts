import { describe, expect, it } from "vitest";

import { runAgentsList, runAgentsModel, runAgentsUse } from "../src/cli/commands/agents.js";
import { runConfigList } from "../src/cli/commands/config.js";
import { withTempHome } from "./helpers.js";

describe("agents command", () => {
  it("lists providers with column headers", async () => {
    const result = await runAgentsList({
      view: {
        defaultProvider: "codex",
        recommendedProvider: "codex",
        choices: [
          {
            id: "codex",
            label: "Codex",
            selected: true,
            recommended: true,
            readiness: "ready",
            ready: true,
            installed: true,
            authenticated: true,
            effectiveModel: "gpt-5.5",
            providerDefaultModel: "gpt-5.5",
            configuredModel: null,
            account: "user@example.com",
            detail: "Logged in",
            fixCommand: null,
            modelChoices: [],
          },
          {
            id: "cursor",
            label: "Cursor",
            selected: false,
            recommended: false,
            readiness: "missing",
            ready: false,
            installed: false,
            authenticated: false,
            effectiveModel: null,
            providerDefaultModel: null,
            configuredModel: null,
            account: null,
            detail: "missing",
            fixCommand: "install cursor-agent",
            modelChoices: [],
          },
        ],
      },
    });

    expect(result.stdout).toContain(
      "DEFAULT  AGENT   STATUS   RECOMMENDED  MODEL             DETAIL",
    );
    expect(result.stdout).toContain(
      "*        Codex   ready    recommended  gpt-5.5           user@example.com",
    );
    expect(result.stdout).toContain(
      "         Cursor  missing               provider default  install cursor-agent",
    );
  });

  it("requires an explicit model or --default", async () => {
    await withTempHome(async () => {
      const result = await runAgentsModel({ provider: "claude" });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("missing model");
    });
  });

  it("does not materialize untouched model origins when changing providers", async () => {
    await withTempHome(async () => {
      await expect(runAgentsUse({ provider: "claude" })).resolves.toMatchObject({
        exitCode: 0,
      });

      const rows = JSON.parse((await runConfigList({ json: true })).stdout) as
        Array<{ key: string; origin: string }>;
      expect(rows.find((row) => row.key === "agent.default")?.origin).toBe(
        "user",
      );
      expect(rows.find((row) => row.key === "agent.models.claude")?.origin).toBe(
        "default",
      );
      expect(rows.find((row) => row.key === "agent.models.codex")?.origin).toBe(
        "default",
      );
    });
  });
});
