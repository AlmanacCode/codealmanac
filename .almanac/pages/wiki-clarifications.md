---
title: Wiki Clarifications
summary: Wiki clarifications are asynchronous human answers to unresolved questions raised by intelligent wiki operations.
topics: [agents, flows, product-positioning]
files:
  - src/operations/absorb.ts
  - src/operations/garden.ts
  - src/process/manager.ts
  - src/viewer/jobs.ts
  - src/viewer/api.ts
sources:
  - /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T01-43-21-019e2a29-293a-7263-b6ce-0a9dc0af792a.jsonl
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

## Product Boundaries

Clarifications should not become a GitHub Issues clone inside Almanac. They do not need assignment, labels, lifecycle boards, or manual resolve workflows. The source of truth remains the wiki plus code; questions are prompts for missing human context and evidence packets for a later agent operation.

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
