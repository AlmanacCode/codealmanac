import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { toKebabCase } from "../../slug.js";
import { writeTextFileAtomically } from "../atomic-write.js";
import {
  emptyReviewFile,
  parseReviewFile,
  serializeReviewFile,
  type ReviewFile,
  type ReviewItem,
} from "./codec.js";

export type {
  ReviewFile,
  ReviewItem,
  ReviewStatus,
} from "./codec.js";

export function reviewYamlPath(repoRoot: string): string {
  return join(repoRoot, ".almanac", "review.yaml");
}

export async function loadReviewFile(path: string): Promise<ReviewFile> {
  if (!existsSync(path)) return emptyReviewFile();

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return emptyReviewFile();
    }
    throw err;
  }

  return parseReviewFile(raw, path);
}

export async function writeReviewFile(
  path: string,
  file: ReviewFile,
): Promise<void> {
  await writeTextFileAtomically(path, serializeReviewFile(file));
}

export function summaryFromMarkdown(markdown: string): string {
  let firstNonEmpty = "";
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const heading = /^#{1,6}\s+(.+?)\s*#*$/.exec(trimmed);
    if (heading !== null) return cleanSummary(heading[1] ?? "");
    if (firstNonEmpty.length === 0) firstNonEmpty = trimmed;
  }
  return cleanSummary(firstNonEmpty);
}

export function nextReviewId(summary: string, items: ReviewItem[]): string {
  const base =
    toKebabCase(summary).slice(0, 80).replace(/-+$/g, "") || "review-item";
  const existing = new Set(items.map((item) => item.id));
  if (!existing.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
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
