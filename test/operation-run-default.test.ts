import { describe, expect, it } from "vitest";

import { createAbsorbRunSpec } from "../src/operations/absorb.js";
import { createBuildRunSpec } from "../src/operations/build.js";
import { createGardenRunSpec } from "../src/operations/garden.js";
import { createOperationRunSpec } from "../src/operations/run.js";

describe("operation run defaults", () => {
  it("uses Codex when a caller does not pass a provider", async () => {
    const spec = await createOperationRunSpec({
      operation: "garden",
      promptName: "operations/garden",
      repoRoot: "/repo",
    });

    expect(spec.provider).toEqual({ id: "codex" });
  });

  it("uses Codex for every operation-specific spec helper", async () => {
    const build = await createBuildRunSpec({ repoRoot: "/repo" });
    const absorb = await createAbsorbRunSpec({
      repoRoot: "/repo",
      context: "Session transcript.",
    });
    const garden = await createGardenRunSpec({ repoRoot: "/repo" });

    expect(build.provider).toEqual({ id: "codex" });
    expect(absorb.provider).toEqual({ id: "codex" });
    expect(garden.provider).toEqual({ id: "codex" });
  });
});
