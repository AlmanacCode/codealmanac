export type ToolId =
  | "read"
  | "write"
  | "edit"
  | "search"
  | "shell"
  | "web"
  | "mcp";

export type ShellPolicy = "read-only" | "default";

export interface ToolRequest {
  id: ToolId;
  policy?: ShellPolicy;
  server?: string;
}

const TOOL_IDS: readonly ToolId[] = [
  "read",
  "write",
  "edit",
  "search",
  "shell",
  "web",
  "mcp",
];

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

export function uniqueToolRequests(tools: readonly ToolRequest[]): ToolRequest[] {
  const seen = new Set<string>();
  const out: ToolRequest[] = [];
  for (const tool of tools) {
    const key = `${tool.id}:${tool.policy ?? ""}:${tool.server ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tool);
  }
  return out;
}
