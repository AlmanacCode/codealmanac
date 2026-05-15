---
title: Accidental Special-Case Architecture
summary: CodeAlmanac treats one-off mechanisms as provisional architecture because AI-assisted implementation can leave locally effective special paths that were never deliberately accepted.
topics: [agents, decisions]
files:
  - AGENTS.md
  - CLAUDE.md
  - .claude/agents/review.md
sources:
  - /Users/rohan/.codex/sessions/2026/05/13/rollout-2026-05-13T10-09-42-019e21ac-062a-7830-af2e-f8e719f85d89.jsonl
  - docs/plans/2026-05-14-provider-automation-boundary-refactor.md
  - /Users/rohan/.codex/sessions/2026/05/13/rollout-2026-05-13T23-00-06-019e246d-595d-76d3-bd45-6433245065ac.jsonl
  - /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T11-33-08-019e271e-c639-72f2-bf85-e598ad83ce62.jsonl
  - /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T01-43-21-019e2a29-293a-7263-b6ce-0a9dc0af792a.jsonl
status: active
verified: 2026-05-15
---

# Accidental Special-Case Architecture

Accidental special-case architecture is a review concept for CodeAlmanac's AI-assisted codebase. It names code that solves a narrow current task by adding a special path, storage file, parser, scheduler, prompt branch, copied artifact, or lifecycle rule when the existing general model could have been extended instead.

The concept became explicit during a 2026-05-14 design discussion about capture automation. A tempting capture design was to copy or chop session transcripts into separate files for the Absorb agent. The accepted model kept ingest neutral instead: capture automation decides when a transcript continuation is eligible, the ledger records what has already been covered, and Absorb receives the original transcript path plus cursor context. That avoided a transcript-copy subsystem with its own source-of-truth, cleanup, dedupe, and lifecycle semantics. See [[capture-flow]] and [[capture-ledger]].

## Review Rule

`CLAUDE.md` now tells agents to ask whether a solution creates a one-off mechanism where the existing general model could be extended. Root `AGENTS.md` is a tracked symlink to `CLAUDE.md`, so Codex receives the same repo-local rule. If a change adds a special path, it needs an explicit architectural justification: why the general path is insufficient, whether the exception is temporary or permanent, how it is bounded, and what would make it safe to remove or generalize later.

The same guidance treats existing special conditions as provisional. This project has been built with AI, and AI agents can leave behind locally effective fixes that were never consciously accepted as architecture. Existing extra flags, copied files, fallback paths, bespoke state, provider-specific branches, and helper scripts have to earn their place instead of being treated as legitimate only because they already exist.

## Review Agent Contract

[[.claude/agents/review.md]] now has a `Special-case architecture` section. The code reviewer must actively question new and existing special paths, including:

- copied or derived files
- workflow-only storage
- command-specific parsers
- provider-specific conditionals outside provider modules
- prompt-specific preprocessing
- helper scripts
- parallel lifecycle paths

The reviewer should not reject every exception. It weighs each special case by the invariant it protects, the user-facing behavior that would break without it, whether it compensates for a missing general abstraction, whether it is temporary glue or permanent architecture, and whether it duplicates source-of-truth data.

## Automation Review Example

A later 2026-05-14 review applied this rule to scheduler automation. The review preserved quiet-window gating, ledger cursors, prefix hashes, pending reconciliation, and repo locks because they protect capture correctness rather than simplifying a local implementation detail. It flagged the pre-refactor placement instead: `src/commands/capture-sweep.ts` owned discovery, metadata parsing, repo mapping, ledger logic, locking, capture enqueueing, and rendering; `src/commands/automation.ts` owned both capture and Garden launchd jobs; setup added an ephemeral-`npx` durable-install branch before calling automation. The follow-up refactor moved sweep ownership under [[src/capture/]], launchd/task ownership under [[src/automation/]], and setup substeps under [[src/commands/setup/]] without deleting the correctness checks.

The durable distinction is that special cases are judged by ownership and invariant, not by whether they are unusual. A prefix hash in [[capture-ledger]] is unusual but load-bearing because it detects transcript rewrites before advancing a cursor. A Garden flag under auto-capture automation may work today but creates a product-boundary question because Garden is a separate lifecycle operation with its own cadence and status needs.

`capture sweep --dry-run` is an explicit design exception to the repo's general "no dry-run flags" rule. The exception is bounded to scheduler verification: it computes the same eligibility and cursor ranges as a real sweep, but does not enqueue capture jobs or write ledger state. A 2026-05-15 codebase-smell review kept the exception only if it remains framed as capture-domain verification, or is renamed to a domain word such as preview, rather than becoming a precedent for generic dry-run command design.

## Platform Boundary Example

A 2026-05-14 review of `origin/codex/windows-support` applied the same rule to cross-platform support. `node:path`, `path.win32`, and `path.posix` should own filesystem path syntax, but they do not decide where npm, Codex, Claude, launchd, Task Scheduler, temp directories, global instructions, or command shims live on each OS.

The reusable architecture is a small platform profile for OS conventions plus adapters at real external-system boundaries. Scheduler behavior belongs behind launchd and Windows Task Scheduler adapters as described in [[automation]]. Agent instruction behavior belongs behind Claude and Codex install targets as described in [[global-agent-instructions]]. Package-manager behavior belongs behind npm/global-install helpers such as [[install-time-node-launcher]]. A single broad "platform path abstraction" would hide important differences and turn platform support into another special case.

## Agent Capability Assumption

The rule assumes the agents using this repo are capable. They can read files, inspect history, follow wiki pages, call tools, and reason over context. CodeAlmanac should not build rigid preprocessing, copied context bundles, artificial staging files, or elaborate orchestration solely because an agent might need help, unless there is evidence that the general agentic workflow fails.

## Open-Source File Burden

The review rule also treats every new tracked file as public surface area and future maintenance burden because CodeAlmanac is open source. A new file should have an owner and a reason to exist outside existing prompts, docs, modules, or test helpers. This applies especially to one-off compatibility files, migration helpers, and workflow-specific artifacts that can become stale after the original task ends.
