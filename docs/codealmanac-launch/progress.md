# Launch Progress

Status: active.
Updated: 2026-07-03.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-03 after Slice 88 hosted updates domain split.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Slice 87 renamed hosted backend package ownership from `almanac` to
`codealmanac_hosted`, moved the Modal worker from `backend/modal_app/` to
`backend/src/codealmanac_hosted/worker/`, and pushed hosted commit `89d97c3` to
`main`. Verification passed with backend ruff, format check, compileall,
architecture/worker focused tests (`92 passed`), full backend tests
(`396 passed, 1 warning`), `make smoke-backend`, `make smoke-modal`, and
`git diff --check`. Render deploy `dep-d941j7m7r5hc73cd5ij0` is live on commit
`89d97c3`; Modal app `codealmanac-hosted-updates` deployed successfully.

Slice 88 split hosted update internals into explicit pipeline axes:
`services/updates/triggers/`, `services/updates/runs/`, and
`services/updates/delivery/`. The public `Updates` facade and API behavior did
not change. Verification passed with backend ruff, format check, compileall,
focused architecture/update/worker/run-event tests (`147 passed`), and the full
backend suite (`397 passed, 1 warning`). Render deploy
`dep-d941qkl8nd3s73chs3fg` is live on commit `1d7b80e`; Modal
`codealmanac-hosted-updates` deployed successfully from the split worker import
path.

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
- Slice 87 implemented the hosted package/worker namespace cleanup:
  `backend/src/almanac/` is now `backend/src/codealmanac_hosted/`, Modal worker
  code is now `backend/src/codealmanac_hosted/worker/`, Render is live on
  commit `89d97c3`, and Modal `codealmanac-hosted-updates` deployed at the new
  path.
- Slice 88 implemented the hosted updates domain split:
  update triggers, run lifecycle/persistence, and delivery helpers now have
  separate homes under `backend/src/codealmanac_hosted/services/updates/`.
  Render is live on commit `1d7b80e`; Modal was redeployed after the worker
  import-path move.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 100% | 100% | No CodeAlmanac runtime change in Slice 87; Slice 86 remains the latest local backend evidence. |
| CodeAlmanac CLI/public UX | 100% | 100% | Published CLI `0.1.9` passed public install smoke; root uninstall is now scoped to setup-owned artifacts, while automation teardown remains explicit. |
| CodeAlmanac-hosted backend/auth/API | 100% | 100% | Slice 88 split hosted update internals into trigger, run, and delivery packages while preserving the public facade; focused and full backend tests pass. |
| Hosted frontend/onboarding | 100% | 99% | Slice 76 shipped repository readiness, capture handoff, maintained branches, and per-branch delivery to Vercel; Chrome verified production with no console errors. |
| Infra/deploy rename | 100% | 100% | Vercel targets `thealmanac/codealmanac-hosted`, Render deploy `dep-d941qkl8nd3s73chs3fg` is live on `1d7b80e`, and Modal `codealmanac-hosted-updates` deployed after the worker import-path split. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
