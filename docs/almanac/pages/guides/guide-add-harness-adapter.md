---
page_id: guide-add-harness-adapter
title: Add A Harness Adapter
summary: Use this guide when adding a provider that can run lifecycle prompts and return normalized harness results.
topics: [guides, integration, lifecycle]
sources:
  - id: harness-service
    type: file
    path: src/codealmanac/services/harnesses/service.py
  - id: harness-ports
    type: file
    path: src/codealmanac/services/harnesses/ports.py
  - id: harness-events
    type: file
    path: src/codealmanac/services/harnesses/events.py
  - id: app
    type: file
    path: src/codealmanac/app.py
---

# Add A Harness Adapter

Use this guide when CodeAlmanac needs a new local agent provider for lifecycle work. The result should be an adapter that checks readiness, runs a prompt, returns a `HarnessRunResult`, and maps provider output into normalized `HarnessEvent` records. [@harness-service] [@harness-ports] [@harness-events]

## Preconditions

Read `[[architecture-harness-system]]` and `[[reference-harness-events]]`. Confirm that the provider can expose structured output or typed events.

## Steps

1. Add a harness kind if the provider is a new public option.
2. Implement a provider adapter under `integrations/harnesses/`.
3. Keep raw provider parsing inside that integration boundary.
4. Map provider output into normalized events.
5. Snapshot changed files before and after execution if the adapter can mutate the wiki.
6. Register the adapter in the default harness adapter set.

If the adapter should be available in normal CLI use, confirm the default app wiring includes it through `[[architecture-composition-root]]`. [@app]

## Verification

Run harness-service tests and provider adapter tests. Add a lifecycle workflow test if the provider changes how `[[architecture-page-run-workflow]]` receives events or changed files. [@harness-service]

## Recovery

If the provider can only return final text, do not scrape durable meaning out of prose. Revisit whether the provider is suitable for lifecycle execution.
