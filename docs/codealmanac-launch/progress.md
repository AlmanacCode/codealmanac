# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 26 WorkOS/AuthKit API foundation.

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
| CodeAlmanac backend/local | 88% | 88% | Slice 26 changed hosted auth only. |
| CodeAlmanac CLI/public UX | 40% | 40% | Slice 26 changed hosted auth only. |
| CodeAlmanac-hosted backend/auth/API | 28% | 8% | WorkOS/AuthKit frontend session handling and FastAPI bearer-token verification are implemented; public API, CLI auth, capture credentials, worker/run storage, and onboarding APIs still remain. |
| Hosted frontend/onboarding | 15% | 5% | AuthKit login/callback/session plumbing is implemented; browser onboarding/configuration screens are still not implemented. |
| Infra/deploy rename | 10% | 10% | Slice 26 changed hosted auth only. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
