# Launch Progress

Status: active.
Updated: 2026-07-03.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: pending after Slice 72 cloud setup CLI polish.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Note: source CLI setup is now cloud-first and no longer exposes local scheduled
automation in the root setup path. Chrome also verified the production
dashboard and `/setup` route as signed-in `rohans0509`.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 96% | 96% | Local/backend unchanged in Slice 72; root setup no longer leaks local scheduler concepts. |
| CodeAlmanac CLI/public UX | 100% | 99% | Source CLI setup renders the bannered cloud setup flow, rejects old scheduler fields, and points to cloud/capture/repo/open next commands. |
| CodeAlmanac-hosted backend/auth/API | 100% | 100% | Unchanged in Slice 72; live trigger path was already verified in Slice 71. |
| Hosted frontend/onboarding | 98% | 98% | Chrome verified production `/setup`, connected GitHub account state, repository dashboard, and activity feed. |
| Infra/deploy rename | 99% | 99% | Render is live on `eb8dba0`; Modal app `codealmanac-hosted-updates` is redeployed; Vercel frontend unchanged. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
