---
title: Lifecycle Architecture
summary: Lifecycle architecture is the reading map for Almanac's AI write operations, provider execution layer, run records, CLI commands, and scheduled maintenance tasks.
topics: [agents, flows, cli, systems]
files:
  - src/operations/
  - src/commands/operations.ts
  - src/cli/register-wiki-lifecycle-commands.ts
  - src/process/
  - src/harness/
  - src/automation/
sources:
  - prompts/base/purpose.md
  - prompts/base/notability.md
  - prompts/operations/build.md
  - prompts/operations/absorb.md
  - prompts/operations/garden.md
status: active
verified: 2026-05-14
---

# Lifecycle Architecture

Lifecycle architecture is the cluster that explains how Almanac performs write-capable wiki work. It spans product operations, command routing, provider-neutral execution specs, provider adapters, durable run records, transcript capture, and scheduled maintenance.

Start with [[wiki-lifecycle-operations]] when the question is "what semantic operation is this?" Start with [[lifecycle-cli]] when the question is "what command did the user run?" Start with [[process-manager-runs]] when the question is "what happened during a run?" Start with [[harness-providers]] when the question is "how does this reach Claude, Codex, Cursor, or another runtime?"

## Core Read Order

[[wiki-lifecycle-operations]] is the conceptual overview. Build, Absorb, and Garden are semantic modes encoded by prompts and operation code, not generic names for "run an agent."

[[operation-prompts]] explains the base doctrine and operation-specific algorithms that give Build, Absorb, and Garden their judgment rules. Prompt edits are the first place to improve wiki-writing behavior when the missing behavior is editorial judgment rather than deterministic plumbing.

[[lifecycle-cli]] maps public commands to operations and process-manager behavior. It is the command-surface reference for `init`, `capture`, `ingest`, `garden`, `jobs`, `serve`, `setup`, and `automation`.

[[process-manager-runs]] owns run records, background spawn, event logs, cancellation, snapshots, reindex-on-success, and jobs inspection. It is the storage and observability layer for operation execution.

[[harness-providers]] owns the runtime adapter boundary. Operations create provider-neutral `AgentRunSpec` values; adapters translate those specs into Claude SDK calls, Codex app-server turns, Cursor placeholders, or future runtimes.

## Operation Pages

[[build-operation]] is the first-wiki creation path behind `almanac init`. It matters when work touches onboarding, initial corpus exploration, populated-wiki refusal, or first-run UX.

[[capture-flow]] is the transcript-to-Absorb path. It matters when work touches session transcript resolution, capture cost, Codex/Claude transcript stores, or the boundary between raw transcript input and durable project memory.

[[ingest-operation]] is the manual file/folder-to-Absorb path. It matters when work touches explicit user-supplied context that is not a coding-session transcript.

[[capture-automation]] and [[capture-ledger]] explain scheduled quiet-session capture. Read them together when changing sweep eligibility, quiet windows, dedupe, pending reconciliation, or cursor semantics.

[[automation]] explains recurring scheduled tasks: capture sweep, Garden, and opt-in self-update. [[self-update]] is the global package mutation path scheduled automation can invoke, but package mutation remains owned by the update command.

## Boundaries To Preserve

Operations own wiki semantics and construct run specs. They do not know provider SDKs, prompt transport protocols, launchd details, or run-record file formats.

The process manager owns execution lifecycle and durable observability. It does not decide whether a transcript is worth capturing, whether a page deserves to exist, or how provider-specific auth works.

Harness providers own runtime execution truth. They must reject unsupported spec fields or report unsupported capabilities rather than silently pretending a provider honored a request.

Automation owns scheduled invocation of known tasks. It does not own transcript eligibility, capture dedupe, Garden judgment, package-update semantics, or run finalization.

Agent readiness, auth checks, global instruction installation, and persisted provider config are support lifecycles, not the same thing as harness execution. [[provider-lifecycle-boundary]] is the current boundary page for that split.

## Historical Context

[[sessionend-hook]] is archived history for hook-based automatic capture. Current automatic capture is scheduler-only and must pass through sweep, ledger, and process-manager records.

The deleted `almanac bootstrap` and old writer/reviewer capture pipeline are historical names. Current runtime guidance should point to [[build-operation]], [[wiki-lifecycle-operations]], [[operation-prompts]], and [[process-manager-runs]].
