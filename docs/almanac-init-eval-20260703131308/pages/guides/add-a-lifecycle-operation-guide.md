---
title: Add A Lifecycle Operation Guide
topics: [guides, lifecycle]
sources:
  - id: page-run
    type: file
    path: src/codealmanac/workflows/page_run/service.py
  - id: init
    type: file
    path: src/codealmanac/workflows/init/service.py
  - id: parser
    type: file
    path: src/codealmanac/cli/parser/lifecycle.py
  - id: dispatch
    type: file
    path: src/codealmanac/cli/dispatch/lifecycle.py
---

# Add A Lifecycle Operation Guide

Use this guide when adding a new AI-backed page-writing operation. The successful outcome is a workflow that prepares operation-specific context, then delegates run state, mutation safety, harness execution, event recording, and index refresh to [[lifecycle-page-run-workflow]] instead of duplicating that machinery [@page-run].

## Steps

1. Define the operation's request and result models under `src/codealmanac/workflows/<operation>/`.
2. Make the workflow prepare only operation-specific context and prompt payload, following `InitWorkflow`, `IngestWorkflow`, or `GardenWorkflow` [@init].
3. Call `PageRunWorkflow.begin()`, `preflight()`, `execute()`, and `fail()` for the shared execution path [@page-run].
4. Add prompt Markdown under `src/codealmanac/prompts/operations/` and render it through `PromptRenderer`.
5. Wire the workflow in [[src/codealmanac/app.py]].
6. Add parser, dispatch, and render surfaces only if the operation is public; lifecycle parser/dispatch files show the existing command family [@parser] [@dispatch].

## Verification

Run the operation's workflow tests plus `tests/test_architecture.py`. Check that no service or workflow imports integrations directly.
