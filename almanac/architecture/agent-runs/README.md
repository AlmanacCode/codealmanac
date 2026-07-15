---
title: Agent Runs
topics: [architecture, agent-runs, harnesses, providers, yoke, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entries for agent runs, harnesses, providers, and Yoke.
  - id: harness-contract
    type: wiki
    path: architecture/agent-runs/harness-contract
    note: Architecture page for the service-owned harness contract.
  - id: yoke-boundary
    type: wiki
    path: architecture/agent-runs/provider-adapters
    note: Architecture page for the current Yoke provider adapter boundary.
  - id: agents-manuals
    type: wiki
    path: architecture/runtime-resources/prompts-and-manuals
    note: Architecture page for packaged lifecycle agents and manuals.
  - id: event-shape
    type: wiki
    path: reference/harness-event-shape
    note: Reference page for normalized harness event fields.
  - id: model-catalog
    type: wiki
    path: decisions/controlled-model-catalog
    note: Decision page for supported runner/model ownership.
  - id: adapter-guide
    type: wiki
    path: guides/add-a-harness-provider-adapter
    note: Guide for adding a new runner or changing a Yoke surface.
---

# Agent Runs

Agent runs are the architecture neighborhood for executing CodeAlmanac
lifecycle agents through local AI harnesses. The `agent-runs` topic groups the
service-owned harness contract, provider adapter boundary, event reference, and
provider-change guide, while narrower `harnesses`, `providers`, and `yoke`
topics keep those pages retrievable from their specific concerns [@topics].
Read this hub when changing how build, ingest, or garden crosses from
CodeAlmanac workflows into a local agent provider.

The key boundary is that workflows send one normalized request and receive one
normalized result. Provider details stay behind the harness adapter, while
runtime instructions and manuals stay in the packaged agent-resource area
[@harness-contract] [@yoke-boundary] [@agents-manuals].

## Reading Order

Start with [Harness contract](harness-contract). It defines
`RunHarnessRequest`, `HarnessRunResult`, readiness checks, transcript
references, and the provider-neutral event stream that lifecycle workflows and
job views consume [@harness-contract].

Then read [Yoke harness boundary](provider-adapters). It explains the current
provider integration: `YokeHarnessAdapter` loads the packaged build, ingest, or
garden agent, selects the Claude or Codex Yoke surface, applies CodeAlmanac's
run options, projects live provider events, and keeps Yoke runtime caches under
local CodeAlmanac state [@yoke-boundary].

Use [Agents and manuals](../runtime-resources/prompts-and-manuals) when the
change concerns the instructions or manual material a lifecycle agent receives.
That page owns packaged Yoke agent identities and writing references, not the
provider execution mechanics [@agents-manuals].

Use [Harness event shape](../../reference/harness-event-shape) when changing
the durable event vocabulary for logs, attach streams, and viewer displays
[@event-shape]. Use [Controlled model catalog](../../decisions/controlled-model-catalog)
when changing supported runner/model pairs or setup defaults [@model-catalog].

## Change Path

Provider support normally starts in Yoke. CodeAlmanac should add a new
`HarnessKind`, model catalog entries, registration, and boundary tests only
after the provider or surface exists in Yoke [@adapter-guide].

For CodeAlmanac-side work, follow [Add a harness provider adapter](../../guides/add-a-harness-provider-adapter).
The guide keeps provider protocol work out of this repository and focuses this
codebase on product-owned choices: which local runner exists, which models are
accepted, which Yoke surface is selected, and which normalized events become
durable product facts [@adapter-guide].
