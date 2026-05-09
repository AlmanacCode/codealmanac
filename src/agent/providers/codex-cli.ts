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

export const codexProvider: AgentProvider = {
  metadata,
  checkStatus,
  assertReady,
  run,
  modelChoices,
};

interface CodexCatalogModel {
  slug: string;
  displayName: string;
}

const CODEX_MODEL_ORDER = [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
] as const;

const CODEX_MODEL_LABELS: Record<string, string> = {
  "gpt-5.5": "GPT-5.5",
  "gpt-5.4": "GPT-5.4",
  "gpt-5.4-mini": "GPT-5.4 Mini",
  "gpt-5.3-codex": "GPT-5.3 Codex",
};

async function modelChoices(args: {
  configuredModel: string | null;
  spawnCli?: SpawnCliFn;
}): Promise<ProviderModelChoice[]> {
  const catalog = await readCodexModelCatalog(args.spawnCli);
  const choices: ProviderModelChoice[] = [];
  if (args.configuredModel !== null) {
    choices.push({
      value: args.configuredModel,
      label: modelLabel(args.configuredModel, catalog),
      recommended: false,
      source: "configured",
    });
  }
  for (const slug of CODEX_MODEL_ORDER) {
    if (choices.some((choice) => choice.value === slug)) continue;
    if (catalog !== undefined && !catalog.some((model) => model.slug === slug)) {
      continue;
    }
    choices.push({
      value: slug,
      label: modelLabel(slug, catalog),
      recommended: slug === "gpt-5.4",
      source: "catalog",
    });
  }
  choices.push({
    value: "__custom__",
    label: "Enter a model name",
    recommended: false,
    source: "custom",
  });
  return choices;
}

async function readCodexModelCatalog(
  spawnCli?: SpawnCliFn,
): Promise<CodexCatalogModel[] | undefined> {
  if (spawnCli === undefined) return undefined;
  try {
    const result = await collectSpawn(spawnCli(["codex", "debug", "models"]));
    if (result.code !== 0) return undefined;
    const parsed = JSON.parse(result.stdout) as unknown;
    if (parsed === null || typeof parsed !== "object") return undefined;
    const models = (parsed as { models?: unknown }).models;
    if (!Array.isArray(models)) return undefined;
    const out: CodexCatalogModel[] = [];
    for (const model of models) {
      if (model === null || typeof model !== "object") continue;
      const record = model as Record<string, unknown>;
      if (record.visibility !== "list") continue;
      if (typeof record.slug !== "string") continue;
      out.push({
        slug: record.slug,
        displayName: typeof record.display_name === "string"
          ? record.display_name
          : record.slug,
      });
    }
    return out;
  } catch {
    return undefined;
  }
}

function collectSpawn(
  child: ReturnType<SpawnCliFn>,
): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    let stdout = "";
    let settled = false;
    const settle = (code: number): void => {
      if (settled) return;
      settled = true;
      resolve({ stdout, code });
    };
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", () => {
      settle(1);
    });
    child.on("close", (codeOrError) => {
      settle(typeof codeOrError === "number" ? codeOrError ?? 1 : 1);
    });
  });
}

function modelLabel(
  slug: string,
  catalog: CodexCatalogModel[] | undefined,
): string {
  return CODEX_MODEL_LABELS[slug] ??
    catalog?.find((model) => model.slug === slug)?.displayName ??
    slug;
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
    ? await runInjectedStatusCommand(spawnCli, [
      metadata.executable,
      "login",
      "status",
    ])
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
