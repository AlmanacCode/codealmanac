# Launch Progress

Status: active.
Updated: 2026-07-03.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-03 after Slice 79 root uninstall split publish and smoke.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Published CLI `0.1.9` removes root uninstall's stale local-scheduler coupling.
GitHub Actions publish run `28672818638` passed full tests, lint, diff hygiene,
build, Twine checks, artifact upload, and PyPI upload. Fresh public PyPI
install smoke passed with `--refresh --no-cache`: root uninstall no longer
shows `--keep-automation` or automation JSON fields, and explicit
`codealmanac automation uninstall` remains available.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 97% | 97% | No local engine change in Slice 79; full source gates still passed after the setup/uninstall split. |
| CodeAlmanac CLI/public UX | 100% | 100% | Published CLI `0.1.9` passed public install smoke; root uninstall is now scoped to setup-owned artifacts, while automation teardown remains explicit. |
| CodeAlmanac-hosted backend/auth/API | 100% | 100% | Slice 75 added production `/v1/repositories`; production repo list and repo status pass without per-repo permission fanout. |
| Hosted frontend/onboarding | 100% | 99% | Slice 76 shipped repository readiness, capture handoff, maintained branches, and per-branch delivery to Vercel; Chrome verified production with no console errors. |
| Infra/deploy rename | 99% | 99% | Hosted frontend deployed to Vercel production at `bff009b` and aliased to `https://www.codealmanac.com`. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
