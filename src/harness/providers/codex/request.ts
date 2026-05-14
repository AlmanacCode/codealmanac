import { createRequire } from "node:module";

import type { AgentRunSpec } from "../../types.js";

export interface CodexExecRequest {
  command: "codex";
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface CodexAppServerRequest {
  command: "codex";
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export function buildCodexExecRequest(spec: AgentRunSpec): CodexExecRequest {
  const unsupported = unsupportedCodexSpecFields(spec);
  if (unsupported.length > 0) {
    throw new Error(
      `Codex exec adapter does not support: ${unsupported.join(", ")}`,
    );
  }
  const args = [
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "--skip-git-repo-check",
    "-C",
    spec.cwd,
  ];
  if (spec.provider.model !== undefined && spec.provider.model.length > 0) {
    args.push("--model", spec.provider.model);
  }
  if (spec.output?.schemaPath !== undefined) {
    args.push("--output-schema", spec.output.schemaPath);
  }
  args.push(combineCodexPrompt(spec));
  return {
    command: "codex",
    args,
    cwd: spec.cwd,
    env: codexEnv(),
  };
}

export function buildCodexAppServerRequest(spec: AgentRunSpec): CodexAppServerRequest {
  const unsupported = unsupportedCodexSpecFields(spec);
  if (unsupported.length > 0) {
    throw new Error(
      `Codex app-server adapter does not support: ${unsupported.join(", ")}`,
    );
  }
  return {
    command: "codex",
    args: ["app-server", "--config", "mcp_servers={}", "--listen", "stdio://"],
    cwd: spec.cwd,
    env: codexEnv(),
  };
}

export function unsupportedCodexSpecFields(spec: AgentRunSpec): string[] {
  const unsupported: string[] = [];
  if (spec.skills !== undefined && spec.skills.length > 0) unsupported.push("skills");
  if (spec.mcpServers !== undefined && Object.keys(spec.mcpServers).length > 0) {
    unsupported.push("mcpServers");
  }
  if (spec.limits?.maxCostUsd !== undefined) unsupported.push("limits.maxCostUsd");
  return unsupported;
}

export function combineCodexPrompt(spec: AgentRunSpec): string {
  const blocks = [spec.systemPrompt, spec.prompt].filter(
    (block): block is string => block !== undefined && block.trim().length > 0,
  );
  return blocks.join("\n\n---\n\n");
}

export function codexClientVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../../../package.json") as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall through to a stable unknown string rather than failing runs.
  }
  return "unknown";
}

function codexEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CODEALMANAC_INTERNAL_SESSION: "1",
  };
}
