# Launch Progress

Status: active.
Updated: 2026-07-03.

This file tracks the rough percentage estimates used in RelayForge updates.
Percentages are planning estimates, not accounting metrics.

## Latest RelayForge Update

Sent: 2026-07-03 after Slice 58 AuthKit production schema repair.

Route:

```bash
doppler run --project almanac --config dev -- \
  relayforge reply \
  --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json \
  --binding rohan-almanac-main "..."
```

Note: rate limits were postponed. PyPI Trusted Publishing is working for
CodeAlmanac `0.1.0`. Hosted sign-in reached production `/setup` after the
schema repair, then production identity/data state was intentionally reset for a
fresh first-login path. The root cause was production Supabase schema drift:
backend code expected WorkOS-shaped `users` rows, while production still had the
old Supabase Auth-shaped `users.supabase_user_id` table shape.

## Percentages

| Area | Latest | Previous | Basis |
| --- | ---: | ---: | --- |
| CodeAlmanac backend/local | 96% | 96% | CodeAlmanac local/backend unchanged in Slice 58. |
| CodeAlmanac CLI/public UX | 98% | 98% | PyPI `0.1.0` remains published and install-smoked; no CLI code changed in Slice 58. |
| CodeAlmanac-hosted backend/auth/API | 98% | 97% | Production DB now matches the WorkOS/AuthKit identity schema and stores encrypted GitHub access plus refresh tokens. |
| Hosted frontend/onboarding | 88% | 84% | Signed-in production `/setup` now renders `rohans0509` and connected GitHub accounts after the fixed auth/session write. |
| Infra/deploy rename | 99% | 98% | Hosted `main` and branch point at the schema-repair commit; Render deployed it live and Vercel remains Ready. |

## Update Rule

After each verified slice:

1. Move the old `Latest` values into `Previous`.
2. Set new `Latest` values.
3. Send the same values through RelayForge.
4. Record command success or failure in the worklog.
