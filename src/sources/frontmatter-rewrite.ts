import { rename, writeFile } from "node:fs/promises";

import yaml from "js-yaml";

export interface SourceFrontmatterFixResult {
  output: string;
  changed: boolean;
  notFixable: string[];
}

export function applySourceFrontmatterFix(
  raw: string,
): SourceFrontmatterFixResult {
  const split = splitFrontmatter(raw);
  if (split === null) {
    return { output: raw, changed: false, notFixable: [] };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(split.frontmatter);
  } catch {
    return { output: raw, changed: false, notFixable: [] };
  }
  if (parsed === null || parsed === undefined) {
    return { output: raw, changed: false, notFixable: [] };
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    return { output: raw, changed: false, notFixable: [] };
  }

  const fm = parsed as Record<string, unknown>;
  const legacyFiles = stringArray(fm.files);
  const rawSources = Array.isArray(fm.sources) ? fm.sources : [];
  const structuredSources: unknown[] = [];
  const legacyUrls: string[] = [];
  const notFixable: string[] = [];

  for (const source of rawSources) {
    if (typeof source !== "string") {
      structuredSources.push(source);
      continue;
    }
    const trimmed = source.trim();
    if (trimmed.length === 0) continue;
    if (isHttpUrl(trimmed)) legacyUrls.push(trimmed);
    else notFixable.push(trimmed);
  }

  if (legacyFiles.length === 0 && legacyUrls.length === 0) {
    return { output: raw, changed: false, notFixable };
  }

  const usedIds = collectSourceIds(structuredSources);
  const nextSources = [...structuredSources];
  for (const path of legacyFiles) {
    nextSources.push({
      id: uniqueId(idFromPath(path), usedIds),
      type: "file",
      path,
      note: "Migrated from legacy files.",
    });
  }
  for (const url of legacyUrls) {
    nextSources.push({
      id: uniqueId(idFromUrl(url), usedIds),
      type: "web",
      url,
      note: "Migrated from legacy sources.",
    });
  }
  for (const source of notFixable) {
    nextSources.push(source);
  }

  delete fm.files;
  fm.sources = nextSources;

  const nextFrontmatter = yaml.dump(fm, {
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
  const output = `${split.opener}${nextFrontmatter}${split.closer}${split.body}`;
  return { output, changed: output !== raw, notFixable };
}

export async function writeSourceFrontmatterFix(
  filePath: string,
  fixed: SourceFrontmatterFixResult,
): Promise<void> {
  if (!fixed.changed) return;
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, fixed.output, "utf8");
  await rename(tmp, filePath);
}

interface SplitFrontmatter {
  opener: string;
  frontmatter: string;
  closer: string;
  body: string;
}

function splitFrontmatter(raw: string): SplitFrontmatter | null {
  if (!raw.startsWith("---")) return null;
  const match = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/);
  if (match === null) return null;
  return {
    opener: match[1] ?? "---\n",
    frontmatter: match[2] ?? "",
    closer: match[3] ?? "\n---\n",
    body: match[4] ?? "",
  };
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function collectSourceIds(sources: unknown[]): Set<string> {
  const out = new Set<string>();
  for (const source of sources) {
    if (source === null || source === undefined) continue;
    if (typeof source !== "object" || Array.isArray(source)) continue;
    const id = (source as Record<string, unknown>).id;
    if (typeof id === "string" && id.trim().length > 0) out.add(id.trim());
  }
  return out;
}

function uniqueId(base: string, used: Set<string>): string {
  const stem = base.length > 0 ? base : "source";
  let candidate = stem;
  let i = 2;
  while (used.has(candidate)) {
    candidate = `${stem}-${i}`;
    i++;
  }
  used.add(candidate);
  return candidate;
}

function idFromPath(path: string): string {
  const withoutSlash = path.replace(/\/+$/, "");
  const parts = withoutSlash.split("/").filter((part) => part.length > 0);
  const leaf = parts[parts.length - 1] ?? "source";
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
