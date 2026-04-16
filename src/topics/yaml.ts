import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import yaml from "js-yaml";

import { toKebabCase } from "../slug.js";

/**
 * One entry in `.almanac/topics.yaml` — the source of truth for topic
 * metadata (title, description, DAG parents). Pages are still the source
 * of truth for which pages belong to which topics; this file only holds
 * the topic-level attributes.
 *
 * `slug` is the canonical kebab-case key used everywhere downstream
 * (SQLite `topics.slug`, page frontmatter `topics:` entries, wikilink
 * targets). `title` is the human-readable name the user typed at create
 * time. `description` is a free-form one-liner (or null when unset).
 * `parents` is the DAG edge list — kept as an array of slugs rather than
 * a nested structure so round-tripping stays boring and a user eyeballing
 * the file can see the full graph.
 */
export interface TopicEntry {
  slug: string;
  title: string;
  description: string | null;
  parents: string[];
}

export interface TopicsFile {
  topics: TopicEntry[];
}

/**
 * Load `.almanac/topics.yaml` into a `TopicsFile`. A missing file is not
 * an error — it's the first-run state, which we treat as "no topic
 * metadata, only whatever the pages declare in frontmatter". Malformed
 * YAML IS an error; we surface it rather than silently clobbering the
 * user's committed source of truth.
 *
 * The return shape is always normalized — callers don't have to guard
 * for missing `topics` key, wrong types, or absent `parents` arrays.
 */
export async function loadTopicsFile(path: string): Promise<TopicsFile> {
  if (!existsSync(path)) {
    return { topics: [] };
  }
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return { topics: [] };
    }
    throw err;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { topics: [] };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`topics.yaml at ${path} is not valid YAML: ${message}`);
  }

  if (parsed === null || parsed === undefined) {
    return { topics: [] };
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`topics.yaml at ${path} must be a mapping`);
  }

  const obj = parsed as Record<string, unknown>;
  const rawTopics = obj.topics;
  if (rawTopics === undefined || rawTopics === null) {
    return { topics: [] };
  }
  if (!Array.isArray(rawTopics)) {
    throw new Error(`topics.yaml at ${path} — "topics" must be a list`);
  }

  const topics: TopicEntry[] = [];
  for (const item of rawTopics) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const slugRaw = entry.slug;
    if (typeof slugRaw !== "string" || slugRaw.trim().length === 0) continue;
    const slug = toKebabCase(slugRaw);
    if (slug.length === 0) continue;
    const title =
      typeof entry.title === "string" && entry.title.trim().length > 0
        ? entry.title.trim()
        : titleCase(slug);
    const description =
      typeof entry.description === "string" &&
      entry.description.trim().length > 0
        ? entry.description.trim()
        : null;
    const parents: string[] = [];
    if (Array.isArray(entry.parents)) {
      for (const p of entry.parents) {
        if (typeof p === "string" && p.trim().length > 0) {
          const ps = toKebabCase(p);
          if (ps.length > 0 && ps !== slug && !parents.includes(ps)) {
            parents.push(ps);
          }
        }
      }
    }
    topics.push({ slug, title, description, parents });
  }

  return { topics };
}

/**
 * Write a `TopicsFile` atomically — tmp file + rename, same pattern as
 * the registry. A half-written topics.yaml would corrupt the user's
 * committed source of truth, so we never write in place.
 *
 * Ordering: topics are sorted by slug for stable diffs. Parents within
 * each entry stay in the order the caller passed them (semantically an
 * ordered list — topics.yaml is the place a user can visibly reason
 * about "primary parent first", even though SQLite treats them as a
 * set).
 *
 * We emit a leading comment so first-time readers know the file is
 * edited by the CLI and what its role is.
 */
export async function writeTopicsFile(
  path: string,
  file: TopicsFile,
): Promise<void> {
  const sorted = [...file.topics].sort((a, b) => a.slug.localeCompare(b.slug));
  const doc = {
    topics: sorted.map((t) => {
      // Emit all four keys in a stable order: slug, title, description,
      // parents. description is emitted as `null` in YAML when unset so
      // the schema stays consistent across entries (js-yaml renders the
      // literal word `null`, not the `~` shorthand).
      return {
        slug: t.slug,
        title: t.title,
        description: t.description,
        parents: t.parents,
      };
    }),
  };

  const header =
    `# .almanac/topics.yaml — source of truth for topic metadata.\n` +
    `# Managed by \`almanac topics\` commands. User-added comments\n` +
    `# between entries will be stripped on the next write (js-yaml\n` +
    `# doesn't round-trip comments). Edit at your own risk — or use the\n` +
    `# CLI (\`almanac topics create|link|describe|rename|delete\`)\n` +
    `# which preserves the structure correctly.\n`;
  const body = yaml.dump(doc, {
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
  const content = `${header}${body}`;
  const tmpPath = `${path}.tmp`;
  // mkdir parent in case `.almanac/` vanished (shouldn't, but cheap insurance)
  const parent = dirname(path);
  if (!existsSync(parent)) {
    await mkdir(parent, { recursive: true });
  }
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, path);
}

/**
 * Look up a topic by slug. Returns `null` when the slug is absent —
 * callers distinguish "declared in topics.yaml" from "ad-hoc (only
 * appears in page frontmatter)" based on this.
 */
export function findTopic(file: TopicsFile, slug: string): TopicEntry | null {
  for (const t of file.topics) {
    if (t.slug === slug) return t;
  }
  return null;
}

/**
 * Ensure a topic entry exists. If missing, inserts a minimal entry with
 * title-cased title and null description. Returns the (possibly new)
 * entry. Used by `tag`, `topics create` (with `--parent auto-creating`),
 * and `topics link` (auto-creating child/parent on demand).
 */
export function ensureTopic(file: TopicsFile, slug: string): TopicEntry {
  const existing = findTopic(file, slug);
  if (existing !== null) return existing;
  const entry: TopicEntry = {
    slug,
    title: titleCase(slug),
    description: null,
    parents: [],
  };
  file.topics.push(entry);
  return entry;
}

/**
 * Convert a slug back to a human-ish title: `auth-flow` → `Auth Flow`.
 * Used as the fallback title when the caller didn't provide one
 * (auto-creation paths, ad-hoc slugs coming from page frontmatter).
 */
export function titleCase(slug: string): string {
  if (slug.length === 0) return slug;
  return slug
    .split("-")
    .filter((s) => s.length > 0)
    .map((s) => `${s[0]?.toUpperCase() ?? ""}${s.slice(1)}`)
    .join(" ");
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
