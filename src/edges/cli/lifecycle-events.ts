import type { AgentRuntimeEvent, AgentRuntimeToolDisplay } from "../../shared/agent-runtime/events.js";

function writeForegroundEvent(event: AgentRuntimeEvent): void {
  const line = formatForegroundEvent(event);
  if (line !== null) process.stdout.write(`${line}\n`);
}

export function lifecycleForegroundEventHandler(
  opts: { verbose?: boolean },
): ((event: AgentRuntimeEvent) => void) | undefined {
  return opts.verbose === true ? writeForegroundEvent : undefined;
}

export function initStartMessage(
  opts: { background?: boolean; json?: boolean; verbose?: boolean },
): string | null {
  if (opts.background === true || opts.json === true) return null;
  return "Analyzing codebase... This usually takes 5-10 minutes.\n";
}

export function formatForegroundEvent(event: AgentRuntimeEvent): string | null {
  switch (event.type) {
    case "text":
      return event.content.trim().length > 0 ? event.content.trim() : null;
    case "tool_use":
      return `[tool] ${formatToolDisplay(event.tool, event.display)}`;
    case "tool_result":
      return event.display !== undefined
        ? `[tool] ${formatToolDisplay("tool", event.display)}`
        : null;
    case "tool_summary":
      return `[tool] ${event.summary}`;
    case "error":
      return null;
    case "done":
      return event.error !== undefined ? null : "[done]";
    default:
      return null;
  }
}

function formatToolDisplay(
  fallbackTool: string,
  display: AgentRuntimeToolDisplay | undefined,
): string {
  if (display === undefined) return fallbackTool;
  const title = display.title ?? fallbackTool;
  const target = display.path ?? display.command ?? display.summary;
  const status =
    display.status === "completed" && display.exitCode !== undefined
      ? `exit ${display.exitCode}`
      : display.status === "failed"
        ? "failed"
        : display.status === "declined"
          ? "declined"
          : undefined;
  return [title, target, status].filter(Boolean).join(" ");
}
