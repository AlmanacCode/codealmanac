import type {
  SetupAgentProviderId,
  SetupProviderView,
  SetupSpawnCliFn,
} from "../../../services/setup/index.js";
import {
  normalizeSetupProviderFixCommand,
  readSetupAgentChoiceState,
  refreshSetupAgentChoiceView,
  resolveSetupAgentSelection,
  runnableSetupProviderFixCommand,
  runSetupProviderFixCommand,
  saveSetupAgentChoice,
} from "../../../services/setup/index.js";
import { chooseProviderModel } from "./agent-model-choice.js";
import {
  confirm,
  selectChoice,
  waitForEnter,
} from "./input.js";
import {
  type SetupTheme,
  dim,
  stepActive,
  stepDone,
  whiteBold,
} from "./output.js";
import type { SetupInputStream } from "./types.js";

export type AgentChoice =
  | { ok: true; provider: SetupAgentProviderId; model: string | null }
  | { ok: false; error: string };

export async function chooseDefaultAgent(args: {
  input: SetupInputStream;
  out: NodeJS.WritableStream;
  theme: SetupTheme;
  interactive: boolean;
  requested?: string;
  requestedModel?: string;
  spawnCli?: SetupSpawnCliFn;
  environment: NodeJS.ProcessEnv;
}): Promise<AgentChoice> {
  const state = await readSetupAgentChoiceState({
    requested: args.requested,
    includeView: args.interactive || args.requested !== undefined,
    spawnCli: args.spawnCli,
    environment: args.environment,
  });
  let view = state.view;
  let selected = state.selected;
  if (args.interactive && args.requested === undefined && view !== null) {
    while (true) {
      const choice = await selectChoice({
        input: args.input,
        out: args.out,
        theme: args.theme,
        title: "Choose your agent",
        help: "Choose the AI agent Almanac should use.",
        choices: view.choices.map((choice) => ({
          value: choice,
          line: formatProviderChoice(args.theme, choice),
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
      const command = normalizeSetupProviderFixCommand(choice.fixCommand);
      if (choice.readiness === "not-authenticated" && command !== null) {
        const runLogin = await confirm(
          args.input,
          args.out,
          args.theme,
          `${choice.label} sign-in is needed. Run '${command}' now?`,
          true,
        );
        if (runLogin === "install") {
          const login = await runSetupProviderFixCommand(command);
          if (!login.ok) {
            stepActive(
              args.out,
              args.theme,
              `${choice.label} login failed: ${login.error}`,
            );
          }
          view = await refreshSetupAgentChoiceView({
            spawnCli: args.spawnCli,
            environment: args.environment,
          });
          const refreshed = view.choices.find((next) => next.id === choice.id);
          if (refreshed?.ready === true) {
            selected = refreshed.id;
            break;
          }
        }
        continue;
      }
      showUnavailableProvider(args.out, args.theme, choice);
      await waitForEnter(
        args.input,
        args.out,
        args.theme,
        "Press Enter to choose a different agent.",
      );
    }
  }
  const selection = resolveSetupAgentSelection({
    selected,
    environment: args.environment,
  });
  if (!selection.ok) return selection;
  const provider = selection.provider;
  let selectedChoice = view?.choices.find((choice) => choice.id === provider);
  const runnableFixCommand = selectedChoice !== undefined
    ? runnableSetupProviderFixCommand(selectedChoice.fixCommand)
    : null;
  if (
    args.interactive &&
    selectedChoice !== undefined &&
    !selectedChoice.ready &&
    runnableFixCommand !== null
  ) {
    const runLogin = await confirm(
      args.input,
      args.out,
      args.theme,
      `${selectedChoice.label} is not ready. Run '${runnableFixCommand}' now?`,
      true,
    );
    if (runLogin === "install") {
      const login = await runSetupProviderFixCommand(runnableFixCommand);
      if (login.ok) {
        view = await refreshSetupAgentChoiceView({
          spawnCli: args.spawnCli,
          environment: args.environment,
        });
        selectedChoice = view.choices.find((choice) => choice.id === provider);
      } else {
        stepActive(
          args.out,
          args.theme,
          `${selectedChoice.label} login failed: ${login.error}`,
        );
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
    input: args.input,
    out: args.out,
    theme: args.theme,
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
    stepDone(args.out, args.theme, `Agent readiness: ${detail}`);
  }
  return { ok: true, provider, model };
}

function formatProviderChoice(
  theme: SetupTheme,
  choice: SetupProviderView["choices"][number],
): string {
  const status = providerStatusLabel(choice);
  const detail = providerDetailLabel(choice);
  const tag = choice.recommended
    ? `  ${dim(theme, "recommended")}`
    : "";
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
  return normalizeSetupProviderFixCommand(choice.fixCommand) ?? choice.detail;
}

function showUnavailableProvider(
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  choice: SetupProviderView["choices"][number],
): void {
  if (choice.readiness === "missing") {
    out.write(
      `\n  ${whiteBold(theme, `${choice.label} is not installed.`)}\n` +
        `  ${providerDetailLabel(choice)}\n\n`,
    );
    return;
  }
  out.write(
    `\n  ${whiteBold(theme, `${choice.label} is not signed in.`)}\n` +
      `  Run: ${providerDetailLabel(choice)}\n\n`,
  );
}
