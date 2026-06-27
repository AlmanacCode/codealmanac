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
    path: src/jobs/records.ts
    note: Records operation jobs that can expose questions or review items.
  - id: viewer-jobs
    type: file
    path: src/viewer/jobs.ts
    note: Exposes operation job records to the local viewer.
  - id: viewer-api
    type: file
    path: src/viewer/api.ts
    note: Serves review items and counts from .almanac/review.yaml to the local viewer.
  - id: viewer-server
    type: file
    path: src/viewer/server.ts
    note: Routes the viewer API request for /review.
  - id: viewer-frontend
    type: file
    path: viewer/app.js
    note: Renders the Review route with open, decided, and applied sections.
  - id: clarifications-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T01-43-21-019e2a29-293a-7263-b6ce-0a9dc0af792a.jsonl
    note: Records the design discussion that introduced asynchronous human clarification records.
  - id: flags-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T12-14-55-019e6f94-fae1-7780-b2c9-3e2f3d6b6f3e.jsonl
    note: Records the discussion that explored branch-scoped truth, wiki editorial review items, and product bug reporting.
  - id: review-plan
    type: file
    path: docs/plans/2026-05-28-review-escalations.md
    note: Defines the shipped review-escalation queue, command surface, status lifecycle, Garden handoff, and verification plan.
  - id: review-command
    type: file
    path: src/cli/commands/review.ts
    note: Implements add, list, show, decide, apply, and reopen behavior for review escalations.
  - id: review-store
    type: file
    path: src/stores/wiki-review/store.ts
    note: Loads, validates, normalizes, IDs, and atomically writes .almanac/review.yaml.
  - id: review-cli
    type: file
    path: src/edges/cli/register-edit-commands.ts
    note: Registers the almanac review subcommands and stdin/argument Markdown handling.
  - id: garden-prompt
    type: file
    path: prompts/operations/garden.md
    note: Instructs Garden to process decided review items before general graph cleanup.
  - id: source-control-runtime
    type: file
    path: src/operations/run.ts
    note: Names .almanac/review.yaml as wiki source content when auto-commit runtime context is enabled.
status: active
verified: 2026-05-28
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

The first implementation can store questions with the job record under `.almanac/jobs/`, because they are produced by a specific Absorb, Garden, or Verify pass. A separate `.almanac/questions/` store is only justified when questions need to survive independently of job records, be grouped across jobs, or become a first-class viewer workflow.

## Editorial Review Items

A 2026-05-28 product discussion produced a related but more explicit CLI surface for wiki maintenance problems, and the same session landed the v1 implementation. The useful distinction is between an agent asking for missing human context and an agent recording a conflict or ambiguity that it cannot safely resolve from the available evidence. `almanac review` is an escalation surface, not a task list for ordinary cleanup. Missing citations, vague prose, deterministic frontmatter migration, and poor linking should be fixed directly or reported by `almanac health` when they can be detected mechanically. [@flags-session] [@review-plan]

The settled name from that discussion is `almanac review`, not `almanac raise`, `almanac flag`, or `almanac flags`. `raise` was rejected because it can mean a wiki conflict, product bug, GitHub issue, exception, or priority change. `flag` and `flags` were rejected because the singular/plural split is awkward and because "flag" is less explicit than the underlying job: create an editorial review item for knowledge that should not be silently accepted as wiki truth. [@flags-session]

The shipped command surface is one noun command with subcommands: `almanac review add`, `almanac review list`, `almanac review show <id>`, `almanac review decide <id>`, `almanac review apply <id>`, and `almanac review reopen <id>`. The edit-command registrar accepts Markdown as positional text or piped stdin for `add`, `decide`, `apply`, and `reopen`, while `list` supports `--status open|decided|applied|all` and defaults to open items. `show` and `list` can emit JSON for agents or viewer integrations. [@review-cli] [@review-command]

`review add` accepts one Markdown explanation rather than separate `--title`, `--body`, `--page`, or required `--kind` fields. The first Markdown heading becomes the summary, and the body explains what is unclear, which pages or sources are affected through inline wikilinks, why human judgment is needed, and what would resolve the item. The v1 design intentionally avoids `kind` and labels because the command itself means escalation for unresolved conflicts or ambiguity; labels can be added later if real review volume needs filtering. [@flags-session] [@review-command]

Review items should be readable as UI cards and detail pages. A good summary is a concrete question such as "Which page should own source-conflict guidance?", not a compressed label such as "Canonical source-conflict ownership ambiguity." The body should use simple prose and wikilinks, because the human reviewer needs enough context to answer without replaying the whole capture session. [@flags-session]

The storage target is `.almanac/review.yaml`, a structured repo-local queue that Garden or a human can review later. The store defaults missing or empty files to `version: 1` with no items, rejects malformed top-level YAML, rejects unsupported versions, rejects duplicate IDs, and writes through a temporary file followed by rename. Item IDs are kebab-case summaries capped from the first heading or first non-empty line, with numeric suffixes for collisions. [@review-store]

The minimal record shape is a stable id, status, summary, creation time, decision time, optional decision text, application time, optional application summary, and Markdown body. Separate `pages: []`, `topics: []`, kind, and evidence fields are not necessary in v1 because the Markdown body can carry wikilinks that the indexer can later extract. This queue is operational maintenance data rather than a normal wiki page, because unresolved conflicts would pollute the page graph if every review item became `.almanac/pages/` content immediately. The source-control runtime context treats `.almanac/review.yaml` as durable wiki source content alongside `.almanac/README.md`, `.almanac/pages/`, and `.almanac/topics.yaml` when auto-commit is enabled. [@flags-session] [@review-store] [@source-control-runtime]

Garden is the primary producer for review items because it audits wiki shape, overlap, source grounding, and currentness across the graph. Absorb and Build may also add review items when their input reveals a source conflict that cannot be resolved from current code, docs, sources, or existing pages. Review items should not be used for ordinary cleanup, missing links, source-health warnings, deterministic migrations, feature ideas, product wishes, or generic "should we support this?" questions; those should be fixed directly, reported by `almanac health`, or handled in the normal product backlog. [@flags-session]

The current escalation rule is unresolved source conflict after verification, not fact drift and not feature design. If current code, tests, config, prompts, schemas, or current external docs answer a present-tense claim, the agent should update the wiki directly and treat older contradictory wiki prose, PR comments, commits, conversations, or notes as stale or historical evidence. A review item is justified only when the wiki needs to say something, the agent has inspected the relevant sources, the sources still support incompatible interpretations, the normal truth hierarchy cannot resolve them, and a human/editor decision is needed to decide what the wiki should say. [@flags-session]

Review items should set the scene for a human decision instead of asking the human to organize the wiki. The body should name the claim in question, summarize the sources inspected, explain why verification did not resolve the source conflict, state the decision needed, and leave page placement, links, archive/supersession, and prose cleanup to Garden. A checkout retry mismatch is not a good review item when current code and tests already define retry behavior, and an image-source policy question is not a review item when it is really a feature or product-design question. [@flags-session]

Review item status should distinguish the human decision from the agent's page edits. `open` means the item still needs a human or editor decision. `decided` means the human decision is recorded but the wiki pages still need to be changed. `applied` means an agent has applied the decision to pages, sources, links, and summaries. [@flags-session]

`review decide` records the human decision that unblocks the agent; it does not mean the wiki pages have already been edited. A decided item stores `status: decided`, `decided_at`, and a Markdown `decision`. Garden starts maintenance by running `almanac review list --status decided`, reads each item with `almanac review show <id>`, applies the decision to the relevant wiki pages, and then runs `almanac review apply <id> "<summary>"` to store `status: applied`, `applied_at`, and an application summary. `review reopen` moves a decided or applied item back to open when the decision was wrong, incomplete, contradicted by later code, or insufficient for the applying agent. Reopening clears the stored decision and application fields while preserving a reopen timestamp and optional note. [@flags-session] [@review-command] [@garden-prompt]

The shipped viewer surface reads as a decision inbox, not a work tracker. `almanac serve` exposes a `/review` route backed by `src/viewer/api.ts`, `src/viewer/server.ts`, and `viewer/app.js`; the route reads `.almanac/review.yaml`, counts items by `open`, `decided`, and `applied`, and renders those statuses as separate sections. After a decision, the UI should mark the item as ready for Garden rather than imply the wiki pages already changed. The human supplies judgment; the agent performs the page edits, link cleanup, and eventual applied-item cleanup. [@flags-session] [@viewer-api] [@viewer-server] [@viewer-frontend]

A review item is different from a product bug report. Review items are for conflicts and unresolved decisions that should not be accepted as current truth. Product bug reports are for defects in CodeAlmanac itself and should eventually use a separate `almanac bug` surface that can open a GitHub issue when configured or print a ready-to-copy report when GitHub is unavailable. [@flags-session]

## Product Boundaries

Clarifications should not become a GitHub Issues clone inside Almanac. They do not need assignment, labels, lifecycle boards, or human-owned implementation workflows. The source of truth remains the wiki plus code; questions are prompts for missing human context and evidence packets for a later agent operation.

Clarifications also should not make lifecycle commands interactive. Background capture and Garden must never block on user input. Foreground runs may print a concise summary that questions were produced, but answering happens through the viewer or a later explicit command.

The likely command and UI surfaces are:

- `almanac serve` Review view for humans
- `almanac jobs show <run-id> --json` exposing run-scoped questions to agents
- a future `almanac verify` or `almanac garden --verify` for claim audits
- a future `almanac resolve-questions` or `almanac garden --answers` operation that applies answered questions

## Example

A clarification can ask whether the provider architecture page should describe Codex as CLI-backed, app-server-backed, or both. The evidence would link `[[harness-providers]]`, `[[provider-lifecycle-boundary]]`, and `[[src/harness/providers/codex/events.ts]]`, then state the conflict: an older design claim says Codex is CLI JSONL-backed, while the current harness maps app-server notifications.

The best answer may be "both are supported, but the wiki should distinguish runtime transport from event normalization." A later agent would then update the provider pages instead of pasting the human answer verbatim.

## Related Pages

[[wiki-lifecycle-operations]] defines Build, Absorb, and Garden as intelligent wiki-update algorithms. [[almanac-serve]] is the likely human UI surface for answering questions. [[process-manager-runs]] is the current local record model for lifecycle runs and JSONL logs. [[lifecycle-cli]] records the no-interactive-prompts constraint that keeps clarifications asynchronous.
