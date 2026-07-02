# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 40 terminal run events.

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
| CodeAlmanac backend/local | 95% | 95% | Slice 40 is hosted-only; local worker behavior is unchanged. |
| CodeAlmanac CLI/public UX | 87% | 87% | Slice 40 adds no public CLI verbs. |
| CodeAlmanac-hosted backend/auth/API | 85% | 84% | Hosted now emits typed `RunFailed` and `RunStale` domain events for terminal run fanout. |
| Hosted frontend/onboarding | 35% | 35% | Slice 40 does not change hosted UI; richer onboarding screens remain. |
| Infra/deploy rename | 15% | 15% | Slice 35 changes Supabase schema but does not change provider deployment naming/configuration. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
