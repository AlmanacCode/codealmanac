---
title: Guides
topics: [guides, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entry that defines guides as task-oriented procedures.
  - id: cli-command
    type: wiki
    path: guides/add-a-cli-command
    note: Procedure for adding or changing a CLI command.
  - id: source-adapter
    type: wiki
    path: guides/add-a-source-runtime-adapter
    note: Procedure for adding a source runtime adapter.
  - id: harness-adapter
    type: wiki
    path: guides/add-a-harness-provider-adapter
    note: Procedure for adding a harness provider adapter.
  - id: failed-run
    type: wiki
    path: guides/debug-a-failed-lifecycle-run
    note: Procedure for investigating failed lifecycle runs.
  - id: automation
    type: wiki
    path: guides/setup-local-automation
    note: Procedure for setting up local scheduled automation.
  - id: topics-guide
    type: wiki
    path: guides/maintain-topics
    note: Procedure for maintaining the topic graph.
  - id: verify-wiki
    type: wiki
    path: guides/verify-a-wiki-change
    note: Procedure for validating wiki edits.
  - id: refactoring
    type: wiki
    path: guides/refactoring-boundaries
    note: Procedure for refactoring along architecture boundaries.
  - id: launch-demo
    type: wiki
    path: guides/demo-codealmanac-in-launch-video
    note: Procedure for demonstrating CodeAlmanac in a launch video.
  - id: launch-positioning
    type: wiki
    path: concepts/launch-positioning
    note: Product-story concept page used by launch and demo framing.
---

# Guides

Guides are task procedures for maintainers who already know what outcome they
need. The topic graph defines `guides` as the task-oriented neighborhood, and
this hub groups the procedures by the work they unblock [@topics].

For background, follow the architecture or reference links inside each guide.
For exact command syntax or file formats, use [Reference](../reference/).

## Change Product Surfaces

[Add a CLI command](add-a-cli-command) covers command parser, dispatch, app
boundary, rendering, and tests for command work [@cli-command].

[Add a source runtime adapter](add-a-source-runtime-adapter) covers a new
source address and runtime loading path for ingest inputs [@source-adapter].
[Add a harness provider adapter](add-a-harness-provider-adapter) covers a new
local agent runner behind the harness contract [@harness-adapter].

## Debug And Operate

[Debug a failed lifecycle run](debug-a-failed-lifecycle-run) is the recovery
path for build, ingest, or garden jobs that fail through the run queue
[@failed-run].

[Setup local automation](setup-local-automation) covers setup, scheduler
entries, sync and garden cadence, update checks, and verification for local
automation [@automation].

## Maintain The Wiki

[Verify a wiki change](verify-a-wiki-change) is the shortest validation path
after editing wiki source [@verify-wiki]. [Maintain topics](maintain-topics)
covers topic creation, description, linking, renaming, deletion, and graph
checks [@topics-guide].

## Shape Future Work

[Refactoring boundaries](refactoring-boundaries) explains how to reshape code
around the repo's service, workflow, store, port, and integration boundaries
before adding behavior [@refactoring].

[Demo CodeAlmanac in a launch video](demo-codealmanac-in-launch-video) is the
product-demonstration guide for showing the local viewer and terminal query
flow in a launch video [@launch-demo]. Use [Launch positioning](../concepts/launch-positioning)
when the work needs the broader product story, comparison frame, or launch
audience notes behind that demo [@launch-positioning].
