# Launch Progress

Status: active.
Updated: 2026-07-03.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Prepared: 2026-07-03 after Slice 77 CLI launch-surface publish and smoke.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Published CLI `0.1.7` makes root help cloud-first, hides stale root
compatibility entrypoints, keeps `setup --yes` from silently opening a browser,
and uses the OpenAlmanac-style setup output. Chrome verified the live
production CLI-login loop and `/setup` page from an isolated temp `HOME`.
Fresh public PyPI install smoke passed after bypassing the immediate resolver
cache with `--no-cache`.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 97% | 97% | No local engine change in Slice 77; previous full suite passed with the repo-list service/workflow additions. |
| CodeAlmanac CLI/public UX | 100% | 100% | Published CLI `0.1.7` passed public install smoke, root help/setup output smoke, and Chrome verified CLI login plus repo status against production. |
| CodeAlmanac-hosted backend/auth/API | 100% | 100% | Slice 75 added production `/v1/repositories`; production repo list and repo status pass without per-repo permission fanout. |
| Hosted frontend/onboarding | 100% | 99% | Slice 76 shipped repository readiness, capture handoff, maintained branches, and per-branch delivery to Vercel; Chrome verified production with no console errors. |
| Infra/deploy rename | 99% | 99% | Hosted frontend deployed to Vercel production at `bff009b` and aliased to `https://www.codealmanac.com`. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
