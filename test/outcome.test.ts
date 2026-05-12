import { describe, expect, it } from "vitest";

import { renderOutcome } from "../src/cli/outcome.js";

describe("CommandOutcome renderer", () => {
  it("renders the four shapes as JSON", () => {
    for (const outcome of [
      { type: "success", message: "done" },
      { type: "noop", message: "nothing changed" },
      { type: "needs-action", message: "not ready", fix: "run: login" },
      { type: "error", message: "failed" },
    ] as const) {
      const result = renderOutcome(outcome, { json: true });
      expect(JSON.parse(result.stdout)).toMatchObject(outcome);
      expect(result.stderr).toBe("");
    }
  });

  it("keeps fixable human output on stderr", () => {
    const result = renderOutcome({
      type: "needs-action",
      message: "no wiki",
      fix: "run: almanac init",
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("almanac: no wiki");
    expect(result.stderr).toContain("run: almanac init");
  });
});
