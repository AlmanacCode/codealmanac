import {
  buildProviderSetupView,
  parseAgentSelection,
  type ProviderReadiness,
  type ProviderSetupView,
} from "../agent/provider-view.js";
import {
  isAgentProviderId,
  readConfig,
  writeConfig,
  type AgentProviderId,
} from "../update/config.js";
import { formatTextTable } from "./table.js";

export interface AgentsResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runAgentsList(opts: {
  view?: ProviderSetupView;
} = {}): Promise<AgentsResult> {
  const view = opts.view ?? await buildProviderSetupView();
  const lines = ["Almanac agents\n"];
  lines.push(
    ...formatTextTable({
      headers: ["DEFAULT", "AGENT", "STATUS", "RECOMMENDED", "MODEL", "DETAIL"],
      rows: view.choices.map((choice) => [
        choice.selected ? "*" : "",
        choice.label,
        readinessLabel(choice.readiness),
        choice.recommended ? "recommended" : "",
        choice.effectiveModel ?? "provider default",
        choice.account ?? choice.fixCommand ?? choice.detail,
      ]),
    }),
  );
  lines.push(
    "\nUse: almanac agents use <claude|codex|cursor>",
    "Set model: almanac agents model <provider> <model>",
  );
  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}

export async function runAgentsDoctor(): Promise<AgentsResult> {
  const view = await buildProviderSetupView();
  const lines = ["Almanac agent doctor\n"];
  for (const choice of view.choices) {
    lines.push(`${choice.ready ? "✓" : "✗"} ${choice.label}`);
    lines.push(`  status: ${readinessLabel(choice.readiness)}`);
    lines.push(`  model: ${choice.effectiveModel ?? "provider default"}`);
    if (choice.account !== null) {
      lines.push(`  account: ${choice.account}`);
    } else if (choice.detail.length > 0) {
      lines.push(`  detail: ${choice.detail}`);
    }
    if (choice.fixCommand !== null) lines.push(`  fix: ${choice.fixCommand}`);
    lines.push("");
  }
  return { stdout: `${lines.join("\n").trimEnd()}\n`, stderr: "", exitCode: 0 };
}

export interface SetDefaultAgentOptions {
  provider: string;
}

export async function runSetDefaultAgent(
  opts: SetDefaultAgentOptions,
): Promise<AgentsResult> {
  return setDefaultAgent(opts);
}

export async function runDeprecatedSetDefaultAgent(
  opts: SetDefaultAgentOptions,
): Promise<AgentsResult> {
  return withDeprecation(
    await setDefaultAgent(opts),
    "almanac set default-agent <provider>",
    "almanac agents use <provider>",
  );
}

export async function runAgentsUse(opts: SetDefaultAgentOptions): Promise<AgentsResult> {
  return setDefaultAgent(opts);
}

async function setDefaultAgent(
  opts: SetDefaultAgentOptions,
): Promise<AgentsResult> {
  const parsed = parseAgentSelection(opts.provider);
  if (parsed.provider === null) {
    return {
      stdout: "",
      stderr:
        `almanac: unknown agent '${opts.provider}'. ` +
        "Expected one of: claude, codex, cursor.\n",
      exitCode: 1,
    };
  }
  const provider = parsed.provider;
  const config = await readConfig();
  const next = {
    ...config,
    agent: {
      ...config.agent,
      default: provider,
      models:
        parsed.model === undefined
          ? config.agent.models
          : {
              ...config.agent.models,
              [provider]: parsed.model,
            },
    },
  };
  await writeConfig(next);
  return {
    stdout:
      parsed.model === undefined
        ? `almanac: default agent set to ${provider}.\n`
        : `almanac: default agent set to ${provider}; ${provider} model set to ${parsed.model}.\n`,
    stderr: "",
    exitCode: 0,
  };
}

export async function runSetAgentModel(opts: {
  provider: string;
  model?: string;
  defaultModel?: boolean;
}): Promise<AgentsResult> {
  return setProviderModel(opts);
}

export async function runDeprecatedSetAgentModel(opts: {
  provider: string;
  model?: string;
  defaultModel?: boolean;
}): Promise<AgentsResult> {
  return withDeprecation(
    await setProviderModel(opts),
    "almanac set model <provider> <model>",
    "almanac agents model <provider> <model>",
  );
}

export async function runAgentsModel(opts: {
  provider: string;
  model?: string;
  defaultModel?: boolean;
}): Promise<AgentsResult> {
  return setProviderModel(opts);
}

async function setProviderModel(opts: {
  provider: string;
  model?: string;
  defaultModel?: boolean;
}): Promise<AgentsResult> {
  if (!isAgentProviderId(opts.provider)) {
    return {
      stdout: "",
      stderr:
        `almanac: unknown agent '${opts.provider}'. ` +
        "Expected one of: claude, codex, cursor.\n",
      exitCode: 1,
    };
  }
  if (
    opts.defaultModel !== true &&
    (opts.model === undefined || opts.model.length === 0)
  ) {
    return {
      stdout: "",
      stderr:
        `almanac: missing model for ${opts.provider}. ` +
        "Pass a model id or --default.\n",
      exitCode: 1,
    };
  }
  const provider = opts.provider as AgentProviderId;
  const config = await readConfig();
  const model = normalizeRequestedModel(opts);
  await writeConfig({
    ...config,
    agent: {
      ...config.agent,
      models: {
        ...config.agent.models,
        [provider]: model,
      },
    },
  });
  return {
    stdout:
      model === null
        ? `almanac: ${provider} model reset to provider default.\n`
        : `almanac: ${provider} model set to ${model}.\n`,
    stderr: "",
    exitCode: 0,
  };
}

function normalizeRequestedModel(opts: {
  provider: string;
  model?: string;
  defaultModel?: boolean;
}): string | null {
  if (opts.defaultModel === true) return null;
  if (opts.model === undefined || opts.model.length === 0) return null;
  if (opts.model === "default" || opts.model === "null") return null;
  return opts.model;
}

function readinessLabel(readiness: ProviderReadiness): string {
  switch (readiness) {
    case "ready":
      return "ready";
    case "missing":
      return "missing";
    case "not-authenticated":
      return "not ready";
  }
}

function withDeprecation(
  result: AgentsResult,
  oldUsage: string,
  newUsage: string,
): AgentsResult {
  return {
    ...result,
    stderr:
      `almanac: warning: \`${oldUsage}\` is deprecated; use \`${newUsage}\`.\n` +
      result.stderr,
  };
}
