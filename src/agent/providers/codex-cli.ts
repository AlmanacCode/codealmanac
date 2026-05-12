import type {
  AgentProvider,
  AgentProviderMetadata,
  AgentResult,
  ProviderModelChoice,
  ProviderStatus,
  RunAgentOptions,
  SpawnCliFn,
} from "../types.js";
import {
  commandExists,
  runInjectedStatusCommand,
  runStatusCommand,
} from "./cli-status.js";
import { parseUsage, runJsonlCli } from "./jsonl-cli.js";
import { combinedPrompt } from "./prompt.js";

const metadata: AgentProviderMetadata = {
  id: "codex",
  displayName: "Codex",
  defaultModel: null,
  executable: "codex",
  capabilities: {
    transport: "cli-jsonl",
    writesFiles: true,
    supportsModelOverride: true,
    supportsStreaming: true,
    supportsSessionId: false,
    supportsUsage: true,
    supportsCost: false,
    supportsProviderReportedTurns: false,
    supportsProgrammaticSubagents: false,
    supportsStrictToolAllowlist: false,
  },
};

const CODEX_MODEL_ORDER = [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
] as const;

const CODEX_MODEL_LABELS: Record<string, string> = {
  "gpt-5.5": "GPT-5.5",
  "gpt-5.4": "GPT-5.4",
  "gpt-5.4-mini": "GPT-5.4-Mini",
  "gpt-5.3-codex": "GPT-5.3 Codex",
};

const RECOMMENDED_CODEX_MODEL = "gpt-5.4";

export const codexProvider: AgentProvider = {
  metadata,
  checkStatus,
  assertReady,
  modelChoices,
  run,
};

async function modelChoices(opts: {
  configuredModel: string | null;
  spawnCli?: SpawnCliFn;
}): Promise<ProviderModelChoice[]> {
  const choices: ProviderModelChoice[] = [];
  if (opts.configuredModel !== null) {
    choices.push({
      value: opts.configuredModel,
      label: CODEX_MODEL_LABELS[opts.configuredModel] ?? opts.configuredModel,
      recommended: false,
      source: "configured",
    });
  }

  const catalog = opts.spawnCli !== undefined
    ? await listCodexModels(opts.spawnCli)
    : [];
  const visible = catalog.length > 0 ? catalog : [...CODEX_MODEL_ORDER];
  for (const slug of visible) {
    if (!CODEX_MODEL_ORDER.includes(slug as (typeof CODEX_MODEL_ORDER)[number])) {
      continue;
    }
    const existing = choices.find((choice) => choice.value === slug);
    if (existing !== undefined) {
      existing.label = CODEX_MODEL_LABELS[slug] ?? slug;
      existing.recommended = slug === RECOMMENDED_CODEX_MODEL;
      existing.source = "catalog";
      continue;
    }
    choices.push({
      value: slug,
      label: CODEX_MODEL_LABELS[slug] ?? slug,
      recommended: slug === RECOMMENDED_CODEX_MODEL,
      source: "catalog",
    });
  }

  if (!choices.some((choice) => choice.recommended)) {
    const recommended = choices.find(
      (choice) => choice.value === RECOMMENDED_CODEX_MODEL,
    );
    if (recommended !== undefined) recommended.recommended = true;
  }
  choices.push({
    value: "__custom__",
    label: "Enter a model name",
    recommended: false,
    source: "custom",
  });
  return choices;
}

async function listCodexModels(spawnCli: SpawnCliFn): Promise<string[]> {
  return new Promise((resolve) => {
    let stdout = "";
    let settled = false;
    const settle = (models: string[]): void => {
      if (settled) return;
      settled = true;
      resolve(models);
    };
    try {
      const child = spawnCli(["codex", "debug", "models"]);
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.on("error", () => settle([]));
      child.on("close", (code) => {
        if (code !== 0) {
          settle([]);
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as {
            models?: { slug?: unknown; visibility?: unknown }[];
          };
          settle(
            (parsed.models ?? [])
              .filter((model) =>
                typeof model.slug === "string" &&
                model.visibility !== "hidden"
              )
              .map((model) => model.slug as string),
          );
        } catch {
          settle([]);
        }
      });
    } catch {
      settle([]);
    }
  });
}

async function run(opts: RunAgentOptions): Promise<AgentResult> {
  const args = [
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "--skip-git-repo-check",
    "-C",
    opts.cwd,
  ];
  if (opts.model !== undefined && opts.model.length > 0) {
    args.push("--model", opts.model);
  }
  args.push(combinedPrompt({ ...opts, provider: "codex" }, metadata));

  return await runJsonlCli({
    command: metadata.executable,
    args,
    cwd: opts.cwd,
    env: { ...process.env, CODEALMANAC_INTERNAL_SESSION: "1" },
    onMessage: opts.onMessage,
    parseFinal: parseCodexFinal,
  });
}

async function checkStatus(spawnCli?: SpawnCliFn): Promise<ProviderStatus> {
  if (spawnCli === undefined && !commandExists(metadata.executable)) {
    return {
      id: metadata.id,
      installed: false,
      authenticated: false,
      detail: `${metadata.executable} not found on PATH`,
    };
  }

  const auth = spawnCli !== undefined
    ? await runInjectedStatusCommand(
        spawnCli,
        ["login", "status"],
        metadata.executable,
      )
    : await runStatusCommand(metadata.executable, ["login", "status"]);
  return {
    id: metadata.id,
    installed: true,
    authenticated: auth.ok,
    detail: auth.detail,
  };
}

async function assertReady(spawnCli?: SpawnCliFn): Promise<void> {
  const status = await checkStatus(spawnCli);
  if (!status.installed || !status.authenticated) {
    const err = new Error(`${status.id} not ready: ${status.detail}`);
    (err as { code?: string }).code = "AGENT_AUTH_MISSING";
    throw err;
  }
}

function parseCodexFinal(
  msg: Record<string, unknown>,
): Partial<AgentResult> | null {
  if (msg.type === "item.completed") {
    const item = msg.item;
    if (item !== null && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (obj.type === "agent_message" && typeof obj.text === "string") {
        return { result: obj.text };
      }
    }
    return null;
  }
  if (msg.type === "turn.completed") {
    return { success: true, turns: 1, usage: parseUsage(msg.usage) };
  }
  if (msg.type === "turn.failed" || msg.type === "error") {
    return {
      success: false,
      error:
        typeof msg.message === "string"
          ? msg.message
          : typeof msg.error === "string"
            ? msg.error
            : "codex turn failed",
    };
  }
  return null;
}
