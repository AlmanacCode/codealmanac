---
title: Runtime Resources
topics: [architecture, runtime-resources, prompts, manuals, harnesses]
sources:
  - id: catalog
    type: file
    path: src/codealmanac/agents/catalog.py
  - id: collection
    type: file
    path: src/codealmanac/agents/yoke.yaml
  - id: build-metadata
    type: file
    path: src/codealmanac/agents/build/agent.yaml
  - id: ingest-metadata
    type: file
    path: src/codealmanac/agents/ingest/agent.yaml
  - id: garden-metadata
    type: file
    path: src/codealmanac/agents/garden/agent.yaml
  - id: build-agent
    type: file
    path: src/codealmanac/agents/build/instructions.md
  - id: ingest-agent
    type: file
    path: src/codealmanac/agents/ingest/instructions.md
  - id: garden-agent
    type: file
    path: src/codealmanac/agents/garden/instructions.md
  - id: build-service
    type: file
    path: src/codealmanac/workflows/build/service.py
  - id: ingest-service
    type: file
    path: src/codealmanac/workflows/ingest/service.py
  - id: garden-service
    type: file
    path: src/codealmanac/workflows/garden/service.py
  - id: manual-library
    type: file
    path: src/codealmanac/manual/library.py
  - id: manual-models
    type: file
    path: src/codealmanac/manual/models.py
  - id: architecture-manual
    type: file
    path: src/codealmanac/manual/architecture.md
  - id: manual-tests
    type: file
    path: tests/test_manual.py
  - id: diagnostics-install
    type: file
    path: src/codealmanac/services/diagnostics/install.py
  - id: package
    type: file
    path: pyproject.toml
  - id: design-doc-transcript
    type: conversation
    session_id: rollout-2026-07-15T00-29-05-019f64ad-e36f-7261-bfc9-11dfc0bb1fdc
    note: Design conversation choosing build-agent and manual wording for repository docs as evidence.
---

# Runtime Resources

Runtime resources are the packaged agents, operation instructions, writing
manuals, and per-run payloads that lifecycle operations hand to the local Yoke
harness. Build, ingest, and garden each have a stable Yoke agent identity,
while the workflow for a single run passes repository facts, health, sources,
guidance, and source-control policy as typed JSON runtime context [@catalog]
[@collection] [@build-service] [@ingest-service] [@garden-service]. The shared
writing manuals stay outside the agent folders so every operation can include
the same page-writing standards without rebuilding those standards into
operation-specific prompts [@manual-library].

## What It Owns

Build, ingest, and garden are a packaged Yoke `Collection`. The collection
manifest maps their stable product names to Yoke agent folders. Each folder's
`agent.yaml` owns description, tools, and permissions; `instructions.md` owns
the complete durable CodeAlmanac kernel and operation instructions [@catalog]
[@collection] [@build-metadata] [@ingest-metadata] [@garden-metadata]
[@build-agent] [@ingest-agent] [@garden-agent].

Manuals remain separate packaged reference documents. Runtime payloads name the
manual inventory so the agent can read the relevant document from the installed
package when it needs detailed page-writing rules [@manual-library].

`ManualLibrary` is the service boundary for that inventory. It reads the
thirteen bundled manual documents named by `MANUAL_DOCUMENTS`, rejects missing
or unreadable package resources with `ValidationFailed`, and returns typed
`ManualDocument` values with relative paths and non-empty bodies
[@manual-library] [@manual-models]. Build, ingest, and garden call
`manual.inventory()` when rendering their runtime context, so the full manual
packet travels with the operation prompt instead of being discovered by the
provider at run time [@build-service] [@ingest-service] [@garden-service].

The same library also owns manual installation and diagnostics. `install_missing`
copies only absent bundled files into a target manual directory, while
`repository_status` compares present files against the package copy without
rewriting local edits [@manual-library] [@manual-tests]. `doctor` uses the
inventory as an install check and reports the number of bundled manual
documents, which makes packaging failures visible before a lifecycle run reaches
the harness [@diagnostics-install].

The build agent should treat repository documentation as design evidence, not
background text to summarize. Plans, ADRs, RFCs, live agreements, design notes,
and ad-hoc Markdown can explain decisions and rejected alternatives, but the
agent must reconcile those claims with current code and tests before preserving
them as current wiki truth [@build-agent] [@design-doc-transcript]. The
architecture manual carries the same rule for article writers: use design
evidence for intent and tradeoffs, then trust code for runtime behavior when
the two disagree [@architecture-manual].

## What It Does Not Own

Agent folders do not contain Python orchestration or provider configuration.
They do not decide when Claude or Codex should delegate. Optional Yoke-native
`skills/`, `subagents/`, and `workflows/` folders are declarative capabilities;
the instructions and native harness decide when to use them.

## Runtime Flow

Each workflow builds one typed Pydantic payload and passes its JSON as the task
prompt under `Runtime context:` [@build-service] [@ingest-service]
[@garden-service]. The Yoke adapter independently loads the selected packaged
agent from the collection [@catalog] [@collection]. This separates stable agent
identity and instructions from facts that belong only to one run.

The instruction words from the former base and operation prompt files are
retained in the agent folders. They now occupy Yoke's intended agent-instruction
channel rather than being rebuilt by a CodeAlmanac prompt-rendering service.

## Key Files

- `src/codealmanac/agents/yoke.yaml` is the collection manifest.
- `src/codealmanac/agents/<name>/agent.yaml` is Yoke agent metadata.
- `src/codealmanac/agents/<name>/instructions.md` is the full agent instruction.
- `src/codealmanac/manual/` contains shared writing references.
- `pyproject.toml` includes the YAML and Markdown agent resources in wheels
  [@collection] [@package].

## Failure Modes

A missing collection entry, agent folder, metadata file, or instruction body is
a packaging or startup defect and should fail before provider execution. A
runtime prompt with invalid or missing typed facts is a workflow defect. Neither
case should be repaired by provider-specific fallback text.

## How To Change It

Change stable behavior in the relevant agent folder. Add a Yoke skill when a
reusable capability should be available on demand. Add a declared subagent only
when it has a durable specialist identity, prompt, or model policy; leave
ad-hoc delegation to the root instructions and native harness. Keep per-run
repository, source, health, guidance, and source-control facts in the typed task
payload.

## Related Pages

See [Yoke harness boundary](../agent-runs/provider-adapters),
[Lifecycle workflows](../lifecycle/workflows), and
[Auto-commit is prompt policy](../../decisions/auto-commit-is-prompt-policy).
