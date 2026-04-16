import yaml from "js-yaml";

export interface Frontmatter {
  title?: string;
  topics: string[];
  files: string[];
  archived_at: number | null;
  superseded_by: string | null;
  supersedes: string | null;
  /**
   * The body of the file with frontmatter removed, for FTS5 and H1 fallback.
   * Always populated even when the file has no frontmatter.
   */
  body: string;
}

/**
 * Pull YAML frontmatter off the top of a markdown file and coerce the
 * relevant fields. Unknown fields are tolerated silently — the wiki should
 * accept fields we don't understand yet without spewing warnings at the
 * user (future slices might consume them).
 *
 * Failure modes:
 *   - No frontmatter at all → `{ topics: [], files: [], ..., body: raw }`.
 *     This is legal; a heading + prose is a valid page.
 *   - Malformed YAML → warning to stderr, treated as "no frontmatter". We
 *     choose not to throw so a single bad file doesn't tank a reindex.
 *
 * Note on `archived_at`: authors write this as a YAML date (`2026-04-15`),
 * which `js-yaml` parses to a JS `Date`. We also tolerate ISO-8601 strings
 * and raw numbers. Everything else gets dropped (treated as "not
 * archived"). Storing epoch seconds keeps `--since`/`--stale`/`archived`
 * arithmetic trivial at query time.
 */
export function parseFrontmatter(raw: string): Frontmatter {
  const empty: Frontmatter = {
    topics: [],
    files: [],
    archived_at: null,
    superseded_by: null,
    supersedes: null,
    body: raw,
  };

  // Frontmatter fence MUST start on line 1 — a `---` partway through the
  // document is just a horizontal rule. Be strict about the opening delim
  // so we don't accidentally strip section headers.
  if (!raw.startsWith("---")) {
    return empty;
  }

  // Tolerate either Unix or Windows line endings. We read the first line
  // explicitly to confirm it's only `---` (no trailing content).
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (match === null) {
    return empty;
  }

  const yamlBody = match[1] ?? "";
  const body = match[2] ?? "";

  let parsed: unknown;
  try {
    parsed = yaml.load(yamlBody);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`almanac: malformed frontmatter (${message})\n`);
    return empty;
  }

  if (parsed === null || parsed === undefined) {
    return { ...empty, body };
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    // Someone wrote a YAML scalar or list as the document root — not a
    // mapping, so no fields for us to extract. Treat as empty but keep the
    // post-fence body so FTS5 still gets content.
    return { ...empty, body };
  }

  const obj = parsed as Record<string, unknown>;

  return {
    title: coerceString(obj.title),
    topics: coerceStringArray(obj.topics),
    files: coerceStringArray(obj.files),
    archived_at: coerceEpochSeconds(obj.archived_at),
    superseded_by: coerceString(obj.superseded_by) ?? null,
    supersedes: coerceString(obj.supersedes) ?? null,
    body,
  };
}

/**
 * H1 fallback for title when frontmatter has none.
 *
 * Only considers the first 40 lines of the body — any real wiki page has
 * its H1 near the top. NOTE: `String.prototype.split(sep, limit)` still
 * splits the whole string internally and then truncates; it's not an
 * early-bail iteration. For the multi-megabyte files we might see in
 * practice this is still cheap (one regex pass, no allocation per-line
 * beyond the 40 we keep), so we favor the clearer code over hand-rolled
 * line iteration.
 */
export function firstH1(body: string): string | undefined {
  const lines = body.split(/\r?\n/, 40);
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*#*\s*$/);
    if (m !== null) {
      return m[1];
    }
  }
  return undefined;
}

function coerceString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return undefined;
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string" && item.trim().length > 0) {
      out.push(item.trim());
    }
  }
  return out;
}

/**
 * Coerce a frontmatter `archived_at` value (YAML Date, ISO string, or raw
 * epoch number) into epoch seconds. Returns `null` for anything we can't
 * make sense of — pages with an unrecognizable `archived_at` are treated as
 * active rather than silently marked archived, which is the safer default.
 */
function coerceEpochSeconds(v: unknown): number | null {
  if (v instanceof Date) {
    return Math.floor(v.getTime() / 1000);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.floor(v);
  }
  if (typeof v === "string" && v.trim().length > 0) {
    const t = Date.parse(v.trim());
    if (!Number.isNaN(t)) {
      return Math.floor(t / 1000);
    }
  }
  return null;
}
