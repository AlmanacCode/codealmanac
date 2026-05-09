import { describe, expect, it } from "vitest";

import {
  runAgentsList,
  runAgentsModel,
  runAgentsUse,
} from "../src/commands/agents.js";
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

  it("hides Cursor by default and rejects selecting it", async () => {
    await withTempHome(async () => {
      const list = await runAgentsList();
      expect(list.stdout).toContain("Claude");
      expect(list.stdout).toContain("Codex");
      expect(list.stdout).not.toContain("Cursor");

      const result = await runAgentsUse({ provider: "cursor" });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("CODEALMANAC_ENABLE_CURSOR=1");
    });
  });

  it("allows Cursor when the feature flag is enabled", async () => {
    const original = process.env.CODEALMANAC_ENABLE_CURSOR;
    process.env.CODEALMANAC_ENABLE_CURSOR = "1";
    try {
      await withTempHome(async () => {
        const result = await runAgentsUse({ provider: "cursor" });
        expect(result.exitCode).toBe(0);
      });
    } finally {
      if (original === undefined) {
        delete process.env.CODEALMANAC_ENABLE_CURSOR;
      } else {
        process.env.CODEALMANAC_ENABLE_CURSOR = original;
      }
    }
  });
});
