---
title: Just-In-Time Context Surfacing
summary: Just-in-time context surfacing is the product direction where CodeAlmanac automatically shows a few cited, file-aware constraints before an agent makes risky edits.
topics: [product-positioning, agents]
sources:
  - /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T01-30-45-019e2a1d-a038-7633-81ea-a1dfc6cb50bd.jsonl
status: active
verified: 2026-05-15
---

# Just-In-Time Context Surfacing

Just-in-time context surfacing is the product direction that answers CodeAlmanac's activation gap. The current wiki can preserve high-signal project memory, but a future agent still has to remember to run `almanac search` and open the right pages. The stronger experience is automatic surfacing before decisions, with the repo-owned wiki remaining the evidence source.

The distinction is automatic surfacing, not automatic believing. CodeAlmanac should not stuff broad memory into every session or treat retrieved text as ground truth. It should notice when an agent is about to change behavior, show a small cited set of relevant constraints, and let the agent drill into full pages such as [[capture-flow]], [[capture-ledger]], or [[accidental-special-case-architecture]] when needed.

## Runtime Shape

The trigger point should be a pre-edit boundary, not session start and not every file read. A hook or future plugin can watch for actions that mutate files or imply a behavioral decision, including `apply_patch`, editor writes, mutating shell commands, focused test commands, stack traces with file paths, and the user's prompt.

Those signals become a compact intent query:

- action: edit, test, debug, or refactor
- files and folders: direct targets such as `src/capture/sweep.ts`
- concepts: terms from the prompt, command, path, stack trace, or diff

Retrieval should combine existing wiki structure rather than rely on semantic similarity alone:

- pages whose `files:` frontmatter mention the target file or folder
- pages with wikilinks to the target paths
- FTS matches in page bodies and summaries
- topic matches for the affected subsystem
- backlinks from architecture, decision, or lifecycle pages

## Context Construction

The first implementation should use deterministic retrieval over SQLite, FTS5, path indexes, topics, wikilinks, and a derived section index. It does not need vectors for the v1 product shape. The useful unit is a cited evidence packet, not a page summary.

A `page_sections` index can split each page by heading and store the page slug, heading path, section text, section kind, related files, related topics, and priority. The initial section kind can be heuristic: headings with `Boundary`, `Invariant`, `Gotcha`, `Decision`, `Do Not`, or `Failure`; sentences with `must`, `never`, `do not`, `accepted model`, `rejected`, or `current path`; frontmatter topics; and proximity to file references. Garden or Absorb can later make section metadata more explicit, but v1 should not require a new block syntax.

The runtime query object should be built without an LLM from observable intent: mode, prompt terms, touched files, containing folders, symbols if available, recent errors, and diff paths. Candidate retrieval should union exact `file_refs` matches, containing folder matches, topic matches inferred from path tokens, FTS matches from prompt and path terms, backlinks from directly matched pages, and architecture overview pages that link to direct matches.

The output should extract one or two source sentences from top-ranked sections before any LLM compression. An LLM may shorten those extracts into bullets, classify section kind, help Garden detect contradiction or staleness, and support post-session promotion into durable pages. It should not search the whole wiki on every edit path.

## Ranking Contract

The ranking question is "will this prevent a bad edit?", not "is this text similar?" Higher priority should go to pages containing invariants, gotchas, "must" or "do not" language, historical bugs, archived or superseded warnings, direct file mentions, and recent changes.

The output should stay short. A useful pre-edit intervention is three bullets such as:

- `capture-ledger`: prefix hashes protect cursor advancement when transcripts change.
- `capture-flow`: capture passes the original transcript path plus cursor context; it does not create copied transcript fragments.
- `accidental-special-case-architecture`: new special lifecycle paths need explicit justification.

Every bullet should name its source page. The agent can proceed after reading it, but high-severity invariants may justify asking the agent to state in its plan how the edit preserves that invariant.

## Product Boundaries

The canonical memory must remain `.almanac/pages/` and `.almanac/topics.yaml`. A session-local observation cache can improve retrieval and recency, but it should not become the source of truth for project memory. [[wiki-lifecycle-operations]] and [[capture-flow]] still own durable writeback through Absorb and Garden.

This boundary keeps the contrast with [[agentmemory-competitor]] sharp. Memory daemons win on automatic capture and recall, but they tend toward user-level memory stores and broad context injection. CodeAlmanac's differentiated path is cited, repo-local, file-aware constraint surfacing from a governed wiki.

## MVP Implication

A future CLI surface could prototype the mechanism before editor or agent hooks exist. The examples discussed were:

```bash
almanac context --for src/capture/sweep.ts --mode pre-edit
almanac context --diff
almanac context --prompt "fix capture automation"
```

These commands are product sketches, not current implemented surface. The durable requirement is the behavior: retrieve from the wiki, rank for actionability, show only a few cited constraints, stay silent when confidence is low, and preserve the repo-owned wiki as the canonical artifact.
