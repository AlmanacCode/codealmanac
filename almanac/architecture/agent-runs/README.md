---
title: Agent Runs
topics: [architecture, agent-runs, harnesses, overview]
sources:
  - id: harness-contract
    type: file
    path: almanac/architecture/agent-runs/harness-contract.md
    note: Architecture page for the normalized harness contract used by lifecycle workflows.
  - id: provider-adapters
    type: file
    path: almanac/architecture/agent-runs/provider-adapters.md
    note: Architecture page for the Yoke harness boundary that implements the contract.
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entry for the agent-runs neighborhood and its harnesses and yoke children.
---

# Agent Runs

Agent runs is the part of CodeAlmanac that executes one build, ingest, or garden task against an external coding agent and turns the result into durable, provider-neutral facts. The neighborhood has two pages: the contract lifecycle workflows depend on, and the one adapter that currently implements it [@topics].

Read this hub when changing how a `RunHarnessRequest` is built, how a harness run reports readiness or results, or how provider events become normalized job-log events.

## Reading Order

Start with [Harness contract](harness-contract). It defines `RunHarnessRequest`, `HarnessRunResult`, and `HarnessEvent`, and states the boundary rule that lifecycle workflows may depend only on those normalized shapes [@harness-contract].

Then read [Yoke harness boundary](provider-adapters). It explains `YokeHarnessAdapter`, the single provider integration that implements the contract for both Claude and Codex by loading a packaged Yoke agent and projecting Yoke runs and events into the contract's models [@provider-adapters].

## Neighboring Pages

[Operation runner](../lifecycle/operation-runner) is the caller: it prepares a `RunHarnessRequest`, invokes the harness through `HarnessesService`, and records the normalized result and events into the [run ledger](../../concepts/run-ledger). [Harness event shape](../../reference/harness-event-shape) is the exact reference for event kinds and fields. [Add a harness provider adapter](../../guides/add-a-harness-provider-adapter) covers the ordered steps for changing or extending this boundary.
