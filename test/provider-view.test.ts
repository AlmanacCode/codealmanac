import { describe, expect, it } from "vitest";

import {
  buildProviderSetupView,
  chooseRecommendedProvider,
  parseAgentSelection,
} from "../src/agent/readiness/view.js";
import type { ProviderStatus } from "../src/agent/types.js";
import { defaultConfig } from "../src/config/index.js";

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

    const view = await buildProviderSetupView({ config, statuses });

    expect(view.recommendedProvider).toBe("codex");
    expect(view.choices).toMatchObject([
      {
        id: "claude",
        label: "Claude",
        selected: true,
        recommended: false,
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
            label: "Claude Opus 4.7",
            source: "catalog",
          },
          {
            value: "claude-sonnet-4-6",
            label: "Claude Sonnet 4.6",
            source: "catalog",
            recommended: true,
          },
          {
            value: "claude-haiku-4-5",
            label: "Claude Haiku 4.5",
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
        recommended: true,
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
            label: "GPT-5.4-Mini",
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
    expect(view.choices.map((choice) => choice.id)).toEqual([
      "claude",
      "codex",
    ]);
  });

  it("recommends Codex when it is ready", () => {
    expect(chooseRecommendedProvider([
      statuses[0]!,
      statuses[1]!,
      statuses[2]!,
    ])).toBe("codex");
  });

  it("parses provider/model shorthand without making it primary UX", () => {
    expect(parseAgentSelection("claude/opus")).toEqual({
      provider: "claude",
      model: "opus",
    });
    expect(parseAgentSelection("nope")).toEqual({ provider: null });
  });
});
