export type FrontmatterSource =
  | { id: string; type: "file"; path: string; note?: string }
  | {
      id: string;
      type: "web";
      url: string;
      title?: string;
      retrieved_at?: string;
      note?: string;
    }
  | { id: string; type: "commit"; rev: string; note?: string }
  | { id: string; type: "pr"; url?: string; number?: string; note?: string }
  | { id: string; type: "issue"; url?: string; number?: string; note?: string }
  | {
      id: string;
      type: "conversation";
      path?: string;
      run_id?: string;
      note?: string;
    }
  | { id: string; type: "wiki"; slug: string; note?: string }
  | { id: string; type: "manual"; note: string };

export function coerceFrontmatterSources(v: unknown): {
  sources: FrontmatterSource[];
  legacySourceStrings: string[];
} {
  if (!Array.isArray(v)) return { sources: [], legacySourceStrings: [] };
  const sources: FrontmatterSource[] = [];
  const legacySourceStrings: string[] = [];
  for (const item of v) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed.length > 0) legacySourceStrings.push(trimmed);
      continue;
    }
    const source = coerceSource(item);
    if (source !== null) sources.push(source);
  }
  return { sources, legacySourceStrings };
}

function coerceSource(v: unknown): FrontmatterSource | null {
  if (v === null || v === undefined || typeof v !== "object" || Array.isArray(v)) {
    return null;
  }
  const obj = v as Record<string, unknown>;
  const id = coerceString(obj.id);
  const type = coerceString(obj.type);
  if (id === undefined || type === undefined) return null;
  const note = coerceString(obj.note);
  switch (type) {
    case "file": {
      const path = coerceString(obj.path);
      return path === undefined ? null : optional({ id, type, path, note });
    }
    case "web": {
      const url = coerceString(obj.url);
      if (url === undefined) return null;
      return optional({
        id,
        type,
        url,
        title: coerceString(obj.title),
        retrieved_at: coerceDateString(obj.retrieved_at),
        note,
      });
    }
    case "commit": {
      const rev = coerceString(obj.rev);
      return rev === undefined ? null : optional({ id, type, rev, note });
    }
    case "pr": {
      const url = coerceString(obj.url);
      const number = coerceString(obj.number) ?? coerceNumberString(obj.number);
      if (url === undefined && number === undefined) return null;
      return optional({ id, type, url, number, note });
    }
    case "issue": {
      const url = coerceString(obj.url);
      const number = coerceString(obj.number) ?? coerceNumberString(obj.number);
      if (url === undefined && number === undefined) return null;
      return optional({ id, type, url, number, note });
    }
    case "conversation": {
      const path = coerceString(obj.path);
      const run_id = coerceString(obj.run_id);
      if (path === undefined && run_id === undefined) return null;
      return optional({ id, type, path, run_id, note });
    }
    case "wiki": {
      const slug = coerceString(obj.slug);
      return slug === undefined ? null : optional({ id, type, slug, note });
    }
    case "manual": {
      if (note === undefined) return null;
      return { id, type, note };
    }
    default:
      return null;
  }
}

function optional<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

function coerceString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return undefined;
}

function coerceNumberString(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function coerceDateString(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return undefined;
}
