---
title: Source Provenance
summary: Source provenance is the page evidence model that makes `sources:` canonical while preserving file-aware queries through derived `file_refs`.
topics: [wiki-design, storage, decisions]
sources:
  - id: source-plan
    type: file
    path: docs/plans/2026-05-28-source-provenance.md
    note: Defines the source-provenance feature scope, compatibility boundary, migration surface, and implementation tasks.
  - id: frontmatter-parser
    type: file
    path: src/stores/wiki/indexer/frontmatter.ts
    note: Parses structured source frontmatter and legacy source strings.
  - id: source-normalizer
    type: file
    path: src/stores/wiki/indexer/page-sources.ts
    note: Normalizes structured sources, legacy files, legacy URL strings, and derived file references.
  - id: indexer-integration
    type: file
    path: src/stores/wiki/indexer/index.ts
    note: Inserts normalized sources into page_sources and derived file references into file_refs.
  - id: schema
    type: file
    path: src/stores/wiki/indexer/schema.ts
    note: Defines the page_sources table and schema-version migration.
  - id: health-command
    type: file
    path: src/stores/wiki/health/index.ts
    note: Reports source-health categories and runs deterministic source frontmatter fixes.
  - id: source-rewriter
    type: file
    path: src/stores/wiki/sources/maintenance.ts
    note: Rewrites safe legacy frontmatter into structured sources for `almanac migrate legacy-sources`.
  - id: show-command
    type: file
    path: src/cli/commands/show/index.ts
    note: Displays indexed page sources in the show command metadata header.
  - id: page-view-query
    type: file
    path: src/stores/wiki/query/page-view.ts
    note: Exposes indexed page sources to shared page-view consumers.
  - id: viewer-api
    type: file
    path: src/edges/viewer/read-model/api.ts
    note: Carries page source records into the local viewer API.
  - id: viewer-frontend
    type: file
    path: viewer/app.js
    note: Renders page sources in the local viewer's right rail.
  - id: syntax-prompt
    type: file
    path: prompts/base/syntax.md
    note: Teaches structured sources, citation markers, and legacy files compatibility to lifecycle agents.
  - id: operation-prompts
    type: file
    path: prompts/operations/build.md
    note: Applies the structured source convention to Build-created pages.
  - id: absorb-prompt
    type: file
    path: prompts/operations/absorb.md
    note: Applies the structured source convention to Absorb-created or substantially edited pages.
  - id: garden-prompt
    type: file
    path: prompts/operations/garden.md
    note: Applies source cleanup guidance to Garden maintenance runs, tells Garden to process decided review items before general cleanup, and limits new review items to unresolved source conflicts after verification.
  - id: review-plan
    type: file
    path: docs/plans/2026-05-28-review-escalations.md
    note: Defines the shipped review-escalation queue, command surface, status lifecycle, and Garden handoff.
  - id: review-command
    type: file
    path: src/cli/commands/review.ts
    note: Implements the deterministic almanac review command functions.
  - id: review-store
    type: file
    path: src/stores/wiki-review/store.ts
    note: Implements .almanac/review.yaml loading, validation, ID generation, and atomic writes.
  - id: manual-seed
    type: file
    path: docs/manual/good-codebase-wikis.md
    note: States the user-facing guidance that sources provide evidence and links provide navigation.
  - id: implementation-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T12-14-55-019e6f94-fae1-7780-b2c9-3e2f3d6b6f3e.jsonl
    note: Records the implementation session that landed structured source parsing, source indexing, health checks, viewer/show exposure, deterministic frontmatter fixes, direct source-query design, and the decision to encode source relationship in notes before adding status fields.
  - id: conversation-restore-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T14-59-42-019e702b-db29-70a0-9c7b-978028922a64.jsonl
    note: Records the recovery of a deleted-looking Codex conversation by copying the archived JSONL from ~/.codex/archived_sessions/ back into the dated ~/.codex/sessions/ tree and verifying byte identity.
  - id: lifecycle-provenance-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-27-05-019e70e9-b7d7-7900-9fc0-da2a6f0b532d.jsonl
    note: Records the capture-sweep discussion that clarified internal or Almanac-tagged sessions as automatic-capture exclusions rather than project evidence.
  - id: source-architecture-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/30/rollout-2026-05-30T18-19-49-019e7b2f-c7d8-7640-a485-6de2f5a4a62f.jsonl
    note: Records the architecture analysis that separated page provenance as a document concept from markdown metadata infrastructure, source connectors, health repair logic, and versioned migrations.
status: active
---

# Source Provenance

Source provenance is the evidence model for Almanac pages. It makes `sources:` the canonical frontmatter field for evidence, keeps `files:` as legacy compatibility during migration, and preserves `almanac search --mentions` by deriving `file_refs` from `sources` entries whose `type` is `file`. [@source-plan]

## Product Contract

`sources:` exists because file paths alone cannot explain why a reader should believe a page. A source can be a repo file, test, migration, prompt, config file, web page, commit, PR, conversation, prior wiki page, or manual note. Each source entry needs a stable page-local `id`, a `type`, a target field such as `path` or `url`, and a `note` that states what the source supports.

`files:` remains supported because existing wikis already use it for mechanical file-aware behavior through [[sqlite-indexer|the SQLite indexer]]. New and substantially edited pages should prefer `sources:`, but existing pages do not need an immediate migration. The indexer derives `file_refs` from `sources[type=file]`, legacy `files:`, and inline file or folder wikilinks. [@source-normalizer] [@indexer-integration]

The first source-provenance implementation deliberately excludes team/local portability fields. The 2026-05-28 discussion identified shared-verification policy as a product question for later iterations, but the source schema slice stays focused on provenance IDs, source types, citations, file-reference derivation, and deterministic migration from legacy fields.

Local conversation sources are evidence pointers, not durable shared archives. A Codex transcript cited as `sources[type=conversation]` may be absent from the normal dated `~/.codex/sessions/` tree while an identical JSONL still exists under `~/.codex/archived_sessions/`; restoring the conversation for local inspection can be a byte-preserving copy back into the dated sessions folder. That operational recovery supports the broader portability rule: local transcript paths can explain where a wiki edit came from, but team-facing current claims should still prefer repo, web, or shared-workspace evidence when another collaborator must verify them. [@conversation-restore-session]

The source shape is:

```yaml
sources:
  - id: capture-command
    type: file
    path: src/cli/commands/operations.ts
    note: Starts capture and records run metadata.
  - id: sdk-docs
    type: web
    url: https://example.com/docs
    title: SDK Docs
    retrieved_at: 2026-05-28
    note: Documents external behavior used by the project.
  - id: local-session
    type: conversation
    run_id: 2026-05-28-abc
    note: Records the discussion that introduced structured sources.
```

Supported source types are `file`, `web`, `commit`, `pr`, `conversation`, `wiki`, and `manual`. Web sources are metadata in page frontmatter; Almanac does not fetch, snapshot, or archive web pages in this implementation.

GitHub pull requests fit the current `pr` source type because a PR is a durable shared object whose title, body, reviews, changed files, linked commits, and closing context can support a wiki claim. GitHub issues are adjacent but not yet first-class: the 2026-05-28 implementation session concluded that issues should become their own `issue` source type instead of being overloaded into `pr` or generic `web` entries. The wiki should still distill the stable decision, invariant, workflow, or failure mode into page prose; GitHub remains provenance, not the wiki itself. [@implementation-session]

The 2026-05-29 GitHub connector research made this boundary sharper: `sources:` and `page_sources` are page-provenance machinery, not the ingestion model for webhooks, linked issues, review comments, branch-scoped source handles, or duplicate delivery handling. Connector ingestion should use source adapters and [[evidence-bundles|evidence bundles]] that carry trigger identity, addressable source refs, branch context, provenance metadata, and dedupe keys as run input or run sidecar data. PR-time review notes should also be separate output objects rather than page edits, so page frontmatter remains the durable citation layer for claims that actually land in the wiki. [@lifecycle-provenance-session]

The implemented local GitHub source-ref path made the naming risk concrete. The removed source-frontmatter rewriter module name confused page-source migration with operation source input, while `src/absorb/source-ref.ts` and `src/absorb/github.ts` mean user-supplied source addresses for Absorb. The corrected boundary keeps provenance as the page-evidence concept, keeps frontmatter parsing and source normalization in the markdown-to-SQLite projection path, keeps source-health checks and deterministic source-frontmatter migration in `[[src/stores/wiki/sources/]]`, puts the `almanac migrate legacy-sources` product workflow in `[[src/services/wiki/source-migration.ts]]`, and leaves `[[src/cli/commands/migrate.ts]]` as terminal rendering. Future source-connector work should not confuse page citations with source access. [@source-architecture-session]

The same source can support current truth, historical context, rejected alternatives, or unresolved questions depending on the claim that cites it. The first implementation does not add source status fields because the underlying problem is simpler: each `note` must state what the source supports. A fixed issue should be cited as the original report plus the current fix source; a brainstorming conversation should be cited as brainstorming unless code, tests, or prompts implemented the idea; and a PR discussion that changed before merge should not be cited as current behavior without a current code or prompt source. [@implementation-session]

Source ordering is not a currentness model. A wiki page may cite old commits, stale issues, untimestamped external docs, local conversations, and current code in the same source list, and those sources can disagree because they belong to different moments in the project. The durable rule from the 2026-05-28 discussion is to mark uncertainty in prose or source notes rather than infer truth from source order: code and tests anchor present-tense code claims, external docs need `retrieved_at` when current dependency behavior matters, and unresolved or speculative material should be written as an open question until a current source confirms it. [@implementation-session]

The later 2026-05-28 capture-sweep discussion exposed a second provenance layer that is broader than page evidence. Capture/Absorb needs provenance and ownership classification for the transcript material it is about to process: a transcript can be ordinary user/project work, helper-agent output, or CodeAlmanac maintenance output. Internal Absorb, Garden, Build, job-log, diagnostic, or other Almanac-tagged sessions are not automatic-capture evidence unless a user explicitly asks to ingest them. This operation-level policy is related to `sources:`, but it is not the same field: `sources:` explains what supports a page claim, while lifecycle provenance decides whether an input is in scope, unclaimed, and worth spending LLM tokens on before Absorb starts. [@lifecycle-provenance-session]

## Citation Contract

Citation markers use the page-local source ID:

```markdown
The source-provenance plan defines the compatibility boundary. [@source-plan]
```

Citations are evidence markers, not navigation links. [[wikilink-syntax|Wikilinks]] remain the graph navigation mechanism, and prose should prefer display text when a raw slug would interrupt sentence flow, such as `[[wiki-lifecycle-operations|the Absorb operation]]`.

Health reports citation problems as warnings instead of write-time failures. `missing_sources` records citation IDs that have no matching `sources[].id`, and `unused_sources` records source entries that prose never cites. [@implementation-session]

## Truth And Conflict Model

Source provenance does not make the latest source automatically true. Almanac decides present-tense claims by authority, recency, and relation to current project state. Current code, tests, config, prompts, and schemas are the highest authority for current behavior in this repo. Committed wiki pages are accepted project memory only when they still match current sources. Merged PRs and commits explain how the current state arrived, but old PR discussion is historical when code, tests, or prompts have moved on. Issues, PR comments, review threads, and conversations are evidence for problems, alternatives, intent, and unresolved questions; they do not establish current behavior unless current code or accepted docs confirm them. External web docs are authoritative for external systems, but they are time-sensitive and need retrieval context when current dependency behavior matters. [@implementation-session]

The local branch boundary is part of currentness. A repo wiki describes the checked-out working tree, so `main` describes `main`, a feature branch may describe branch behavior, and behavior-changing branches should carry matching `.almanac/` changes in the same PR. After merge, the merged wiki files become durable project memory; abandoned branch wiki changes disappear with the branch. Almanac should not make one local index reason over every branch until a team or remote product needs that behavior. [@implementation-session]

The main failure mode is claim/source mismatch. A source can be real but obsolete, recent but low-authority, authoritative but unrelated to the exact claim, useful only as historical context, private or local, or unresolved brainstorming. The writer's job is to decide whether a cited source supports a current claim, a historical claim, a rejected alternative, or an open question.

When code contradicts the wiki, the wiki should be updated toward current code and the old statement should remain only when it explains history. When current code contradicts an old issue, PR, or conversation, the old source should be cited as historical evidence rather than present truth. When two non-code sources conflict, the page should prefer the more authoritative and recent source, or mark the conflict as unresolved when that cannot be decided from available evidence. When a conversation proposes a feature that is not implemented, the page should record it as an open question or idea instead of describing it as product behavior. When external docs change while the repo still depends on older behavior, the page should name the mismatch explicitly. [@implementation-session]

Unresolved source conflicts should not automatically become page state. [[wiki-clarifications|Editorial review items]] are the shipped escalation queue for source conflicts that an agent cannot safely resolve after checking the relevant evidence and applying the normal truth hierarchy. The CLI uses `almanac review add`, `almanac review list`, `almanac review show <id>`, `almanac review decide <id>`, `almanac review apply <id>`, and `almanac review reopen <id>` over `.almanac/review.yaml`; `review add` accepts one Markdown explanation whose heading becomes the summary and whose body carries wikilinks to affected pages or sources. `review decide` records the human decision that a later agent operation should apply to the wiki, rather than marking the page edits as already complete. `review apply` records that an agent applied the decision to the wiki. Garden reads decided items before general cleanup and marks them applied after editing pages. Source-hygiene problems such as missing citations and non-portable sources fit `almanac health` better when they can be detected mechanically. Ordinary cleanup, answerable code/wiki drift, feature ideas, and product questions should not become review items. [@implementation-session] [@review-plan] [@review-command] [@review-store] [@garden-prompt]

## Transition Contract

The transition from `files:` to `sources[type=file]` is deterministic because agents cannot be expected to remember old wiki conventions. The indexer must accept legacy `files:` and structured `sources:` at the same time, and both forms must populate `file_refs` so `almanac search --mentions` remains stable for existing wikis.

Legacy compatibility is a temporary parsing and rewrite concern, not the conceptual source model. `[[src/stores/wiki/indexer/page-sources.ts]]` isolates legacy handling so `[[src/stores/wiki/indexer/index.ts]]` consumes one normalized `pageSources` and `fileRefs` model instead of looping over `files:` and `sources:` in multiple places. [@source-normalizer] [@indexer-integration]

The deterministic migration surface is `almanac migrate legacy-sources`, not Garden-owned cleanup, package-update side effects, or a mutating `health --fix` mode. The migration may rewrite wiki pages only for safe mechanical source-frontmatter fixes, must not invoke AI, and must not alter page body prose.

The rewriter in `[[src/stores/wiki/sources/maintenance.ts]]` preserves unrelated frontmatter fields, preserves body bytes, converts legacy `files:` entries into `sources` entries with `type: file`, converts legacy string URL entries in `sources:` into `type: web` entries, and removes `files:` only after conversion. Ambiguous non-URL legacy source strings remain unchanged and are reported as not fixable. [@source-rewriter]

The source-maintenance placement is not a general rule that migrations belong under the indexer. If Almanac later gets ordered, versioned migrations with durable migration state, those should have their own migration infrastructure. This frontmatter rewriter is a deterministic wiki-source maintenance command, not a schema migration system. [@source-architecture-session]

The migration must not invent citation markers in prose. Generated source IDs come from basenames, domains, or other deterministic target-derived names, with numeric suffixes for collisions. Migrated file entries use conservative notes such as `Migrated from legacy files.` until Garden or a future human edit can state source relevance more precisely.

## Implementation Surfaces

The parser in `[[src/stores/wiki/indexer/frontmatter.ts]]` exposes structured sources while continuing to parse legacy `files:`. The normalization module in `[[src/stores/wiki/indexer/page-sources.ts]]` preserves structured sources with `legacy: false`, converts legacy `files:` into temporary file sources with `legacy: true`, derives file refs from both forms, generates deterministic legacy source IDs, and exposes whether a page still has legacy frontmatter. [@frontmatter-parser] [@source-normalizer]

The indexer in `[[src/stores/wiki/indexer/index.ts]]` is the integration point that inserts derived file references into `file_refs` and source metadata into the `page_sources` table defined by `[[src/stores/wiki/indexer/schema.ts]]`. Keeping legacy conversion out of the indexer makes the compatibility branch easier to delete after the migration window closes. [@indexer-integration] [@schema]

The `page_sources` table stores `page_slug`, `source_id`, `source_type`, `target`, `title`, `retrieved_at`, `note`, and `legacy`. File sources store a normalized path as `target`; web sources store the URL. The schema version bump forces pages to reindex so existing markdown can populate the new table once the indexer consumes the normalized source model. [@schema] [@indexer-integration]

`page_sources` is intentionally a query projection, not the canonical source model. Markdown frontmatter remains the source of truth, while SQLite stores a flattened row per source so `show`, `serve`, health checks, and future source-target queries do not reread every page. The table is correct for indexed provenance because it is separate from `file_refs`: `file_refs` stays optimized for normalized path lookup and dead-reference checks, while `page_sources` can represent web pages, commits, PRs, conversations, wiki pages, manuals, and file evidence. The tradeoff is weak typing: type-specific fields collapse into `target`, so future features that need richer per-source metadata should read frontmatter or add a new derived table rather than treating `page_sources.target` as a full source object. Almanac does not yet have an `almanac sources` query command; source records are visible through `show`, `serve`, and health output. [@implementation-session]

A future `almanac sources` command should behave like source-aware `--mentions`, not like a raw inventory dump. The useful questions are "which pages cite this PR, issue, URL, commit, file, or conversation?", "which pages rely on sources from this type or domain?", and "which current wiki claims still depend only on unresolved or historical context?" Candidate query shapes are `almanac sources --mentions <target>`, `almanac sources --type pr`, `almanac sources --type issue`, and `almanac sources --domain github.com`. [@implementation-session]

The query surface exposes sources without replacing existing file-reference behavior. `[[src/cli/commands/show/index.ts]]` renders a compact source summary in the metadata header, `[[src/stores/wiki/query/page-view.ts]]` returns source records on shared page views, `[[src/edges/viewer/read-model/api.ts]]` includes source records in page API responses, and `[[viewer/app.js]]` renders file sources as file-route links, web sources as external links, and other source types as non-navigating source rows in [[almanac-serve|the viewer]] right rail. [@show-command] [@page-view-query] [@viewer-api] [@viewer-frontend]

The health implementation in `[[src/stores/wiki/health/index.ts]]` adds source-specific categories beside the existing graph checks, while `[[src/cli/commands/health/index.ts]]` stays the CLI entrypoint and owns output rendering. Missing source citations and unused source entries belong in `health` because the project chose warnings over hard validation for the first source-provenance slice. `legacy_frontmatter` records pages still using `files:` or legacy string sources, `duplicate_sources` records repeated source IDs, and `unfixable_sources` records ambiguous legacy source strings. `almanac health` is report-only for source migration and warns users to run `almanac migrate legacy-sources` when legacy frontmatter is present. [@health-command]

## Prompt And Manual Guidance

`[[prompts/base/syntax.md]]` teaches `sources:` as the provenance field and describes `files:` as legacy compatibility. The operation prompts for [[build-operation|Build]], [[wiki-lifecycle-operations|Absorb]], and [[wiki-lifecycle-operations|Garden]] bias new or substantially edited pages toward structured `sources:`. Garden may recommend `almanac migrate legacy-sources` during wiki maintenance, but Garden is not the migration engine and package updates must not create surprise wiki diffs. [@syntax-prompt] [@operation-prompts] [@absorb-prompt] [@garden-prompt]

The manual seed is `docs/manual/good-codebase-wikis.md`. It treats sources and links as separate quality primitives: sources make claims trustworthy, and links make the graph navigable. The manual also preserves the page-title and subject-neighborhood guidance described by [[wiki-organization-primitives]]. [@manual-seed]

## Settled Boundaries

The implementation settled three boundaries during review:

- `unused_sources` warns for every indexed source, including file sources.
- `almanac migrate legacy-sources` does not require a clean working tree; it performs deterministic page rewrites and relies on normal Git review.
- Legacy URL conversion does not synthesize `retrieved_at`, because invented retrieval dates would misrepresent evidence.

## Open Questions

The feature still leaves product questions unresolved:

- whether `retrieved_at` is required for web sources immediately or only warned by Garden
- whether web sources eventually need copied snapshots under `.almanac/sources/`
- whether `issue` and `discussion` should become supported source types for GitHub and other shared collaboration systems
- whether currentness and uncertainty should stay in prose and source notes, become source metadata, or become a health/query concern
- whether legacy `files:` should appear only in compatibility notes or remain visible in normal syntax docs
- whether `almanac serve` should render citation markers specially or leave them as normal Markdown text
- whether shared-team portability policy belongs in source metadata, health policy, or a separate team product surface

## Related Pages

[[wiki-organization-primitives]] explains why sources and links are separate content primitives. [[operation-prompts]] explains where prompt guidance belongs. [[sqlite-indexer]] explains the current index tables that source provenance extends. [[almanac-product-family]] explains the deferred product distinction between individual and team Almanacs.
