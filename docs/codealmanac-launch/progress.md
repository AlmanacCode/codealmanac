# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 35 hosted trigger policies.

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
| CodeAlmanac backend/local | 92% | 92% | Slice 35 changed hosted trigger policy and dashboard behavior only; local package API and local worker maturity are unchanged. |
| CodeAlmanac CLI/public UX | 64% | 64% | Slice 35 does not add public CLI commands; CLI trigger mirrors remain future work. |
| CodeAlmanac-hosted backend/auth/API | 74% | 68% | Hosted now stores maintained-branch trigger policies and starts branch-push runs from enabled policies. |
| Hosted frontend/onboarding | 28% | 20% | Repository settings now expose maintained branches and per-branch commit/PR delivery from real DTOs. |
| Infra/deploy rename | 15% | 15% | Slice 35 changes Supabase schema but does not change provider deployment naming/configuration. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
