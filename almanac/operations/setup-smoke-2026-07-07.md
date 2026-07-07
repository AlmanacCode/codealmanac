---
title: Setup Smoke 2026-07-07
summary: Local setup installed automation, but the first run exposed Codex app-server sandbox drift and stale-repository garden behavior.
topics: [operations, agents, storage]
sources:
  - id: codex-sandbox
    type: file
    path: src/codealmanac/integrations/harnesses/codex/sandbox.py
    note: Codex app-server sandbox names used for thread/start and turn/start.
  - id: codex-test
    type: file
    path: tests/test_codex_app_server_adapter.py
    note: Fake app-server contract test for sandbox payloads.
  - id: run-queue
    type: file
    path: src/codealmanac/workflows/run_queue/service.py
    note: Scheduled garden queues one garden run per registered repository.
  - id: repository-state
    type: file
    path: src/codealmanac/services/repositories/state.py
    note: Repository availability status used by list/doctor surfaces.
---

# Setup Smoke 2026-07-07

After `codealmanac setup`, `codealmanac automation status` reported sync,
garden, and update launchd jobs installed and loaded. `codealmanac doctor`
reported CodeAlmanac 0.3.1, database `/Users/rohan/.codealmanac/codealmanac.db`,
the current repository registered as `codealmanac`, an index with 19 pages and
10 topics, and zero wiki health problems.

The first job check showed one queued sync ingest, two failed garden runs, and
one older failed ingest. The failed garden run
`garden-20260707044359-95318450` hit Codex app-server sandbox drift:
thread/start rejected `repository-write`; after changing the thread sandbox to
`workspace-write`, turn/start rejected `repositoryWrite`; the turn sandbox
policy type now needs `workspaceWrite` [@codex-sandbox] [@codex-test].
The product expectation after the smoke is stronger: lifecycle agents are
trusted maintainers, so Codex should default to `danger-full-access` and Claude
should run with `permission_mode="dontAsk"` plus shell access rather than a
restricted file-only tool set.

The other failed garden run, `garden-20260707044359-e68f2350`, targeted
`/private/var/folders/.../tmp2v0n43if/repo`, a stale registered temp
repository whose `almanac/` directory no longer existed. Scheduled garden
queued it because it iterates registered repositories; the observed expectation
gap is that scheduled garden should skip repositories whose state is
`missing_repo` or `missing_almanac` before queueing work [@run-queue]
[@repository-state].

The queued sync ingest `ingest-20260707044402-c97e6f54` was manually drained
after the first sandbox fix. It resolved four transcript sources and then
failed on the second sandbox drift, the turn/start `repositoryWrite` rejection.
That run proves transcript discovery and source loading progressed before the
Codex app-server contract failed.

A fresh smoke garden run, `garden-20260707044916-c6b5b2bf`, got past both
sandbox checks after the source fix and edited `almanac/getting-started.md`.
It did not record completion promptly; the DB stayed `running` with only four
events through mutation preflight. Cancelling the job changed the run status to
`cancelled`, removed the Codex child processes, and the worker exited shortly
afterward. The expectation gap is that a cancelled or completed agent run should
not leave a long silent interval between file mutation and terminal run state.
