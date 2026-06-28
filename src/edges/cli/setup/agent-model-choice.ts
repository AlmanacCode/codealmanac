import type {
  SetupAgentProviderId,
  SetupProviderModelChoice,
  SetupProviderView,
} from "../../../services/setup/index.js";
import { readSetupProviderModelChoices } from "../../../services/setup/index.js";
import {
  promptText,
  selectChoice,
} from "./input.js";
import {
  dim,
  type SetupTheme,
} from "./output.js";
import type { SetupInputStream } from "./types.js";

export async function chooseProviderModel(args: {
  input: SetupInputStream;
  out: NodeJS.WritableStream;
  theme: SetupTheme;
  interactive: boolean;
  provider: SetupAgentProviderId;
  choice?: SetupProviderView["choices"][number];
  configuredModel: string | null;
}): Promise<string | null> {
  const choices = await readSetupProviderModelChoices({
    provider: args.provider,
    configuredModel: args.configuredModel,
    choice: args.choice,
  });
  const recommended =
    choices.find((choice) => choice.recommended) ??
    choices.find((choice) => choice.source === "provider-default");
  if (!args.interactive) {
    return args.configuredModel ?? recommended?.value ?? null;
  }

  const currentIndex = choices.findIndex((choice) =>
    choice.value === args.configuredModel
  );
  const recommendedIndex = choices.findIndex((choice) => choice.recommended);
  const defaultIndex = Math.max(
    0,
    currentIndex >= 0
      ? currentIndex
      : recommendedIndex >= 0
        ? recommendedIndex
        : 0,
  );
  const modelChoice = await selectChoice({
    input: args.input,
    out: args.out,
    theme: args.theme,
    title: `Choose ${providerDisplayName(args.provider)} model`,
    choices: choices.map((choice) => ({
      value: choice,
      line: formatModelChoice(args.theme, choice, args.configuredModel),
      aliases: choice.value === null
        ? ["default", "provider default"]
        : [String(choice.value)],
    })),
    defaultIndex,
  });
  if (modelChoice?.source === "custom") {
    const custom = await promptText(
      args.input,
      args.out,
      args.theme,
      "Model name",
      "",
    );
    return custom.length > 0 ? custom : recommended?.value ?? null;
  }
  return modelChoice?.value ?? recommended?.value ?? null;
}

function formatModelChoice(
  theme: SetupTheme,
  choice: SetupProviderModelChoice,
  configuredModel: string | null,
): string {
  const marker = choice.recommended
    ? `  ${dim(theme, "recommended")}`
    : choice.value === configuredModel
      ? `  ${dim(theme, "current")}`
      : "";
  const label = choice.source === "provider-default" && choice.value !== null
    ? friendlyModelLabel(choice.value)
    : choice.label;
  return `${label}${marker}`;
}

function friendlyModelLabel(value: string): string {
  if (value === "claude-sonnet-4-6") return "Sonnet 4.6";
  if (value === "claude-opus-4-7") return "Opus 4.7";
  if (value === "claude-haiku-4-5") return "Haiku 4.5";
  return value;
}

function providerDisplayName(provider: SetupAgentProviderId): string {
  if (provider === "claude") return "Claude";
  if (provider === "codex") return "Codex";
  return "Cursor";
}
