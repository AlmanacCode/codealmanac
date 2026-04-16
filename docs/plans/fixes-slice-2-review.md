# Slice 2 — Review Fixes

Apply the fixes identified in the slice 2 code review. Slice 2 introduced the SQLite indexer and query commands (`search`, `show`, `path`, `info`, `reindex`). The review pinned issues against commit `6e11e32`; slice 1 review fixes landed on top of that at `55f1699`.

## Read before coding

- Current files in `~/Desktop/Projects/codealmanac/src/indexer/` and `~/Desktop/Projects/codealmanac/src/commands/` — HEAD state
- Existing tests in `~/Desktop/Projects/codealmanac/test/` — extend, don't rewrite
- The slice 1 fix agent extracted `toKebabCase` to `src/slug.ts`. `src/indexer/slug.ts` is now a thin alias (`slugifyFilename`). One of the "consider" items below is to finish that cleanup.

## Must fix

### 1. GLOB wildcard escape — silent correctness bug

**File:** `src/commands/search.ts` (the `--mentions` queries), anywhere `r.path || '*'` or similar concatenates stored paths into GLOB patterns.

**Bug:** SQLite `GLOB` treats `*`, `?`, and `[...]` as wildcards on the RHS. A page with `files: [src/[id]/page.tsx]` (Next.js dynamic route) gets stored as `file_refs.path = 'src/[id]/page.tsx'`. Then `--mentions src/abc/page.tsx` runs `'src/abc/page.tsx' GLOB 'src/[id]/page.tsx*'` — the `[id]` is a character class matching `i` or `d`, producing spurious matches like `src/i/page.tsx`.

Verified with better-sqlite3:
```
SELECT 'src/a/page.tsx' GLOB 'src/[abc]/page.tsx'  →  1
```

**Recommended fix (cleaner):** Stop doing `r.path || '*'`-style concat in SQL. For a file query like `p`, generate its prefix folders in JS (`src/`, `src/checkout/`, etc.) and use parameterized equality:

```sql
-- For --mentions src/checkout/handler.ts, build prefixes = ['src/', 'src/checkout/']
SELECT DISTINCT p.slug FROM pages p JOIN file_refs r ON r.page_slug = p.slug
WHERE p.archived_at IS NULL
  AND (
    r.path = 'src/checkout/handler.ts'
    OR (r.is_dir = 1 AND r.path IN (?, ?))  -- prefixes parameterized
  );
```

This sidesteps GLOB-in-RHS entirely, is faster (equality probe on `idx_file_refs_path`), and avoids the wildcard escape problem. Update both mentions-a-file (upward match) and mentions-a-folder (downward match — still need a prefix match there; escape `*?[` before appending `*`).

**Fallback fix (mechanical):** Escape `*`, `?`, `[` in stored path before concatenating into GLOB. Implement `globEscape(path)`. Test with Next.js-style paths.

**Test to add:** `test/search.test.ts`:
- Page with `files: [src/[id]/page.tsx]` — `--mentions src/a/page.tsx` does NOT match it
- Page with `files: [src/checkout/]` — `--mentions src/checkout/handler.ts` DOES match it (upward match still works)
- Folder paths containing `*` or `?` (rare but possible)

### 2. Indexer aborts on a single unreadable/deleted file

**File:** `src/indexer/index.ts` (around lines 155, 161 — `statSync` + `readFile` per-file)

**Bug:** `fast-glob` returns the list, then mid-loop a file could be deleted, renamed, or become temporarily unreadable (editors writing via rename-swap expose this briefly). Any `ENOENT` or `EACCES` takes the whole reindex down. Since `ensureFreshIndex` is implicit on every query command, one transient filesystem race makes `almanac search` crash mid-session.

**Fix:** Wrap `statSync` + `readFile` in try/catch per-file. On ENOENT/EACCES, warn to stderr and continue. Matches the existing malformed-YAML behavior ("a single bad file doesn't tank a reindex").

```typescript
for (const fullPath of files) {
  try {
    const stat = statSync(fullPath);
    const raw = await readFile(fullPath, "utf-8");
    // ... existing logic
  } catch (err) {
    if (err instanceof Error && "code" in err && (err.code === "ENOENT" || err.code === "EACCES")) {
      process.stderr.write(`[codealmanac] skipping ${fullPath}: ${err.message}\n`);
      continue;
    }
    throw err;
  }
}
```

**Test to add:** create a file, delete it mid-reindex (simulate via mock), verify reindex completes and search still works.

### 3. Schema comment misleading about FTS cascade

**File:** `src/indexer/schema.ts` (the comment claiming "CASCADE cleans page_topics, file_refs, wikilinks, cross_wiki_links")

**Bug (docs only):** The comment is correct that CASCADE handles those four tables, but omits that `fts_pages` is a virtual table and does NOT honor FK cascades. The indexer correctly handles this with explicit `DELETE FROM fts_pages WHERE slug = ?`, but the invariant isn't documented — future changes might skip the explicit FTS cleanup.

**Fix:** Add a comment in `src/indexer/index.ts` next to the FTS delete statement:

```typescript
// fts_pages is a virtual FTS5 table — no FK cascade.
// We explicitly delete FTS rows here; the CASCADE on pages handles the other four tables.
deleteFtsByPage.run(slug);
```

And optionally in `schema.ts` near the `fts_pages` CREATE: `-- NOTE: virtual, no FK cascade — indexer handles deletion explicitly`.

## Should fix

### 4. Clock skew / future-mtime reindex loop

**File:** `src/indexer/index.ts` (around `ensureFreshIndex`)

**Bug:** If any page mtime > `index.db` mtime, `ensureFreshIndex` triggers a reindex. Content-hash comparison then marks everything unchanged, so the transaction does nothing, and the DB mtime stays put. Every subsequent query reindexes and re-hashes every file. Clock skew or `git checkout` setting future mtimes can trigger this.

**Fix:** At the end of a successful reindex (even a no-op one), bump the DB mtime. Either `db.pragma('user_version = user_version + 1')` inside the transaction, or `utimes(dbPath, now, now)` after the transaction commits. Cheap, makes the mtime comparison monotonic.

### 5. `total` field is subtly wrong

**File:** `src/indexer/index.ts` (`IndexResult.total` returns `seenSlugs.size`)

**Bug:** Collided/non-sluggable files are skipped via `continue` before `seenSlugs.add()`. The `total` in the reindex summary undercounts files on disk. Misleading on exactly the situations where a summary matters.

**Fix:** Return both `filesSeen` and `pagesIndexed` as separate fields, or rename `total` → `pagesIndexed` and add `filesSkipped`. Update `commands/reindex.ts` to report both.

### 6. FTS phrase queries silently stripped

**File:** `src/commands/search.ts` (`buildFtsQuery`)

**Bug:** `raw.split(/[^a-z0-9]+/).filter(...)` loses underscores, dashes, and destroys multi-token phrase queries. `search "stripe webhook"` becomes `stripe* AND webhook*` rather than the phrase `"stripe webhook"`.

**Fix (minimal):** if `raw` starts and ends with `"`, pass through as an FTS5 phrase (escaped). Otherwise current prefix-AND behavior.

**Tests to add:** search queries with quoted phrases, with punctuation like dashes, with only whitespace.

### 7. Empty-page FTS behavior

**File:** `src/indexer/index.ts` (around FTS insert)

**Bug:** Pages with no body still get `INSERT INTO fts_pages (..., content) VALUES (..., '')`. FTS5 tolerates it but rank() behavior in joined queries is unpredictable.

**Fix:** Verify or add tests for "empty page, still searchable by title" and "page with only frontmatter, no body."

### 8. Info JSON shape inconsistency

**File:** `src/commands/info.ts`

**Bug:** Single-slug `--stdin` returns an array; single-slug positional returns an object. Consumers piping one slug vs. invoking directly get different shapes.

**Fix:** Always return array when `--stdin`; always return object when positional. Remove the conditional branch. Make the rule predictable and documented.

### 9. `updated_at` semantics

**File:** `src/commands/search.ts` (duration filters `--since` / `--stale`)

**Observation:** `updated_at` is file mtime. Any file rewrite — even whitespace-only — bumps it. When capture (slice 5) rewrites pages, `--stale 90d` will miss genuinely-stale content that received a trivial touch.

**Fix (optional, consider for slice 5+):** Add `content_edited_at` to the schema, bumped only on content-hash change. Defer to slice 5 or later. For this fixes slice, just document the behavior in command help: `--stale` is based on filesystem mtime.

### 10. `firstH1` implementation doesn't match comment

**File:** `src/indexer/frontmatter.ts` (`firstH1`)

**Bug:** Comment says "scans only up to the first 40 lines so a 2MB file doesn't stall." Actually, `str.split(/\r?\n/, 40)` splits the ENTIRE string first. The comment's invariant isn't held.

**Fix:** Either implement with per-line iteration that bails early, or fix the comment. For a 2MB file, performance is fine in practice — go with the simpler fix of updating the comment to say "returns only the first 40 lines' H1 match."

### 11. Missing slug-collision positive test

**File:** `test/indexer.test.ts`

**Bug:** Slug-collision warn-and-skip has no positive test asserting (a) warning is emitted, (b) first file wins, (c) second file not indexed.

**Fix:** Add a test creating two files that slugify to the same slug. Assert the second is skipped and a warning appears on stderr.

### 12. Missing empty-pages-directory test

**File:** `test/indexer.test.ts`

**Fix:** Test reindex against an empty `.almanac/pages/` directory. Should succeed with zero pages indexed.

## Consider

### 13. `show --stdin` separator ambiguity

**File:** `src/commands/show.ts`

**Observation:** `\n---\n` separator collides with YAML frontmatter delimiters, so consumers can't split on it. Tests already note this.

**Options:**
- A less-ambiguous sentinel like `\n<<<almanac-page-boundary>>>\n`
- JSON lines for bulk show: one page per line with `{slug, content}`

**Recommendation:** Switch `show --stdin` to JSON lines output (one JSON object per line). Matches `info --stdin` JSON. If compatibility with non-stdin `show` matters, keep that as pretty cat unchanged; stdin mode becomes structured.

### 14. WAL pragma on every open + missing sidecar gitignore

**Files:** `src/indexer/schema.ts`, `src/commands/init.ts`

**Observations:**
- WAL journal mode persists in the DB; setting it on every open is redundant (harmless but wasteful).
- WAL creates `.db-wal` and `.db-shm` sidecar files that will show up in `git status` during active reindexing.

**Fix:**
- Check WAL mode once at DB open; set only if not already WAL.
- Update `.gitignore` written by `almanac init` to include `.almanac/index.db-wal` and `.almanac/index.db-shm`.

### 15. Finish `toKebabCase` / `slugifyFilename` unification

**Files:** `src/indexer/slug.ts` (thin alias after slice 1 fixes), call sites in `src/indexer/index.ts`

**Observation:** Slice 1 fix agent extracted `toKebabCase` to `src/slug.ts` and made `src/indexer/slug.ts` a thin re-export under the alias `slugifyFilename`. The indexer still imports from the alias.

**Fix:** Update indexer imports to use `toKebabCase` from `src/slug.ts` directly. Delete `src/indexer/slug.ts`. One fewer indirection.

### 16. `--all` cross-wiki asymmetry

**Observation (deferred behavior):** The spec says "explicit `--wiki foo` errors on unreachable; `--all` silent." Slice 2 deferred `--all` entirely. Document this expectation in `resolveWiki.ts` comments so slice 3 (or whenever --all lands) preserves the asymmetry.

**Fix:** Add a comment in `src/indexer/resolveWiki.ts`:
```typescript
// NOTE: explicit --wiki <name> must fail loudly on unreachable wikis.
// When --all lands, it must silently skip unreachable ones (spec contract).
```

## Don't do

- **Don't change command surface area.** No new flags, no removed flags. These are bug fixes and robustness improvements.
- **Don't change the design.** GLOB-vs-LIKE, schema shape, archived filter semantics — all correct per spec. Don't second-guess.
- **Don't rewrite tests.** Extend. Preserve the `withTempHome` pattern.
- **Don't touch slice 1 code.** Slice 1 fixes already landed (`55f1699`).

## Verification

```bash
cd ~/Desktop/Projects/codealmanac
npm test
# ✓ all existing tests pass
# ✓ new tests for GLOB-escape, filesystem-race, FTS phrase, slug-collision, empty-dir all pass

npm run build
# ✓ clean

# Manual verification of must-fixes:

# Fix #1 — GLOB correctness
mkdir -p /tmp/glob-test && cd /tmp/glob-test && git init
almanac init
cat > .almanac/pages/route-a.md << 'EOF'
---
title: Route A
files: [src/[id]/page.tsx]
---
EOF
cat > .almanac/pages/route-b.md << 'EOF'
---
title: Route B
files: [src/abc/page.tsx]
---
EOF
almanac reindex
almanac search --mentions src/abc/page.tsx
# ✓ returns ONLY route-b (NOT route-a)

# Fix #2 — filesystem race resilience (manual approximation)
# Create a file, start reindex, delete the file before it's read.
# Indexer should warn and continue, not crash.

# Fix #3 — comment update
grep -n "virtual" src/indexer/index.ts
# ✓ comment near FTS delete references virtual table + manual cleanup
```

## Commit template

```
fix(slice-2-review): apply review findings

Must fix:
- search: GLOB wildcard escape via prefix equality + parameterized IN
- indexer: skip unreadable files (ENOENT/EACCES) instead of aborting reindex
- schema: document FTS5 virtual table manual-delete invariant

Should fix:
- indexer: bump DB mtime after every successful reindex (clock skew loop)
- indexer: distinguish filesSeen vs pagesIndexed in result
- search: phrase-match FTS queries when input is quoted
- info: consistent JSON shape (array for --stdin, object for positional)
- frontmatter: fix firstH1 comment to match implementation
- tests: slug collision, empty-pages-dir, FTS phrase, filesystem race

Consider:
- show --stdin emits JSON lines (parseable)
- WAL pragma set once; .db-wal/.db-shm added to .gitignore
- drop src/indexer/slug.ts alias; use src/slug.ts directly
- resolveWiki: comment --all asymmetry for future implementers
```

Push to origin/main.

## Report format

1. Each fix applied (one line per fix: what changed, which file/line)
2. `npm test` output summary
3. Manual verification transcript for must-fixes (GLOB escape, filesystem race)
4. Git commit hash + push confirmation
5. Anything punted + why
6. Any additional issues discovered during the fix pass
