# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 47 repository setup summary and production deploy.

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
| CodeAlmanac backend/local | 95% | 95% | Slice 47 is hosted setup/status work; local worker behavior is unchanged. |
| CodeAlmanac CLI/public UX | 91% | 91% | No CLI change after Slice 45 retry; browser setup now mirrors more cloud state. |
| CodeAlmanac-hosted backend/auth/API | 93% | 92% | Browser-session capture status is exposed at `/api/capture/status`. |
| Hosted frontend/onboarding | 60% | 52% | Repository settings now show GitHub access, capture, branches, and delivery readiness. |
| Infra/deploy rename | 88% | 86% | Vercel production and Render backend are live on the Slice 47 commit. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
