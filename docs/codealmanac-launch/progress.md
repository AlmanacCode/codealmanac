# Launch Progress

Status: active.
Updated: 2026-07-03.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-03 after Slice 85 CodeAlmanac job ledger naming.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Slice 85 moved repo-local lifecycle job storage into
`src/codealmanac/jobs/ledger/` and the background lifecycle queue into
`src/codealmanac/jobs/queue/`. Lifecycle records now use `job_id` and
`JobRecord`/`JobLogEvent` naming across service, CLI, viewer API, sync,
maintenance, and tests; cloud/local trigger executions remain `runs`. Focused
verification passed with `217 passed`; full local verification passed with
`uv run ruff check src tests`, `uv run pytest -q --tb=short` (`513 passed`), and
`git diff --check`.

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
  harness contracts, sources, source bundles, worker workspaces, page-run
  execution, and lifecycle helpers now live under `src/codealmanac/engine/`.
- Slice 84 implemented the next CodeAlmanac-side refactor from that audit:
  local control DB, hooks, delivery, run preparation/execution/jobs/worker,
  policies, setup, status, and update now live under `src/codealmanac/local/`.
- Slice 85 implemented the job-ledger naming cleanup from that audit:
  repo-local lifecycle jobs now live under `src/codealmanac/jobs/ledger/` and
  `src/codealmanac/jobs/queue/`, while branch-triggered local/cloud executions
  remain `runs`.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 99.9% | 99.8% | Slice 85 renamed repo-local lifecycle execution to jobs, moved the ledger/queue under `src/codealmanac/jobs/`, added architecture guards, and passed focused/full gates. |
| CodeAlmanac CLI/public UX | 100% | 100% | Published CLI `0.1.9` passed public install smoke; root uninstall is now scoped to setup-owned artifacts, while automation teardown remains explicit. |
| CodeAlmanac-hosted backend/auth/API | 100% | 100% | Slice 75 added production `/v1/repositories`; production repo list and repo status pass without per-repo permission fanout. |
| Hosted frontend/onboarding | 100% | 99% | Slice 76 shipped repository readiness, capture handoff, maintained branches, and per-branch delivery to Vercel; Chrome verified production with no console errors. |
| Infra/deploy rename | 100% | 99% | Vercel now targets `thealmanac/codealmanac-hosted`, Render health is live, and Modal `codealmanac-hosted-updates` was redeployed with current `codealmanac` `0.1.9` engine logs. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
