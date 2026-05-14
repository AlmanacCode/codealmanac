import { spawn } from "node:child_process";

import type { SpawnCliFn } from "../../agent/readiness/providers/claude/index.js";
import {
  buildProviderModelChoices,
  buildProviderSetupView,
  parseAgentSelection,
} from "../../agent/readiness/view.js";
import type {
  ProviderSetupView,
} from "../../agent/readiness/view.js";
import type { ProviderModelChoice } from "../../agent/types.js";
import {
  disabledAgentProviderMessage,
  formatEnabledAgentProviderList,
  isAgentProviderId,
  isEnabledAgentProviderId,
  readConfig,
  writeConfig,
  type AgentProviderId,
} from "../../config/index.js";
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
  | { ok: true; provider: AgentProviderId; model: string | null }
  | { ok: false; error: string };

export async function chooseDefaultAgent(args: {
  out: NodeJS.WritableStream;
  interactive: boolean;
  requested?: string;
  requestedModel?: string;
  spawnCli?: SpawnCliFn;
}): Promise<AgentChoice> {
  const config = await readConfig();
  let view: ProviderSetupView | null = null;
  let selected = args.requested ?? config.agent.default;
  if (args.interactive || args.requested !== undefined) {
    view = await buildProviderSetupView({ config, spawnCli: args.spawnCli });
  }
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
          view = await buildProviderSetupView({ config, spawnCli: args.spawnCli });
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
  const parsed = parseAgentSelection(selected);
  if (parsed.provider === null || !isAgentProviderId(parsed.provider)) {
    return {
      ok: false,
      error:
        `unknown agent '${selected}'. Expected one of: ${formatEnabledAgentProviderList()}.`,
    };
  }
  const provider = parsed.provider;
  if (!isEnabledAgentProviderId(provider)) {
    return {
      ok: false,
      error: disabledAgentProviderMessage(provider),
    };
  }
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
        view = await buildProviderSetupView({ config, spawnCli: args.spawnCli });
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
  const requestedModel = args.requestedModel ?? parsed.model;
  const model = requestedModel ?? await chooseProviderModel({
    out: args.out,
    interactive: args.interactive,
    provider,
    choice: selectedChoice,
    configuredModel: config.agent.models[provider] ?? null,
  });
  await writeConfig({
    ...config,
    agent: {
      ...config.agent,
      default: provider,
      models: {
        ...config.agent.models,
        [provider]: model,
      },
    },
  });
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
  provider: AgentProviderId;
  choice?: ProviderSetupView["choices"][number];
  configuredModel: string | null;
}): Promise<string | null> {
  const choices =
    args.choice?.modelChoices ??
    await buildProviderModelChoices(args.provider, args.configuredModel);
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
  choice: ProviderSetupView["choices"][number],
): string {
  const status = providerStatusLabel(choice);
  const detail = providerDetailLabel(choice);
  const tag = choice.recommended ? `  ${DIM}recommended${RST}` : "";
  return `${choice.label.padEnd(8)} ${status.padEnd(15)} ${detail}${tag}`;
}

function providerStatusLabel(
  choice: ProviderSetupView["choices"][number],
): string {
  if (choice.ready) {
    return choice.detail === "ANTHROPIC_API_KEY set" ? "API key set" : "signed in";
  }
  return choice.readiness === "missing" ? "not installed" : "sign in needed";
}

function providerDetailLabel(
  choice: ProviderSetupView["choices"][number],
): string {
  if (choice.ready) return choice.account ?? choice.detail;
  if (choice.fixCommand === null) return choice.detail;
  return choice.fixCommand.startsWith("run: ")
    ? choice.fixCommand.slice("run: ".length)
    : choice.fixCommand;
}

function showUnavailableProvider(
  out: NodeJS.WritableStream,
  choice: ProviderSetupView["choices"][number],
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
  choice: ProviderModelChoice,
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

function providerDisplayName(provider: AgentProviderId): string {
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
