# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 45 cloud run retry and production deploy.

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
| CodeAlmanac backend/local | 95% | 95% | Slice 45 is cloud-run control; local worker behavior is unchanged. |
| CodeAlmanac CLI/public UX | 91% | 90% | `codealmanac runs retry <run-id>` is pushed to `origin/dev` at `af7953c6`. |
| CodeAlmanac-hosted backend/auth/API | 92% | 90% | Hosted retry is pushed to the launch branch and hosted `main` at `b3535cd`. |
| Hosted frontend/onboarding | 44% | 43% | Browser BFF/API helpers can retry runs; visible retry UI remains future work. |
| Infra/deploy rename | 84% | 82% | Vercel production and Render backend are live on the Slice 45 code. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
