import {
  type ProviderReadiness,
  type ProviderSetupView,
} from "../../services/agents/index.js";
import {
  readAgentsView,
  setAgentModel,
  setDefaultAgent as setDefaultAgentService,
} from "../../services/agents/index.js";
import { formatTextTable } from "./table.js";

export interface AgentsResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runAgentsList(opts: {
  view?: ProviderSetupView;
} = {}): Promise<AgentsResult> {
  const view = await readAgentsView(opts);
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
  const view = await readAgentsView();
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

export async function runAgentsUse(opts: SetDefaultAgentOptions): Promise<AgentsResult> {
  return setDefaultAgent(opts);
}

async function setDefaultAgent(
  opts: SetDefaultAgentOptions,
): Promise<AgentsResult> {
  const result = await setDefaultAgentService({
    cwd: process.cwd(),
    provider: opts.provider,
  });
  if (result.status === "unknown-agent") {
    return {
      stdout: "",
      stderr:
        `almanac: unknown agent '${opts.provider}'. ` +
        "Expected one of: claude, codex, cursor.\n",
      exitCode: 1,
    };
  }
  return {
    stdout: result.model === undefined
      ? `almanac: default agent set to ${result.provider}.\n`
      : `almanac: default agent set to ${result.provider}; ${result.provider} model set to ${result.model}.\n`,
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
  const result = await setAgentModel({
    cwd: process.cwd(),
    provider: opts.provider,
    model: opts.model,
    defaultModel: opts.defaultModel,
  });
  if (result.status === "unknown-agent") {
    return {
      stdout: "",
      stderr:
        `almanac: unknown agent '${opts.provider}'. ` +
        "Expected one of: claude, codex, cursor.\n",
      exitCode: 1,
    };
  }
  if (result.status === "missing-model") {
    return {
      stdout: "",
      stderr:
        `almanac: missing model for ${opts.provider}. ` +
        "Pass a model id or --default.\n",
      exitCode: 1,
    };
  }
  return {
    stdout: result.status === "model-reset"
      ? `almanac: ${result.provider} model reset to provider default.\n`
      : `almanac: ${result.provider} model set to ${result.model}.\n`,
    stderr: "",
    exitCode: 0,
  };
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
