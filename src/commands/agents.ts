import { listProviderStatuses } from "../agent/providers.js";
import {
  isAgentProviderId,
  readConfig,
  writeConfig,
  type AgentProviderId,
} from "../update/config.js";

export interface AgentsResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runAgentsList(): Promise<AgentsResult> {
  const config = await readConfig();
  const statuses = await listProviderStatuses();
  const lines = ["codealmanac agents\n"];
  for (const status of statuses) {
    const selected = status.id === config.agent.default ? "*" : " ";
    const auth = status.authenticated ? "ready" : "not ready";
    const installed = status.installed ? "installed" : "missing";
    lines.push(
      `${selected} ${status.id.padEnd(6)} ${installed.padEnd(9)} ${auth.padEnd(9)} ${status.detail}`,
    );
  }
  lines.push("\nChange default with: almanac set default-agent <claude|codex|cursor>");
  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}

export interface SetDefaultAgentOptions {
  provider: string;
}

export async function runSetDefaultAgent(
  opts: SetDefaultAgentOptions,
): Promise<AgentsResult> {
  if (!isAgentProviderId(opts.provider)) {
    return {
      stdout: "",
      stderr:
        `almanac: unknown agent '${opts.provider}'. ` +
        "Expected one of: claude, codex, cursor.\n",
      exitCode: 1,
    };
  }
  const config = await readConfig();
  const next = {
    ...config,
    agent: {
      ...config.agent,
      default: opts.provider,
    },
  };
  await writeConfig(next);
  return {
    stdout: `codealmanac: default agent set to ${opts.provider}.\n`,
    stderr: "",
    exitCode: 0,
  };
}

export async function runSetAgentModel(opts: {
  provider: string;
  model?: string;
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
  const provider = opts.provider as AgentProviderId;
  const config = await readConfig();
  const model =
    opts.model !== undefined && opts.model.length > 0 ? opts.model : null;
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
        ? `codealmanac: ${provider} model reset to provider default.\n`
        : `codealmanac: ${provider} model set to ${model}.\n`,
    stderr: "",
    exitCode: 0,
  };
}
