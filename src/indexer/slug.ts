/**
 * Page-slug helper for the indexer. Thin alias over the top-level
 * `toKebabCase` — the algorithm is identical (wiki names, page filenames,
 * topic names, and wikilink targets all kebab-case the same way), so we
 * keep a single implementation in `src/slug.ts` and re-export under the
 * name the indexer uses.
 *
 * `Checkout_Flow.md` and `Checkout Flow.md` both resolve to `checkout-flow`.
 * The indexer emits a warning when the on-disk name isn't already the
 * canonical form — `almanac health` (slice 3) will formally report these.
 */
export { toKebabCase as slugifyFilename } from "../slug.js";
