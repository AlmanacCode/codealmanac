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

Slice 74 verified Chrome/fresh-CLI production auth, fixed
`codealmanac repo status` through GitHub App installation-token permission
checks, and recorded that `codealmanac repos list` is still absent from PyPI
`0.1.5`.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 96% | 96% | Local/backend unchanged in Slice 73. |
| CodeAlmanac CLI/public UX | 98% | 100% | Published CLI `0.1.5` setup/capture/repo status work; `codealmanac repos list` is not implemented despite being discussed. |
| CodeAlmanac-hosted backend/auth/API | 100% | 100% | Slice 74 fixed GitHub provider-limit handling and repo authorization hot path; production `repo status` and `repo triggers list` pass. |
| Hosted frontend/onboarding | 99% | 98% | Production setup and CLI guide copy now match the public CLI; Chrome verified stale setup-capture wording is gone. |
| Infra/deploy rename | 99% | 99% | Hosted frontend deployed to Vercel production at `af0d7da` and aliased to `https://www.codealmanac.com`. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
