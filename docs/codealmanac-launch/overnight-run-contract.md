# Overnight Run Contract

Status: active.
Date: 2026-07-02.

This file records the execution order for the long autonomous launch run.

## Priority Order

The first major objective is infrastructure and deployment, before deep product
implementation.

Order:

1. Verify provider CLIs and auth state.
2. Prepare a clean `codealmanac-hosted` rename workspace.
3. Rename/move `usealmanac` to `codealmanac-hosted` under `AlmanacCode`.
4. Update repository names, package names, remotes, and provider settings.
5. Deploy the cloud app/backend so there is a real deployed target.
6. Set up or repair Vercel, Render, Modal, Supabase, GitHub App, Doppler,
   PostHog, and Autumn state as needed.
7. Run deployment smoke checks.
8. Only then continue into larger functionality chunks.

The intended wake-up state is: there is something deployed, not only a local
refactor.

## Provider CLI Check

Initial local CLI availability:

```text
gh        present
vercel    present
render    present
supabase  present
modal     present
doppler   present
atmn      available through frontend npm context
posthog   available through npm package investigation, not on PATH
autumn    no separate binary found; use atmn
```

Missing standalone CLIs do not automatically block the run. Use project npm
scripts, provider APIs, or dashboards when those are the correct interface.

Follow-up findings:

```text
cd /Users/rohan/Desktop/Projects/usealmanac/frontend
npm exec -- atmn --version
  -> 1.1.8

npm exec -- atmn --help
  -> works; commands include env, push, pull, preview, dashboard, login

npm exec --package @posthog/cli -- posthog-cli --help
  -> works; commands include login, sourcemap, api

npm exec --package @posthog/cli -- posthog-cli --version
  -> failed locally with spawnSync Unknown system error -88
```

Provider docs confirm:

- Autumn's JavaScript monorepo ships `atmn` as the CLI.
- PostHog documents `@posthog/cli` as the CLI package and `posthog-cli` as the
  binary.
- PostHog also documents `npx @posthog/wizard`, but the local Node 21.7.3
  runtime failed that wizard with an ESM directory-import error. Use Node 20.20+
  or Node 22.22+ if the wizard is needed.

## Implementation Cadence

The run should not spend the night on tiny commit ceremony.

Preferred cadence:

```text
plan a coherent chunk
implement the chunk
refactor while the shape is fresh
run focused checks
run broader checks at chunk boundaries
commit and push the coherent chunk
update steering docs
continue
```

Do not test every two-minute edit. Do test before committing/pushing each
meaningful chunk and before claiming a deployed state.

## Functionality Versus Slow Development

The launch run has two pressures:

- ship working functionality
- preserve the long-term architecture

The compromise is not to skip architecture. The compromise is to use larger
functional slices:

```text
infrastructure deployed
cloud onboarding path works
repo setup path works
trigger/delivery config exists
worker uses engine contract
run history is visible
local setup/update path works
```

Refactors are allowed inside these chunks when they make the chunk fit cleanly.
Refactors that do not affect the launch path should wait.

## Supabase

No external customers are using the product yet. Supabase migrations can be
rewritten, collapsed, repaired, or reset when that is the cleanest path.

Still record the chosen migration action in `worklog.md` and verify the final
schema against the launch requirements.
