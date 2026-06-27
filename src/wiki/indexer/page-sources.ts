import { basename, dirname } from "node:path/posix";

import type { FrontmatterSource } from "./frontmatter-sources.js";
import { looksLikeDir, normalizePath } from "./paths.js";

export interface IndexedPageSource {
  id: string;
  type: FrontmatterSource["type"];
  target: string;
  title?: string;
  retrieved_at?: string;
  note?: string;
  legacy: boolean;
}

export interface DerivedFileRef {
  rawPath: string;
  source: "structured-source" | "legacy-files";
}

export interface NormalizedPageSources {
  sources: IndexedPageSource[];
  fileRefs: DerivedFileRef[];
  hasLegacyFrontmatter: boolean;
  ambiguousLegacySources: string[];
}

export function normalizePageSources(input: {
  sources: FrontmatterSource[];
  legacyFiles: string[];
  legacySourceStrings: string[];
}): NormalizedPageSources {
  const usedIds = new Set(input.sources.map((source) => source.id));
  const sources: IndexedPageSource[] = [];
  const fileRefs: DerivedFileRef[] = [];
  const ambiguousLegacySources: string[] = [];

  for (const source of input.sources) {
    const indexed = sourceToIndexed(source, false);
    if (indexed === null) continue;
    sources.push(indexed);
    if (source.type === "file") {
      fileRefs.push({ rawPath: source.path, source: "structured-source" });
    }
  }

  for (const path of input.legacyFiles) {
    const id = uniqueId(idFromPath(path), usedIds);
    sources.push({
      id,
      type: "file",
      target: normalizeFileTarget(path),
      note: "Migrated from legacy files.",
      legacy: true,
    });
    fileRefs.push({ rawPath: path, source: "legacy-files" });
  }

  for (const raw of input.legacySourceStrings) {
    if (!isHttpUrl(raw)) {
      ambiguousLegacySources.push(raw);
      continue;
    }
    const id = uniqueId(idFromUrl(raw), usedIds);
    sources.push({
      id,
      type: "web",
      target: raw,
      note: "Migrated from legacy sources.",
      legacy: true,
    });
  }

  return {
    sources,
    fileRefs,
    hasLegacyFrontmatter:
      input.legacyFiles.length > 0 || input.legacySourceStrings.length > 0,
    ambiguousLegacySources,
  };
}

function sourceToIndexed(
  source: FrontmatterSource,
  legacy: boolean,
): IndexedPageSource | null {
  switch (source.type) {
    case "file":
      return optional({
        id: source.id,
        type: source.type,
        target: normalizeFileTarget(source.path),
        note: source.note,
        legacy,
      });
    case "web":
      return optional({
        id: source.id,
        type: source.type,
        target: source.url,
        title: source.title,
        retrieved_at: source.retrieved_at,
        note: source.note,
        legacy,
      });
    case "commit":
      return optional({
        id: source.id,
        type: source.type,
        target: source.rev,
        note: source.note,
        legacy,
      });
    case "pr":
    case "issue":
      return optional({
        id: source.id,
        type: source.type,
        target: source.url ?? source.number,
        note: source.note,
        legacy,
      });
    case "conversation":
      return optional({
        id: source.id,
        type: source.type,
        target: source.path ?? source.run_id,
        note: source.note,
        legacy,
      });
    case "wiki":
      return optional({
        id: source.id,
        type: source.type,
        target: source.slug,
        note: source.note,
        legacy,
      });
    case "manual":
      return {
        id: source.id,
        type: source.type,
        target: source.note,
        note: source.note,
        legacy,
      };
  }
}

function optional(
  source: Omit<IndexedPageSource, "target"> & { target?: string },
): IndexedPageSource | null {
  if (source.target === undefined || source.target.length === 0) return null;
  return {
    id: source.id,
    type: source.type,
    target: source.target,
    legacy: source.legacy,
    ...(source.title !== undefined ? { title: source.title } : {}),
    ...(source.retrieved_at !== undefined ? { retrieved_at: source.retrieved_at } : {}),
    ...(source.note !== undefined ? { note: source.note } : {}),
  };
}

function uniqueId(base: string, used: Set<string>): string {
  let candidate = base.length > 0 ? base : "source";
  let i = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${i}`;
    i++;
  }
  used.add(candidate);
  return candidate;
}

function idFromPath(path: string): string {
  const withoutSlash = path.replace(/\/+$/, "");
  const leaf = basename(withoutSlash) || basename(dirname(withoutSlash));
  return kebab(leaf.replace(/\.[^.]+$/, ""));
}

function idFromUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const pathBits = url.pathname.split("/").filter((bit) => bit.length > 0);
    const last = pathBits[pathBits.length - 1] ?? "";
    const stem = last.replace(/\.[^.]+$/, "");
    return kebab(stem.length > 0 ? stem : url.hostname.replace(/^www\./, ""));
  } catch {
    return kebab(raw);
  }
}

function isHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function kebab(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeFileTarget(path: string): string {
  return normalizePath(path, looksLikeDir(path));
}
