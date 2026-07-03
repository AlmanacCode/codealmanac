# Next Agent Brief

Status: active.
Updated: 2026-07-03.

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

Slice 55 improves hosted cloud setup:

- `/setup` shows an ordered checklist for GitHub sign-in, GitHub App install,
  repository selection, repository automation, and machine CLI setup
- route guardrails pin the checklist, PyPI-shaped install command, and
  GitHub-only copy
- frontend route tests, frontend component tests, lint, and Next build passed
- browser-harness proved unauthenticated `/setup` reaches GitHub-only login
- hosted commit `49afdcebace71eefb45e004c403879aaae6b3e9f` is on the hosted
  branch and hosted `main`
- Vercel production deployment
  `https://codealmanac-hosted-nhz0fnyqv-thealmanac.vercel.app` is aliased to
  `https://www.codealmanac.com`

Slice 56 completes PyPI publishing:

- trusted publisher entry was added for the PyPI `codealmanac` project
- GitHub Actions publish run `28619144624` succeeded on `main` at
  `43ec4800311b2f66f6095bff231f5fde7740eb07`
- PyPI now serves `codealmanac` `0.1.0`
- `uv tool install --python 3.12 codealmanac==0.1.0` works from a fresh tool dir

Slice 57 hardens GitHub-only hosted sign-in:

- public landing CTAs enter `/login` or `/login?next=...`, not protected
  dashboard/setup routes directly
- unauthenticated protected routes redirect to `/login?next=...`, not directly
  to WorkOS/AuthKit
- `/sign-in` is the only WorkOS/AuthKit start endpoint and owns the PKCE
  verifier-cookie setup
- plain `/login` defaults its GitHub CTA to `/sign-in?returnTo=%2Fsetup`
- the AuthKit callback rejects completed sessions without GitHub OAuth tokens
  and maps callback verifier failures to explicit GitHub-only login errors
- Vercel production deployment
  `https://codealmanac-hosted-jaxnxk6oq-thealmanac.vercel.app` is aliased to
  `https://www.codealmanac.com`

Slice 58 repairs production AuthKit schema drift:

- WorkOS/GitHub OAuth was configured correctly; the failing production request
  was backend persistence after the callback.
- Production Supabase still had the old Supabase Auth-era `users.supabase_user_id`
  table shape, while deployed backend code expected `users.workos_user_id` plus
  encrypted GitHub token columns.
- Hosted migration
  `supabase/migrations/20260703000000_repair_workos_identity_schema.sql`
  records the repair path.
- Production now has an active `rohans0509` WorkOS user row with encrypted
  GitHub access and refresh tokens.
- Hosted commit `01c84637e082945f22c71e09dfb7216c49c7769d` is on hosted
  `origin/codex/workos-authkit-api-foundation` and hosted `origin/main`.
- Render deploy `dep-d93h21h9rddc73a2q0g0` is live for commit `01c8463`.
- Browser-harness verified signed-in production `/setup` with `rohans0509`,
  `ReverieOne`, and `AlmanacCode`.

Slice 59 fixes the CLI auth/setup contract:

- root `codealmanac setup` is cloud setup only and no longer exposes local
  scheduled automation flags
- setup/login ask before opening a browser in interactive terminals
- non-interactive runs and `--no-browser` print the verification URL/code and
  poll without opening a browser
- local auth state now writes `access_token` plus optional `refresh_token`
  while reading old `token` files for migration
- README and public-contract tests now describe the cloud-first setup plus the
  explicit `local` surface

## Current Repo State

CodeAlmanac:

- repo: `/Users/rohan/Desktop/Projects/codealmanac`
- branch: `dev`
- current launch-docs commit after Slice 58 docs:
  `dfc4ea478b0164144d668258dcd9dc3f2cd722b3`
- `origin/dev` and `origin/main` both point at
  `dfc4ea478b0164144d668258dcd9dc3f2cd722b3`
- package version in `pyproject.toml`: `0.1.1`
- PyPI live version checked on 2026-07-02: `0.1.0`
- Slice 59 is verified locally and pending commit/publish from this working
  tree.

Hosted:

- repo: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- branch: `codex/workos-authkit-api-foundation`
- current Slice 58 commit:
  `01c84637e082945f22c71e09dfb7216c49c7769d`
- `origin/codex/workos-authkit-api-foundation` and `origin/main` both point at
  `01c84637e082945f22c71e09dfb7216c49c7769d`
- production frontend: `https://www.codealmanac.com`
- hosted main has setup/auth hardening, route-test guardrails, cloud setup
  checklist, and production WorkOS identity schema repair through `01c8463`.

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
- Slice 55 hosted frontend verification passed: `npm run test:routes`
  (`27 passed`), `npm run test:frontend` (`52 passed`), `npm run lint`,
  `npm run build`, and browser-harness unauthenticated `/setup` check.
- Slice 55 Vercel production deployment passed:
  `codealmanac-hosted-nhz0fnyqv-thealmanac.vercel.app` was aliased to
  `www.codealmanac.com`; production `/`, `/login`, unauthenticated `/setup`,
  and backend health smokes passed.
- Slice 55 full local dev stack did not start because Doppler
  `codealmanac/dev_personal` is missing `GITHUB_TOKEN_ENCRYPTION_KEYS`. This
  blocks a signed-in local walkthrough, not the static route/build verification.
- Slice 56 PyPI verification passed: publish workflow run `28619144624`
  succeeded, PyPI JSON and simple index expose `0.1.0`, `uvx --python 3.12
  codealmanac==0.1.0 --version` returned `0.1.0`, and isolated `uv tool install
  --python 3.12 codealmanac==0.1.0` installed an executable that returned
  `0.1.0`.
- Slice 57 hosted auth verification passed: `npm run test:routes`
  (`27 passed`), `npm run test:frontend` (`52 passed`), `npm run lint`,
  `npm run build`, `git diff --check`, production `/setup?smoke=auth57b`
  redirected to `/login?next=%2Fsetup%3Fsmoke%3Dauth57b`, production
  `/sign-in` set a `wos-auth-verifier-*` cookie before redirecting to WorkOS,
  browser-harness showed `/login` with `Continue with GitHub` and no inputs,
  and Vercel had no recent error logs.
- Slice 58 production auth verification passed: focused hosted backend auth
  tests (`24 passed`), production DB row for `rohans0509` with encrypted access
  and refresh token ciphertext, Render live deploy `dep-d93h21h9rddc73a2q0g0`,
  backend health `{"status":"ok"}`, Vercel production Ready, and browser-harness
  signed-in `/setup` showing `rohans0509`, `ReverieOne`, and `AlmanacCode`.
- Slice 59 local verification passed: `uv run pytest -q` (`499 passed`) and
  `uv run ruff check .` (`All checks passed`).
- Slice 59 package smoke passed: `uv build --out-dir dist`,
  `uvx twine check dist/*`, isolated wheel install through `uv tool install`,
  installed `codealmanac --version` (`0.1.1`), and installed setup JSON showed
  `automation_mode: "none"`.

## Next Pressure Tests

- Continue the real signed-in production browser pass from the verified
  `/setup` state into repository settings, branch trigger configuration,
  capture consent, and run visibility.
- Add `GITHUB_TOKEN_ENCRYPTION_KEYS` to Doppler `codealmanac/dev_personal` if a
  local signed-in setup walkthrough is needed; the backend currently refuses to
  start without it.
- Keep setup simple. The user should not see email verification, email/password,
  or generic SSO as part of launch.
- Do not implement rate limits now unless Rohan explicitly reopens that work.
- Do not deploy every small guardrail. Batch deploys after real functionality or
  infrastructure changes.
- If WorkOS/AuthKit Hosted UI still shows email paths after `/sign-in`, fix the
  WorkOS dashboard authentication methods; the installed AuthKit Next.js helper
  routes to AuthKit and does not expose a code-level force-GitHub provider
  option.

## Remaining Launch Gaps

- Final provider cleanup. CodeAlmanac and hosted branch/main convergence are
  done as of Slice 53.
- Live production browser verification with a signed-in user through the GitHub
  Hosted UI and GitHub App install/config path.
- Deeper browser UX for maintained branches, per-branch delivery, capture
  consent, and billing/plan gates.
- Future abuse-control/rate-limit slice before broad public scale.
