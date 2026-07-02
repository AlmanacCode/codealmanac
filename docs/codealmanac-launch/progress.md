# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 37 cloud runs CLI.

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
| CodeAlmanac backend/local | 94% | 93% | Slice 37 adds the typed `cloud_runs` service/workflow in the local package; local worker behavior is unchanged. |
| CodeAlmanac CLI/public UX | 78% | 72% | CLI now mirrors cloud run list/detail/log inspection from the terminal. |
| CodeAlmanac-hosted backend/auth/API | 80% | 78% | Hosted now exposes CLI-token `/v1` run read routes. |
| Hosted frontend/onboarding | 28% | 28% | Slice 36 does not change browser UI. |
| Infra/deploy rename | 15% | 15% | Slice 35 changes Supabase schema but does not change provider deployment naming/configuration. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
