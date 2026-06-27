import { describe, expect, it } from "vitest";

import {
  createHarnessProviderRegistry,
  HARNESS_PROVIDER_METADATA,
} from "../src/harness/index.js";

describe("harness provider registry", () => {
  it("lists the supported provider ids", () => {
    const registry = createHarnessProviderRegistry({ environment: {} });

    expect(registry.listProviders().map((provider) => provider.metadata.id)).toEqual([
      "claude",
      "codex",
      "cursor",
    ]);
  });

  it("returns provider metadata by id", () => {
    const registry = createHarnessProviderRegistry({ environment: {} });

    expect(registry.getProvider("claude").metadata).toBe(
      HARNESS_PROVIDER_METADATA.claude,
    );
    expect(registry.getProvider("codex").metadata.displayName).toBe("Codex");
    expect(registry.getProvider("cursor").metadata.displayName).toBe("Cursor");
  });

  it("keeps capability differences explicit", () => {
    expect(
      HARNESS_PROVIDER_METADATA.claude.capabilities.subagents.programmaticPerRun,
    ).toBe(true);
    expect(
      HARNESS_PROVIDER_METADATA.codex.capabilities.subagents.programmaticPerRun,
    ).toBe(false);
    expect(HARNESS_PROVIDER_METADATA.codex.capabilities.subagents.supported).toBe(false);
    expect(HARNESS_PROVIDER_METADATA.codex.capabilities.sessionPersistence).toBe(false);
    expect(HARNESS_PROVIDER_METADATA.codex.capabilities.reasoningEffort).toBe(true);
    expect(HARNESS_PROVIDER_METADATA.codex.capabilities.contextUsage).toBe(true);
    expect(HARNESS_PROVIDER_METADATA.cursor.capabilities.fileWrite).toBe(false);
    expect(HARNESS_PROVIDER_METADATA.claude.capabilities.contextUsage).toBe(false);
    expect(HARNESS_PROVIDER_METADATA.claude.capabilities.structuredOutput).toBe(true);
  });

  it("keeps unported adapters explicit", async () => {
    const registry = createHarnessProviderRegistry({ environment: {} });

    await expect(
      registry.getProvider("cursor").run({
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
