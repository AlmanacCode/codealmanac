---
title: Agent Runs
topics: [architecture, agent-runs, harnesses, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entries for agent runs, harnesses, and providers.
  - id: harness-contract
    type: wiki
    path: architecture/agent-runs/harness-contract
    note: Architecture page for the service-owned harness request, result, and event contract.
  - id: yoke-boundary
    type: wiki
    path: architecture/agent-runs/provider-adapters
    note: Architecture page for the current Yoke-backed provider adapter boundary.
  - id: harness-events
    type: wiki
    path: reference/harness-event-shape
    note: Reference page for normalized harness event payloads.
  - id: runtime-resources
    type: wiki
    path: architecture/runtime-resources/prompts-and-manuals
    note: Architecture page for packaged Yoke agents, writing manuals, and per-run payloads.
  - id: lifecycle-workflows
    type: wiki
    path: architecture/lifecycle/workflows
    note: Architecture page for build, ingest, garden, and sync workflow boundaries.
---

# Agent Runs

Agent-run architecture is the boundary that lets lifecycle workflows ask a
local agent provider to do wiki-writing work without leaking provider protocols
into the rest of CodeAlmanac. The topic graph splits this neighborhood into
agent runs, harnesses, and providers: lifecycle code depends on the harness
contract, while provider execution is currently implemented through the Yoke
boundary [@topics] [@harness-contract] [@yoke-boundary].

Read this hub when changing Codex or Claude execution, normalized run events,
harness readiness, packaged agent loading, or the path from a lifecycle task to
provider output.

## Reading Order

Start with [Harness contract](harness-contract). It defines the
service-owned request, readiness, result, transcript reference, changed-file
metadata, and normalized event vocabulary that lifecycle workflows can depend
on [@harness-contract].

Then read [Yoke harness boundary](provider-adapters). It explains the current
adapter that binds CodeAlmanac's packaged Yoke agents to Codex or Claude,
projects provider events, and returns one terminal harness result
[@yoke-boundary].

Use [Harness event shape](../../reference/harness-event-shape) when a change
touches log events, attach streams, usage counters, tool display fields,
failure payloads, or helper-agent traces. That page is the exact lookup
contract for the event objects returned by the harness boundary
[@harness-events].

## Neighboring Pages

[Runtime resources](../runtime-resources/prompts-and-manuals) explains the
packaged Yoke collection, shared writing manuals, and typed per-run payloads
that lifecycle workflows select before calling the harness [@runtime-resources].
The lifecycle entry point is [Lifecycle workflows](../lifecycle/workflows),
which explains build, ingest, garden, and sync before they reach this provider
boundary [@lifecycle-workflows].
