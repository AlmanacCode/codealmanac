import { describe, expect, it } from "vitest";

import {
  buildProviderSetupView,
  chooseRecommendedProvider,
  parseAgentSelection,
} from "../src/agent/provider-view.js";
import type {
  ProviderStatus,
  SpawnCliFn,
  SpawnedProcess,
} from "../src/agent/types.js";
import { defaultConfig } from "../src/update/config.js";

const statuses: ProviderStatus[] = [
  {
    id: "claude",
    installed: true,
    authenticated: true,
    detail: "Claude account: rohan@example.com",
  },
  {
    id: "codex",
    installed: true,
    authenticated: true,
    detail: "ChatGPT account: rohan@example.com",
  },
  {
    id: "cursor",
    installed: true,
    authenticated: false,
    detail: "not logged in",
  },
];

function fakeSpawnCli(stdout: string): SpawnCliFn {
  return (): SpawnedProcess => {
    const stdoutCbs: ((d: string) => void)[] = [];
    const closeCbs: ((c: number | null) => void)[] = [];
    queueMicrotask(() => {
      for (const cb of stdoutCbs) cb(stdout);
      for (const cb of closeCbs) cb(0);
    });
    return {
      stdout: {
        on: (event, cb) => {
          if (event === "data") stdoutCbs.push(cb);
        },
      },
      stderr: { on: () => {} },
      on: (event, cb) => {
        if (event === "close") closeCbs.push(cb as (c: number | null) => void);
      },
      kill: () => {},
    };
  };
}

const CODEX_MODELS = JSON.stringify({
  models: [
    { slug: "gpt-5.3-codex", display_name: "gpt-5.3-codex", visibility: "list" },
    { slug: "gpt-5.4-mini", display_name: "GPT-5.4-Mini", visibility: "list" },
    { slug: "gpt-5.4", display_name: "gpt-5.4", visibility: "list" },
    { slug: "gpt-5.5", display_name: "GPT-5.5", visibility: "list" },
    { slug: "hidden-model", display_name: "Hidden", visibility: "hidden" },
  ],
});

describe("provider setup view", () => {
  it("builds the provider-first choice model", async () => {
    const config = {
      ...defaultConfig(),
      agent: {
        default: "claude" as const,
        models: {
          claude: "claude-opus-4-6",
          codex: null,
          cursor: null,
        },
      },
    };

    const view = await buildProviderSetupView({
      config,
      statuses,
      spawnCli: fakeSpawnCli(CODEX_MODELS),
    });

    expect(view.recommendedProvider).toBe("claude");
    expect(view.choices).toMatchObject([
      {
        id: "claude",
        label: "Claude",
        selected: true,
        recommended: true,
        readiness: "ready",
        effectiveModel: "claude-opus-4-6",
        account: "Claude account: rohan@example.com",
        fixCommand: null,
        modelChoices: [
          {
            value: "claude-opus-4-6",
            label: "claude-opus-4-6",
            source: "configured",
          },
          {
            value: "claude-opus-4-7",
            label: "Opus 4.7",
            source: "catalog",
          },
          {
            value: "claude-sonnet-4-6",
            label: "Sonnet 4.6",
            source: "catalog",
            recommended: true,
          },
          {
            value: "claude-haiku-4-5-20251001",
            label: "Haiku 4.5",
            source: "catalog",
          },
          {
            value: "__custom__",
            label: "Enter a model name",
            source: "custom",
          },
        ],
      },
      {
        id: "codex",
        label: "Codex",
        readiness: "ready",
        effectiveModel: null,
        account: "ChatGPT account: rohan@example.com",
        modelChoices: [
          {
            value: "gpt-5.5",
            label: "GPT-5.5",
            source: "catalog",
          },
          {
            value: "gpt-5.4",
            label: "GPT-5.4",
            source: "catalog",
            recommended: true,
          },
          {
            value: "gpt-5.4-mini",
            label: "GPT-5.4 Mini",
            source: "catalog",
          },
          {
            value: "gpt-5.3-codex",
            label: "GPT-5.3 Codex",
            source: "catalog",
          },
          {
            value: "__custom__",
            label: "Enter a model name",
            source: "custom",
          },
        ],
      },
    ]);
    expect(view.choices.map((choice) => choice.id)).not.toContain("cursor");
  });

  it("shows Cursor when the feature flag is enabled", async () => {
    const original = process.env.CODEALMANAC_ENABLE_CURSOR;
    process.env.CODEALMANAC_ENABLE_CURSOR = "1";
    try {
      const view = await buildProviderSetupView({
        config: defaultConfig(),
        statuses,
        spawnCli: fakeSpawnCli(CODEX_MODELS),
      });
      expect(view.choices.map((choice) => choice.id)).toEqual([
        "claude",
        "codex",
        "cursor",
      ]);
      expect(view.choices.find((choice) => choice.id === "cursor"))
        .toMatchObject({
          label: "Cursor",
          readiness: "not-authenticated",
          fixCommand: "run: cursor-agent login",
        });
    } finally {
      if (original === undefined) {
        delete process.env.CODEALMANAC_ENABLE_CURSOR;
      } else {
        process.env.CODEALMANAC_ENABLE_CURSOR = original;
      }
    }
  });

  it("falls back to first ready provider when Claude is not ready", () => {
    expect(chooseRecommendedProvider([
      {
        id: "claude",
        installed: true,
        authenticated: false,
        detail: "not logged in",
      },
      statuses[1]!,
      statuses[2]!,
    ])).toBe("codex");
  });

  it("does not recommend a provider whose detail says it is logged out", () => {
    expect(chooseRecommendedProvider([
      {
        id: "claude",
        installed: true,
        authenticated: true,
        detail: "not logged in",
      },
      statuses[1]!,
      statuses[2]!,
    ])).toBe("codex");
  });

  it("parses provider/model shorthand without making it primary UX", () => {
    expect(parseAgentSelection("claude/opus")).toEqual({
      provider: "claude",
      model: "opus",
    });
    expect(parseAgentSelection("cursor")).toEqual({ provider: "cursor" });
    expect(parseAgentSelection("nope")).toEqual({ provider: null });
  });
});
