# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 48 WorkOS auth-boundary alignment and production deploy.

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
| CodeAlmanac backend/local | 95% | 95% | Slice 48 is hosted auth-boundary work; local worker behavior is unchanged. |
| CodeAlmanac CLI/public UX | 91% | 91% | No CLI change after Slice 45 retry. |
| CodeAlmanac-hosted backend/auth/API | 94% | 93% | API bearer parsing now uses FastAPI `HTTPBearer`; WorkOS claims mirror documented AuthKit access-token shape. |
| Hosted frontend/onboarding | 60% | 60% | No frontend behavior change after Slice 47 setup summary. |
| Infra/deploy rename | 89% | 88% | Vercel production and Render backend are live on the Slice 48 commit. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
