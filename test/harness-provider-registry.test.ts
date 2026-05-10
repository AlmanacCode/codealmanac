import { describe, expect, it } from "vitest";

import {
  getHarnessProvider,
  HARNESS_PROVIDER_METADATA,
  listHarnessProviders,
} from "../src/harness/index.js";

describe("harness provider registry", () => {
  it("lists the supported provider ids", () => {
    expect(listHarnessProviders().map((provider) => provider.metadata.id)).toEqual([
      "claude",
      "codex",
      "cursor",
    ]);
  });

  it("returns provider metadata by id", () => {
    expect(getHarnessProvider("claude").metadata).toBe(
      HARNESS_PROVIDER_METADATA.claude,
    );
    expect(getHarnessProvider("codex").metadata.displayName).toBe("Codex");
    expect(getHarnessProvider("cursor").metadata.displayName).toBe("Cursor");
  });

  it("keeps capability differences explicit", () => {
    expect(
      HARNESS_PROVIDER_METADATA.claude.capabilities.subagents.programmaticPerRun,
    ).toBe(true);
    expect(
      HARNESS_PROVIDER_METADATA.codex.capabilities.subagents.programmaticPerRun,
    ).toBe(false);
    expect(HARNESS_PROVIDER_METADATA.codex.capabilities.contextUsage).toBe(false);
    expect(HARNESS_PROVIDER_METADATA.claude.capabilities.contextUsage).toBe(false);
  });

  it("keeps unported adapters explicit", async () => {
    await expect(
      getHarnessProvider("cursor").run({
        provider: { id: "cursor" },
        cwd: "/repo",
        prompt: "hello",
        metadata: { operation: "build" },
      }),
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("not implemented yet"),
    });
  });
});
