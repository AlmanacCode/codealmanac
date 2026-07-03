# Launch Progress

Status: active.
Updated: 2026-07-03.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-03 after Slice 68 production branch-trigger smoke.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Note: production Chrome verified setup and repository dashboard; Render is live
on hosted commit `eb8dba0`; Modal `codealmanac-hosted-updates` is redeployed;
a fresh GitHub branch push created run
`773da5fb-9871-4f83-8797-ddf651c635ce`, which delivered with summary
`No wiki changes made.`

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 96% | 96% | CodeAlmanac local/backend unchanged in Slice 68. |
| CodeAlmanac CLI/public UX | 98% | 98% | Published CLI setup/capture were verified in earlier slices; Slice 68 used the CLI to disable the smoke trigger and revoke capture cleanup. |
| CodeAlmanac-hosted backend/auth/API | 99% | 99% | Production branch push now creates an immutable branch-source run and worker completion delivered successfully. |
| Hosted frontend/onboarding | 96% | 95% | Chrome verified signed-in `/setup` and repository dashboard after production fixes; dashboard showed delivered run. |
| Infra/deploy rename | 99% | 99% | Render is live on `eb8dba0`; Modal app `codealmanac-hosted-updates` is redeployed; Vercel frontend unchanged. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
