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

Slice 52 adds PyPI Trusted Publishing readiness:

- `.github/workflows/publish.yml` publishes from `main` through
  `pypa/gh-action-pypi-publish@release/v1`
- the workflow requires manual `confirm_version`, refuses non-`main` refs, and
  refuses pre-release versions
- the GitHub environment name is `pypi`
- `RELEASE.md` documents the exact PyPI trusted publisher settings

Slice 53 converges hosted `main`:

- hosted branch `codex/workos-authkit-api-foundation` and hosted `main` both
  point at `8052be0`
- hosted route tests and lint passed before the fast-forward
- public production frontend and backend smokes passed after the fast-forward

Slice 54 executes the PyPI release path until the provider-side blocker:

- first `publish` workflow run `28617718053` exposed a real local
  attach-stream race in `tests/test_runs_service.py`
- fix commit `a0c86bfe6bedfdd2cd7bd8ff21c252692a6c4eb6` stabilizes terminal
  event streaming and is on CodeAlmanac `dev` and `main`
- second `publish` workflow run `28617914312` passed tests, lint, diff hygiene,
  build, Twine checks, and artifact upload
- PyPI rejected the upload with `invalid-publisher`; the trusted publisher
  entry is missing or does not match the GitHub OIDC claims

## Current Repo State

CodeAlmanac:

- repo: `/Users/rohan/Desktop/Projects/codealmanac`
- branch: `dev`
- current Slice 54 fix commit:
  `a0c86bfe6bedfdd2cd7bd8ff21c252692a6c4eb6`
- previous `origin/dev` before Slice 54 fix push:
  `8e08deb88a15d712c2d7ce08bc48fd201d482b69`
- `origin/main`: fast-forwarded during Slice 54 so the run-stream fix exists on
  the release branch before publishing
- package version in `pyproject.toml`: `0.1.0`
- PyPI live version checked on 2026-07-02: `0.1.0.dev0`

Hosted:

- repo: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- branch: `codex/workos-authkit-api-foundation`
- current Slice 53 commit: `8052be0`
- previous `origin/codex/workos-authkit-api-foundation` before Slice 51 push:
  `0683c78`
- `origin/main`: `8052be0`; previous `origin/main` before Slice 53 was
  `a8ebe9e`
- production frontend: `https://www.codealmanac.com`
- hosted main has the setup/auth hardening and route-test guardrails through
  `8052be0`

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
- CodeAlmanac `0.1.0` artifacts were built and locally install-tested earlier.
  Slice 52 adds the trusted-publishing workflow; the PyPI project still needs a
  trusted publisher entry before the workflow can upload.
- Slice 52 package/release verification passed: focused public-contract tests
  (`25 passed`), full `uv run pytest` (`496 passed`), `uv run ruff check .`,
  workflow YAML parsing, `uv build --out-dir dist`, `uvx twine check dist/*`,
  and `git diff --check`.
- Slice 53 hosted verification passed: hosted `npm run test:routes`
  (`27 passed`), hosted `npm run lint`, hosted remote refs both at `8052be0`,
  `https://www.codealmanac.com` HTTP 200, `https://www.codealmanac.com/login`
  HTTP 200, and backend health returned `{"status":"ok"}`.
- Slice 54 local verification passed after the run-stream race fix:
  focused run-stream tests (`3 passed`), full `uv run pytest` (`497 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Slice 54 GitHub publish run `28617914312` passed the workflow's build job:
  tests, lint, diff hygiene, artifact build, Twine checks, and artifact upload.
  It failed only at PyPI token exchange with `invalid-publisher`.

## Next Pressure Tests

- Add the PyPI trusted publisher entry for project `codealmanac`, owner
  `AlmanacCode`, repository `codealmanac`, workflow filename `publish.yml`,
  environment `pypi`.
  The failed run's claims were
  `sub=repo:AlmanacCode/codealmanac:environment:pypi`,
  `repository=AlmanacCode/codealmanac`,
  `workflow_ref=AlmanacCode/codealmanac/.github/workflows/publish.yml@refs/heads/main`,
  `ref=refs/heads/main`, and `environment=pypi`.
- Publish CodeAlmanac `0.1.0` by running the `publish` workflow on `main` with
  `confirm_version=0.1.0`, then test `uv tool install codealmanac` from PyPI.
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

- PyPI trusted publisher setup, package publish, and fresh install smoke from
  PyPI. The workflow build job is clean; PyPI currently rejects upload with
  `invalid-publisher`.
- Final provider cleanup. CodeAlmanac and hosted branch/main convergence are
  done as of Slice 53.
- Live production browser verification with a signed-in user.
- Deeper browser UX for maintained branches, per-branch delivery, capture
  consent, and billing/plan gates.
- Future abuse-control/rate-limit slice before broad public scale.
