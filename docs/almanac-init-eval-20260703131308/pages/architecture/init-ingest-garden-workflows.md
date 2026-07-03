---
title: Init, Ingest, And Garden Workflows
topics: [architecture, lifecycle]
sources:
  - id: init
    type: file
    path: src/codealmanac/workflows/init/service.py
  - id: ingest
    type: file
    path: src/codealmanac/workflows/ingest/service.py
  - id: garden
    type: file
    path: src/codealmanac/workflows/garden/service.py
  - id: prompts
    type: file
    path: src/codealmanac/prompts/operations/init.md
---

# Init, Ingest, And Garden Workflows

`init`, `ingest`, and `garden` are the main page-writing lifecycle workflows. Each workflow owns its operation-specific preparation and prompt payload, then calls [[lifecycle-page-run-workflow]] for the shared harness and safety path [@init] [@ingest] [@garden].

`InitWorkflow` resolves or registers the workspace, initializes the wiki scaffold, counts existing pages, enforces `--force` when rebuilding, and renders the base kernel plus init operation prompt [@init]. `IngestWorkflow` resolves source inputs, loads runtime snapshots, and renders source material into the prompt [@ingest].

`GardenWorkflow` prepares index and health context for improving an existing wiki [@garden]. Prompt resources are described in [[prompt-and-manual-resources]].
