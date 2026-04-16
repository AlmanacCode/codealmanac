/**
 * Canonical kebab-case slugifier used across the codebase.
 *
 * One function, three callers:
 *   - `registry/index.ts` — wiki name slugs (both auto-derived and
 *     user-supplied via `--name`)
 *   - `indexer/index.ts` — page filename → slug and topic → slug
 *   - `indexer/wikilinks.ts` — wikilink target → slug for resolution
 *
 * All three want the same behavior: lowercased, non-alphanumeric runs
 * collapse to a single hyphen, leading/trailing hyphens trimmed. Keeping
 * this in one place avoids a class of bug where an unusual input (e.g.
 * `Checkout_Flow`) produces different slugs depending on which layer
 * slugified it.
 *
 * Rules:
 *   - Lowercase
 *   - Non-alphanumeric runs collapse to a single hyphen
 *   - Leading/trailing hyphens trimmed
 */
export function toKebabCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
