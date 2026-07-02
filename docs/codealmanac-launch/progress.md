# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 57 AuthKit sign-in hardening.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Note: rate limits were postponed. PyPI Trusted Publishing is working for
CodeAlmanac `0.1.0`. Hosted sign-in is now routed through the product login
page first, with `/sign-in` as the only WorkOS/AuthKit start endpoint.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 96% | 96% | CodeAlmanac local/backend unchanged in Slice 57. |
| CodeAlmanac CLI/public UX | 98% | 98% | PyPI `0.1.0` remains published and install-smoked; no CLI code changed in Slice 57. |
| CodeAlmanac-hosted backend/auth/API | 97% | 96% | AuthKit callback now rejects non-GitHub-token completions and maps callback errors back to GitHub-only login states. |
| Hosted frontend/onboarding | 84% | 78% | Public CTAs, protected redirects, login, `/sign-in`, and production `/setup` smoke now follow one GitHub-first setup path. |
| Infra/deploy rename | 98% | 98% | Vercel production redeployed and aliased after Slice 57; remaining infra work is provider cleanup and signed-in walkthrough coverage. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
