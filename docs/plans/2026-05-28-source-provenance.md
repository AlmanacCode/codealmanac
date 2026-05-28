# Source Provenance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `sources:` the canonical provenance field for Almanac pages, derive file mentions from file sources, and give agents explicit guidance for source-backed claims and readable links.

**Architecture:** Page frontmatter will use structured `sources:` entries with stable IDs, typed source metadata, and optional citation markers in prose. A dedicated source-normalization module will convert current and legacy frontmatter into one internal source model, then the indexer will derive `file_refs` from normalized file sources plus inline file wikilinks. Prompt and manual guidance will treat sources as evidence and links as navigation.

**Tech Stack:** TypeScript, `js-yaml`, better-sqlite3, Vitest, Markdown/YAML frontmatter.

---

## Product Decisions

1. `sources:` is the canonical provenance field.
2. `files:` remains temporarily supported as legacy input, but new writer guidance should prefer `sources:`.
3. `file_refs` remains the index table used by `almanac search --mentions`, `health dead-refs`, `show --files`, and the viewer.
4. Legacy compatibility must be isolated in `src/indexer/page-sources.ts` or a sibling module, not scattered through `src/indexer/index.ts`.
5. The indexer derives `file_refs` from:
   - structured `sources:` entries with `type: file`
   - legacy `files:` entries during migration
   - inline file and folder wikilinks such as `[[src/indexer/schema.ts]]`
6. Source entries use stable IDs so prose can cite them with `[@source-id]`.
7. Citation validation starts as `health` warnings, not hard publish failures.
8. Web sources are supported as metadata in page frontmatter, not fetched or archived in this slice.
9. Deterministic migration belongs in `almanac health --fix`, not in Garden and not in update-time side effects.
10. Link style guidance belongs in the same manual/prompt pass because source trust and graph navigation are the same product surface.

## Source Entry Shape

Use this canonical frontmatter form:

```yaml
sources:
  - id: capture-command
    type: file
    path: src/commands/capture.ts
    note: Starts capture and records run metadata.
  - id: writer-prompt
    type: file
    path: prompts/writer.md
    note: Defines the Absorb writing contract.
  - id: claude-agent-sdk-docs
    type: web
    url: https://docs.anthropic.com/
    title: Claude Agent SDK documentation
    retrieved_at: 2026-05-28
    note: Documents SDK behavior used by the Claude provider.
```

Required fields:

- `id`: kebab-case page-local source ID.
- `type`: source type.
- `note`: one sentence explaining what the source supports.

Type-specific required fields:

- `file`: `path`
- `web`: `url`
- `commit`: `rev`
- `pr`: `url` or `number`
- `conversation`: `path` or `run_id`
- `wiki`: `slug`
- `manual`: `note`

Supported source types for this slice:

- `file`
- `web`
- `commit`
- `pr`
- `conversation`
- `wiki`
- `manual`

The parser should ignore unknown source types for indexing, but `health` can report malformed known types.

## Compatibility Boundary

The old model had two fields:

```yaml
files:
  - src/commands/capture.ts
sources:
  - https://example.com/docs
```

The new model has one field:

```yaml
sources:
  - id: capture
    type: file
    path: src/commands/capture.ts
    note: Migrated from legacy files.
  - id: example-docs
    type: web
    url: https://example.com/docs
    retrieved_at: 2026-05-28
    note: Migrated from legacy sources.
```

Compatibility is a temporary parsing and rewrite concern, not the conceptual model. Keep all legacy handling in one module so it is easy to delete after the migration window:

```ts
// src/indexer/page-sources.ts
export function normalizePageSources(input: {
  sources: FrontmatterSource[];
  legacyFiles: string[];
  legacySourceStrings: string[];
}): NormalizedPageSources;
```

`src/indexer/index.ts` should operate on normalized `pageSources` and derived `fileRefs`. It should not separately loop over `fm.files` and `fm.sources` in multiple places.

## Citation Shape

Use citation markers in prose:

```markdown
Capture starts a background Absorb job after supported sessions. [@capture-command]
```

Rules:

- A citation marker must match a `sources[].id` in the same page.
- Multiple citations are allowed after one sentence.
- Citations are evidence, not navigation. Use wikilinks for navigation.
- Claims may cite file, web, commit, PR, conversation, wiki, or manual sources.

## Link Style Shape

Readable prose should prefer display text:

```markdown
Capture updates pages through [[absorb-operation|the Absorb operation]].
```

Use slug-only links when the slug is already readable in context:

```markdown
See [[capture-flow]].
```

The manual should say: link concepts, not words. Link the first meaningful mention of load-bearing concepts, related anchors, adjacent systems, constraints, workflows, and source files.

---

### Task 1: Parse Structured Sources

**Files:**

- Modify: `src/indexer/frontmatter.ts`
- Test: `test/frontmatter.test.ts`

**Step 1: Write failing parser tests**

Add tests that assert:

- structured `sources:` entries are parsed
- legacy string `sources:` entries are parsed separately for compatibility
- `file` sources keep `id`, `type`, `path`, and `note`
- `web` sources keep `id`, `type`, `url`, `title`, `retrieved_at`, and `note`
- malformed entries are ignored rather than throwing
- legacy `files:` still parses

Example test body:

```ts
const fm = parseFrontmatter(`---
title: Capture
sources:
  - id: capture-command
    type: file
    path: src/commands/capture.ts
    note: Starts capture.
  - id: sdk-docs
    type: web
    url: https://example.com/docs
    title: SDK Docs
    retrieved_at: 2026-05-28
    note: External behavior.
  - https://legacy.example.com/docs
files:
  - src/legacy.ts
---

Body.`);

expect(fm.sources).toEqual([
  {
    id: "capture-command",
    type: "file",
    path: "src/commands/capture.ts",
    note: "Starts capture.",
  },
  {
    id: "sdk-docs",
    type: "web",
    url: "https://example.com/docs",
    title: "SDK Docs",
    retrieved_at: "2026-05-28",
    note: "External behavior.",
  },
]);
expect(fm.files).toEqual(["src/legacy.ts"]);
expect(fm.legacySourceStrings).toEqual(["https://legacy.example.com/docs"]);
```

**Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- test/frontmatter.test.ts
```

Expected: tests fail because `Frontmatter` has no `sources` field.

**Step 3: Implement parser support**

Add source interfaces:

```ts
export type FrontmatterSource =
  | { id: string; type: "file"; path: string; note?: string }
  | { id: string; type: "web"; url: string; title?: string; retrieved_at?: string; note?: string }
  | { id: string; type: "commit"; rev: string; note?: string }
  | { id: string; type: "pr"; url?: string; number?: string; note?: string }
  | { id: string; type: "conversation"; path?: string; run_id?: string; note?: string }
  | { id: string; type: "wiki"; slug: string; note?: string }
  | { id: string; type: "manual"; note: string };
```

Add `sources: FrontmatterSource[]` and `legacySourceStrings: string[]` to `Frontmatter`, initialize both to `[]`, and parse `obj.sources` with a narrow coercion helper. Structured mapping entries go into `sources`; string entries go into `legacySourceStrings`. The helper should require `id` and `type`, then require the type-specific field. Preserve `retrieved_at` as a `YYYY-MM-DD` string if YAML parsed it as a `Date`.

**Step 4: Run parser tests**

Run:

```bash
npm test -- test/frontmatter.test.ts
```

Expected: parser tests pass.

---

### Task 2: Derive File Refs From Sources

**Files:**

- Create: `src/indexer/page-sources.ts`
- Modify: `src/indexer/index.ts`
- Test: `test/indexer.test.ts`
- Test: `test/search.test.ts`
- Test: `test/health.test.ts`

**Step 1: Write failing indexer tests**

Add a test page with:

```yaml
sources:
  - id: schema
    type: file
    path: src/indexer/schema.ts
    note: Defines index tables.
```

Assert that `file_refs` contains `src/indexer/schema.ts`.

Add search coverage:

```bash
almanac search --mentions src/indexer/schema.ts
```

Expected result includes the page whose file ref came from `sources:`.

Add health coverage:

- existing file source should not appear in `dead_refs`
- missing file source should appear in `dead_refs`

**Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- test/indexer.test.ts test/search.test.ts test/health.test.ts
```

Expected: tests fail because only `files:` and inline wikilinks populate `file_refs`.

**Step 3: Implement derived file refs**

Create `src/indexer/page-sources.ts` with the current source model and the isolated legacy compatibility layer:

```ts
import type { FrontmatterSource } from "./frontmatter.js";

export interface IndexedPageSource {
  id: string;
  type: FrontmatterSource["type"];
  target: string;
  title?: string;
  retrieved_at?: string;
  note?: string;
  legacy: boolean;
}

export interface DerivedFileRef {
  rawPath: string;
  source: "structured-source" | "legacy-files";
}

export interface NormalizedPageSources {
  sources: IndexedPageSource[];
  fileRefs: DerivedFileRef[];
  hasLegacyFrontmatter: boolean;
}
```

Add functions:

```ts
export function normalizePageSources(input: {
  sources: FrontmatterSource[];
  legacyFiles: string[];
  legacySourceStrings: string[];
}): NormalizedPageSources;
```

`normalizePageSources` should:

- preserve structured sources with `legacy: false`
- convert legacy `files:` entries into `type: file` sources with `legacy: true`
- convert legacy string URL `sources:` entries into `type: web` sources with `legacy: true`
- preserve ambiguous non-URL legacy source strings for health reporting, but do not index them as source rows
- derive file refs from both structured file sources and legacy file entries
- generate deterministic legacy source IDs from the basename, de-duplicated with numeric suffixes
- set `hasLegacyFrontmatter` to true when `legacyFiles.length > 0` or `legacySourceStrings.length > 0`

In `runIndexer`, include normalized page sources and derived file refs in the planned page record:

```ts
const normalizedSources = normalizePageSources({
  sources: fm.sources,
  legacyFiles: fm.files,
  legacySourceStrings: fm.legacySourceStrings,
});
```

Insert file refs from the normalized model:

```ts
for (const ref of p.sourceFileRefs) {
  const raw = ref.rawPath;
  const isDir = looksLikeDir(raw);
  const path = normalizePath(raw, isDir);
  const originalPath = normalizePathPreservingCase(raw, isDir);
  if (path.length === 0) continue;
  insertFileRef.run(p.slug, path, originalPath, isDir ? 1 : 0);
}
```

Keep inline wikilink insertion unchanged.

**Step 4: Run mention and health tests**

Run:

```bash
npm test -- test/indexer.test.ts test/search.test.ts test/health.test.ts
```

Expected: tests pass.

**Removal note:** `normalizePageSources` is the only place that should know legacy `files:` can become file sources. When the compatibility window closes, deleting the legacy branch in this module should be sufficient for the indexer path.

---

### Task 3: Index Source Metadata

**Files:**

- Modify: `src/indexer/schema.ts`
- Modify: `src/indexer/index.ts`
- Test: `test/indexer.test.ts`

**Step 1: Write failing source table tests**

Assert that a parsed page inserts rows into a new `page_sources` table:

```sql
SELECT source_id, source_type, target, title, retrieved_at, note
FROM page_sources
WHERE page_slug = ?
ORDER BY source_id
```

Expected rows:

- file source target is the normalized path
- web source target is the URL
- note is preserved
- retrieved date is preserved for web sources

**Step 2: Run test and verify it fails**

Run:

```bash
npm test -- test/indexer.test.ts
```

Expected: test fails because `page_sources` does not exist.

**Step 3: Add schema**

Add:

```sql
CREATE TABLE IF NOT EXISTS page_sources (
  page_slug   TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  source_id   TEXT NOT NULL,
  source_type TEXT NOT NULL,
  target      TEXT NOT NULL,
  title       TEXT,
  retrieved_at TEXT,
  note        TEXT,
  PRIMARY KEY (page_slug, source_id)
);
CREATE INDEX IF NOT EXISTS idx_page_sources_type ON page_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_page_sources_target ON page_sources(target);
```

Bump `SCHEMA_VERSION` to `4`. In migration, drop `page_sources` if needed and clear `pages.content_hash` so all pages reindex.

**Step 4: Insert source rows**

In the indexer transaction:

- delete existing `page_sources` for the page
- insert normalized rows for each source
- use `path` as target for file sources
- use `url`, `rev`, `number`, `run_id`, `slug`, or `note` as target depending on type

**Step 5: Run tests**

Run:

```bash
npm test -- test/indexer.test.ts
```

Expected: source table tests pass.

---

### Task 4: Validate Citations In Health

**Files:**

- Modify: `src/commands/health.ts`
- Modify: `src/cli/register-query-commands.ts`
- Create: `src/sources/frontmatter-rewrite.ts`
- Test: `test/health.test.ts`

**Step 1: Add health report categories**

Add three categories:

- `missing_sources`: citation markers with no matching `sources[].id`
- `unused_sources`: source entries never cited in prose
- `legacy_frontmatter`: pages still using `files:` or legacy string sources

Use names that are specific enough for JSON consumers:

```json
{
  "missing_sources": [
    { "slug": "capture", "source_id": "missing-id" }
  ],
  "unused_sources": [
    { "slug": "capture", "source_id": "writer-prompt" }
  ],
  "legacy_frontmatter": [
    { "slug": "capture", "fields": ["files"] }
  ]
}
```

**Step 2: Write failing health tests**

Add pages:

```markdown
---
topics: [x]
sources:
  - id: capture-command
    type: file
    path: src/commands/capture.ts
    note: Starts capture.
---

Claim. [@missing-source]
```

Expected:

- `missing_sources` contains `missing-source`
- `unused_sources` contains `capture-command`

Add a positive test where `[@capture-command]` is used and neither category reports it.

**Step 3: Implement citation extraction**

Extract citation markers from page body with:

```ts
const CITATION_RE = /\[@([a-z0-9][a-z0-9-]*)\]/g;
```

Compare extracted IDs against `page_sources.source_id`.

**Step 4: Add deterministic `health --fix` rewrite support**

Add `--fix` to `almanac health`. `health --fix` may rewrite wiki pages only for safe mechanical source-frontmatter fixes. It must not invoke AI and must not alter page body prose.

Create `src/sources/frontmatter-rewrite.ts` with a deterministic rewriter that:

- preserves body bytes exactly
- preserves unrelated frontmatter fields
- converts `files:` entries into structured `sources[type=file]`
- converts string URL entries in legacy `sources:` into structured `sources[type=web]`
- removes `files:` only after conversion
- generates deterministic source IDs
- de-duplicates source IDs with numeric suffixes
- uses conservative notes such as `Migrated from legacy files.`
- leaves ambiguous non-URL legacy source strings unchanged and reports them as not fixable

Do not run this on package update. Updates may report that legacy frontmatter exists, but they must not create surprise project diffs.

**Step 5: Update JSON shape tests**

Update health JSON shape snapshots to include `missing_sources`, `unused_sources`, and `legacy_frontmatter`.

**Step 6: Run health tests**

Run:

```bash
npm test -- test/health.test.ts
```

Expected: health tests pass.

---

### Task 5: Display Sources In Show And Viewer

**Files:**

- Modify: `src/query/page-view.ts`
- Modify: `src/commands/show.ts`
- Modify: `src/viewer/api.ts`
- Test: `test/show.test.ts`
- Test: `test/viewer-api.test.ts`

**Step 1: Extend page view query tests**

Assert that page records include `sources` with source ID, type, target, title, retrieved date, and note.

**Step 2: Update shared page view query**

Query `page_sources` by page slug and return ordered source records.

**Step 3: Update `almanac show`**

When metadata is displayed, show a compact source summary:

```text
sources:    capture-command (file: src/commands/capture.ts), sdk-docs (web)
```

Do not dump long notes in the default header. Full source notes remain in page frontmatter/body.

**Step 4: Update viewer API**

Include sources in the page JSON response so the UI can render them later.

**Step 5: Run tests**

Run:

```bash
npm test -- test/show.test.ts test/viewer-api.test.ts
```

Expected: tests pass.

---

### Task 6: Update Writer Guidance And Manual Home

**Files:**

- Modify: `prompts/base/syntax.md`
- Create: `docs/manual/good-codebase-wikis.md`
- Test: no automated test required

**Step 1: Update prompt syntax guidance**

Change frontmatter guidance from "`files:` plus prompt-level `sources:`" to "`sources:` as provenance, with legacy `files:` still accepted."

New guidance should say:

- use `sources:` for all evidence
- use `type: file` for repo files, tests, migrations, prompts, and configs
- cite non-obvious claims with `[@source-id]`
- use `[[slug|readable text]]` when slug-only links interrupt sentence flow
- do not cite sources the agent did not inspect
- code is current truth; conversations and old PRs are historical unless verified against current code

**Step 2: Create the manual seed**

Create `docs/manual/good-codebase-wikis.md` as the first manual page. Keep it short and readable. It should define:

- sources make pages trustworthy
- links make pages navigable
- page names make pages readable
- subject neighborhoods make large subjects understandable
- source entries must explain relevance
- links should use readable display text in prose

This is not the full manual. It is the stable home for the doctrine we are actively turning into product behavior.

**Step 3: Run markdown-facing checks**

Run:

```bash
npm test
```

Expected: all tests pass.

---

### Task 7: Migration And Compatibility

**Files:**

- Modify: `prompts/operations/build.md`
- Modify: `prompts/operations/absorb.md`
- Modify: `prompts/operations/garden.md`
- Modify: `prompts/base/syntax.md`
- Test: prompt/manual review

**Step 1: Keep legacy pages working**

Do not require existing pages to migrate from `files:` immediately. The parser and indexer must continue supporting `files:`.

**Step 2: Bias new pages toward `sources:`**

Update operation prompts so new or substantially edited pages use structured `sources:` entries.

**Step 3: Teach the deterministic migration surface**

Update prompts and manual guidance so agents know:

- query commands read both old and new source formats
- new writing should emit only structured `sources:`
- deterministic cleanup is `almanac health --fix`
- Garden may recommend or run `almanac health --fix` when the task is wiki maintenance, but Garden is not the migration engine
- package update must not rewrite wiki files

**Step 4: Document the fixed rewrite**

The deterministic fixer migrates this:


```yaml
files:
  - src/foo.ts
sources:
  - https://example.com
```

to:

```yaml
sources:
  - id: foo
    type: file
    path: src/foo.ts
    note: Migrated from legacy files.
  - id: external-docs
    type: web
    url: https://example.com
    retrieved_at: 2026-05-28
    note: Migrated from legacy sources.
```

It does not add `[@source-id]` citations, improve source notes, or decide which claims a source supports. Those are agent/human work.

---

## Verification

Run the full suite:

```bash
npm test
```

Run a manual smoke test:

```bash
npm run build
node dist/bin/codealmanac.js search --mentions src/indexer/schema.ts
node dist/bin/codealmanac.js health --json
node dist/bin/codealmanac.js show wiki-organization-primitives
```

Expected:

- existing `files:` pages still show up in `--mentions`
- `sources[type=file]` pages show up in `--mentions`
- `almanac health` reports legacy frontmatter
- `almanac health --fix` rewrites safe legacy frontmatter without changing body prose
- missing file sources appear in `dead_refs`
- missing citation IDs appear in `missing_sources`
- uncited source IDs appear in `unused_sources`
- page display includes source summaries without making prose unreadable

## Open Questions

1. Should `unused_sources` warn for every source, or only for non-file sources? File sources can be useful for `--mentions` even when not cited in prose.
2. Should `retrieved_at` be required for web sources immediately, or only warned by Garden?
3. Should web sources eventually be copied into `.almanac/sources/` with snapshots, or is URL metadata enough for V1?
4. Should legacy `files:` be documented only under compatibility notes, or omitted from normal user-facing syntax docs?
5. Should citation markers be rendered specially in `almanac serve`, or left as normal Markdown text for now?
6. Should `health --fix` require a clean working tree for `.almanac/pages/`, or should it operate file-by-file and trust Git review?

## Commit Plan

1. `feat(sources): parse page source metadata`
2. `feat(sources): derive file refs from file sources`
3. `feat(sources): index source metadata`
4. `feat(sources): validate citation markers`
5. `feat(health): fix legacy source frontmatter`
6. `docs: add codebase wiki manual seed`
