# Launch Progress

Status: active.
Updated: 2026-07-02.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-02 after Slice 51 launch-state reconciliation and route-guard
verification.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Note: rate limits were postponed. PyPI publish is still blocked on a package
token or trusted publishing setup; the built `0.1.0` artifacts were tested but
PyPI still shows `0.1.0.dev0`.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 95% | 95% | Local engine and control surfaces are unchanged in Slice 51. |
| CodeAlmanac CLI/public UX | 93% | 91% | `0.1.0` Python artifacts were built and locally install-tested; PyPI publish is still blocked on token/trusted publishing. |
| CodeAlmanac-hosted backend/auth/API | 96% | 95% | WorkOS/AuthKit boundary, GitHub provider-token encryption, and callback hardening are implemented; rate limits are postponed. |
| Hosted frontend/onboarding | 72% | 60% | `/setup` is the cloud setup hub, login is GitHub-only, and route guards cover setup/login copy. Deeper branch/delivery/capture consent UX remains. |
| Infra/deploy rename | 94% | 90% | Render/Vercel are renamed/deployed for current hosted work; PyPI publish and final provider cleanup remain. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
