# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 28 cloud capture install.

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
| CodeAlmanac backend/local | 88% | 88% | Slice 28 added cloud capture state and hooks, but local trigger/run/workspace/delivery maturity stays unchanged. |
| CodeAlmanac CLI/public UX | 62% | 52% | `capture status/enable/repair/disable` now exists; repo, runs, status, and open commands remain. |
| CodeAlmanac-hosted backend/auth/API | 40% | 34% | Hosted now issues, lists, and revokes narrow capture credentials; repo API, run storage, worker APIs, and rate limits remain. |
| Hosted frontend/onboarding | 15% | 15% | Slice 28 added DTO parity only; browser onboarding/configuration screens are still not implemented. |
| Infra/deploy rename | 10% | 10% | Slice 28 changed capture/API/CLI only. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
