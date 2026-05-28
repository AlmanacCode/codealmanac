---
title: Wiki Clarifications
summary: Wiki clarifications are asynchronous human answers to unresolved questions raised by intelligent wiki operations.
topics: [agents, flows, product-positioning]
sources:
  - id: absorb-operation
    type: file
    path: src/operations/absorb.ts
    note: Runs Absorb operations that may need to raise unresolved wiki questions.
  - id: garden-operation
    type: file
    path: src/operations/garden.ts
    note: Runs Garden operations that may review unresolved wiki maintenance items.
  - id: process-manager
    type: file
    path: src/process/manager.ts
    note: Records operation runs that can expose questions or review items.
  - id: viewer-jobs
    type: file
    path: src/viewer/jobs.ts
    note: Exposes operation run records to the local viewer.
  - id: viewer-api
    type: file
    path: src/viewer/api.ts
    note: Serves viewer data that can later include question or review surfaces.
  - id: clarifications-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T01-43-21-019e2a29-293a-7263-b6ce-0a9dc0af792a.jsonl
    note: Records the design discussion that introduced asynchronous human clarification records.
  - id: flags-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T12-14-55-019e6f94-fae1-7780-b2c9-3e2f3d6b6f3e.jsonl
    note: Records the discussion that explored branch-scoped truth, wiki editorial review items, and product bug reporting.
status: active
verified: 2026-05-15
---

# Wiki Clarifications

Wiki clarifications are the product shape for questions that [[wiki-lifecycle-operations]] cannot answer from code, docs, history, or existing wiki pages. They are not deterministic health issues and not interactive CLI prompts. They are run-scoped or locally persisted questions that an agent raises during Absorb, Garden, or a future verification operation so a human can answer later in the viewer.

The design problem is different from `almanac health`. `health` can report broken links, dead file refs, stale pages, empty topics, and slug collisions because those are mechanical facts. Clarifications handle semantic uncertainty: contradictory architecture claims, stale responsibility statements, missing business context, unresolved product decisions, or wiki claims whose source of truth is partly in a human's head.

## Loop Shape

An intelligent wiki operation should clean up what it can without waiting for a human. When the evidence is insufficient, it emits a bounded question with evidence rather than guessing.

The intended loop is:

1. Absorb, Garden, or future Verify inspects the wiki and related source material.
2. The agent edits pages when current truth is clear.
3. The agent records unresolved questions when truth depends on missing human context.
4. `almanac serve` exposes a Questions or Needs Answer view over those records.
5. A human chooses an option, writes a freeform answer, dismisses the question, or marks that they do not know.
6. A later agent operation consumes answered questions as evidence and updates, archives, or leaves wiki pages unchanged.

The human answer is evidence, not automatic page content. The applying agent must reconcile it with code, docs, design rules, and existing pages before editing `.almanac/pages/`.

## Question Record

A useful question record needs enough context for a human to answer without reopening the whole session:

- stable id
- status such as `open`, `answered`, `applied`, or `dismissed`
- kind such as `conflict`, `missing-context`, `decision-needed`, or `stale-claim`
- question text
- why the answer changes future work
- related pages and files
- short evidence summaries with source references
- optional answer choices with consequences
- freeform answer support

The first implementation can store questions with the run record under `.almanac/runs/`, because they are produced by a specific Absorb, Garden, or Verify pass. A separate `.almanac/questions/` store is only justified when questions need to survive independently of run records, be grouped across runs, or become a first-class viewer workflow.

## Editorial Review Items

A 2026-05-28 product discussion explored a related but more explicit CLI surface for wiki maintenance problems. The useful distinction is between an agent asking for missing human context and an agent recording a conflict or ambiguity that it cannot safely resolve from the available evidence. `almanac review` is an escalation surface, not a task list for ordinary cleanup. Missing citations, vague prose, deterministic frontmatter migration, and poor linking should be fixed directly or reported by `almanac health` when they can be detected mechanically. [@flags-session]

The settled name from that discussion is `almanac review`, not `almanac raise`, `almanac flag`, or `almanac flags`. `raise` was rejected because it can mean a wiki conflict, product bug, GitHub issue, exception, or priority change. `flag` and `flags` were rejected because the singular/plural split is awkward and because "flag" is less explicit than the underlying job: create an editorial review item for knowledge that should not be silently accepted as wiki truth. [@flags-session]

The proposed command surface is one noun command with subcommands: `almanac review add`, `almanac review list`, `almanac review show <id>`, `almanac review decide <id>`, `almanac review apply <id>`, and `almanac review reopen <id>`. `review add` should accept one Markdown explanation rather than separate `--title`, `--body`, `--page`, or required `--kind` fields. The first Markdown heading becomes the summary, and the body explains what is unclear, which pages or sources are affected through inline wikilinks, why human judgment is needed, and what would resolve the item. The v1 design intentionally avoids `kind` and labels because the command itself means escalation for unresolved conflicts or ambiguity; labels can be added later if real review volume needs filtering. [@flags-session]

Review items should be readable as UI cards and detail pages. A good summary is a concrete question such as "Which page should own source-conflict guidance?", not a compressed label such as "Canonical source-conflict ownership ambiguity." The body should use simple prose and wikilinks, because the human reviewer needs enough context to answer without replaying the whole capture session. [@flags-session]

The proposed storage target is `.almanac/review.yaml`, a structured repo-local queue that Garden or a human can review later. The minimal record shape is a stable id, status, summary, creation time, decision time, optional decision text, application time, optional application summary, and Markdown body. Separate `pages: []`, `topics: []`, kind, and evidence fields are not necessary in v1 because the Markdown body can carry wikilinks that the indexer can later extract. This queue is operational maintenance data rather than a normal wiki page, because unresolved conflicts would pollute the page graph if every review item became `.almanac/pages/` content immediately. [@flags-session]

Review item status should distinguish the human decision from the agent's page edits. `open` means the item still needs a human or editor decision. `decided` means the human decision is recorded but the wiki pages still need to be changed. `applied` means an agent has applied the decision to pages, sources, links, and summaries. [@flags-session]

`review decide` records the human decision that unblocks the agent; it does not mean the wiki pages have already been edited. A decided item stores `status: decided`, `decided_at`, and a Markdown `decision`. Garden should start maintenance by running `almanac review list --status decided`, read each item with `almanac review show <id>`, apply the decision to the relevant wiki pages, and then run `almanac review apply <id> "<summary>"` to store `status: applied`, `applied_at`, and an application summary. `review reopen` moves a decided or applied item back to open when the decision was wrong, incomplete, contradicted by later code, or insufficient for the applying agent. [@flags-session]

The viewer surface should read as a decision inbox, not a work tracker. `almanac serve` can list open, decided, and applied review items, show the Markdown explanation with wikilinks, and provide a decision form for open items. After a decision, the UI should mark the item as ready for Garden rather than imply the wiki pages already changed. The human supplies judgment; the agent performs the page edits, link cleanup, and eventual applied-item cleanup. [@flags-session]

A review item is different from a product bug report. Review items are for conflicts and unresolved decisions that should not be accepted as current truth. Product bug reports are for defects in CodeAlmanac itself and should eventually use a separate `almanac bug` surface that can open a GitHub issue when configured or print a ready-to-copy report when GitHub is unavailable. [@flags-session]

## Product Boundaries

Clarifications should not become a GitHub Issues clone inside Almanac. They do not need assignment, labels, lifecycle boards, or human-owned implementation workflows. The source of truth remains the wiki plus code; questions are prompts for missing human context and evidence packets for a later agent operation.

Clarifications also should not make lifecycle commands interactive. Background capture and Garden must never block on user input. Foreground runs may print a concise summary that questions were produced, but answering happens through the viewer or a later explicit command.

The likely command and UI surfaces are:

- `almanac serve` Questions view for humans
- `almanac jobs show <run-id> --json` exposing run-scoped questions to agents
- a future `almanac verify` or `almanac garden --verify` for claim audits
- a future `almanac resolve-questions` or `almanac garden --answers` operation that applies answered questions

## Example

A clarification can ask whether the provider architecture page should describe Codex as CLI-backed, app-server-backed, or both. The evidence would link `[[harness-providers]]`, `[[provider-lifecycle-boundary]]`, and `[[src/harness/providers/codex/events.ts]]`, then state the conflict: an older design claim says Codex is CLI JSONL-backed, while the current harness maps app-server notifications.

The best answer may be "both are supported, but the wiki should distinguish runtime transport from event normalization." A later agent would then update the provider pages instead of pasting the human answer verbatim.

## Related Pages

[[wiki-lifecycle-operations]] defines Build, Absorb, and Garden as intelligent wiki-update algorithms. [[almanac-serve]] is the likely human UI surface for answering questions. [[process-manager-runs]] is the current local record model for lifecycle runs and JSONL logs. [[lifecycle-cli]] records the no-interactive-prompts constraint that keeps clarifications asynchronous.
