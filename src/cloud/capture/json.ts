export function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function stringAt(
  value: Record<string, unknown>,
  paths: readonly (readonly string[])[],
): string | null {
  for (const path of paths) {
    const found = nestedValue(value, path);
    if (typeof found === "string" && found.trim().length > 0) return found.trim();
  }
  return null;
}

export function textFromUnknown(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => textFromUnknown(item))
      .filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "content", "message", "value"]) {
      const text = textFromUnknown(record[key]);
      if (text !== null) return text;
    }
  }
  return null;
}

function nestedValue(
  value: Record<string, unknown>,
  path: readonly string[],
): unknown {
  let current: unknown = value;
  for (const part of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
