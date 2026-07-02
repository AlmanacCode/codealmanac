# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, push, and RelayForge update.

Cloud remains the primary product path. Local remains a free/dev surface with a
parallel conceptual model where it is useful, but not a reason to muddy the
cloud setup flow.

## Last Completed Work

Slice 50 added the browser-owned cloud setup entry:

- hosted `/setup` is the cloud setup hub
- `/setup` requires a WorkOS/AuthKit browser session
- missing GitHub App installation shows an install CTA
- connected accounts show GitHub repository access and links into repository
  setup surfaces
- the local machine command is Python/PyPI-shaped:
  `uv tool install codealmanac` then `codealmanac setup`

Slice 51 reconciles launch state and guardrails:

- launch login is GitHub-only
- email/password, magic link, and email verification are WorkOS/AuthKit
  misconfiguration paths, not alternate launch flows
- hosted route tests guard login and `/setup` against email-auth and npm/npx
  regressions
- rate limits are explicitly postponed; they remain future abuse-control work,
  not a current launch blocker

## Current Repo State

CodeAlmanac:

- repo: `/Users/rohan/Desktop/Projects/codealmanac`
- branch: `dev`
- current Slice 51 docs commit: the commit containing this brief
- previous `origin/dev` before Slice 51 push: `ae4f4c78`
- `origin/main`: `6d69c53b`
- package version in `pyproject.toml`: `0.1.0`
- PyPI live version checked on 2026-07-02: `0.1.0.dev0`

Hosted:

- repo: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- branch: `codex/workos-authkit-api-foundation`
- current Slice 51 commit: `8052be0`
- previous `origin/codex/workos-authkit-api-foundation` before Slice 51 push:
  `0683c78`
- `origin/main`: `a8ebe9e`
- production frontend: `https://www.codealmanac.com`
- hosted main has the setup/auth hardening through `a8ebe9e`; Slice 51's hosted
  change is test-only

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.

## Verified Recently

- Hosted route tests passed after the GitHub-only login guard:
  `npm run test:routes` -> `27 passed`.
- Browser-harness verified `https://www.codealmanac.com/login` renders only
  `Continue with GitHub` and no email/password inputs.
- Vercel production auth logs checked after latest deploy had no recent
  error-level entries; an older `/auth/callback` error from
  `2026-07-02T18:56:34Z` was from a pre-hardening deployment.
- CodeAlmanac `0.1.0` artifacts were built and locally install-tested earlier,
  but PyPI publish failed because no PyPI token/trusted publishing credential was
  available.

## Next Pressure Tests

- Publish CodeAlmanac `0.1.0` to PyPI once a PyPI token or trusted publishing is
  available, then test `uv tool install codealmanac` from PyPI.
- Do a real signed-in production browser pass through:
  `/login` -> GitHub AuthKit -> `/setup` -> GitHub App install/config ->
  repository settings.
- Keep setup simple. The user should not see email verification, email/password,
  or generic SSO as part of launch.
- Do not implement rate limits now unless Rohan explicitly reopens that work.
- Do not deploy every small guardrail. Batch deploys after real functionality or
  infrastructure changes.
- If WorkOS/AuthKit Hosted UI still shows email paths, fix the WorkOS dashboard
  authentication methods; the installed AuthKit Next.js helper routes to
  AuthKit and does not expose a code-level force-GitHub provider option.

## Remaining Launch Gaps

- PyPI package publish and fresh install smoke from PyPI.
- Final provider cleanup and branch/main convergence for both repos.
- Live production browser verification with a signed-in user.
- Deeper browser UX for maintained branches, per-branch delivery, capture
  consent, and billing/plan gates.
- Future abuse-control/rate-limit slice before broad public scale.
