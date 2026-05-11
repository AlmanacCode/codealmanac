export function buildTranscript(entries) {
  const transcript = [];
  const toolsById = new Map();
  let assistant = null;

  const ensureAssistant = (timestamp) => {
    if (assistant === null) {
      assistant = { type: "assistant", timestamp, text: "" };
      transcript.push(assistant);
    }
    return assistant;
  };

  const closeAssistant = () => {
    assistant = null;
  };

  for (const entry of entries) {
    if (entry.invalid) {
      closeAssistant();
      transcript.push({ type: "invalid", line: entry.line, raw: entry.raw, error: entry.error });
      continue;
    }

    const event = entry.event;
    if (event.type === "text_delta" || event.type === "text") {
      ensureAssistant(entry.timestamp).text += event.content;
      continue;
    }

    if (event.type === "done" && event.result) {
      const bubble = ensureAssistant(entry.timestamp);
      bubble.text += `${bubble.text ? "\n\n" : ""}${event.result}`;
      if (!event.error) continue;
    }

    closeAssistant();

    if (event.type === "tool_use") {
      const tool = {
        type: "tool",
        timestamp: entry.timestamp,
        id: event.id ?? null,
        name: event.tool,
        input: event.input,
        display: event.display ?? {},
        hasResult: false,
        result: null,
        resultDisplay: null,
        resultTimestamp: null,
        isError: false,
      };
      transcript.push(tool);
      if (tool.id) toolsById.set(tool.id, tool);
      continue;
    }

    if (event.type === "tool_result") {
      const paired = event.id ? toolsById.get(event.id) : null;
      if (paired) {
        paired.hasResult = true;
        paired.result = event.content;
        paired.resultDisplay = event.display ?? null;
        paired.resultTimestamp = entry.timestamp;
        paired.isError = Boolean(event.isError);
        continue;
      }
      transcript.push({
        type: "tool",
        timestamp: entry.timestamp,
        id: event.id ?? null,
        name: "tool_result",
        input: null,
        display: event.display ?? {},
        hasResult: true,
        result: event.content,
        resultDisplay: event.display ?? null,
        resultTimestamp: entry.timestamp,
        isError: Boolean(event.isError),
      });
      continue;
    }

    if (event.type === "tool_summary") {
      transcript.push({ type: "status", timestamp: entry.timestamp, tone: "neutral", title: "Tool summary", detail: event.summary });
      continue;
    }

    if (event.type === "context_usage") {
      transcript.push({
        type: "status",
        timestamp: entry.timestamp,
        tone: "neutral",
        title: "Context usage",
        detail: stringifyEventValue(event.usage),
      });
      continue;
    }

    if (event.type === "error") {
      transcript.push({
        type: "status",
        timestamp: entry.timestamp,
        tone: "error",
        title: event.error || "Error",
        detail: event.failure?.fix ?? event.failure?.raw ?? "",
      });
      continue;
    }

    if (event.type === "done" && event.error) {
      transcript.push({
        type: "status",
        timestamp: entry.timestamp,
        tone: "error",
        title: event.error,
        detail: event.failure?.fix ?? event.failure?.raw ?? "",
      });
    }
  }

  return transcript.filter((entry) => entry.type !== "assistant" || entry.text.trim().length > 0);
}

export function getToolCardModel(step) {
  const display = step.display ?? {};
  const resultDisplay = step.resultDisplay ?? {};
  const kind = normalizeToolKind(display.kind ?? inferToolKind(step.name, display));
  const title = display.title ?? titleFromToolName(step.name, kind);
  const preview =
    display.path ??
    display.command ??
    display.summary ??
    getInputPreview(step.input) ??
    resultDisplay.summary ??
    "";
  const status = resultDisplay.status ?? display.status ?? (step.hasResult ? "completed" : "started");
  const isError = Boolean(step.isError) || status === "failed";

  return {
    kind,
    icon: iconForKind(kind, isError),
    title,
    preview,
    status,
    statusLabel: statusLabel(status, isError),
    isError,
  };
}

export function stringifyEventValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function parseJsonObject(text) {
  if (typeof text !== "string" || text.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function inferToolKind(name, display) {
  const normalized = String(name ?? "").toLowerCase();
  if (display.command) return "shell";
  if (display.path) {
    if (normalized.includes("write")) return "write";
    if (normalized.includes("edit") || normalized.includes("patch")) return "edit";
    return "read";
  }
  if (normalized === "agent" || normalized.includes("agent")) return "agent";
  if (normalized.includes("search")) return "search";
  if (normalized.includes("web") || normalized.includes("url")) return "web";
  if (normalized.includes("image")) return "image";
  if (normalized.includes("mcp")) return "mcp";
  return "unknown";
}

function normalizeToolKind(kind) {
  const known = new Set(["read", "write", "edit", "search", "shell", "mcp", "web", "agent", "image", "unknown"]);
  return known.has(kind) ? kind : "unknown";
}

function titleFromToolName(name, kind) {
  if (kind === "agent") return "Subagent";
  if (kind === "shell") return "Shell command";
  if (kind === "search") return "Search";
  if (kind === "web") return "Web";
  if (kind === "read") return "Read";
  if (kind === "write") return "Write";
  if (kind === "edit") return "Edit";
  return String(name ?? "Tool").replace(/[_-]/g, " ");
}

function getInputPreview(input) {
  const parsed = parseJsonObject(input);
  if (!parsed) return typeof input === "string" ? truncate(input, 96) : "";
  const value = parsed.description ?? parsed.prompt ?? parsed.query ?? parsed.path ?? parsed.command ?? parsed.url;
  if (typeof value === "string") return truncate(value, 96);
  if (Array.isArray(value)) return truncate(value.slice(0, 3).join(", "), 96);
  return "";
}

function iconForKind(kind, isError) {
  if (isError) return "!";
  if (kind === "read") return "R";
  if (kind === "write" || kind === "edit") return "E";
  if (kind === "search") return "S";
  if (kind === "shell") return "$";
  if (kind === "web") return "W";
  if (kind === "agent") return "A";
  if (kind === "image") return "I";
  if (kind === "mcp") return "M";
  return "-";
}

function statusLabel(status, isError) {
  if (isError) return "failed";
  if (status === "completed") return "completed";
  if (status === "declined") return "declined";
  if (status === "failed") return "failed";
  return "running";
}

function truncate(text, limit) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3)}...`;
}
