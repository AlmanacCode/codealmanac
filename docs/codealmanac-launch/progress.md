# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 38 cloud open handoff.

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
| CodeAlmanac backend/local | 95% | 94% | Slice 38 adds the typed `cloud_open` workflow and app URL defaults; local worker behavior is unchanged. |
| CodeAlmanac CLI/public UX | 84% | 78% | Bare `codealmanac`, `open`, `repo setup`, and `repo open` now hand off to cloud pages from the current checkout. |
| CodeAlmanac-hosted backend/auth/API | 81% | 80% | Hosted adds browser-session repo resolve for redirector routes. |
| Hosted frontend/onboarding | 35% | 28% | Stable `/wiki/github/...` and `/setup/repo` redirectors now exist for CLI/browser handoff, but richer onboarding screens remain. |
| Infra/deploy rename | 15% | 15% | Slice 35 changes Supabase schema but does not change provider deployment naming/configuration. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
