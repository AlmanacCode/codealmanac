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
    note: Procedure for extending the Yoke harness boundary.
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
  - id: release
    type: wiki
    path: guides/release-package
    note: Procedure for publishing and verifying the Python package.
  - id: launch-positioning
    type: wiki
    path: concepts/launch-positioning
    note: Product-story concept page used by launch and demo framing.
  - id: local-only
    type: wiki
    path: decisions/local-only-python-product
    note: Decision that defines the local Python product boundary.
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
[Extend the Yoke harness boundary](add-a-harness-provider-adapter) covers
adding provider or surface support through Yoke, then registering the product
harness choice behind the harness contract [@harness-adapter].

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

[Release package](release-package) is the public packaging checklist for the
local Python CLI. It belongs with product-surface work because the release must
preserve the [Local-only Python product](../decisions/local-only-python-product)
boundary while proving the installed `codealmanac` command works outside the
repo developer environment [@release] [@local-only].

[Demo CodeAlmanac in a launch video](demo-codealmanac-in-launch-video) is the
product-demonstration guide for showing the local viewer and terminal query
flow in a launch video [@launch-demo]. Use [Launch positioning](../concepts/launch-positioning)
when the work needs the broader product story, comparison frame, or launch
audience notes behind that demo [@launch-positioning].
