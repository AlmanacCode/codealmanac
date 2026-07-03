# Launch Progress

Status: active.
Updated: 2026-07-03.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-03 after Slice 69 CLI open-route fix.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Note: PyPI `0.1.4` is published. Fresh installed `codealmanac open` now has
both launch paths: no-auth falls back to `/wiki/github/<owner>/<repo>`, and
signed-in opens the exact dashboard wiki route.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 96% | 96% | CodeAlmanac local/backend unchanged in Slice 68. |
| CodeAlmanac CLI/public UX | 99% | 99% | PyPI `0.1.4` fixes fresh-install `open`: no-auth falls back to `/wiki/github/...`, signed-in opens the dashboard wiki. |
| CodeAlmanac-hosted backend/auth/API | 99% | 99% | Production branch push now creates an immutable branch-source run and worker completion delivered successfully. |
| Hosted frontend/onboarding | 97% | 96% | Chrome verified the signed-in dashboard wiki route for `AlmanacCode/codealmanac` with 62 pages. |
| Infra/deploy rename | 99% | 99% | Render is live on `eb8dba0`; Modal app `codealmanac-hosted-updates` is redeployed; Vercel frontend unchanged. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
