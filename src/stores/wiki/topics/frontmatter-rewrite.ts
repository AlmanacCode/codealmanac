import { readFile } from "node:fs/promises";

import { writeTextFileAtomically } from "../../atomic-write.js";
import { splitFrontmatter } from "./frontmatter-block.js";
import {
  arraysEqual,
  dedupeSlugs,
  flowList,
  readTopicsFromLines,
} from "./frontmatter-topic-list.js";

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
 * Atomic per file: write to a same-directory temp file then rename, same
 * pattern as the registry and topics.yaml writers. A half-written page would
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
    await writeTextFileAtomically(filePath, output);
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
    // an empty list, this is a no-op. Line endings: default to LF for a
    // brand-new frontmatter — we can't infer intent from a file that
    // doesn't have frontmatter yet, and LF is the committed default in
    // most modern repos.
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

  const { opener, fmLines, closer, body, eol } = parsed;
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
    // Interleaved comments/blank lines from a block-style list are
    // re-emitted BELOW the new flow-style `topics:` line so the
    // author's commentary sticks around. Flow/scalar inputs produce an
    // empty `preserved` array, so this collapses to the old behavior
    // for the common case. When we fully delete the key (empty after)
    // the preserved lines go too — without a `topics:` key to anchor
    // them to, trailing "# below the topics list" comments become
    // orphans that no longer mean what they said.
    const preservedTail =
      replacement === null ? [] : existingRange.preserved;
    nextFmLines = [
      ...fmLines.slice(0, existingRange.start),
      ...(replacement === null ? [] : [replacement]),
      ...preservedTail,
      ...fmLines.slice(existingRange.end),
    ];
  }

  // Rejoin with the same line ending the input frontmatter used so a
  // CRLF-authored file comes out CRLF end-to-end. `splitFrontmatter`
  // sniffed the dominant separator for us.
  const fmBlock =
    nextFmLines.length === 0 ? "" : `${nextFmLines.join(eol)}${eol}`;
  const output = `${opener}${fmBlock}${closer}${body}`;
  return {
    before: beforeDeduped,
    after,
    output,
    changed: true,
  };
}
