import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import yaml from "js-yaml";

import { toKebabCase } from "../slug.js";

export type ReviewStatus = "open" | "decided" | "applied";

export interface ReviewItem {
  id: string;
  status: ReviewStatus;
  summary: string;
  created_at: string;
  body: string;
  decided_at: string | null;
  decision: string | null;
  applied_at: string | null;
  application: string | null;
  reopened_at?: string | null;
  reopen_note?: string | null;
}

export interface ReviewFile {
  version: 1;
  items: ReviewItem[];
}

export function reviewYamlPath(repoRoot: string): string {
  return join(repoRoot, ".almanac", "review.yaml");
}

export async function loadReviewFile(path: string): Promise<ReviewFile> {
  if (!existsSync(path)) return { version: 1, items: [] };

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return { version: 1, items: [] };
    }
    throw err;
  }

  if (raw.trim().length === 0) return { version: 1, items: [] };

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`review.yaml at ${path} is not valid YAML: ${message}`);
  }

  if (parsed === null || parsed === undefined) return { version: 1, items: [] };
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`review.yaml at ${path} must be a mapping`);
  }

  const obj = parsed as Record<string, unknown>;
  const version = obj.version === undefined ? 1 : obj.version;
  if (version !== 1) {
    throw new Error(`review.yaml at ${path} has unsupported version ${String(version)}`);
  }

  const rawItems = obj.items;
  if (rawItems === undefined || rawItems === null) {
    return { version: 1, items: [] };
  }
  if (!Array.isArray(rawItems)) {
    throw new Error(`review.yaml at ${path} - "items" must be a list`);
  }

  const items: ReviewItem[] = rawItems.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`review.yaml at ${path} - item ${index + 1} must be a mapping`);
    }
    return normalizeReviewItem(item as Record<string, unknown>, index + 1, path);
  });
  const seenIds = new Set<string>();
  for (const item of items) {
    if (seenIds.has(item.id)) {
      throw new Error(`review.yaml at ${path} contains duplicate id "${item.id}"`);
    }
    seenIds.add(item.id);
  }

  return { version: 1, items };
}

export async function writeReviewFile(path: string, file: ReviewFile): Promise<void> {
  const doc = {
    version: 1,
    items: file.items.map((item) => ({
      id: item.id,
      status: item.status,
      summary: item.summary,
      created_at: item.created_at,
      body: item.body,
      decided_at: item.decided_at,
      decision: item.decision,
      applied_at: item.applied_at,
      application: item.application,
      ...(item.reopened_at !== undefined ? { reopened_at: item.reopened_at } : {}),
      ...(item.reopen_note !== undefined ? { reopen_note: item.reopen_note } : {}),
    })),
  };
  const header =
    `# .almanac/review.yaml - unresolved wiki review escalations.\n` +
    `# Managed by \`almanac review\`. Use this for conflicts that need\n` +
    `# a human/editor decision before an agent changes wiki pages.\n`;
  const body = yaml.dump(doc, {
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
  const parent = dirname(path);
  if (!existsSync(parent)) {
    await mkdir(parent, { recursive: true });
  }
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, `${header}${body}`, "utf8");
  await rename(tmpPath, path);
}

export function summaryFromMarkdown(markdown: string): string {
  let firstNonEmpty = "";
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const heading = /^#{1,6}\s+(.+?)\s*#*$/.exec(trimmed);
    if (heading !== null) return cleanSummary(heading[1]);
    if (firstNonEmpty.length === 0) firstNonEmpty = trimmed;
  }
  return cleanSummary(firstNonEmpty);
}

export function nextReviewId(summary: string, items: ReviewItem[]): string {
  const base = toKebabCase(summary).slice(0, 80).replace(/-+$/g, "") || "review-item";
  const existing = new Set(items.map((item) => item.id));
  if (!existing.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
}

function normalizeReviewItem(
  item: Record<string, unknown>,
  index: number,
  path: string,
): ReviewItem {
  const id = requiredString(item.id, "id", index, path);
  const status = requiredStatus(item.status, index, path);
  const summary = requiredString(item.summary, "summary", index, path);
  const createdAt = requiredString(item.created_at, "created_at", index, path);
  const body = requiredString(item.body, "body", index, path);
  return {
    id,
    status,
    summary,
    created_at: createdAt,
    body,
    decided_at: nullableString(item.decided_at),
    decision: nullableString(item.decision),
    applied_at: nullableString(item.applied_at),
    application: nullableString(item.application),
    ...(item.reopened_at !== undefined ? { reopened_at: nullableString(item.reopened_at) } : {}),
    ...(item.reopen_note !== undefined ? { reopen_note: nullableString(item.reopen_note) } : {}),
  };
}

function requiredString(
  value: unknown,
  key: string,
  index: number,
  path: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`review.yaml at ${path} - item ${index} requires non-empty "${key}"`);
  }
  return value;
}

function requiredStatus(value: unknown, index: number, path: string): ReviewStatus {
  if (value === "open" || value === "decided" || value === "applied") {
    return value;
  }
  throw new Error(
    `review.yaml at ${path} - item ${index} has invalid "status" (expected open, decided, or applied)`,
  );
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function cleanSummary(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[-*]\s+/, "")
    .trim()
    .slice(0, 160)
    .trim();
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && "code" in err;
}
