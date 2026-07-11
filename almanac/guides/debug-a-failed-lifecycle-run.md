---
title: Debug A Failed Lifecycle Run
topics: [guides, lifecycle, runs]
sources:
  - id: repo-readme
    type: file
    path: README.md
  - id: run-store
    type: file
    path: src/codealmanac/services/runs/store.py
  - id: operation-runner
    type: file
    path: src/codealmanac/workflows/operations/service.py
  - id: operation-harness
    type: file
    path: src/codealmanac/workflows/operations/harness.py
  - id: yoke-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/adapter.py
  - id: yoke-results
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/results.py
---

# Debug A Failed Lifecycle Run

Use this guide when build, ingest, or garden leaves a failed run. Start with
`codealmanac jobs`, then inspect `jobs show <run-id>` and
`jobs logs <run-id>`. The durable run store keeps the record and normalized
event stream after the original process exits [@repo-readme] [@run-store].

If the run is active, `codealmanac jobs attach <run-id>` follows the same event
record until it becomes terminal. The readable log is the primary debugging
surface; JSON output exposes the corresponding structured harness fields.

## Identify The Boundary

- Readiness or authentication failures appear before provider execution and
  include Yoke's repair message when available [@yoke-adapter].
- Provider failures and timeouts become a failed terminal harness event with
  structured failure details [@yoke-results].
- Tool and helper-agent failures appear in the preceding normalized events.
- Validation failures occur after a successful agent run when the resulting
  wiki source does not satisfy CodeAlmanac's product checks [@operation-runner].
- Indexing failures usually indicate malformed source or route collisions.

The operation runner records harness output before validating success, so the
event stream normally contains the provider evidence needed to distinguish a
Yoke/provider failure from a wiki validation failure [@operation-runner]
[@operation-harness]. Do not inspect deleted provider-specific adapter files or
infer failure state from assistant prose when a structured error event exists.

After correcting wiki source, follow [Verify A Wiki Change](verify-a-wiki-change).
After correcting credentials, installation, or provider configuration, run
`codealmanac doctor` and queue a new lifecycle run.
