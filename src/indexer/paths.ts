/**
 * Path normalization for the file/folder references stored in `file_refs`
 * and for the query input passed to `--mentions`.
 *
 * The same function runs over both sides so a value written at index time
 * and a value looked up at query time compare byte-for-byte. If this ever
 * drifts between writers and readers, `--mentions` starts silently missing
 * matches — apply one canonicalization, not two.
 *
 * Rules (from the spec, Correctness):
 *   - Lowercase (macOS filesystems are case-insensitive, so the wiki treats
 *     `Src/Checkout/` and `src/checkout/` as the same path)
 *   - Forward slashes only (never backslashes from Windows-authored content)
 *   - No leading `./`
 *   - Collapse redundant slashes (`src//checkout/` → `src/checkout/`)
 *   - Trailing `/` iff the caller says it's a directory
 *
 * The `isDir` flag is a signal carried alongside the path — we don't infer
 * it from the raw string here, because frontmatter `files:` entries and the
 * inline `[[...]]` classifier both decide directness themselves and pass
 * the answer in. Having one place decide and one place normalize keeps the
 * directory inference rule testable in isolation.
 */
export function normalizePath(raw: string, isDir: boolean): string {
  const normalized = normalizeShape(raw, isDir);
  return normalized.toLowerCase();
}

/**
 * Normalize shape without lowercasing — preserves the author's casing.
 * Used to store `original_path` in `file_refs` so dead-ref checks on
 * case-sensitive filesystems (Linux, `git` checkouts with core.ignorecase
 * false) stat the actual path on disk rather than a lowercased alias.
 *
 * Everything else about the result is identical to `normalizePath`:
 * forward slashes, no `./`, no duplicate slashes, trailing `/` iff
 * `isDir`. The ONLY difference is the final `.toLowerCase()` is skipped.
 */
export function normalizePathPreservingCase(raw: string, isDir: boolean): string {
  return normalizeShape(raw, isDir);
}

function normalizeShape(raw: string, isDir: boolean): string {
  let s = raw.trim();

  // Windows-style backslashes → forward slashes. We never want to store
  // backslashes; a path authored on Windows and checked in should match
  // the same path authored on macOS.
  s = s.replace(/\\+/g, "/");

  // Drop a leading `./` — it's syntactic noise and authors inconsistently
  // include it. `./src/checkout/` and `src/checkout/` must hash equal.
  while (s.startsWith("./")) s = s.slice(2);

  // Collapse any run of slashes to a single slash. This also normalizes
  // `src//checkout/` and accidental doubled slashes from string concat.
  s = s.replace(/\/+/g, "/");

  // Strip any trailing slashes before re-applying the directory marker —
  // this way we don't care if the caller fed us `src/checkout` or
  // `src/checkout/` as a directory; we impose our own rule.
  s = s.replace(/\/+$/, "");

  if (isDir) {
    // Directories ALWAYS end with a trailing slash. This is what lets the
    // GLOB queries distinguish `src/checkout/` (the directory) from
    // `src/checkout` (a file with no extension) without ambiguity.
    return `${s}/`;
  }
  return s;
}

/**
 * Infer `isDir` from the raw string the author wrote. Only used at the
 * point of parsing frontmatter `files:` entries and inline `[[...]]`
 * references — everywhere else, `isDir` is already known from context.
 *
 * Rule: trailing `/` (after backslash normalization) means directory.
 */
export function looksLikeDir(raw: string): boolean {
  const s = raw.trim().replace(/\\+/g, "/");
  return s.endsWith("/");
}
