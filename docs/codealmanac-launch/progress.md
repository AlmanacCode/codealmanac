# Launch Progress

Status: active.
Updated: 2026-07-04.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-04 after Slice 91 CLI 0.1.11 release.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  "CodeAlmanac CLI breaking surface is done and publicly shipped. Published codealmanac 0.1.11 ..." \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json
```

Result: `sent via rohan-codex-019f05b3`.

Slice 91 published `codealmanac` `0.1.11` from `main` through GitHub Actions
run `28692015106`. Public install smoke passed with `uv tool install --python
3.12 --refresh --no-cache --force codealmanac==0.1.11`; the installed CLI
returned `0.1.11`, rejected old root `jobs`, `__capture-hook`, and
`__run-worker`, exposed `codealmanac capture inspect`, and installed private
`codealmanac-capture-hook`, `codealmanac-job-worker`,
`codealmanac-local-trigger`, and `codealmanac-local-worker` scripts.

## Latest Local Notes

2026-07-03 provider correction:

- Vercel production was re-linked to project `thealmanac/codealmanac-hosted`
  and redeployed. `https://www.codealmanac.com` now serves deployment
  `dpl_BNAWQDiWydrtXUXfM1D4f61FiwCB`.
- Hosted Modal app `codealmanac-hosted-updates` was redeployed with the current
  `codealmanac` git SHA. Modal image logs showed `codealmanac 0.1.9`.
- Architecture cleanup notes now live under
  `docs/refactor-audit-2026-07-03-hosted-local-architecture/`.
- Slice 81 implemented the first CodeAlmanac-side refactor from that audit:
  `services/cloud_* + workflows/cloud_* -> cloud/`.
- Slice 82 implemented the next CodeAlmanac-side refactor from that audit:
  wiki files, workspaces, index, search, pages, topics, health, and viewer now
  live under `src/codealmanac/wiki/`.
- Slice 83 implemented the next CodeAlmanac-side refactor from that audit:
  harness contracts, sources, source bundles, engine workspaces, page-run
  execution, and lifecycle helpers now live under `src/codealmanac/engine/`.
- Slice 84 implemented the next CodeAlmanac-side refactor from that audit:
  local control DB, hooks, delivery, run preparation/execution/jobs/worker,
  policies, setup, status, and update now live under `src/codealmanac/local/`.
- Slice 85 implemented the job-ledger naming cleanup from that audit:
  repo-local lifecycle jobs now live under `src/codealmanac/jobs/ledger/` and
  `src/codealmanac/jobs/queue/`, while branch-triggered local/cloud executions
  remain `runs`.
- Slice 86 implemented the engine runtime cleanup from that audit:
  model-worker request/result artifacts now live under `src/codealmanac/engine/runs/`,
  detached engine workspaces live under `src/codealmanac/engine/workspaces/`,
  and local run workflows use the `app.engine` facade.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 100% | 100% | Slice 89 removed the old sync/automation implementation path and aligned local execution/history on `local runs`; Slice 90 public smoke verified the packaged private local trigger/worker entrypoints. |
| CodeAlmanac CLI/public UX | 100% | 99% | `0.1.11` is live on PyPI and fresh public install smoke verified the corrected command contract: old hidden root worker commands fail, `capture inspect` exists, and private hook/worker scripts are installed. |
| CodeAlmanac-hosted backend/auth/API | 100% | 100% | Slice 75 added production `/v1/repositories`; production repo list and repo status pass without per-repo permission fanout. |
| Hosted frontend/onboarding | 100% | 99% | Slice 76 shipped repository readiness, capture handoff, maintained branches, and per-branch delivery to Vercel; Chrome verified production with no console errors. |
| Infra/deploy rename | 100% | 100% | Vercel targets `thealmanac/codealmanac-hosted`, Render health is live, Modal `codealmanac-hosted-updates` was redeployed, and PyPI `codealmanac` `0.1.11` is live. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
