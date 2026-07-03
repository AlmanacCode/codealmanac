# Launch Progress

Status: active.
Updated: 2026-07-03.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-03 after Slice 74 GitHub App permission hot-path fix.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Slice 75 has since been completed locally: published CLI `0.1.6` includes the
canonical `codealmanac repo list` command, production `/v1/repositories` works,
and Chrome verified fresh setup from a clean `HOME`.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 97% | 96% | Full local suite passed with the repo-list service/workflow additions. |
| CodeAlmanac CLI/public UX | 100% | 98% | Published CLI `0.1.6` setup/whoami/repo list/repo status/capture status passed against production from a clean Chrome-approved HOME. |
| CodeAlmanac-hosted backend/auth/API | 100% | 100% | Slice 75 added production `/v1/repositories`; production repo list and repo status pass without per-repo permission fanout. |
| Hosted frontend/onboarding | 99% | 98% | Production setup and CLI guide copy now match the public CLI; Chrome verified stale setup-capture wording is gone. |
| Infra/deploy rename | 99% | 99% | Hosted frontend deployed to Vercel production at `af0d7da` and aliased to `https://www.codealmanac.com`. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
