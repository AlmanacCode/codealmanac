import { spawn } from "node:child_process";

import type {
  SetupAgentProviderId,
  SetupProviderModelChoice,
  SetupProviderView,
  SetupSpawnCliFn,
} from "../../../services/setup/index.js";
import {
  readSetupAgentChoiceState,
  readSetupProviderModelChoices,
  refreshSetupAgentChoiceView,
  resolveSetupAgentSelection,
  saveSetupAgentChoice,
} from "../../../services/setup/index.js";
import {
  DIM,
  RST,
  WHITE_BOLD,
  confirm,
  promptText,
  selectChoice,
  stepActive,
  stepDone,
  waitForEnter,
} from "./output.js";

export type AgentChoice =
  | { ok: true; provider: SetupAgentProviderId; model: string | null }
  | { ok: false; error: string };

export async function chooseDefaultAgent(args: {
  out: NodeJS.WritableStream;
  interactive: boolean;
  requested?: string;
  requestedModel?: string;
  spawnCli?: SetupSpawnCliFn;
}): Promise<AgentChoice> {
  const state = await readSetupAgentChoiceState({
    requested: args.requested,
    includeView: args.interactive || args.requested !== undefined,
    spawnCli: args.spawnCli,
  });
  let view = state.view;
  let selected = state.selected;
  if (args.interactive && args.requested === undefined && view !== null) {
    while (true) {
      const choice = await selectChoice({
        out: args.out,
        title: "Choose your agent",
        help: "Choose the AI agent Almanac should use.",
        choices: view.choices.map((choice) => ({
          value: choice,
          line: formatProviderChoice(choice),
          aliases: [choice.id, choice.label.toLowerCase()],
        })),
        defaultIndex: Math.max(
          0,
          view.choices.findIndex((choice) =>
            choice.id === view?.recommendedProvider
          ),
        ),
      });
      if (choice.ready) {
        selected = choice.id;
        break;
      }
      if (choice.readiness === "not-authenticated" && choice.fixCommand !== null) {
        const command = choice.fixCommand.startsWith("run: ")
          ? choice.fixCommand.slice("run: ".length)
          : choice.fixCommand;
        const runLogin = await confirm(
          args.out,
          `${choice.label} sign-in is needed. Run '${command}' now?`,
          true,
        );
        if (runLogin === "install") {
          const login = await runLoginCommand(command);
          if (!login.ok) {
            stepActive(args.out, `${choice.label} login failed: ${login.error}`);
          }
          view = await refreshSetupAgentChoiceView({
            spawnCli: args.spawnCli,
          });
          const refreshed = view.choices.find((next) => next.id === choice.id);
          if (refreshed?.ready === true) {
            selected = refreshed.id;
            break;
          }
        }
        continue;
      }
      showUnavailableProvider(args.out, choice);
      await waitForEnter(args.out, "Press Enter to choose a different agent.");
    }
  }
  const selection = resolveSetupAgentSelection(selected);
  if (!selection.ok) return selection;
  const provider = selection.provider;
  let selectedChoice = view?.choices.find((choice) => choice.id === provider);
  if (
    args.interactive &&
    selectedChoice !== undefined &&
    !selectedChoice.ready &&
    selectedChoice.fixCommand?.startsWith("run: ") === true
  ) {
    const command = selectedChoice.fixCommand.slice("run: ".length);
    const runLogin = await confirm(
      args.out,
      `${selectedChoice.label} is not ready. Run '${command}' now?`,
      true,
    );
    if (runLogin === "install") {
      const login = await runLoginCommand(command);
      if (login.ok) {
        view = await refreshSetupAgentChoiceView({
          spawnCli: args.spawnCli,
        });
        selectedChoice = view.choices.find((choice) => choice.id === provider);
      } else {
        stepActive(args.out, `${selectedChoice.label} login failed: ${login.error}`);
      }
    }
  }
  if (selectedChoice !== undefined && !selectedChoice.ready) {
    return {
      ok: false,
      error: `${selectedChoice.label} is not ready: ${
        selectedChoice.fixCommand ?? selectedChoice.detail
      }`,
    };
  }
  const requestedModel = args.requestedModel ?? selection.parsedModel;
  const model = requestedModel ?? await chooseProviderModel({
    out: args.out,
    interactive: args.interactive,
    provider,
    choice: selectedChoice,
    configuredModel: state.configuredModels[provider] ?? null,
  });
  await saveSetupAgentChoice({ provider, model });
  if ((!args.interactive || args.requested !== undefined) && selectedChoice !== undefined) {
    const detail = selectedChoice?.ready === true
      ? "ready"
      : selectedChoice?.fixCommand ?? selectedChoice?.detail ?? "status unknown";
    stepDone(args.out, `Agent readiness: ${detail}`);
  }
  return { ok: true, provider, model };
}

async function chooseProviderModel(args: {
  out: NodeJS.WritableStream;
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
  const defaultIndex = Math.max(0,
    currentIndex >= 0
      ? currentIndex
      : recommendedIndex >= 0
        ? recommendedIndex
        : 0);
  const modelChoice = await selectChoice({
    out: args.out,
    title: `Choose ${providerDisplayName(args.provider)} model`,
    choices: choices.map((choice) => ({
      value: choice,
      line: formatModelChoice(choice, args.configuredModel),
      aliases: choice.value === null
        ? ["default", "provider default"]
        : [String(choice.value)],
    })),
    defaultIndex,
  });
  if (modelChoice?.source === "custom") {
    const custom = await promptText(args.out, "Model name", "");
    return custom.length > 0 ? custom : recommended?.value ?? null;
  }
  return modelChoice?.value ?? recommended?.value ?? null;
}

function formatProviderChoice(
  choice: SetupProviderView["choices"][number],
): string {
  const status = providerStatusLabel(choice);
  const detail = providerDetailLabel(choice);
  const tag = choice.recommended ? `  ${DIM}recommended${RST}` : "";
  return `${choice.label.padEnd(8)} ${status.padEnd(15)} ${detail}${tag}`;
}

function providerStatusLabel(
  choice: SetupProviderView["choices"][number],
): string {
  if (choice.ready) {
    return choice.detail === "ANTHROPIC_API_KEY set" ? "API key set" : "signed in";
  }
  return choice.readiness === "missing" ? "not installed" : "sign in needed";
}

function providerDetailLabel(
  choice: SetupProviderView["choices"][number],
): string {
  if (choice.ready) return choice.account ?? choice.detail;
  if (choice.fixCommand === null) return choice.detail;
  return choice.fixCommand.startsWith("run: ")
    ? choice.fixCommand.slice("run: ".length)
    : choice.fixCommand;
}

function showUnavailableProvider(
  out: NodeJS.WritableStream,
  choice: SetupProviderView["choices"][number],
): void {
  if (choice.readiness === "missing") {
    out.write(
      `\n  ${WHITE_BOLD}${choice.label} is not installed.${RST}\n` +
        `  ${providerDetailLabel(choice)}\n\n`,
    );
    return;
  }
  out.write(
    `\n  ${WHITE_BOLD}${choice.label} is not signed in.${RST}\n` +
      `  Run: ${providerDetailLabel(choice)}\n\n`,
  );
}

function formatModelChoice(
  choice: SetupProviderModelChoice,
  configuredModel: string | null,
): string {
  const marker = choice.recommended
    ? `  ${DIM}recommended${RST}`
    : choice.value === configuredModel
      ? `  ${DIM}current${RST}`
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

async function runLoginCommand(command: string): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
    });
    child.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      resolve({ ok: false, error: `exited ${code ?? 1}` });
    });
  });
}
