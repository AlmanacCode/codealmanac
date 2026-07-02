# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 23 verification.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Note: `DISCORD_BOT_TOKEN` is currently present in Doppler `almanac/dev`.
It was not present in `codealmanac/prd` when checked.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 87% | 87% | Slice 23 did not change local worker/control architecture. |
| CodeAlmanac CLI/public UX | 40% | 35% | Slice 23 removed top-level `ingest`/`garden` from public help and moved the manual lifecycle surface under hidden `codealmanac dev`. |
| CodeAlmanac-hosted backend/auth/API | 8% | 8% | WorkOS/Doppler setup and hosted rename groundwork exist; public API migration is not implemented yet. |
| Hosted frontend/onboarding | 5% | 5% | Existing frontend is deployed under CodeAlmanac; new onboarding/configuration screens are not implemented yet. |
| Infra/deploy rename | 5% | 5% | GitHub rename, Modal, Render, Vercel production deploy, and health checks were exercised; durable cleanup remains. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
