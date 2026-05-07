import { describe, expect, it } from "vitest";

import { runAgentsModel, runAgentsUse } from "../src/commands/agents.js";
import { runConfigList } from "../src/commands/config.js";
import { withTempHome } from "./helpers.js";

describe("agents command", () => {
  it("requires an explicit model or --default", async () => {
    await withTempHome(async () => {
      const result = await runAgentsModel({ provider: "claude" });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("missing model");
    });
  });

  it("does not materialize untouched model origins when changing providers", async () => {
    await withTempHome(async () => {
      await expect(runAgentsUse({ provider: "codex" })).resolves.toMatchObject({
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
