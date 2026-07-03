---
title: Lifecycle Architecture
summary: Lifecycle architecture is the reading map for CodeAlmanac's AI write operations, provider execution layer, repo-local job records, CLI commands, and scheduled maintenance tasks.
topics:
  - agents
  - flows
  - cli
  - systems
sources:
  - id: operations
    type: file
    path: src/codealmanac/workflows/
    note: Defines init, ingest, garden, sync, and shared lifecycle workflows in the active Python codebase.
  - id: app-composition
    type: file
    path: src/codealmanac/app.py
    note: Wires lifecycle workflows, the job ledger, the job queue, harnesses, and viewer services through the composition root.
  - id: lifecycle-parser
    type: file
    path: src/codealmanac/cli/parser/lifecycle.py
    note: Registers public lifecycle command parsing for init and hidden sync plus dev ingest/garden wiring.
  - id: jobs-parser
    type: file
    path: src/codealmanac/cli/parser/jobs.py
    note: Registers the hidden jobs inspection surface with `job_id` arguments.
  - id: jobs-layer
    type: file
    path: src/codealmanac/jobs/
    note: Stores repo-local lifecycle job records, logs, queue specs, worker locks, and background queue behavior.
  - id: harness
    type: file
    path: src/codealmanac/engine/harnesses/
    note: Defines provider-neutral harness requests and provider adapters that execute lifecycle prompts.
  - id: automation
    type: file
    path: src/codealmanac/services/automation/
    note: Implements scheduled sync, Garden, and update task configuration for recurring lifecycle work.
  - id: purpose-prompt
    type: file
    path: src/codealmanac/prompts/base/purpose.md
    note: Defines Almanac's project-memory purpose for lifecycle operations.
  - id: notability-prompt
    type: file
    path: src/codealmanac/prompts/base/notability.md
    note: Defines page notability and graph-structure rules used by lifecycle operations.
  - id: init-prompt
    type: file
    path: src/codealmanac/prompts/operations/init.md
    note: Defines the init operation's first-wiki algorithm.
  - id: ingest-prompt
    type: file
    path: src/codealmanac/prompts/operations/ingest.md
    note: Defines the ingest operation's source-distillation algorithm.
  - id: garden-prompt
    type: file
    path: src/codealmanac/prompts/operations/garden.md
    note: Defines the garden operation's graph-maintenance algorithm.
status: active
verified: 2026-07-03

---

# Lifecycle Architecture

Lifecycle architecture is the cluster that explains how CodeAlmanac performs write-capable wiki work. It spans product workflows, command routing, provider-neutral harness execution, repo-local job records, transcript sync, and scheduled maintenance. [@operations] [@app-composition] [@jobs-layer] [@harness] [@automation]

Start with [[wiki-lifecycle-operations]] when the question is "what semantic operation is this?" Start with [[lifecycle-cli]] when the question is "what command did the user run?" Start with [[process-manager-runs]] when the question is "what happened during a lifecycle job?" Start with [[harness-providers]] when the question is "how does this reach Claude, Codex, Cursor, or another runtime?"

## Core Read Order

[[wiki-lifecycle-operations]] is the conceptual overview. Init, ingest, and garden are semantic modes encoded by prompts and workflow code, not generic names for "run an agent."

[[operation-prompts]] explains the base doctrine and operation-specific algorithms that give init, ingest, and garden their judgment rules. Prompt edits are the first place to improve wiki-writing behavior when the missing behavior is editorial judgment rather than deterministic plumbing. [@purpose-prompt] [@notability-prompt] [@init-prompt] [@ingest-prompt] [@garden-prompt]

[[lifecycle-cli]] maps public commands to operations and job behavior. It is the command-surface reference for `init`, `sync`, `jobs`, `serve`, `setup`, automation, and the developer ingest/garden surfaces. [@lifecycle-parser] [@jobs-parser]

[[process-manager-runs]] owns repo-local lifecycle job records, background spawn, event logs, cancellation, queue specs, worker locks, attach streaming, reindex-on-success, and jobs inspection. It is the storage and observability layer for init, ingest, garden, and sync-started ingest execution. It deliberately does not own cloud runs or branch-triggered local runs.

[[harness-providers]] owns the runtime adapter boundary. Workflows create provider-neutral harness requests; adapters translate those requests into Claude, Codex, or future runtimes.

## Operation Pages

[[build-operation]] is historical naming for the first-wiki creation path now surfaced as `codealmanac init`. It matters when work touches onboarding, initial corpus exploration, populated-wiki refusal, or first-run UX.

[[capture-flow]] is the transcript-to-ingest path. It matters when work touches session transcript resolution, capture cost, Codex/Claude transcript stores, or the boundary between raw transcript input and durable project memory.

[[ingest-operation]] is the explicit bounded-source ingest path. It matters when work touches user-supplied files, folders, git ranges, source refs, or other concrete source material that should be distilled into durable wiki memory.

[[capture-automation]] and [[capture-ledger]] explain scheduled quiet-session capture. Read them together when changing sweep eligibility, quiet windows, dedupe, pending reconciliation, or cursor semantics.

[[automation]] explains recurring scheduled tasks such as sync and garden. [[self-update]] is the global package mutation path scheduled automation can invoke, but package mutation remains owned by the update command.

## Boundaries To Preserve

Lifecycle workflows own wiki semantics and construct harness requests. They do not know provider SDKs, prompt transport protocols, launchd details, or job-record file formats.

The jobs layer owns repo-local lifecycle execution state and durable observability. It does not decide whether a transcript is worth syncing, whether a page deserves to exist, how provider-specific auth works, or how cloud/local trigger runs are delivered.

Harness providers own runtime execution truth. They must reject unsupported spec fields or report unsupported capabilities rather than silently pretending a provider honored a request.

Automation owns scheduled invocation of known tasks. It does not own transcript eligibility, capture dedupe, Garden judgment, package-update semantics, or run finalization.

Agent readiness, auth checks, global instruction installation, and persisted provider config are support lifecycles, not the same thing as harness execution. [[provider-lifecycle-boundary]] is the current boundary page for that split.

## Historical Context

[[sessionend-hook]] is archived history for hook-based automatic capture. Current automatic sync is scheduler-only and must pass through sync sweep, ledger, and job records.

Deleted bootstrap/build surfaces and the old writer/reviewer capture pipeline are historical names. Current runtime guidance should point to `codealmanac init`, [[wiki-lifecycle-operations]], [[operation-prompts]], and [[process-manager-runs]].
