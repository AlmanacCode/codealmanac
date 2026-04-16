/**
 * Slugify a page filename (without the `.md`) into the canonical kebab-case
 * slug used as the primary key in `pages`. Mirrors `toKebabCase` in
 * `registry/index.ts` but lives here because page slugs are produced at
 * index time from a different input space (filenames on disk, not
 * user-typed wiki names).
 *
 * `Checkout_Flow.md` and `Checkout Flow.md` both resolve to `checkout-flow`.
 * The indexer emits a warning when the on-disk name isn't already the
 * canonical form — `almanac health` (slice 3) will formally report these.
 */
export function slugifyFilename(basename: string): string {
  return basename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
