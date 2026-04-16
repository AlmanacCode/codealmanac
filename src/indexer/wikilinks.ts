import { toKebabCase } from "../slug.js";
import { looksLikeDir, normalizePath } from "./paths.js";

/**
 * One parsed `[[...]]` reference from a page body. Classification is
 * deterministic and content-based — see `classifyWikilink` below.
 *
 * Callers dispatch on `kind`:
 *   - `page`    → row in `wikilinks`
 *   - `file`    → row in `file_refs` with `is_dir = 0`
 *   - `folder`  → row in `file_refs` with `is_dir = 1`
 *   - `xwiki`   → row in `cross_wiki_links`
 */
export type WikilinkRef =
  | { kind: "page"; target: string }
  | { kind: "file"; path: string }
  | { kind: "folder"; path: string }
  | { kind: "xwiki"; wiki: string; target: string };

/**
 * Rules from the spec ("Classification rules"), applied in order:
 *
 *   1. Contains `:` before any `/`  → cross-wiki reference (`wiki:slug`)
 *   2. Contains `/`                  → file or folder reference
 *          - Trailing `/` = folder
 *          - Otherwise    = file
 *   3. Otherwise                     → page slug wikilink
 *
 * Edge cases the test suite pins down:
 *   - `[[a:b/c]]`      → xwiki (colon is before the slash, rule 1 wins)
 *   - `[[src/a:b]]`    → file (slash is before the colon, rule 2 wins)
 *   - `[[./x]]`        → the leading `./` is stripped by `normalizePath`,
 *                        so this lands in `file_refs` as `x`. A bare `./x`
 *                        with no inner slash would classify as a file.
 *   - `[[foo|display]]`→ Obsidian-style display text is stripped; we key
 *                        on the target only. A future slice could surface
 *                        display text in `almanac info`.
 */
export function classifyWikilink(raw: string): WikilinkRef | null {
  // Strip Obsidian-style `|display` suffix — we don't index display text
  // in slice 2, but we want the classifier to see the real target.
  const pipe = raw.indexOf("|");
  let body = pipe === -1 ? raw : raw.slice(0, pipe);
  body = body.trim();
  if (body.length === 0) return null;

  const firstColon = body.indexOf(":");
  const firstSlash = body.indexOf("/");

  // Rule 1: cross-wiki, `wiki:slug`. Only if the colon comes before any
  // slash — otherwise `src/urls.ts:42` (hypothetical) would wrongly
  // classify as xwiki.
  if (firstColon !== -1 && (firstSlash === -1 || firstColon < firstSlash)) {
    const wiki = body.slice(0, firstColon).trim();
    const target = body.slice(firstColon + 1).trim();
    if (wiki.length === 0 || target.length === 0) return null;
    return { kind: "xwiki", wiki, target };
  }

  // Rule 2: file or folder. The `/` may be anywhere including trailing.
  if (firstSlash !== -1) {
    const isDir = looksLikeDir(body);
    const path = normalizePath(body, isDir);
    if (path.length === 0) return null;
    return isDir ? { kind: "folder", path } : { kind: "file", path };
  }

  // Rule 3: page slug wikilink. Authors might write `Checkout Flow` or
  // `Checkout_Flow` by accident — slugify defensively so backlinks still
  // resolve in those cases.
  const target = toKebabCase(body);
  if (target.length === 0) return null;
  return { kind: "page", target };
}

/**
 * Walk a markdown body and pull every `[[...]]` reference. We scan the
 * whole body rather than try to skip code blocks — the spec is explicit:
 * "Prose outside `[[...]]` is just prose. No backtick-path heuristics, no
 * false positives from code blocks or log output." A `[[foo]]` inside a
 * fenced code block is still a wikilink. Authors who genuinely need a
 * literal `[[x]]` in code can escape one of the brackets.
 */
export function extractWikilinks(body: string): WikilinkRef[] {
  const out: WikilinkRef[] = [];
  const re = /\[\[([^\]\n]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const ref = classifyWikilink(m[1] ?? "");
    if (ref !== null) out.push(ref);
  }
  return out;
}
