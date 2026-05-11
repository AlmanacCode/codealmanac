import { describe, expect, it } from "vitest";

import {
  buildProviderSetupView,
  chooseRecommendedProvider,
  parseAgentSelection,
} from "../src/agent/provider-view.js";
import type { ProviderStatus } from "../src/agent/types.js";
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
            value: "claude-sonnet-4-6",
            label: "claude-sonnet-4-6",
            source: "provider-default",
            recommended: true,
          },
          {
            value: "__custom__",
            label: "custom model id",
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
            value: null,
            label: "provider default",
            source: "provider-default",
            recommended: true,
          },
          {
            value: "__custom__",
            label: "custom model id",
            source: "custom",
          },
        ],
      },
      {
        id: "cursor",
        label: "Cursor",
        readiness: "not-authenticated",
        fixCommand: "run: cursor-agent login",
      },
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
