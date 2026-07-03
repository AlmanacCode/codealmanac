# Next Agent Brief

Status: active.
Updated: 2026-07-03.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, push, and RelayForge update.

Cloud remains the primary product path. Local remains a free/dev surface with a
parallel conceptual model where it is useful, but not a reason to muddy the
cloud setup flow.

## Current Verified State

- Hosted `main` includes
  `bff009bf7181b32a13a89aaf16aa683837207b09`.
- Render service `srv-d8g8nb37uimc739vnnsg` is live on deploy
  `dep-d93s4im7r5hc73c8hh00`.
- Modal app `codealmanac-hosted-updates` was redeployed after `eb8dba0`.
- Vercel production deploy
  `https://codealmanac-hosted-jgak4853w-thealmanac.vercel.app` is aliased to
  `https://www.codealmanac.com`.
- Chrome verified signed-in production `/setup`, `/dashboard/local-agent-access`,
  and the production repository dashboard for `AlmanacCode/codealmanac`.
- Chrome verified signed-in production repository settings at
  `https://www.codealmanac.com/dashboard/accounts/264516179/repositories/1212149375/settings`
  after the Slice 76 Vercel deployment. The page shows repository readiness,
  GitHub settings, CLI guide, capture handoff, branch rows, delivery controls,
  and no console errors.
- Slice 77 local CLI verification passed for the launch surface:
  root help is cloud-first, `sync` and `jobs` are hidden compatibility
  entrypoints, setup uses OpenAlmanac-style output, and `setup --yes` no longer
  silently opens a browser.
- Chrome verified the production CLI-login loop again from an isolated temp
  `HOME`: `codealmanac login --force --no-browser` printed a fresh
  `/cli-login` URL, Chrome showed `CLI login approved`, `whoami` succeeded, and
  `repo status` resolved `AlmanacCode/codealmanac` on `dev` with `triggers: 3`.
- Fresh production branch push created run
  `773da5fb-9871-4f83-8797-ddf651c635ce`; it delivered with summary
  `No wiki changes made.`
- Production captured-conversation trigger smoke passed. A temporary Codex
  capture on branch `codealmanac-smoke/slice-71-20260703123931` became run
  `02ae5710-92b4-4ae4-acdd-7148e8aa60f7` with source kind
  `conversation_batch`; it delivered and appeared at the top of the production
  activity page.
- Slice 71 cleanup completed: temp capture credential revoked, temp hook
  removed, smoke trigger disabled, remote smoke branch deleted, temp worktree
  removed, and temp HOME removed.
- Do not chase older failed smoke runs unless doing cleanup. The old failures
  are historical evidence from stale worker images and pre-fix payloads.
- The old conversation-batch run
  `aeb55370-cbdd-4ded-af6a-5e0e22f0ef0a` still appears `running` from a stale
  pre-fix Modal worker image.

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
- GitHub Actions publish run `28640955934` published `codealmanac` `0.1.1` to
  PyPI, and a fresh PyPI install verified the released CLI

Slice 60 repairs capture-token schema drift in production:

- production repository settings failed because the page called
  `GET /api/capture/status`, and production Supabase lacked
  `public.capture_tokens`
- hosted migration `20260703010000_capture_tokens.sql` creates the table,
  indexes, grants, forced RLS, and backend policy
- the clean-slate init migration also includes `capture_tokens`
- the migration was applied through Doppler-backed `psql` and marked applied in
  Supabase migration history
- browser-harness verified signed-in production repository settings now loads
  and Render logs show fresh `/api/capture/status` `200 OK` entries
- hosted focused tests and ruff passed for the slice

Slice 61 hardens GitHub webhook intake:

- webhook parsing now routes by `X-GitHub-Event`, not payload shape
- `installation.suspend` and `installation.unsuspend` match GitHub schema
- `installation_repositories.added` and `.removed` are parsed as their own
  event family
- repository delta messages carry parent account and installation snapshots
- identity fanout upserts those parent rows before repository fanout syncs
  repository scope
- production signed-webhook smoke recorded a synthetic `check_run` delivery as
  `ignored`, proving unsupported event-header routing is live

Slice 62 hardens branch-trigger delivery:

- non-truncated `.almanac/`-only branch pushes are ignored before trigger policy
  lookup, capacity checks, or run creation
- truncated push payloads still remain eligible for runs because changed paths
  are incomplete when GitHub caps the commits array
- delivery commits and PR titles now use `docs almanac: <worker summary>`
- open-PR delivery branches now use `almanac/update-<run>` instead of
  `almanac/wiki-<run>`
- hosted commit `fdad34d4297c969d3d7779250f67c94a60903c27` is deployed live on
  Render deploy `dep-d93mceekanas73aeia30`

Slice 63 pressure-tests production setup and repository settings:

- signed-in Chrome verified `https://www.codealmanac.com/setup`,
  repository list, repository activity, repository settings, and
  `/dashboard/local-agent-access`
- repository settings now keep the setup summary live after branch/delivery
  saves instead of needing a refresh
- dashboard page/header sizing now uses border-box sizing so repository-list
  actions do not crop at the 1290px Chrome viewport
- Vercel production deployment
  `https://codealmanac-hosted-gutvigm88-thealmanac.vercel.app` is aliased to
  `https://www.codealmanac.com`
- the temporary production mutation was restored: `main` is disabled and its
  delivery mode is `commit`

Slice 64 publishes canonical cloud endpoint defaults:

- CodeAlmanac package version is `0.1.2`
- PyPI `0.1.2` defaults to `https://api.codealmanac.com` and
  `https://www.codealmanac.com`
- fresh PyPI install and Chrome `/cli-login` approval worked without
  `--api-url`
- `codealmanac setup --no-browser --skip-instructions` from a temp HOME signed
  in as `rohans0509`

Slice 65 adds the public installer and curl-first onboarding:

- `scripts/install.sh` installs through Astral `uv` and `uv tool install`
- hosted serves the exact same script from `frontend/public/install.sh`
- README, landing, `/setup`, `/dashboard/local-agent-access`, and design-lab
  install copy now use
  `curl -fsSL https://www.codealmanac.com/install.sh | sh`
- manual install remains `uv tool install --python 3.12 codealmanac`
- installer smoke with temp dirs correctly warned that the stale Node-era
  `/Users/rohan/.nvm/versions/node/v21.7.3/bin/codealmanac` shadows the PyPI
  tool on this machine
- local verification passed: CodeAlmanac full tests (`501 passed`), ruff,
  hosted route tests (`28 passed`), hosted frontend tests (`52 passed`),
  hosted lint, and hosted Next build
- CodeAlmanac commit `43a88a6e` is on `origin/dev` and `origin/main`
- hosted commit `3cb9462` is on the hosted feature branch and hosted
  `origin/main`
- Vercel production deployment `6RT9PwDsTAicKSHid57JjcmDkubA` is aliased to
  `https://www.codealmanac.com`
- production `/install.sh` returned `HTTP/2 200`, `content-type:
  application/x-sh`, passed `sh -n`, and matched `scripts/install.sh`
  byte-for-byte
- production homepage, signed-in `/setup`, and signed-in
  `/dashboard/local-agent-access` now show the curl installer and no stale
  `npx`, old backend host, or Vercel URL strings

Slice 66 pressure-tests production capture upload:

- fresh PyPI CLI setup was re-run through real Chrome from a new temp HOME
- Chrome showed `CLI login approved`, setup completed as `rohans0509`, and
  `whoami` returned `https://api.codealmanac.com`
- `capture enable --target codex` issued a production capture credential,
  wrote temp `capture.json` with mode `0600`, and installed the temp Codex Stop
  hook
- synthetic `__capture-hook` upload returned `upload_status: uploaded`,
  `AlmanacCode/codealmanac`, branch `dev`, and `routing_status: routable`
- production internal artifact read-back returned `HTTP/2 200` using Render's
  production Doppler target `codealmanac/prd`
- `capture disable --target codex` revoked the credential and left no local or
  cloud capture credential
- focused CodeAlmanac capture tests passed (`7 passed`)
- focused hosted capture/internal API tests passed (`14 passed`, `1` warning)

Slice 67 aligns captured conversations with branch triggers:

- maintained branch pushes now claim completed, unclaimed, ref-backed
  conversation turns for the same repo/branch into a source bundle
- source-bundle runs use `ConversationBatchSource` with `batch_id` plus
  source refs; transcript/session content remains in source artifacts
- branches with no captured source refs still start the existing `BranchSource`
  run
- conversation-batch delivery now uses the same per-branch trigger policy as
  branch-source delivery, including the old due-ingest scheduler path
- hosted backend verification passed: focused trigger/conversation tests
  (`61 passed`), broader update/webhook/installation/worker/architecture tests
  (`172 passed`), full backend suite (`380 passed`, `1` warning), hosted ruff,
  compileall, and diff check

Important provider note:

- Render production backend secrets come from Doppler `codealmanac/prd`.
- RelayForge Discord updates use Doppler `almanac/dev`.
- Do not use the RelayForge Doppler target to test production internal API
  secrets; it correctly returns `401`.

## Current Repo State

CodeAlmanac:

- repo: `/Users/rohan/Desktop/Projects/codealmanac`
- branch: `dev`
- published Slice 59 artifact commit:
  `571dedb7 fix(slice-59): align public docs contract`
- later docs-only checkpoint commits may sit on top of that artifact commit;
  do not assume rerunning the publish workflow for `0.1.1` is valid because
  PyPI already has that version
- package version in `pyproject.toml`: `0.1.2`
- PyPI live version checked after Slice 64 publish on 2026-07-03: `0.1.2`
- Slice 59 is published and verified from a fresh PyPI install.
- Slice 64 bumped `pyproject.toml` to `0.1.2` because PyPI `0.1.1`
  still defaults to `https://codealmanac-backend-docker.onrender.com`.
- GitHub Actions publish run `28648341690` succeeded for `0.1.2`.
- Fresh public install with `uv tool install --python 3.12 --refresh --no-cache
  codealmanac` installed `0.1.2`, and `capture status --json` reported
  `api_url: https://api.codealmanac.com`.
- Source CLI production auth was verified in Chrome with:
  `uv run codealmanac login --api-url https://api.codealmanac.com --no-browser`.
  The browser approved `/cli-login`, `whoami` returned `rohans0509`, and
  capture credential issue/status/disable worked in a temp HOME.
- Fresh PyPI `0.1.2` login was verified with no `--api-url`: the installed
  binary printed a `https://www.codealmanac.com/cli-login` approval URL, Chrome
  approved it, and `whoami` returned `rohans0509` with cloud
  `https://api.codealmanac.com`.
- Fresh PyPI `0.1.2` `setup` was retested in Chrome on 2026-07-03 from an
  isolated `uv tool install --refresh --no-cache` binary and temp `HOME`.
  Chrome rendered `CLI login approved`; setup exited signed in as `rohans0509`;
  `whoami` and `capture status --check-cloud --json` both reached production.
- The machine PATH currently resolves an old Node-era `codealmanac` first:
  `/Users/rohan/.nvm/versions/node/v21.7.3/bin/codealmanac` reports `0.2.26`.
  `/Users/rohan/.local/bin/codealmanac` also reports stale `0.1.0.dev0` without
  cloud `setup`. Use `uv run codealmanac` inside this repo or a fresh
  `uv tool install` binary when verifying the Python package.
- Local working tree note at handoff: Slice 65 product/code changes are already
  committed and pushed. Current dirty files should only be launch evidence
  notes until the close-out docs commit lands. The pre-existing
  `docs/plans/2026-07-03-github-webhook-contract-hardening.md` remains
  untracked and should not be swept into the installer slice unless the next
  work intentionally resumes GitHub webhook planning.

Hosted:

- repo: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- branch: `codex/workos-authkit-api-foundation`
- current Slice 67 hosted backend commit:
  `a9a7ff82c3b014254feb6da05615d1048d7673f6`
- `origin/codex/workos-authkit-api-foundation` and `origin/main` both point at
  `a9a7ff82c3b014254feb6da05615d1048d7673f6`
- production frontend: `https://www.codealmanac.com`
- hosted main has setup/auth hardening, route-test guardrails, cloud setup
  checklist, production WorkOS identity schema repair, and capture-token
  storage repair, GitHub webhook event-header routing, branch-trigger delivery
  loop protection, Slice 63 frontend production fixes, Slice 65 curl-first
  installer/onboarding changes, and Slice 67 branch-triggered source bundles
  through `a9a7ff8`.
- Slice 65 is deployed and production-smoked. Slice 67 is pushed to hosted
  `main`; deploy status should be checked after the provider finishes building.

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
- Slice 59 publish verification passed: GitHub Actions run `28640955934`
  succeeded, PyPI JSON/simple index exposed `0.1.1`, and
  `uv tool install --python 3.12 --no-cache codealmanac==0.1.1` installed a
  CLI whose root setup JSON still showed `automation_mode: "none"`.
- Slice 60 hosted verification passed: production DB has
  `public.capture_tokens`, Supabase migration history includes
  `20260703010000`, Render deploy `dep-d93lnpl7vvec73fpne40` is live on commit
  `5220adf`, signed-in production repository settings loads in Chrome, Render
  logs show post-deploy `/api/capture/status` `200 OK`, hosted focused tests
  reported `76 passed`, and hosted ruff passed.
- Slice 61 hosted verification passed: focused webhook/fanout tests
  (`23 passed`), adjacent repository/update tests (`55 passed`), full hosted
  backend suite (`370 passed, 1 warning`), hosted ruff, Render deploy
  `dep-d93lvet7vvec73fpsag0` live on commit `c9b0da1`, backend health
  `{"status":"ok"}`, and production signed-webhook smoke persisted a synthetic
  `check_run` delivery as `ignored`.
- Slice 62 hosted verification passed: focused update tests (`49 passed`),
  adjacent webhook/update tests (`65 passed`), full hosted backend suite
  (`375 passed, 1 warning`), hosted ruff, compileall, `git diff --check`,
  Render deploy `dep-d93mceekanas73aeia30` live on commit `fdad34d`, and
  backend health `{"status":"ok"}` on both canonical API and Render URLs.
- Slice 63 production frontend verification passed: frontend tests
  (`52 passed`), route tests (`27 passed`), frontend lint, Next build,
  `git diff --check`, Vercel deploy
  `codealmanac-hosted-gutvigm88-thealmanac.vercel.app`, production Chrome setup
  and settings checks, live settings summary check, and restored trigger state
  `main enabled=false deliveryMode=commit`.
- Slice 65 production installer verification passed: public `/install.sh`
  matched the repo script byte-for-byte, homepage and setup surfaces use the
  curl installer with no stale npm/backend-host strings, API health returned
  `{"status":"ok"}`, and Chrome verified source plus PyPI CLI setup handoffs.
- Slice 67 hosted backend verification passed: focused trigger/conversation
  tests (`61 passed`), broader adjacent tests (`172 passed`), full backend
  suite (`380 passed`, `1` warning), hosted ruff, compileall, and
  `git diff --check`.
- Slice 67 is live on Render deploy `dep-d93oj33rjlhs73abh3tg` at hosted
  commit `a9a7ff8`; canonical API health returned `{"status":"ok"}`.
- Fresh published CLI setup was re-run through real Chrome from a temp HOME.
  Chrome showed `CLI login approved`, setup completed as `rohans0509`, and
  `whoami` returned cloud `https://api.codealmanac.com`.

## Next Pressure Tests

- Continue the real signed-in production browser pass into capture install and
  agent-instruction polish. The backend capture-to-run path is now live-tested;
  the remaining pressure is product UX, not basic data flow.
- Add `GITHUB_TOKEN_ENCRYPTION_KEYS` to Doppler `codealmanac/dev_personal` if a
  local signed-in setup walkthrough is needed; the backend currently refuses to
  start without it.
- Keep setup simple. Product-owned CodeAlmanac setup should stay GitHub-first;
  WorkOS/AuthKit may still show provider-owned account verification when its
  own policy requires it.
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

## Current Slice 69 Handoff

- Do not chase WorkOS for the latest CLI issue. Chrome verifies the
  signed-in dashboard wiki route.
- The concrete bug was public CLI `0.1.2`: `codealmanac open` printed
  `/wiki/github/AlmanacCode/codealmanac`, which is an obsolete cloud route.
- Published CLI `0.1.3` fixes this by resolving the current checkout through the cloud
  repositories API, then opening
  `/dashboard/accounts/{account_id}/repositories/{repo_id}/wiki`.
- PyPI `0.1.3` is live. Fresh default install with
  `uv tool install --python 3.12 --upgrade --force --refresh codealmanac`
  installed `0.1.3`.
- Installed `codealmanac open` opened Chrome to the dashboard wiki URL without
  a GitHub OAuth bounce.
- Keep the user-facing explanation short: old npm shadow was local and fixed;
  stale `open` route was public and fixed in `0.1.3`.

## Current Slice 70 Handoff

- PyPI `0.1.4` fixes the fresh-install `open` regression without undoing
  Slice 69.
- Signed-in `codealmanac open` still resolves through the cloud API and opens
  `/dashboard/accounts/264516179/repositories/1212149375/wiki`.
- No-auth `codealmanac open` now falls back to
  `/wiki/github/AlmanacCode/codealmanac` so the browser can handle hosted
  login/onboarding.
- Do not broaden the fallback. Only missing local `cloud auth state` should use
  the public resolver; real cloud repository/API failures should stay visible.
- Chrome verified both paths: public resolver completed through GitHub OAuth to
  `/setup`, and the signed-in dashboard wiki rendered `Default branch /
  62 pages`.
- Local gates passed for source `0.1.4`: focused tests (`65 passed`), full
  tests (`504 passed`), ruff, diff hygiene, build, and Twine check.
- Publish run `28660115818` succeeded from `main` at `35c7108e`.
- Fresh public install with
  `uv tool install --python 3.12 --upgrade --force --refresh codealmanac`
  installed `0.1.4`.
- Installed `codealmanac open --no-browser` verified both paths: fresh HOME
  prints the public resolver, and signed-in HOME prints the dashboard wiki URL.

## Current Slice 71 Handoff

- Chrome setup retry worked: WorkOS/AuthKit plus GitHub OAuth completed, and
  `/setup` rendered connected GitHub state for `AlmanacCode/codealmanac`.
- Production capture plus maintained-branch trigger worked end to end:
  `__capture-hook` uploaded a routable Codex transcript, the second push to the
  smoke branch created run `02ae5710-92b4-4ae4-acdd-7148e8aa60f7`, and the run
  source was `conversation_batch`.
- The run delivered with commit
  `9211b65f85ce0583419926c67968cefc0893c7bd` and changed
  `.almanac/pages/github-native-wiki-maintenance.md`.
- Cleanup is clean. Public CLI capture status has no local credential, no
  hooks, and no cloud credentials. The Slice 71 smoke trigger row remains only
  as disabled historical state.
- Do not repeat the same smoke unless changing trigger/source-bundle code.
  Spend the next slice on CLI/setup polish, provider cleanup, or frontend
  branch/delivery/capture UX.

## Current Slice 72 Handoff

- Source root `codealmanac setup` is now cloud-first and bannered. It handles
  cloud login plus Codex/Claude instruction setup only.
- Root setup no longer installs or recommends local scheduled automation, and
  its JSON output no longer contains `automation_mode`, `automation`, or
  `automation_install`.
- Explicit local/admin automation still lives under the existing automation
  surface; do not re-add scheduler fields to root setup.
- Chrome production retry worked in the user's Chrome profile. `/setup` showed
  connected WorkOS/AuthKit and GitHub state, and the repository dashboard showed
  the Slice 71 delivered run.
- Source gates passed: focused setup/CLI/architecture tests, public-contract
  tests, full `uv run pytest -q`, ruff, diff hygiene, build, and Twine check.
- PyPI `0.1.5` is live from GitHub Actions publish run `28662835062`.
- Fresh isolated public install of `codealmanac==0.1.5` passed, and installed
  setup JSON showed the cloud setup plan without root automation fields.

## Current Slice 73 Handoff

- Hosted `/setup` and `/dashboard/local-agent-access` now describe the same
  public CLI contract shipped in `0.1.5`.
- `codealmanac setup` signs in and installs Codex/Claude instruction files.
- `codealmanac capture enable` is the explicit command for cloud source
  capture.
- Production Chrome verified stale setup-capture wording is gone from both
  pages.

## Current Slice 76 Handoff

- Hosted repository settings now match the cloud setup model:
  GitHub App access, explicit capture handoff, maintained branches, and
  per-branch delivery.
- Repository list DTOs now carry `repoId`, `accountId`, `fullName`, and
  `defaultBranch` on both backend and frontend surfaces.
- Production Vercel deploy
  `https://codealmanac-hosted-jgak4853w-thealmanac.vercel.app` is aliased to
  `https://www.codealmanac.com`.
- Chrome verified the signed-in production settings page for
  `AlmanacCode/codealmanac`; it rendered the new copy and controls with no
  console errors.
- Next useful work is not another settings-copy slice. Prefer either real
  GitHub App onboarding/install-path pressure testing or the larger codebase
  sharpening pass Rohan requested.

## Current Slice 77 Handoff

- Local package version is now `0.1.7`.
- Root help is cloud-first and starts with open/setup/auth/capture/repo/runs.
  `sync` and `jobs` still parse for compatibility but are hidden from help.
- `codealmanac setup --yes` stays in prompt-mode; only `--no-browser` forces
  no-browser mode, and `--json` stays silent/machine-readable.
- Setup output uses the OpenAlmanac-style ANSI logo, diamond status markers,
  and boxed `Next steps`.
- Focused gates passed: CLI/public-contract/cloud-login pytest (`90 passed`),
  ruff on the touched CLI/login files, and `git diff --check`.
- Distribution gates passed: `uv build --out-dir dist`, `uvx twine check
  dist/*`, and an isolated Python `3.12.9` wheel install smoke for version,
  root help, and setup output.
- Chrome production retry passed for `/cli-login`, `whoami`, `repo status`,
  and `/setup`, with no console errors on `/setup`.
- Remaining work for the slice: publish `0.1.7` to PyPI through GitHub
  Actions, smoke a fresh public install, then send the RelayForge update.
