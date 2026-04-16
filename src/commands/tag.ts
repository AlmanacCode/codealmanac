import { join } from "node:path";

import { ensureFreshIndex, runIndexer } from "../indexer/index.js";
import { resolveWikiRoot } from "../indexer/resolveWiki.js";
import { openIndex } from "../indexer/schema.js";
import { toKebabCase } from "../slug.js";
import { rewritePageTopics } from "../topics/frontmatterRewrite.js";
import { topicsYamlPath } from "../topics/paths.js";
import {
  ensureTopic,
  loadTopicsFile,
  writeTopicsFile,
} from "../topics/yaml.js";

/**
 * `almanac tag <page> <topic>...` and `almanac untag <page> <topic>`.
 *
 * These are the page-side of the topics system — `topics ...` manages
 * the DAG and metadata; `tag`/`untag` wires concrete pages into
 * topics. Both commands mutate page frontmatter atomically per file
 * and leave body bytes untouched.
 *
 * Auto-creation policy: if a topic passed to `tag` doesn't yet exist
 * in `topics.yaml`, we create a minimal entry for it (title-cased
 * title, no description, no parents). This matches the spec: "Ensure
 * topic exists in topics.yaml; if not, create a minimal entry." We
 * don't silently create topics on `untag` — you can only untag
 * something that was already a topic.
 */

export interface TagCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TagOptions {
  cwd: string;
  wiki?: string;
  page?: string;
  topics: string[];
  stdin?: boolean;
  stdinInput?: string;
}

export interface UntagOptions {
  cwd: string;
  wiki?: string;
  page: string;
  topic: string;
}

export async function runTag(options: TagOptions): Promise<TagCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });

  const topics = options.topics
    .map((t) => toKebabCase(t))
    .filter((t) => t.length > 0);
  if (topics.length === 0) {
    return {
      stdout: "",
      stderr: "almanac: tag requires at least one topic\n",
      exitCode: 1,
    };
  }

  // Bulk mode reads slugs from stdin; single mode uses the positional.
  const pages: string[] = [];
  if (options.stdin === true) {
    if (options.stdinInput === undefined) {
      return {
        stdout: "",
        stderr: "almanac: tag --stdin called without stdin input\n",
        exitCode: 1,
      };
    }
    for (const line of options.stdinInput.split(/\r?\n/)) {
      const s = line.trim();
      if (s.length > 0) pages.push(s);
    }
  } else if (options.page !== undefined && options.page.length > 0) {
    pages.push(options.page);
  } else {
    return {
      stdout: "",
      stderr: "almanac: tag requires a page slug (or --stdin)\n",
      exitCode: 1,
    };
  }

  // Resolve slugs to file paths from the DB. A stale index is fine for
  // `tag` — we just need to find each page's file; `ensureFreshIndex`
  // runs first so the common path is consistent.
  await ensureFreshIndex({ repoRoot });
  const dbPath = join(repoRoot, ".almanac", "index.db");
  const db = openIndex(dbPath);

  // Auto-create missing topics in topics.yaml.
  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);
  let fileChanged = false;
  for (const t of topics) {
    // ensureTopic mutates the file; we check presence beforehand so
    // we only write when something actually changes (skip a redundant
    // atomic rewrite + mtime bump).
    const before = file.topics.length;
    ensureTopic(file, t);
    if (file.topics.length > before) fileChanged = true;
  }
  if (fileChanged) {
    await writeTopicsFile(yamlPath, file);
  }

  const stmt = db.prepare<[string], { file_path: string }>(
    "SELECT file_path FROM pages WHERE slug = ?",
  );
  const summary: string[] = [];
  const missing: string[] = [];
  let taggedPages = 0;
  try {
    for (const page of pages) {
      const row = stmt.get(toKebabCase(page));
      if (row === undefined) {
        missing.push(page);
        continue;
      }
      const result = await rewritePageTopics(row.file_path, (current) => {
        // Preserve existing order; append new topics in the order
        // the caller supplied them. `applyTopicsTransform` will
        // dedupe for us, but we skip redundant work here too.
        const out = [...current];
        for (const t of topics) if (!current.includes(t)) out.push(t);
        return out;
      });
      if (result.changed) {
        taggedPages += 1;
        summary.push(`tagged ${page}: ${topics.join(", ")}`);
      } else {
        summary.push(`no change ${page} (already tagged)`);
      }
    }
  } finally {
    db.close();
  }

  if (taggedPages > 0 || fileChanged) {
    // Trigger a reindex so downstream queries see the new rows
    // immediately. Writes to page files bumped their mtimes; writes to
    // topics.yaml are caught by `topicsYamlNewerThan`.
    await runIndexer({ repoRoot });
  }

  const stderr = missing.map((p) => `almanac: no such page "${p}"\n`).join("");
  return {
    stdout: summary.length > 0 ? `${summary.join("\n")}\n` : "",
    stderr,
    exitCode: missing.length > 0 ? 1 : 0,
  };
}

export async function runUntag(
  options: UntagOptions,
): Promise<TagCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const page = toKebabCase(options.page);
  const topic = toKebabCase(options.topic);
  if (page.length === 0) {
    return {
      stdout: "",
      stderr: "almanac: untag requires a page slug\n",
      exitCode: 1,
    };
  }
  if (topic.length === 0) {
    return {
      stdout: "",
      stderr: "almanac: untag requires a topic\n",
      exitCode: 1,
    };
  }

  await ensureFreshIndex({ repoRoot });
  const db = openIndex(join(repoRoot, ".almanac", "index.db"));
  let filePath: string;
  try {
    const row = db
      .prepare<[string], { file_path: string }>(
        "SELECT file_path FROM pages WHERE slug = ?",
      )
      .get(page);
    if (row === undefined) {
      return {
        stdout: "",
        stderr: `almanac: no such page "${page}"\n`,
        exitCode: 1,
      };
    }
    filePath = row.file_path;
  } finally {
    db.close();
  }

  const result = await rewritePageTopics(filePath, (current) =>
    current.filter((t) => t !== topic),
  );
  if (result.changed) {
    await runIndexer({ repoRoot });
  }

  return {
    stdout: result.changed
      ? `untagged ${page}: ${topic}\n`
      : `no change ${page} (not tagged with ${topic})\n`,
    stderr: "",
    exitCode: 0,
  };
}
