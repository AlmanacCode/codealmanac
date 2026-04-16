import { readFile, rename, writeFile } from "node:fs/promises";

import yaml from "js-yaml";

/**
 * Rewrite the `topics:` field in a markdown file's YAML frontmatter.
 *
 * The absolute requirement is **body byte-preservation**. Tag/untag/
 * rename commands touch only the frontmatter; everything after the
 * closing `---` must be byte-identical to the input (same line endings,
 * same trailing whitespace, same final-newline-or-not). We lean on a
 * precise split rather than re-serializing the whole file so any
 * incidental bytes in the body (literal `\r\n`, unusual trailing
 * whitespace, triple-hyphen rulers) are left alone.
 *
 * For the frontmatter itself we do a **surgical rewrite of the `topics:`
 * field only** — not a full YAML roundtrip. Reasons:
 *   - `js-yaml` normalizes quoting, re-orders keys alphabetically by
 *     default, and can drop comments. Any of those would surprise a user
 *     who hand-edited their own frontmatter and expects their formatting
 *     preserved byte-for-byte.
 *   - We only care about one field. Replacing just that field lets the
 *     rest of the YAML survive verbatim.
 *
 * The strategy:
 *   1. Find the exact span of the `topics:` key (whether flow
 *      `topics: [a, b]` or block `topics:\n  - a\n  - b\n`) using a
 *      small line scanner.
 *   2. Compute the new topics list from the caller's transform.
 *   3. Replace the span with a freshly-emitted `topics: [a, b, c]` line
 *      (flow style — compact, readable, and what most authors write).
 *   4. If no `topics:` key exists and the new list is non-empty, append
 *      a line to the end of the frontmatter block.
 *   5. If `topics:` exists but the new list is empty, drop the line
 *      entirely rather than leaving `topics: []` around.
 *
 * The transform function gets the current deduplicated topic list and
 * returns the new list. Returning an empty array means "remove the
 * `topics:` key entirely".
 */

export interface RewriteResult {
  /** The page's topics before the rewrite (possibly empty). */
  before: string[];
  /** The page's topics after the rewrite (possibly empty). */
  after: string[];
  /** True iff the file content actually changed. */
  changed: boolean;
}

/**
 * Read `filePath`, compute the new topics via `transform`, and
 * atomically rewrite if the result differs.
 *
 * Atomic per file: write to `<path>.tmp` then rename, same pattern as
 * the registry and topics.yaml writers. A half-written page would
 * corrupt committed user content, so this is non-negotiable.
 */
export async function rewritePageTopics(
  filePath: string,
  transform: (current: string[]) => string[],
): Promise<RewriteResult> {
  const raw = await readFile(filePath, "utf8");
  const { before, after, output, changed } = applyTopicsTransform(
    raw,
    transform,
  );
  if (changed) {
    const tmp = `${filePath}.tmp`;
    await writeFile(tmp, output, "utf8");
    await rename(tmp, filePath);
  }
  return { before, after, changed };
}

interface TransformApplied {
  before: string[];
  after: string[];
  output: string;
  changed: boolean;
}

/**
 * Pure-string version of `rewritePageTopics`. Useful for tests and for
 * the few places (rename, delete) where we loop many files and want to
 * short-circuit no-op writes cheaply.
 */
export function applyTopicsTransform(
  raw: string,
  transform: (current: string[]) => string[],
): TransformApplied {
  const parsed = splitFrontmatter(raw);
  if (parsed === null) {
    // No frontmatter at all. Tagging a topic on such a page means
    // creating a frontmatter block. We keep the body untouched and
    // prepend `---\ntopics: [...]\n---\n\n`. If the transform yields
    // an empty list, this is a no-op.
    const next = dedupeSlugs(transform([]));
    if (next.length === 0) {
      return { before: [], after: [], output: raw, changed: false };
    }
    const fm = `---\ntopics: ${flowList(next)}\n---\n\n`;
    return {
      before: [],
      after: next,
      output: `${fm}${raw}`,
      changed: true,
    };
  }

  const { opener, fmLines, closer, body } = parsed;
  const { before, existingRange } = readTopicsFromLines(fmLines);
  const beforeDeduped = dedupeSlugs(before);
  const after = dedupeSlugs(transform(beforeDeduped));

  if (arraysEqual(beforeDeduped, after)) {
    return { before: beforeDeduped, after, output: raw, changed: false };
  }

  let nextFmLines: string[];
  if (existingRange === null) {
    // No `topics:` key currently present. Add one (only if non-empty).
    if (after.length === 0) {
      return { before: beforeDeduped, after, output: raw, changed: false };
    }
    nextFmLines = [...fmLines, `topics: ${flowList(after)}`];
  } else {
    const replacement =
      after.length === 0 ? null : `topics: ${flowList(after)}`;
    nextFmLines = [
      ...fmLines.slice(0, existingRange.start),
      ...(replacement === null ? [] : [replacement]),
      ...fmLines.slice(existingRange.end),
    ];
  }

  const fmBlock =
    nextFmLines.length === 0 ? "" : `${nextFmLines.join("\n")}\n`;
  const output = `${opener}${fmBlock}${closer}${body}`;
  return {
    before: beforeDeduped,
    after,
    output,
    changed: true,
  };
}

interface SplitFrontmatter {
  /** The opening `---\n` or `---\r\n`. */
  opener: string;
  /** Frontmatter lines (no line-ending character included). */
  fmLines: string[];
  /** The closing `---\n` (or `---\r\n`, possibly without trailing newline if EOF). */
  closer: string;
  /** Everything after the closing fence, byte-for-byte. */
  body: string;
}

/**
 * Split a file into (opener, frontmatter lines, closer, body). The
 * regex mirrors `parseFrontmatter` in `indexer/frontmatter.ts` so the
 * indexer and the rewriter agree on what "has frontmatter" means.
 *
 * Returns `null` when the file doesn't start with a `---` fence or
 * lacks a matching closer — both cases are legal (a page with only
 * body content) and the caller treats them as "no frontmatter to
 * rewrite".
 */
function splitFrontmatter(raw: string): SplitFrontmatter | null {
  if (!raw.startsWith("---")) return null;
  // Match the exact opener (with its line ending) so we can preserve
  // it byte-for-byte.
  const openerMatch = raw.match(/^---(\r?\n)/);
  if (openerMatch === null) return null;
  const opener = `---${openerMatch[1] ?? "\n"}`;
  const rest = raw.slice(opener.length);
  // Find the closing `---` that begins at the start of a line. We
  // also handle the edge case where the closer sits at position 0 of
  // `rest` (frontmatter was empty).
  let fenceIdx: number;
  if (rest.startsWith("---")) {
    fenceIdx = 0;
  } else {
    const m = rest.match(/\r?\n---(\r?\n|$)/);
    if (m === null || m.index === undefined) return null;
    // `m.index` points at the `\r?\n` before `---`; skip that newline
    // so fenceIdx lands exactly on the `-`.
    const leadingNewlineLen = (m[0] ?? "").startsWith("\r\n") ? 2 : 1;
    fenceIdx = m.index + leadingNewlineLen;
  }
  const fmBlock = rest.slice(0, fenceIdx);
  // Determine the closer's full span, including its trailing newline if any.
  const afterDashes = rest.slice(fenceIdx + 3);
  let closerTail = "";
  if (afterDashes.startsWith("\r\n")) {
    closerTail = "\r\n";
  } else if (afterDashes.startsWith("\n")) {
    closerTail = "\n";
  }
  const closer = `---${closerTail}`;
  const body = afterDashes.slice(closerTail.length);
  const fmLines =
    fmBlock.length === 0 ? [] : fmBlock.replace(/\r?\n$/, "").split(/\r?\n/);
  return { opener, fmLines, closer, body };
}

interface ExistingRange {
  /** Index in `fmLines` of the `topics:` key line (inclusive). */
  start: number;
  /** Index in `fmLines` one past the last line belonging to this key. */
  end: number;
}

/**
 * Find `topics:` in a frontmatter-lines array and read the values.
 *
 * Handles three YAML shapes authors commonly write:
 *   - `topics: [a, b, c]`       (flow sequence, one line)
 *   - `topics:` followed by block entries like `  - a` (block sequence)
 *   - `topics: a` (a single scalar — treated as one element)
 *
 * Also handles the empty case `topics:` with nothing after it, and the
 * "no topics key" case (returns `existingRange: null`).
 *
 * This is NOT a general YAML parser — it's intentionally scoped to the
 * one key we mutate, because using `js-yaml` for a round-trip would
 * lose comments and re-quote strings the user picked a specific way.
 */
function readTopicsFromLines(fmLines: string[]): {
  before: string[];
  existingRange: ExistingRange | null;
} {
  const keyLineIdx = findTopKey(fmLines, "topics");
  if (keyLineIdx === -1) {
    return { before: [], existingRange: null };
  }
  const keyLine = fmLines[keyLineIdx] ?? "";
  const colonIdx = keyLine.indexOf(":");
  // Everything to the right of the first colon, trimmed.
  const after = keyLine.slice(colonIdx + 1).trim();
  // Strip trailing `# ...` line-comment from a flow value so we don't
  // parse comments as list contents. (A block list's sub-items have
  // their own comments stripped in the block branch below.)
  const afterNoComment = stripTrailingComment(after);

  if (afterNoComment.length === 0) {
    // Block sequence style: collect subsequent `- item` lines.
    const values: string[] = [];
    let i = keyLineIdx + 1;
    while (i < fmLines.length) {
      const line = fmLines[i] ?? "";
      const m = line.match(/^\s*-\s+(.*)$/);
      if (m === null) break;
      const raw = stripTrailingComment((m[1] ?? "").trim());
      const parsed = parseScalar(raw);
      if (parsed.length > 0) values.push(parsed);
      i += 1;
    }
    return {
      before: values,
      existingRange: { start: keyLineIdx, end: i },
    };
  }

  // Flow / scalar shape on one line. Let js-yaml handle the value-parsing
  // (quoting, escapes, etc.) for the RHS only.
  let parsed: unknown;
  try {
    parsed = yaml.load(afterNoComment);
  } catch {
    parsed = null;
  }
  const values: string[] = [];
  if (Array.isArray(parsed)) {
    for (const v of parsed) {
      if (typeof v === "string" && v.trim().length > 0) {
        values.push(v.trim());
      }
    }
  } else if (typeof parsed === "string" && parsed.trim().length > 0) {
    values.push(parsed.trim());
  }
  return {
    before: values,
    existingRange: { start: keyLineIdx, end: keyLineIdx + 1 },
  };
}

/**
 * Find a top-level key line. "Top-level" means no leading whitespace —
 * we don't walk into nested mappings. The indexer's frontmatter parser
 * only reads top-level keys too, so this matches.
 */
function findTopKey(fmLines: string[], key: string): number {
  const re = new RegExp(`^${escapeRegex(key)}\\s*:`);
  for (let i = 0; i < fmLines.length; i += 1) {
    if (re.test(fmLines[i] ?? "")) return i;
  }
  return -1;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTrailingComment(s: string): string {
  // Only strip `#` outside of quotes. For the shapes we handle —
  // slug-like kebab-case topics — quoted strings with `#` are rare, but
  // be defensive.
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "#" && !inSingle && !inDouble) {
      return s.slice(0, i).trimEnd();
    }
  }
  return s;
}

/**
 * Strip YAML quoting from a scalar. Block-sequence items might be
 * written as `- 'foo'` or `- "foo"` or bare `- foo`; we accept all
 * three and return the plain string.
 */
function parseScalar(s: string): string {
  if (s.length === 0) return s;
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    return s.slice(1, -1);
  }
  if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Emit a flow-style YAML sequence like `[auth, jwt, security]`. We use
 * flow because it's the shape most authors write by hand and stays on
 * one line, which keeps diffs tight. Values are quoted only when
 * necessary — plain kebab-case slugs never need quoting.
 */
function flowList(items: string[]): string {
  return `[${items.map((t) => formatScalar(t)).join(", ")}]`;
}

function formatScalar(s: string): string {
  // If it's a bare kebab/alnum slug, no quotes. Otherwise fall back to
  // js-yaml for correct escaping. We check against a conservative
  // pattern — anything outside it gets YAML-quoted.
  if (/^[a-z0-9][a-z0-9-]*$/.test(s)) return s;
  return yaml
    .dump(s, { flowLevel: 0, lineWidth: Number.MAX_SAFE_INTEGER })
    .trimEnd();
}

function dedupeSlugs(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const s = raw.trim();
    if (s.length === 0) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
