# Slice 3 — Review Fixes

Apply the fixes identified in the slice 3 code review. Slice 3 introduced topics DAG, tag/untag, and health. Review pinned issues against commit `f9a2ed2`.

## Read before coding

- `/Users/rohan/Desktop/Projects/codealmanac/src/topics/frontmatterRewrite.ts`
- `/Users/rohan/Desktop/Projects/codealmanac/src/topics/yaml.ts`
- `/Users/rohan/Desktop/Projects/codealmanac/src/commands/topics.ts`
- `/Users/rohan/Desktop/Projects/codealmanac/src/commands/health.ts`
- `/Users/rohan/Desktop/Projects/codealmanac/src/commands/tag.ts`
- `/Users/rohan/Desktop/Projects/codealmanac/src/indexer/paths.ts`
- `/Users/rohan/Desktop/Projects/codealmanac/test/topics.test.ts`, `tag.test.ts`, `health.test.ts`

Existing patterns to preserve: `withTempHome` in tests, surgical frontmatter rewrite, atomic writes, DAG depth cap at 32.

## Must fix

### 1. Block-style topics list with comments silently drops items (DATA LOSS)

**File:** `src/topics/frontmatterRewrite.ts:249-258`

**Bug:** The block-sequence parser loops while each line matches `^\s*-\s+(.*)$` and **breaks on the first non-matching line**. A page with:

```yaml
topics:
  - auth
  # security below
  - jwt
```

is parsed as `[auth]`, then the comment breaks the loop, then rewrite emits `topics: [auth]` — the comment AND `- jwt` are deleted from frontmatter on any subsequent `tag`/`rename`/`delete`.

**Fix:** Inside the block-seq scanning loop, skip lines that start with `#` (after optional whitespace) or are blank. Continue; don't break. Only break when hitting a line whose indent is ≤ the key's indent and whose content isn't a dash.

Edge cases to cover in tests:
- `# comment` interleaved between entries (preserve on rewrite)
- blank line interleaved
- trailing comment after last entry
- a comment that starts the block (before any entry)

Alternative (acceptable): detect the comment and refuse with a clear error ("block-list frontmatter with comments is not supported for rewrite; please flatten to flow style or delete the comment"). Only consider this fallback if preserving comments is genuinely hard.

### 2. CRLF → LF corruption in frontmatter (line-ending corruption)

**File:** `src/topics/frontmatterRewrite.ts:138, 202-203`

**Bug:** `splitFrontmatter` preserves the opener/closer's line endings byte-for-byte, but `fmLines = fmBlock.split(/\r?\n/)` strips endings, and the rewrite joins with `\n`. A CRLF-authored file comes out with LF frontmatter + CRLF body + CRLF closer — mixed endings, git-diff storm.

**Fix:** Detect the dominant frontmatter line ending on read (`const fmHadCRLF = /\r\n/.test(fmBlock)`). Rejoin with matching separator when writing.

Test: round-trip a CRLF frontmatter through `tag`/`untag`/`rename`; verify every original `\r\n` is preserved.

### 3. `dead-refs` fails on case-sensitive filesystems

**Files:** `src/commands/health.ts:230-257`, `src/indexer/paths.ts:45`

**Bug:** `normalizePath` lowercases paths at index time (good for macOS case-insensitive FS — it means lookups hit regardless of casing). But `dead-refs` does `existsSync(join(repoRoot, r.path))` — on Linux, `src/Dockerfile`, `README.md`, `src/Foo.tsx` are stored as lowercase and the stat call for the lowercase form returns false, so every mixed-case file is reported "missing."

**Fix (recommended):** Store both forms in `file_refs`:
- `path` (lowercased, used for GLOB/equality queries — current behavior)
- `original_path` (as-written, used for `existsSync` + display in `info` output)

Migrate the schema: add `original_path TEXT NOT NULL`. On index, record both. On dead-ref check, stat `original_path`. On display (`almanac info`), show `original_path` rather than `path`.

**Fix (alternative, simpler but slower):** On Linux, when `existsSync(join(repoRoot, r.path))` returns false, walk the parent directory and look for any entry that lowercases to the expected basename. Slow for pages with many refs but avoids a schema change.

Go with the schema change. It's the right long-term shape.

Tests:
- On Linux runner (CI): create a file `src/Dockerfile`, reference it from a page, `health` reports zero dead-refs
- `almanac info <page>` displays the original-casing path

## Should fix

### 4. Rename/delete write-ordering hole

**File:** `src/commands/topics.ts:603-608`

**Bug:** Pages get rewritten first; then `writeTopicsFile` fails (ENOSPC, EACCES, signal). User is left with every page frontmatter mutated but topics.yaml unchanged — silent partial rename.

**Fix:** Swap ordering. Write topics.yaml FIRST (atomic via tmp+rename), then rewrite pages. If a page rewrite fails mid-loop, topics.yaml is consistent with the new world and the reindex recovers the DB state; the remaining pages can be re-rewritten by re-running the command or reindex-picking-up ad-hoc topics.

Even better (two-phase): stage all page rewrites to tmp files, fsync each, atomically rename-all after topics.yaml is written. Defer this to a future slice unless trivial — swapping order is the must-have.

### 5. broken-links / broken-xwiki don't filter archived source pages

**File:** `src/commands/health.ts:264-273, 286-317`

**Bug:** Every other page-scoped health check filters `archived_at IS NULL`. Wikilinks/cross-wiki links from archived pages get flagged, producing noise.

**Fix:** `JOIN pages src ON src.slug = w.source_slug WHERE src.archived_at IS NULL`. Mirror for xwiki.

Tests: archived page with a broken wikilink doesn't appear in the report.

### 6. `topics list` page_count includes archived; other queries don't

**File:** `src/commands/topics.ts:112-116`

**Bug:** `topics list` shows archived pages in counts; `topics show` doesn't. Inconsistent user-facing numbers.

**Fix:** Add `archived_at IS NULL` guard to the count subquery. Pick one policy (default: exclude archived) and apply consistently. Document in code comment.

### 7. Document topics.yaml comment loss

**File:** `src/topics/yaml.ts:158-163`

**Bug:** `yaml.dump` strips comments. Plan explicitly flagged this; limitation wasn't documented.

**Fix (pragmatic):** Update the generated header comment in topics.yaml to say:
```
# Managed by `almanac topics`. User-added comments between entries
# will be stripped on the next write. Edit at your own risk — or use
# the CLI commands instead of hand-editing.
```

Don't switch to `eemeli/yaml` unless comment preservation becomes important to a user. `js-yaml` is simpler and the limitation is now visible.

### 8. `runTopicsCreate` skips `ensureFreshIndex`

**File:** `src/commands/topics.ts:337-351`

**Bug:** Every other topics command that touches the DB runs `ensureFreshIndex` first; `create` doesn't. If a user just wrote a page with `topics: [newparent]`, `topics create Foo --parent newparent` will reject because the DB hasn't seen it yet.

**Fix:** Call `ensureFreshIndex({ repoRoot })` at the start of `runTopicsCreate`. Same pattern as other commands.

### 9. `isAdHocTopicInDb` reopens DB per call

**File:** `src/commands/topics.ts:407-419`

**Bug:** Called inside a `for (const p of requestedParents)` loop; each call does `new Database()` + schema DDL + prepare + close. Wasteful at N=3.

**Fix:** Hoist DB open out of the iterating call site. Pass the handle into `isAdHocTopicInDb`. Or collapse with `findTopic` into a single `topicExists(file, db, slug): boolean` helper (see Consider #13 below).

### 10. Tag summary lies about newly-added topics

**File:** `src/commands/tag.ts:137`

**Bug:** Summary prints the full requested topic list, including ones already present. Misleading; creates false positives in commit diffs.

**Fix:** Compute `after.filter(t => !before.includes(t))` and only list the delta. If delta is empty, print "already tagged with X, Y" instead.

### 11-12. Missing tests

Add:
- **Block-style topics list with interleaved comments** (verifies must-fix #1)
- **CRLF line endings preserved** (verifies must-fix #2)
- **Linux case-sensitive dead-refs** (verifies must-fix #3; may need skip-on-macOS guard)
- **Archived page wikilinks don't appear in broken-links** (verifies should-fix #5)
- **`topics list` page_count excludes archived** (verifies should-fix #6)
- **`topics create --parent` works after writing a new page** (verifies should-fix #8)
- **Two-hop cycle via ad-hoc-promotion code path** (`topics link` on ad-hoc topic that creates a cycle)
- **Parameterized body-byte-preservation** across LF/CRLF/mixed, with/without trailing newline, block/flow topics style
- **`--json` shape snapshot** for topics/tag/health commands — assert shape stability

## Consider

### 13. Collapse `isAdHocTopicInDb` + `findTopic` into one helper

Five call sites do `findTopic(file, slug) === null && !isAdHocTopicInDb(repoRoot, slug)`. A helper `topicExists(file, db, slug): boolean` makes the intent obvious.

### 14. Drop or use `indexDbPath`

`src/topics/paths.ts` defines it, exports it, no one imports it. Either use it everywhere (matches slice-2 registry pattern) or delete it.

### 15. Drop `runTopicsDescribe` "impossible" error branch

`src/commands/topics.ts:702-709` — defensive check for an impossible null. CLAUDE.md says to trust invariants. Delete.

### 16. Fix misleading comment

`src/topics/yaml.ts:147` — says `null` becomes `~` in YAML, but js-yaml emits literal `null`. Minor wording fix.

### 17. Preserve block-style frontmatter when input was block-style

Frontmatter rewriter always emits flow style `topics: [a, b]` even if input was block style. Teams that standardize on block will see churn on first tag/untag. Nice-to-have; skip if complex.

## Don't do

- **Don't change command surface.** No new flags, no removed flags.
- **Don't restructure the topics module.** The current shape is fine; the bugs are local.
- **Don't touch slice 1 or 2 code.** Only slice 3 files.

## Verification

```bash
cd ~/Desktop/Projects/codealmanac
npm test          # all 171+ tests pass (plus new tests from this fix pass)
npm run build     # clean
npx tsc --noEmit  # clean

# Manual must-fix verifications:

# Fix #1 — block-style with comments
# Create a page with:
#   topics:
#     - auth
#     # keep me
#     - jwt
# Run: almanac tag page another
# Verify: comment and original entries preserved, "another" added

# Fix #2 — CRLF preservation
# Create page with CRLF line endings throughout
# Run: almanac tag page foo
# Verify: every \r\n survives

# Fix #3 — case-sensitive dead-refs
# Write a page referencing src/README.md
# Ensure src/README.md exists (with that exact casing)
# Run: almanac health
# Verify: dead-refs shows 0 (previously showed src/readme.md missing on Linux)
```

## Commit template

```
fix(slice-3-review): apply review findings

Must fix:
- frontmatterRewrite: block-style topics with comments preserved (data loss fix)
- frontmatterRewrite: CRLF line endings preserved through rewrite
- file_refs: store original_path alongside normalized path (fixes dead-refs
  on case-sensitive filesystems)

Should fix:
- topics rename/delete: write topics.yaml before rewriting pages
- health broken-links/broken-xwiki: filter archived source pages
- topics list: page_count excludes archived (consistency with topics show)
- topics.yaml header: document comment-stripping behavior
- topics create: ensureFreshIndex before ad-hoc parent lookup
- topics: hoist DB open out of iterating call sites
- tag summary: only list newly-added topics

Tests:
- block-style with comments, CRLF preservation, Linux dead-refs case
- archived wikilinks filter, page_count consistency
- two-hop cycle via ad-hoc promotion
- --json shape snapshot across topics/tag/health

Consider:
- collapsed findTopic + isAdHocTopicInDb helper
- use indexDbPath consistently or drop it
- drop impossible error branch in runTopicsDescribe
- fix misleading null/~ comment
```

Push to origin/main.

## Report format

1. Each fix applied (one line per fix: what changed, which file/line)
2. `npm test` output summary
3. Manual must-fix verification transcripts
4. Git commit hash + push confirmation
5. Anything punted + why
6. Any additional issues discovered during the fix pass
