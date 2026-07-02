# CodeAlmanac Launch Steering

Status: active.
Started: 2026-07-02.

This folder is the durable steering area for the CodeAlmanac cloud/local launch.
Use it to track the plan, decisions, worklog, ownership, open questions, and
verification evidence.

## Canonical Plan

The enforceable launch plan is:

- `docs/plans/2026-07-02-codealmanac-cloud-local-launch.md`

First prerequisite implementation plan:

- `docs/codealmanac-launch/init-first-build-prompt-restoration.md`

Supporting decision notes:

- `docs/hosted-local-live-agreement/cli-onboarding-launch-2026-07-02.md`
- `docs/hosted-local-live-agreement/local-pipeline-architecture-2026-07-02.md`
- `docs/hosted-local-live-agreement/cloud-local-parallel-architecture-2026-07-02.md`
- `docs/hosted-local-live-agreement/cloud-local-state-mirror-2026-07-02.md`

## Files In This Folder

- `decisions.md` records accepted launch decisions.
- `ownership-map.md` records which repo owns which responsibility.
- `schema-contract.md` records local/cloud tables and artifact storage.
- `auth-api-contract.md` records WorkOS auth, CLI login, public API, internal
  API, and rate-limit requirements.
- `cli-contract.md` records the public CLI surface.
- `frontend-surface-contract.md` records browser onboarding and dashboard
  surfaces.
- `repo-organization.md` records the two-repo dependency direction.
- `open-questions.md` records unresolved choices.
- `verification-matrix.md` records what must be proven before launch.
- `worklog.md` records chronological progress.
- `deployment-rename-runbook.md` records the `usealmanac` to
  `codealmanac-hosted` provider migration.
- `overnight-run-contract.md` records the infrastructure-first execution order
  and chunking cadence for the long autonomous run.
- `init-first-build-prompt-restoration.md` records the local/Python prerequisite
  for restoring `init` as the first-build lifecycle command.
- `coverage-audit-019f1be2.md` records the transcript coverage audit for
  session `019f1be2-83a2-7c03-bf18-f5adc681857d`.
- `references/workos/` copies the curated WorkOS research notes from
  `../almanac/docs/workos/`.

## Current Shape

```text
codealmanac
  local runtime
  shared update engine
  local control DB
  local worker
  human CLI

codealmanac-hosted
  cloud dashboard
  backend API
  GitHub App
  source capture API
  cloud run queue
  delivery policy
  billing
```

The public CLI is a UX surface. Cloud workers and local workers use the shared
engine contract, not the human CLI.

The Python runtime is the model execution path. Hosted workers should call the
Python engine/workflows directly through the shared contract.
