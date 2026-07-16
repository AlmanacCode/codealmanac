---
title: Agents And Manuals
topics: [architecture, runtime-resources, yoke, prompts]
sources:
  - id: catalog
    type: file
    path: src/codealmanac/agents/catalog.py
  - id: collection
    type: file
    path: src/codealmanac/agents/yoke.yaml
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
  - id: wiki-service
    type: file
    path: src/codealmanac/services/wiki/service.py
  - id: wiki-paths
    type: file
    path: src/codealmanac/services/wiki/paths.py
  - id: package
    type: file
    path: pyproject.toml
---

# Agents And Manuals

## What It Owns

Build, ingest, and garden are a packaged Yoke `Collection`. The collection
manifest maps their stable product names to Yoke agent folders. Each folder's
`agent.yaml` owns description, tools, and permissions; `instructions.md` owns
the complete durable CodeAlmanac kernel and operation instructions [@catalog]
[@collection] [@build-agent] [@ingest-agent] [@garden-agent].

Manuals remain separate packaged reference documents. During initialization,
the wiki service copies missing package resources into `almanac/manual/` before
the build agent starts [@wiki-service] [@manual-library]. The build runtime
payload names that repository-local manual root, and the build instructions give
writing sub-agents exact paths beneath it [@build-service] [@build-agent].

Ingest and garden do not use this repository-local manual root. Their runtime
payloads still embed the full manual document bodies from `ManualLibrary`
directly as `manual_documents` [@ingest-service] [@garden-service]. Only build
was moved to filesystem-reference manuals; a future change that extends this
pattern to ingest and garden needs to touch both workflow services and their
agent instructions the same way the build workflow was changed.

## What It Does Not Own

Agent folders do not contain Python orchestration or provider configuration.
They do not decide when Claude or Codex should delegate. Optional Yoke-native
`skills/`, `subagents/`, and `workflows/` folders are declarative capabilities;
the instructions and native harness decide when to use them.

## Runtime Flow

Each workflow builds one typed Pydantic payload and passes its JSON as the task
prompt under `Runtime context:` [@build-service] [@ingest-service]
[@garden-service]. The Yoke adapter independently loads the selected packaged
agent. This separates stable agent identity and instructions from facts that
belong only to one run.

Repository-local manual Markdown is support material, not wiki article prose.
The page iterator reserves the `manual/` directory, so copied manuals do not
become indexed page routes [@wiki-paths].

The instruction words from the former base and operation prompt files are
retained in the agent folders. They now occupy Yoke's intended agent-instruction
channel rather than being rebuilt by a CodeAlmanac prompt-rendering service.

## Key Files

- `src/codealmanac/agents/yoke.yaml` is the collection manifest.
- `src/codealmanac/agents/<name>/agent.yaml` is Yoke agent metadata.
- `src/codealmanac/agents/<name>/instructions.md` is the full agent instruction.
- `src/codealmanac/manual/` contains shared writing references.
- `almanac/manual/` contains the repository-local copies used by build agents.
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
