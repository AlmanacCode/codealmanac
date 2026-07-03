# Launch Worklog

## 2026-07-03

- Planned Slice 59 in
  `docs/plans/2026-07-02-slice-59-cli-auth-setup-contract.md`.
- Made root `codealmanac setup` cloud-first only. It no longer exposes
  `--install-automation`, `--sync-every`, `--sync-quiet`, `--garden-every`, or
  `--garden-off`; local scheduled automation stays behind explicit local or
  automation commands.
- Changed CLI login/setup browser behavior so interactive terminals ask before
  opening the browser, `--no-browser` always prints the URL/code and polls
  without opening, non-interactive runs never open a browser, and `--yes` only
  opens when a TTY is present.
- Added the WorkOS-shaped local auth token model in the CLI: stored auth now
  writes `access_token` plus optional `refresh_token`, while still reading
  legacy `token` auth files for migration.
- Kept the human CLI above the service/workflow layer. Browser prompting lives
  in `src/codealmanac/integrations/cloud_login.py`; the workflow receives an
  interaction port and does not print or prompt directly.
- Updated README/public-contract tests to the launch surface: `setup`/`login`
  for cloud, `capture` for Codex/Claude capture, local update commands under
  `local`, and runtime state documented separately from `init` scaffold files.
- Bumped the CLI package from `0.1.0` to `0.1.1` because PyPI already serves
  `0.1.0` and this slice needs a deployable CLI artifact.
- Verified Slice 59 with `uv run pytest -q` (`499 passed`) and
  `uv run ruff check .` (`All checks passed`).
- Release-smoked Slice 59 with `git diff --check`, `uv build --out-dir dist`,
  `uvx twine check dist/*`, isolated `uv tool install --python 3.12` from the
  built wheel, installed `codealmanac --version` (`0.1.1`), and installed
  `codealmanac setup --skip-login --skip-instructions --json`
  (`automation_mode: "none"`).
- Planned Slice 60 in the hosted worktree with
  `docs/plans/2026-07-03-capture-token-schema-repair.md`.
- Repaired the production repository-settings failure. The real blocker was
  `GET /api/capture/status`: backend code queried `CaptureTokenRow`, but
  production Supabase did not have `public.capture_tokens`.
- Added hosted migration `20260703010000_capture_tokens.sql` and updated the
  clean-slate init migration so repaired production and fresh environments
  share the same capture-token table shape.
- Applied the migration to production through Doppler-backed `psql`, then
  marked it applied in Supabase migration history.
- Verified production DB has `public.capture_tokens` and policy
  `capture_tokens_backend_access` for `{postgres,service_role}`.
- Verified hosted Slice 60 with
  `uv run pytest tests/test_architecture_contract.py tests/test_capture_tokens_api_contract.py`
  (`76 passed, 1 warning`) and `uv run ruff check .`.
- Pushed hosted commit
  `5220adf8de537111beb7383761cfe82eb87b0a38 fix: add capture token storage schema`
  to `origin/codex/workos-authkit-api-foundation` and hosted `origin/main`.
- Render deployed hosted commit `5220adf` live as deploy
  `dep-d93lnpl7vvec73fpne40`; backend health returned `{"status":"ok"}`.
- Browser-harness verified signed-in production repository settings at
  `https://www.codealmanac.com/dashboard/accounts/264516179/repositories/1212149375/settings`
  showing repository readiness, GitHub write access, capture status,
  maintained branches, and delivery controls.
- Render logs after the live deploy showed fresh
  `GET /api/capture/status HTTP/1.1` requests returning `200 OK`.
- Planned Slice 61 in hosted
  `docs/plans/2026-07-03-slice-61-github-webhook-contract-hardening.md`.
- Hardened hosted GitHub webhook intake so parsing is routed by
  `X-GitHub-Event`, not guessed from payload shape.
- Corrected GitHub installation actions to `suspend` and `unsuspend`. The old
  non-schema `suspended` and `unsuspended` strings are now ignored.
- Split `installation_repositories.added` and `.removed` into their own event
  family mapper.
- Changed installation repository delta messages to carry parent account and
  installation snapshots so identity fanout can upsert parent rows before
  repository fanout syncs repository scope.
- Verified Slice 61 with hosted backend focused tests
  `tests/test_github_service_contract.py tests/test_installations_contract.py`
  (`23 passed`), adjacent repository/update tests (`55 passed`), full backend
  suite (`370 passed, 1 warning`), and `uv run ruff check .`.
- Pushed hosted commit
  `c9b0da10cad6f21f28fce72eabebcb7fde38f7a4 fix(github): route webhooks by event contract`
  to `origin/codex/workos-authkit-api-foundation` and hosted `origin/main`.
- Render deployed hosted commit `c9b0da1` live as deploy
  `dep-d93lvet7vvec73fpsag0`; backend health returned `{"status":"ok"}`.
- Production signed-webhook smoke posted a synthetic `check_run` delivery and
  the DB recorded it as `event=check_run`, `action=requested_action`,
  `status=ignored`.
- Planned Slice 62 in hosted
  `docs/plans/2026-07-03-slice-62-branch-trigger-delivery-loop-guard.md`.
- Added hosted branch-push loop protection. Non-truncated pushes with no
  changed paths are ignored as `empty_push`, and non-truncated pushes whose
  changed paths are all under `.almanac/` are ignored as `almanac_only_push`
  before trigger policy lookup, capacity checks, or run creation.
- Kept truncated push payloads eligible for runs because GitHub caps the push
  commits array; visible changed paths are not authoritative when
  `commits_truncated=True`.
- Changed hosted delivery commit/PR text to use deterministic
  `docs almanac: <worker summary>` messages, with `docs almanac: update wiki`
  as the missing-summary fallback.
- Changed open-PR delivery branches from `almanac/wiki-<run>` to
  `almanac/update-<run>` because the delivery path is not only for initial wiki
  creation.
- Verified Slice 62 with hosted focused update tests
  `tests/test_updates_contract.py` (`49 passed`), adjacent webhook/update
  tests (`65 passed`), full backend suite (`375 passed, 1 warning`),
  `uv run ruff check .`, `python -m compileall backend/src backend/modal_app
  -q`, and `git diff --check`.
- Pushed hosted commit
  `fdad34d4297c969d3d7779250f67c94a60903c27 fix(updates): ignore almanac delivery pushes`
  to `origin/codex/workos-authkit-api-foundation` and hosted `origin/main`.
- Render deployed hosted commit `fdad34d` live as deploy
  `dep-d93mceekanas73aeia30`; both `https://api.codealmanac.com/api/health`
  and the Render URL returned `{"status":"ok"}`.
- Production synthetic branch-push smoke was intentionally skipped because
  fake `push` events also feed the wiki tracker; a fake `.almanac/` path could
  mark an import state even though the update service correctly ignores it.
- Planned Slice 63 in hosted
  `docs/plans/2026-07-03-slice-63-production-setup-pressure-test.md`.
- Browser-harness/Chrome verified signed-in production setup, repository list,
  repository activity, repository settings, reversible maintained-branch
  configuration, and the CLI setup guide for `rohans0509`.
- Fixed repository settings so branch and delivery changes update the
  readiness summary from client state immediately after a successful save
  instead of requiring a page refresh.
- Fixed dashboard page/header sizing so repository-list actions no longer crop
  at a 1290px Chrome viewport. The stale page measured
  `.dashboard-page-body` at `right=1378`; after reload on the Slice 63 Vercel
  deployment it measured `right=1290` and the row action measured
  `right=1221`.
- Verified Slice 63 frontend locally with frontend tests (`52 passed`), route
  tests (`27 passed`), frontend lint, Next build, and `git diff --check`.
- Pushed hosted commit
  `47b1ada536b27a13b10eebe0878180542a01f8ba fix(frontend): keep repository settings feedback live`
  to `origin/codex/workos-authkit-api-foundation` and hosted `origin/main`.
- Deployed the hosted frontend to Vercel production at
  `https://codealmanac-hosted-gutvigm88-thealmanac.vercel.app`; Vercel aliased
  it to `https://www.codealmanac.com`.
- Production Chrome verification after the Vercel deploy passed:
  `https://www.codealmanac.com/setup` rendered the connected cloud setup for
  `rohans0509`; the repository list no longer overflowed; the settings page
  updated summary text live from `No maintained branch enabled` to `main` plus
  `Open pull requests`; the dashboard BFF returned
  `[{"repoId":1212149375,"branch":"main","enabled":true,"deliveryMode":"pr"}]`
  during the reversible mutation; the page and backend were restored to
  `enabled=false`, `deliveryMode="commit"` afterward.
- Retried the public PyPI `0.1.2` setup path in Chrome from an isolated
  `uv tool install --refresh --no-cache` binary and temp `HOME`. The CLI
  printed a `https://www.codealmanac.com/cli-login` approval URL, Chrome showed
  `CLI login approved`, setup exited signed in as `rohans0509`, `whoami`
  returned `Cloud: https://api.codealmanac.com`, and
  `capture status --check-cloud --json` reached production successfully.
- Confirmed the local machine still has stale PATH entries: plain
  `codealmanac` resolves to the old Node binary at
  `/Users/rohan/.nvm/versions/node/v21.7.3/bin/codealmanac` (`0.2.26`), and
  `/Users/rohan/.local/bin/codealmanac` reports `0.1.0.dev0` without cloud
  `setup`. Product verification should use a fresh `uv tool install` binary or
  `uv run codealmanac` until PATH cleanup is done.

## 2026-07-02

- Planned Slice 58 in
  `docs/plans/2026-07-02-slice-58-authkit-stale-session-retry.md`. The initial
  hypothesis was a stale AuthKit session retry problem; production evidence
  changed the slice into a schema-drift repair.
- Confirmed the real production auth failure was not WorkOS or GitHub OAuth
  configuration. WorkOS/GitHub returned tokens, but
  `POST /api/auth/github-app/session` failed because production Supabase still
  had the old Supabase Auth-era `users.supabase_user_id` shape while deployed
  backend code expected `users.workos_user_id` and encrypted token columns.
- Repaired production Supabase through Doppler-backed `psql` because Supabase
  CLI migration commands hit the pooler prepared-statement error
  `prepared statement "lrupsc_1_0" already exists`.
- Added hosted migration
  `supabase/migrations/20260703000000_repair_workos_identity_schema.sql`. The
  migration creates missing launch tables, converts legacy identity foreign keys
  to WorkOS text ids, drops plaintext GitHub token columns, adds encrypted token
  columns, and recreates foreign keys to `users(workos_user_id)`.
- Applied and repaired production migration history for:
  `launch_security_hardening`, `local_agent_setup_intro`,
  `hosted_conversation_sync`, `conversation_ingest_scheduler`,
  `conversation_source_refs`, `encrypt_github_user_tokens`, and
  `repair_workos_identity_schema`.
- Verified production DB has `user_01KWJ304254FX8W88S879S8PQG` for
  `rohans0509`, active, with encrypted GitHub access and refresh token
  ciphertext present.
- Verified hosted backend focused auth tests:
  `uv run pytest tests/test_identity_auth_contract.py tests/test_github_auth_contract.py tests/test_installations_contract.py -q`
  (`24 passed`).
- Pushed hosted commit
  `01c84637e082945f22c71e09dfb7216c49c7769d fix(auth): repair WorkOS identity schema migration`
  to `origin/codex/workos-authkit-api-foundation` and hosted `origin/main`.
- Render deployed hosted commit `01c8463` live as deploy
  `dep-d93h21h9rddc73a2q0g0`. Backend health returned `{"status":"ok"}`.
- Vercel production remained Ready and aliased to `https://www.codealmanac.com`.
  No new Vercel deployment was needed for the SQL-only migration commit.
- Browser-harness verified signed-in production setup after the Render deploy:
  `https://www.codealmanac.com/setup` rendered `rohans0509`, cloud setup,
  connected GitHub accounts `ReverieOne` and `AlmanacCode`, and the PyPI-shaped
  machine setup command.
- Sent RelayForge update through `rohan-almanac-main` with Slice 58 verification
  evidence and progress percentages: CodeAlmanac backend/local 96%,
  CLI/public UX 98%, hosted backend/auth/API 98%, hosted frontend/onboarding
  88%, infra/deploy rename 99%.
- Planned Slice 57 in
  `docs/plans/2026-07-02-slice-57-authkit-signin-hardening.md`.
- Hardened hosted sign-in so `/sign-in` is the only route that starts
  WorkOS/AuthKit. Public landing CTAs now link to `/login` or
  `/login?next=...`; unauthenticated protected routes redirect to local
  `/login?next=...`, not directly to WorkOS.
- Changed the login CTA to a normal anchor to `/sign-in`, so the server route
  owns the WorkOS PKCE verifier cookie. Plain `/login` defaults to `/setup`.
- Changed the AuthKit callback to reject completed sessions without GitHub
  OAuth tokens and to map callback failures to GitHub-only login errors.
- Verified hosted Slice 57 locally with `npm run test:routes` (`27 passed`),
  `npm run test:frontend` (`52 passed`), `npm run lint`, `npm run build`, and
  `git diff --check`. The Next build still reports the pre-existing CSS
  optimizer warning about `m-* utility`.
- Pushed hosted commits `2b68292` and `041deb8` to
  `origin/codex/workos-authkit-api-foundation` and fast-forwarded hosted
  `origin/main` to `041deb878edb3931121ad861659dff0568f23b99`.
- Deployed the final hosted Slice 57 frontend to Vercel production at
  `https://codealmanac-hosted-jaxnxk6oq-thealmanac.vercel.app`; Vercel aliased
  it to `https://www.codealmanac.com`.
- Production smoke passed: unauthenticated `/setup?smoke=auth57b` returns
  `307 Location: /login?next=%2Fsetup%3Fsmoke%3Dauth57b`, `/sign-in` sets a
  `wos-auth-verifier-*` cookie before redirecting to WorkOS, browser-harness
  shows `/login` with only `Continue with GitHub` and no inputs, and Vercel had
  no error logs in the latest check.
- Sent the Slice 57 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 96%, CLI/public UX 98%,
  CodeAlmanac-hosted backend/auth/API 97%, hosted frontend/onboarding 84%, and
  infra/deploy rename 98%.
- Planned Slice 55 in
  `docs/plans/2026-07-02-slice-55-cloud-setup-checklist.md`.
- Updated hosted `/setup` so the browser-owned cloud setup hub shows an ordered
  checklist: sign in with GitHub, install the GitHub App, choose repositories,
  configure repository automation, and set up this machine.
- Kept top-level setup facts limited to real `MeDTO` state: signed-in user,
  connected GitHub accounts, installation ids, and repository selection. The
  page does not invent repository count, branch trigger, delivery, or capture
  status; those remain repository-settings facts.
- Added hosted route guardrails so `/setup` keeps the checklist, PyPI-shaped
  install command, maintained-branches/per-branch-delivery copy, and
  GitHub-only auth language.
- Verified Slice 55 with hosted `npm run test:routes` (`27 passed`),
  `npm run test:frontend` (`52 passed`), `npm run lint`, and `npm run build`.
- Browser-harness verified unauthenticated `http://localhost:3000/setup`
  redirects into the GitHub-only login surface with `Continue with GitHub` and
  no email/password path. The full dev stack could not start because
  Doppler `codealmanac/dev_personal` is missing `GITHUB_TOKEN_ENCRYPTION_KEYS`;
  signed-in local setup walkthrough remains open until that env is present.
- Pushed hosted commit `49afdcebace71eefb45e004c403879aaae6b3e9f` to
  `origin/codex/workos-authkit-api-foundation` and fast-forwarded hosted
  `origin/main`.
- Deployed the hosted frontend to Vercel production at
  `https://codealmanac-hosted-nhz0fnyqv-thealmanac.vercel.app`; Vercel aliased
  it to `https://www.codealmanac.com`.
- Production smoke passed: `https://www.codealmanac.com` returned HTTP 200,
  `https://www.codealmanac.com/login` returned HTTP 200,
  unauthenticated `https://www.codealmanac.com/setup` redirected through
  WorkOS/AuthKit, and
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`.
- Sent the Slice 55 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 96%, CLI/public UX 95%,
  CodeAlmanac-hosted backend/auth/API 96%, hosted frontend/onboarding 78%, and
  infra/deploy rename 96%.
- Planned Slice 54 in
  `docs/plans/2026-07-02-slice-54-pypi-release-execution.md`.
- Triggered the first `publish` workflow run on GitHub `main` with
  `confirm_version=0.1.0`. Run `28617718053` failed in `uv run pytest` because
  `test_runs_service_streams_attach_until_run_is_terminal` exposed a real
  attach-stream race: the file-backed run ledger can expose a terminal record
  before the terminal status event is visible.
- Fixed the attach-stream race in `RunAttachStreamer` by waiting through a
  bounded terminal-record/log-event settle window. Added a regression test that
  waits through repeated terminal-log race snapshots.
- Verified the fix locally with focused run-stream tests (`3 passed`), full
  `uv run pytest` (`497 passed`), `uv run ruff check .`, and `git diff --check`.
- Pushed fix commit `a0c86bfe6bedfdd2cd7bd8ff21c252692a6c4eb6` to
  `origin/dev` and `origin/main`.
- Triggered the second `publish` workflow run on GitHub `main` with
  `confirm_version=0.1.0`. Run `28617914312` passed tests, lint, diff hygiene,
  build, Twine artifact checks, and artifact upload, then failed in the PyPI
  publish step with `invalid-publisher`.
- The PyPI failure claims were:
  `sub=repo:AlmanacCode/codealmanac:environment:pypi`,
  `repository=AlmanacCode/codealmanac`,
  `workflow_ref=AlmanacCode/codealmanac/.github/workflows/publish.yml@refs/heads/main`,
  `ref=refs/heads/main`, and `environment=pypi`.
- Confirmed PyPI still exposes only `codealmanac` `0.1.0.dev0`, so the fresh
  PyPI install smoke remains blocked until the trusted publisher entry is added
  in the PyPI dashboard.
- Sent the Slice 54 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 96%, CLI/public UX 95%,
  CodeAlmanac-hosted backend/auth/API 96%, hosted frontend/onboarding 73%, and
  infra/deploy rename 96%.
- Planned Slice 53 in
  `docs/plans/2026-07-02-slice-53-hosted-main-convergence.md`.
- Verified hosted branch `codex/workos-authkit-api-foundation` with
  `npm run test:routes` (`27 passed`) and `npm run lint`.
- Fast-forwarded hosted `main` to
  `8052be030f202b3186cad85b51e12308ca4f9bc4`, matching the verified hosted
  branch. No Vercel or Render deploy was triggered because the hosted diff
  since `a8ebe9e` was route-test-only.
- Smoked production public routes after hosted main convergence:
  `https://www.codealmanac.com` returned HTTP 200,
  `https://www.codealmanac.com/login` returned HTTP 200, and
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`.
- Sent the Slice 53 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 95%, CLI/public UX 94%,
  CodeAlmanac-hosted backend/auth/API 96%, hosted frontend/onboarding 73%, and
  infra/deploy rename 96%.
- Planned Slice 52 in
  `docs/plans/2026-07-02-slice-52-pypi-trusted-publishing.md`.
- Replaced the disabled CodeAlmanac `publish` workflow with a manual
  PyPI Trusted Publishing workflow. The workflow publishes only from `main`,
  requires `confirm_version` to match `pyproject.toml`, refuses pre-release
  versions, builds/checks artifacts, and uploads through
  `pypa/gh-action-pypi-publish@release/v1` using GitHub environment `pypi`.
- Updated `RELEASE.md` with the exact PyPI trusted publisher setup:
  project `codealmanac`, owner `AlmanacCode`, repository `codealmanac`,
  workflow filename `publish.yml`, environment `pypi`.
- Verified Slice 52 with focused public-contract tests (`25 passed`), full
  `uv run pytest` (`496 passed`), `uv run ruff check .`, workflow YAML parsing,
  `uv build --out-dir dist`, `uvx twine check dist/*`, and `git diff --check`.
- Sent the Slice 52 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 95%, CLI/public UX 94%,
  CodeAlmanac-hosted backend/auth/API 96%, hosted frontend/onboarding 72%, and
  infra/deploy rename 95%.
- Pushed Slice 52 to `origin/dev` and fast-forwarded `origin/main` so the
  manual trusted-publishing workflow exists on the release branch. The workflow
  is manual-only and does not publish automatically.
- Planned Slice 51 in
  `docs/plans/2026-07-02-slice-51-launch-state-reconciliation.md`.
- Reconciled launch state after Slice 50 and the GitHub-only auth guard. The
  launch folder now records that `/setup` is the browser-owned cloud setup hub,
  PyPI still serves `codealmanac` `0.1.0.dev0`, and rate limits are postponed
  future abuse-control work rather than a current product blocker.
- Added hosted route guards for `/setup`: it must show cloud setup, GitHub App
  setup, `uv tool install codealmanac` plus `codealmanac setup`, and no
  `npx`, `almanac login`, email verification, password, or magic-link copy.
- Verified Slice 51 with hosted `npm run test:routes` (`27 passed`), hosted
  `npm run lint`, CodeAlmanac `git diff --check`, and hosted `git diff --check`.
- Sent the Slice 51 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 95%, CLI/public UX 93%,
  CodeAlmanac-hosted backend/auth/API 96%, hosted frontend/onboarding 72%, and
  infra/deploy rename 94%.
- Rechecked the cloud login decision after a cofounder hit an email-style
  verification path. Launch login remains GitHub-only: `codealmanac setup`
  opens browser login, the user continues with GitHub, then installs/configures
  the GitHub App. Email/password, magic auth, and email verification are
  misconfigured WorkOS/AuthKit paths because they do not return GitHub provider
  OAuth tokens to the AuthKit callback.
- Pulled Vercel production auth logs from the linked frontend project. Recent
  production auth logs after the latest deployment had no error-level entries;
  the relevant older `/auth/callback` error at `2026-07-02T18:56:34Z` was
  `WorkOS GitHub OAuth tokens were missing`, from a deployment before the
  callback hardening was active.
- Verified with browser-harness that `https://www.codealmanac.com/login`
  renders only `Continue with GitHub` and no email/password inputs.
- Added a hosted route regression guard so the login surface cannot reintroduce
  password, magic-link, or email-verification copy.
- Planned Slice 49 in
  `docs/plans/2026-07-02-slice-49-token-storage-hardening.md`.
- Hardened hosted GitHub provider token storage. `users.oauth_token` and
  `users.refresh_token` became `oauth_token_ciphertext` and
  `refresh_token_ciphertext`.
- Added `backend/src/almanac/services/identity/users/secrets.py` with a
  Fernet/MultiFernet `TokenCipher` boundary. `UsersStore` encrypts tokens on
  upsert and decrypts them when hydrating the domain `User`.
- Wired the token cipher in `backend/src/almanac/app.py` from
  `Settings.github_token_encryption_keys`, keeping concrete secret machinery
  in the composition root.
- Kept WorkOS Vault out of this slice because WorkOS Vault is
  organization-scoped and the current CodeAlmanac product hierarchy does not
  make WorkOS organizations own all GitHub accounts/repositories.
- Normalized WorkOS issuer handling to the documented slash form
  `https://api.workos.com/`.
- Updated Supabase migrations so clean databases use ciphertext columns and
  legacy plaintext columns are invalidated/dropped, not renamed as ciphertext.
- Added architecture coverage that prevents plaintext token columns and
  prevents migrations from renaming `oauth_token` or `refresh_token` into
  ciphertext columns.
- Updated Modal Doppler hydration and the frontend-owned backend smoke command
  so the required `GITHUB_TOKEN_ENCRYPTION_KEYS` setting is present at runtime.
- Created `GITHUB_TOKEN_ENCRYPTION_KEYS` in Doppler `codealmanac/prd` without
  printing the generated Fernet key.
- Verified Slice 49 with hosted focused backend tests (`99 passed, 1 warning`),
  full hosted backend tests (`361 passed, 1 warning`), backend
  `uv run ruff check .`, backend
  `uv run python -m compileall src modal_app -q`, hosted frontend route tests
  (`27 passed`), focused Modal hydration test (`1 passed`), and
  `npm run backend:smoke`.
- Pushed hosted commit `0f9850c refactor: encrypt github provider tokens` to
  `origin/codex/workos-authkit-api-foundation`.
- Did not apply Supabase migrations or deploy after Slice 49. Per Rohan's
  deployment-cadence instruction, deployment should be batched after another
  coherent infrastructure slice so DB migration and backend rollout happen
  together.
- Recorded progress as: CodeAlmanac backend/local 95%, CLI/public UX 91%,
  CodeAlmanac-hosted backend/auth/API 95%, hosted frontend/onboarding 60%, and
  infra/deploy rename 90%.
- Planned Slice 48 in
  `docs/plans/2026-07-02-slice-48-workos-library-auth-boundary.md`.
- Tightened the hosted WorkOS/AuthKit auth hierarchy. Browser sessions remain
  owned by `@workos-inc/authkit-nextjs`; FastAPI API requests receive bearer
  access tokens from the Next server layer; CLI tokens and capture credentials
  remain separate product machine credentials.
- Replaced hand-rolled `Authorization` header parsing in
  `backend/src/almanac/server/deps.py` with FastAPI
  `HTTPBearer(auto_error=False)`.
- Documented the provider boundary in
  `backend/src/almanac/integrations/workos/client.py`: WorkOS Python
  sealed-session helpers are for direct `wos_session` cookie sessions, while
  this app's FastAPI boundary validates AuthKit access-token JWTs via WorkOS
  JWKS and PyJWT.
- Expanded `WorkOSClaims` to mirror documented AuthKit access-token claims:
  organization id, role, roles, permissions, entitlements, and feature flags.
- Added architecture-test coverage that prevents regression to custom bearer
  string parsing.
- Verified Slice 48 with hosted focused backend tests
  (`86 passed, 1 warning`), full hosted backend tests
  (`357 passed, 1 warning`), backend `uv run ruff check .`, backend
  `uv run python -m compileall src modal_app -q`, hosted frontend route tests
  (`27 passed`), `npm run lint`, `npm run build`, and `git diff --check`. The
  frontend build retained the known CSS optimizer warning about `m-* utility`.
- Pushed hosted commit `c68d448 refactor: align workos auth boundary` to
  `origin/codex/workos-authkit-api-foundation` and fast-forwarded hosted
  `main` to exact commit `c68d448d87e7d3ffb6f1a239129b1885adf35641`.
- Deployed the hosted frontend to Vercel production. Vercel produced
  `https://codealmanac-hosted-qejqttlne-thealmanac.vercel.app`, reported it
  ready as deployment `dpl_FNMruMmwmmv2d9xzk7eYkEErsb5j`, and aliased it to
  `https://www.codealmanac.com`.
- Render auto-deployed service `srv-d8g8nb37uimc739vnnsg` at exact hosted
  commit `c68d448d87e7d3ffb6f1a239129b1885adf35641`; deploy
  `dep-d93a2c6k1jcs73ab8qg0` finished `live`.
- Verified production smoke: `https://www.codealmanac.com` returned HTTP 200,
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`, and unauthenticated `GET /api/capture/status` returned
  `401 not_authenticated`.
- Recorded progress as: CodeAlmanac backend/local 95%, CLI/public UX 91%,
  CodeAlmanac-hosted backend/auth/API 94%, hosted frontend/onboarding 60%, and
  infra/deploy rename 89%.
- Planned Slice 47 in
  `docs/plans/2026-07-02-slice-47-repository-setup-summary.md`.
- Added browser-authenticated hosted `GET /api/capture/status`, returning
  `CaptureStatusDTO` without raw capture token material.
- Added frontend `getCaptureStatus()` and the repository setup summary on the
  repository settings page.
- The setup summary renders GitHub App access, repository access, capture
  credential state, maintained branch trigger count, and delivery readiness
  from real backend DTOs.
- Verified Slice 47 with hosted focused backend tests
  (`15 passed, 1 warning`), full hosted backend tests
  (`356 passed, 1 warning`), backend `uv run ruff check .`, backend
  `uv run python -m compileall src modal_app -q`, hosted frontend route tests
  (`27 passed`), hosted frontend component tests (`52 passed`),
  `npm run lint`, `npm run build`, and `git diff --check`. The frontend build
  retained the known CSS optimizer warning about `m-* utility`.
- Pushed hosted commit `2102d38 feat: add repository setup summary` to
  `origin/codex/workos-authkit-api-foundation` and fast-forwarded hosted
  `main` to exact commit `2102d38d17f66c32fb2e68a30ae9ddb3a1f8a34c`.
- Deployed the hosted frontend to Vercel production. Vercel produced
  `https://codealmanac-hosted-3wf3uccd1-thealmanac.vercel.app`, reported it
  ready as deployment `dpl_DmcaJnx2j1vLBfFHuWFaiCDzUgax`, and aliased it to
  `https://www.codealmanac.com`.
- Render auto-deployed service `srv-d8g8nb37uimc739vnnsg` at exact hosted
  commit `2102d38d17f66c32fb2e68a30ae9ddb3a1f8a34c`; deploy
  `dep-d939qpbtqb8s73fg7c9g` finished `live`.
- Verified production smoke: `https://www.codealmanac.com` returned HTTP 200,
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`, and unauthenticated `GET /api/capture/status` returned
  `401 not_authenticated`, proving the browser capture-status route is mounted.
- Recorded progress as: CodeAlmanac backend/local 95%, CLI/public UX 91%,
  CodeAlmanac-hosted backend/auth/API 93%, hosted frontend/onboarding 60%, and
  infra/deploy rename 88%.
- Recorded the stricter launch steering rule: trusted public provider
  libraries and documented APIs should be used instead of parallel hand-rolled
  paths unless a provider gap is documented.
- Planned Slice 46 in
  `docs/plans/2026-07-02-slice-46-dashboard-run-actions.md`.
- Added hosted dashboard run actions for repository activity rows.
- Added `frontend/src/components/runs/run-actions.ts` so run-status action
  policy has one source: `queued` and `running` show Cancel; `failed`, `stale`,
  and `cancelled` show Retry; `delivered` stays read-only.
- Updated `RunRow` to render icon+text action buttons, pending copy, disabled
  state, and inline row errors.
- Updated `RunsList` to call the existing BFF `cancelRun` and `retryRun`
  commands, replace cancelled rows, insert/upsert retried runs at the top, and
  preserve the existing active-run polling behavior.
- Reused the shared `actionErrorMessage` helper so backend `ApiError` messages
  show while generic exception details stay hidden.
- Verified Slice 46 with hosted frontend route tests (`27 passed`), frontend
  component tests (`50 passed`), `npm run lint`, `npm run build`, and
  `git diff --check`. The frontend build retained the known CSS optimizer
  warning about `m-* utility`.
- Pushed hosted commit `7b35cc9 feat: add dashboard run actions` to
  `origin/codex/workos-authkit-api-foundation` and fast-forwarded hosted
  `main` to the same commit.
- Deployed the hosted frontend to Vercel production. Vercel produced
  `https://codealmanac-hosted-arnwuqgyo-thealmanac.vercel.app`, reported it
  ready as deployment `dpl_7D22Df6y4Q1D5MM8eqLHnnf2Qekx`, and aliased it to
  `https://www.codealmanac.com`.
- Render auto-deployed service `srv-d8g8nb37uimc739vnnsg` at exact hosted
  commit `7b35cc96b4afbacce376bfb4f0feca253b8d44e0`; deploy
  `dep-d939m5cm0tmc73avfu50` finished `live`.
- Verified production smoke: `https://www.codealmanac.com` returned HTTP 200
  and `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`.
- Recorded progress as: CodeAlmanac backend/local 95%, CLI/public UX 91%,
  CodeAlmanac-hosted backend/auth/API 92%, hosted frontend/onboarding 52%, and
  infra/deploy rename 86%.
- Planned Slice 45 in
  `docs/plans/2026-07-02-slice-45-cloud-run-retry.md`.
- Added hosted `UpdateRetry` and `Updates.retry_run(...)`.
- Added hosted CLI-token and browser-session retry routes:
  `POST /v1/runs/{run_id}/retry` and `POST /api/runs/{run_id}/retry`.
- Retry creates a new run instead of mutating the original terminal run,
  accepts `failed`, `stale`, and `cancelled`, rejects active and already
  delivered runs, refreshes the current GitHub head, and preserves conversation
  batch `source_refs` by reference.
- Added browser BFF/server helpers and gateway allowlist support for
  `/api/dashboard/runs/<uuid>/retry`.
- Added CodeAlmanac `codealmanac runs retry <run-id>`, backed by the stored CLI
  token and cloud `/v1/runs/{run_id}/retry` route.
- Verified Slice 45 focused hosted gates with backend update/API tests
  (`61 passed, 1 warning`), frontend route tests (`27 passed`), and frontend
  component tests (`44 passed`).
- Verified Slice 45 full/hygiene gates with hosted backend `uv run pytest -q`
  (`355 passed, 1 warning`), hosted backend `uv run ruff check .`, hosted
  backend `uv run python -m compileall src modal_app -q`, CodeAlmanac
  `uv run pytest -q` (`496 passed`), CodeAlmanac focused cloud-runs/CLI tests
  (`123 passed`), CodeAlmanac `uv run ruff check .`, CodeAlmanac
  `uv run python -m compileall src -q`, hosted frontend `npm run test:routes`,
  `npm run test:frontend`, `npm run lint`, `npm run build`, and both
  `git diff --check` commands. The frontend build retained the known CSS
  optimizer warning about `m-* utility`.
- Pushed hosted commit `b3535cd feat: retry cloud update runs` to
  `origin/codex/workos-authkit-api-foundation` and fast-forwarded hosted
  `main` to the same commit.
- Pushed CodeAlmanac commit `af7953c6 feat: retry cloud runs from CLI` to
  `origin/dev`.
- Deployed the hosted frontend to Vercel production. Vercel produced
  `https://codealmanac-hosted-g97a69ujf-thealmanac.vercel.app` and aliased it
  to `https://www.codealmanac.com`.
- Render auto-deployed service `srv-d8g8nb37uimc739vnnsg` at exact hosted
  commit `b3535cdfda2cec1633be05fafd0ffd1ec7440e0b`; deploy
  `dep-d939gveq1p3s73d1dt30` finished `live`.
- Verified production smoke: `https://www.codealmanac.com` returned HTTP 200,
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`, and unauthenticated
  `POST /v1/runs/00000000-0000-0000-0000-000000000000/retry` returned the
  expected `401 not_authenticated`, proving the retry route is live.
- Sent the Slice 45 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 95%, CLI/public UX 91%,
  CodeAlmanac-hosted backend/auth/API 92%, hosted frontend/onboarding 44%, and
  infra/deploy rename 84%.
- Planned Slice 44 in
  `docs/plans/2026-07-02-slice-44-cloud-run-cancel.md`.
- Added hosted `RunStatus.CANCELLED`, `UpdatesStore.mark_cancelled(...)`,
  `UpdateCancellation`, and `Updates.cancel_run(...)`.
- Added Modal worker cancellation through
  `modal.FunctionCall.from_id(call_id).cancel(terminate_containers=False)`.
- Added browser and CLI-token cancellation routes:
  `POST /api/runs/{run_id}/cancel` and `POST /v1/runs/{run_id}/cancel`.
- Added typed `RunCancelled` events and GitHub Checks fanout with conclusion
  `cancelled`.
- Updated hosted frontend DTO/status metadata and the BFF gateway so cancelled
  runs render cleanly and browser clients can call
  `POST /api/dashboard/runs/<uuid>/cancel`.
- Added CodeAlmanac `codealmanac runs cancel <run-id>`, backed by the stored
  CLI token and the cloud `/v1/runs/{run_id}/cancel` route.
- Verified Slice 44 focused hosted gates with backend cancellation/event/check
  tests (`75 passed, 1 warning`), frontend route tests (`27 passed`), and
  frontend component tests (`44 passed`).
- Verified Slice 44 full/hygiene gates with hosted backend `uv run pytest -q`
  (`348 passed, 1 warning`), hosted backend `uv run ruff check .`, hosted
  backend `uv run python -m compileall src modal_app -q`, CodeAlmanac
  `uv run pytest -q` (`496 passed`), CodeAlmanac `uv run ruff check .`,
  CodeAlmanac `uv run python -m compileall src -q`, hosted frontend
  `npm run lint`, hosted frontend `npm run build`, and both `git diff --check`
  commands. The frontend build retained the known CSS optimizer warning about
  `m-* utility`.
- Recorded progress as: CodeAlmanac backend/local 95%, CLI/public UX 90%,
  CodeAlmanac-hosted backend/auth/API 90%, hosted frontend/onboarding 43%, and
  infra/deploy rename 72%.
- Pushed hosted commit `0e17a34 feat: cancel cloud update runs` to
  `origin/codex/workos-authkit-api-foundation`.
- Fast-forwarded hosted `main` from `3010001` to `0e17a34` so Render's normal
  branch tracking points at the launch code instead of an older baseline.
- Pushed CodeAlmanac commit `a7cbc7d5 feat: cancel cloud runs from CLI` to
  `origin/dev`.
- Deployed the hosted frontend to Vercel production. Vercel produced
  `https://codealmanac-hosted-ce944e0r5-thealmanac.vercel.app` and aliased it
  to `https://www.codealmanac.com`.
- Deployed Render service `srv-d8g8nb37uimc739vnnsg` at exact hosted commit
  `0e17a34c56be5e839e01a163bb2ca4ef8cc46fd7`; final auto-deploy
  `dep-d93997dosiuc73cd9fig` finished `live`.
- Verified production smoke: `https://www.codealmanac.com` returned HTTP 200,
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`, and unauthenticated
  `POST /v1/runs/00000000-0000-0000-0000-000000000000/cancel` returned the
  expected `401 not_authenticated`, proving the cancel route is live.
- Sent the Slice 44 RelayForge update and recorded deploy-adjusted progress as:
  CodeAlmanac backend/local 95%, CLI/public UX 90%,
  CodeAlmanac-hosted backend/auth/API 90%, hosted frontend/onboarding 43%, and
  infra/deploy rename 82%.
- Planned Slice 43 in
  `docs/plans/2026-07-02-slice-43-cloud-setup-copy.md`.
- Verified the production GitHub App through the App API. App slug
  `almanac-bot` owned by `AlmanacCode` has `checks: write`, `contents: write`,
  and `pull_requests: write`, so Slice 42's Check Runs fanout has the required
  app permission.
- Updated hosted setup copy so `/dashboard/local-agent-access` presents a
  single command: `npx codealmanac@latest setup`.
- Removed the outdated `almanac login` quickstart from hosted browser
  onboarding. Setup copy now says setup signs in through the browser, connects
  the machine to cloud, and asks before installing Claude/Codex capture.
- Updated `/cli-login` error/success copy to use `codealmanac login` and
  `CodeAlmanac CLI`.
- Updated the GitHub App install prompt and repository access copy to say
  `CodeAlmanac` where the setup flow is naming the hosted product.
- Verified Slice 43 frontend gates with `npm run test:routes` (`27 passed`),
  `npm run test:frontend` (`44 passed`), `npm run lint`, `npm run build`, and
  `git diff --check`. The build retained the known CSS optimizer warning about
  `m-* utility`.
- Pushed hosted commit `eafe60c feat: align cloud setup copy` to
  `origin/codex/workos-authkit-api-foundation`.
- Deployed the hosted frontend to Vercel production. Vercel produced
  `https://codealmanac-hosted-2ld7otxqz-thealmanac.vercel.app` and aliased it
  to `https://www.codealmanac.com`.
- Verified production smoke: `https://www.codealmanac.com` returned HTTP 200.
- Recorded progress as: CodeAlmanac backend/local 95%, CLI/public UX 88%,
  CodeAlmanac-hosted backend/auth/API 88%, hosted frontend/onboarding 42%, and
  infra/deploy rename 72%.
- Planned Slice 42 in
  `docs/plans/2026-07-02-slice-42-github-check-fanout.md`.
- Added hosted typed GitHub Check Run models, resource adapter, and `checks`
  capability under `backend/src/almanac/integrations/github/`.
- Added `GitHubChecksFanout` under `backend/src/almanac/wiring/fanout/`.
  It subscribes to `RunDelivered`, `RunFailed`, and `RunStale` without adding
  GitHub provider logic to the update service.
- Terminal check conclusions are deterministic: delivered runs with wiki file
  changes publish `success`, delivered runs with no wiki changes publish
  `neutral`, failed runs publish `failure`, and stale-head runs publish
  `action_required`.
- Check details URLs point to the existing hosted repository activity page:
  `/dashboard/accounts/<account-id>/repositories/<repo-id>`.
- Pushed hosted commit `97564f7 feat: publish terminal run checks` to
  `origin/codex/workos-authkit-api-foundation`.
- Deployed Render service `srv-d8g8nb37uimc739vnnsg` at exact hosted commit
  `97564f7ea00c74614f8c45c081430e73bbd38090`; deploy
  `dep-d938q30js32c73eqj80g` finished `live`.
- Verified backend production smoke:
  `https://codealmanac-backend-docker.onrender.com/api/health` returned HTTP
  200 with `{"status":"ok"}`.
- Verified Slice 42 focused backend gate with
  `uv run pytest tests/test_github_checks_contract.py
  tests/test_github_checks_fanout.py tests/test_events_contract.py
  tests/test_updates_contract.py tests/test_architecture_contract.py -q`
  (`114 passed`).
- Verified Slice 42 hosted backend full/hygiene gates with
  `uv run pytest -q` (`340 passed, 1 warning`), `uv run ruff check .`,
  `uv run python -m compileall src modal_app -q`, and `git diff --check`.
- Recorded progress as: CodeAlmanac backend/local 95%, CLI/public UX 87%,
  CodeAlmanac-hosted backend/auth/API 88%, hosted frontend/onboarding 35%, and
  infra/deploy rename 70%.
- Planned Slice 41 in
  `docs/plans/2026-07-02-slice-41-hosted-rename-provider-convergence.md`.
- Updated active hosted identity references from `usealmanac` to
  `codealmanac-hosted` in `CLAUDE.md`, `MANUAL.md`, FastAPI app metadata,
  logger names, event-dispatch session keys, frontend support defaults, and the
  clean-slate Supabase migration comment.
- Renamed Vercel project `prj_sBOdSIF82roDGnkFeYrh5qdg6epp` from
  `thealmanac/usealmanac` to `thealmanac/codealmanac-hosted` through Vercel's
  documented project update API.
- Linked the clean hosted frontend checkout to `thealmanac/codealmanac-hosted`
  for production deployment commands.
- Pushed hosted commit `a781e51 chore: align hosted product identity` to
  `origin/codex/workos-authkit-api-foundation`.
- Deployed the hosted frontend to Vercel production. Vercel produced
  `https://codealmanac-hosted-lasush9ur-thealmanac.vercel.app` and aliased it
  to `https://www.codealmanac.com`.
- Deployed Render service `srv-d8g8nb37uimc739vnnsg` at exact hosted commit
  `a781e5189da4403bcf8b31d7fb9129b3779aec01`; deploy
  `dep-d938j4km0tmc73d6p3sg` finished `live`.
- Verified production smoke: `https://www.codealmanac.com` returned HTTP 200
  and `https://codealmanac-backend-docker.onrender.com/api/health` returned
  HTTP 200 with `{"status":"ok"}`.
- Verified provider state: GitHub repo `AlmanacCode/codealmanac-hosted`,
  Vercel project `thealmanac/codealmanac-hosted`, Render service
  `codealmanac-backend`, Doppler project `codealmanac`, Modal app
  `codealmanac-hosted-updates`, PostHog CLI API availability, and Autumn
  billing via `make billing-verify`.
- Direct `npm run billing:verify` failed without `AUTUMN_SECRET_KEY`; rerunning
  through `make billing-verify` passed for free, pro, and scale plans.
- Verified Slice 41 backend gates with focused pytest (`85 passed`), full
  pytest (`334 passed, 1 warning`), `uv run ruff check .`,
  `uv run python -m compileall src modal_app -q`, and `git diff --check`.
- Verified Slice 41 frontend gates with `npm run test:routes` (`27 passed`),
  `npm run test:frontend` (`44 passed`), `npm run lint`, and `npm run build`.
  The build retained the known CSS optimizer warning about `m-* utility`.
- Recorded progress as: CodeAlmanac backend/local 95%, CLI/public UX 87%,
  CodeAlmanac-hosted backend/auth/API 86%, hosted frontend/onboarding 35%, and
  infra/deploy rename 70%.
- Planned Slice 38 in
  `docs/plans/2026-07-02-slice-38-cloud-open-handoff.md`.
- Added hosted browser-session repository resolution:
  `POST /api/repositories/resolve`.
- Added hosted redirector routes:
  `/wiki/github/[owner]/[repo]` and `/setup/repo`.
- Added frontend route builders for CLI-opened cloud URLs while preserving the
  existing account-scoped dashboard routes.
- Added CodeAlmanac `CloudOpenWorkflow`, `DEFAULT_CLOUD_APP_URL`, and URL
  construction for wiki, repo activity, setup, settings, direct GitHub, and
  GitHub App targets.
- Added public browser-handoff commands:
  `codealmanac`, `codealmanac open`, `codealmanac repo setup`, and
  `codealmanac repo open [activity|settings|github|github-app]`.
- Verified Slice 38 focused hosted backend gate with
  `uv run pytest tests/test_repositories_api_contract.py
  tests/test_cli_repositories_api_contract.py -q` (`13 passed, 1 warning`).
- Verified Slice 38 hosted route gate with `npm run test:routes`
  (`27 passed`).
- Verified Slice 38 focused CodeAlmanac gate with
  `uv run pytest tests/test_cloud_open_workflow.py tests/test_cli.py
  tests/test_architecture.py -q` (`125 passed`).
- Verified Slice 38 CodeAlmanac full/hygiene gates with
  `uv run pytest -q` (`496 passed`), `uv run ruff check .`,
  `uv run python -m compileall src -q`, and `git diff --check`.
- Verified Slice 38 hosted backend full/hygiene gates with
  `uv run pytest -q` (`327 passed, 1 warning`), `uv run ruff check .`,
  `uv run python -m compileall src modal_app -q`, and `git diff --check`.
- Verified Slice 38 hosted frontend gates with `npm run lint`,
  `npm run test:frontend` (`44 passed`), and `npm run build`. Build passed
  with the known CSS optimizer warning about `m-* utility`.
- Pushed hosted commit `ed7e765 feat: add cloud route handoff` to
  `origin/codex/workos-authkit-api-foundation`.
- Pushed CodeAlmanac commit `117b36db feat: open cloud pages from CLI` to
  `origin/dev`.
- Sent the Slice 38 RelayForge update with progress as:
  CodeAlmanac backend/local 95%, CLI/public UX 84%,
  CodeAlmanac-hosted backend/auth/API 81%, hosted frontend/onboarding 35%, and
  infra/deploy rename 15%.
- Planned Slice 37 in
  `docs/plans/2026-07-02-slice-37-cloud-runs-cli.md`.
- Added hosted CLI run read routes:
  `GET /v1/repositories/{repo_id}/runs`, `GET /v1/runs/{run_id}`, and
  `GET /v1/runs/{run_id}/events`.
- Added CodeAlmanac `cloud_runs` service, typed cloud run/run-event models,
  HTTP adapter methods, and cloud run workflow.
- Added public cloud run commands:
  `codealmanac runs list`, `codealmanac runs show <run-id>`, and
  `codealmanac runs logs <run-id>`.
- Verified Slice 37 focused hosted backend gate with
  `uv run pytest tests/test_cli_runs_api_contract.py
  tests/test_repositories_api_contract.py tests/test_updates_contract.py -q`
  (`40 passed, 1 warning`).
- Verified Slice 37 focused CodeAlmanac gate with
  `uv run pytest tests/test_cloud_runs_service.py
  tests/test_cloud_runs_workflow.py tests/test_cli.py tests/test_architecture.py -q`
  (`121 passed`).
- Verified Slice 37 CodeAlmanac hygiene with `uv run ruff check .` and
  `uv run python -m compileall src -q`.
- Verified Slice 37 hosted backend hygiene with `uv run ruff check .`,
  `uv run python -m compileall src modal_app -q`, and `git diff --check`.
- Verified Slice 37 full gates with CodeAlmanac `uv run pytest -q`
  (`490 passed`) and hosted backend `uv run pytest -q`
  (`326 passed, 1 warning`).
- Pushed hosted commit `168f9b2 feat: add CLI run read routes` to
  `origin/codex/workos-authkit-api-foundation`.
- Pushed CodeAlmanac commit `bc177cf2 feat: inspect cloud runs from CLI` to
  `origin/dev`.
- Sent the Slice 37 RelayForge update with progress as:
  CodeAlmanac backend/local 94%, CLI/public UX 78%,
  CodeAlmanac-hosted backend/auth/API 80%, hosted frontend/onboarding 28%, and
  infra/deploy rename 15%.
- Planned Slice 36 in
  `docs/plans/2026-07-02-slice-36-cloud-repo-trigger-cli.md`.
- Added hosted CLI repository routes:
  `POST /v1/repositories/resolve`,
  `GET /v1/repositories/{repo_id}/triggers`, and
  `PUT /v1/repositories/{repo_id}/triggers`.
- Added direct repo-id trigger policy service methods for CLI-token routes.
  Browser routes remain account-scoped.
- Added CodeAlmanac `cloud_repositories` service, typed cloud repository
  models, HTTP adapter methods, and current-checkout cloud repo workflow.
- Added public cloud repo commands:
  `codealmanac repo status`,
  `codealmanac repo triggers list`,
  `codealmanac repo triggers enable <branch> --delivery pr|commit`,
  `codealmanac repo triggers disable <branch>`, and
  `codealmanac repo delivery set --branch <branch> --mode pr|commit`.
- Verified Slice 36 focused hosted backend gate with
  `uv run pytest tests/test_cli_repositories_api_contract.py
  tests/test_repositories_api_contract.py tests/test_repositories_contract.py -q`
  (`23 passed, 1 warning`).
- Verified Slice 36 focused CodeAlmanac gate with
  `uv run pytest tests/test_cloud_repositories_service.py
  tests/test_cloud_repo_workflow.py tests/test_cli.py -q` (`57 passed`).
- Verified Slice 36 CodeAlmanac hygiene/full gates with
  `uv run ruff check .`, touched-file `uv run ruff format --check ...`,
  `uv run python -m compileall src -q`, `uv run pytest -q`
  (`487 passed`), and `git diff --check`.
- Verified Slice 36 hosted backend hygiene/full gates with
  `uv run ruff check .`, touched-file `uv run ruff format --check ...`,
  `uv run python -m compileall src modal_app -q`, `uv run pytest -q`
  (`324 passed, 1 warning`), and `git diff --check`.
- Pushed hosted commit
  `fbf8b5a feat: add CLI repository trigger routes` to
  `origin/codex/workos-authkit-api-foundation`.
- Pushed CodeAlmanac commit
  `8ca50e0f feat: mirror cloud repository triggers in CLI` to `origin/dev`.
- Sent the Slice 36 RelayForge update with progress as:
  CodeAlmanac backend/local 93%, CLI/public UX 72%,
  CodeAlmanac-hosted backend/auth/API 78%, hosted frontend/onboarding 28%, and
  infra/deploy rename 15%.
- Planned Slice 35 in
  `docs/plans/2026-07-02-slice-35-hosted-trigger-policies.md`.
- Added hosted `repository_trigger_policies`, keyed by `(repo_id, branch)`,
  with `enabled` and cloud delivery mode `commit|pr`.
- Added backend `RepositoryTriggerPolicy` models, table/store/service methods,
  API DTOs, and account-scoped routes:
  `GET /api/accounts/{account_id}/repositories/{repo_id}/triggers` and
  `PUT /api/accounts/{account_id}/repositories/{repo_id}/triggers`.
- Added branch-push update planning from normalized GitHub `BranchPushed`
  events. A branch push starts an update only when the branch has an enabled
  trigger policy.
- Added deterministic policy-based branch delivery:
  `commit` creates `CommitToBranch`; `pr` creates `OpenWikiPullRequest`.
- Added the repository settings branch trigger UI. It reads real GitHub branch
  DTOs, shows saved trigger policies, lets users toggle maintained branches,
  and chooses commit vs PR delivery per branch.
- Fixed the Atlas design-lab mock status metadata to include `stale`, which was
  required for production TypeScript build after Slice 33.
- Verified Slice 35 focused backend gate with
  `uv run pytest tests/test_repositories_contract.py
  tests/test_repositories_api_contract.py tests/test_updates_contract.py
  tests/test_architecture_contract.py -q` (`118 passed, 1 warning`).
- Verified Slice 35 hosted frontend gates with `npm run test:frontend`
  (`44 passed`), `npm run test:routes` (`26 passed`), `npm run lint`, and
  `npm run build`. Build passed with the known CSS optimizer warning about
  `m-* utility`.
- Verified Slice 35 hosted backend hygiene/full gates with
  `uv run ruff check .`, `uv run ruff format --check .`,
  `python -m compileall src modal_app -q`, `uv run pytest -q`
  (`320 passed, 1 warning`), and `git diff --check`.
- Pushed hosted commit
  `1b00b63 feat: add repository trigger policies` to
  `origin/codex/workos-authkit-api-foundation`.
- Planned Slice 34 in
  `docs/plans/2026-07-02-slice-34-hosted-run-event-visibility.md`.
- Added hosted `RunEventDTO` and
  `GET /api/runs/{run_id}/events`.
- Added `Updates.run_events_for_user(...)` and
  `UpdateQueries.run_events_for_user(...)`, authorizing access through the
  run's repository before returning ordered events.
- Added frontend `RunEventDTO` parity, `listRunEvents(runId)`, and the
  BFF allowlist path `GET /api/dashboard/runs/<uuid>/events`.
- Added lazy dashboard run-event loading through an expandable `RunRow`
  timeline that renders event kind, relative time, message, and normalized
  payload fields.
- Verified Slice 34 focused hosted backend gate with
  `uv run pytest tests/test_updates_contract.py
  tests/test_repositories_api_contract.py tests/test_update_run_events_contract.py -q`
  (`35 passed, 1 warning`).
- Verified Slice 34 hosted frontend gates with `npm run test:frontend`
  (`43 passed`), `npm run test:routes` (`26 passed`), and `npm run lint`.
- Verified Slice 34 hosted hygiene/full backend gates with
  `uv run ruff check .`, `uv run ruff format --check .`,
  `python -m compileall src modal_app -q`, `uv run pytest -q`
  (`312 passed, 1 warning`), and `git diff --check`.
- Pushed hosted commit
  `4e4c94b feat: expose run event timeline` to
  `origin/codex/workos-authkit-api-foundation`.
- Planned Slice 33 in
  `docs/plans/2026-07-02-slice-33-hosted-delivery-stale-outcome.md`.
- Added hosted `RunStatus.STALE` and `UpdateResult.stale(...)` for runs whose
  target branch moved before delivery.
- Replaced raw GitHub commit-head drift `ValueError` with typed
  `GitHubBranchHeadChanged`.
- Added product-level `StaleDelivery` in hosted delivery, with preflight branch
  head checks for `CommitToBranch` and `OpenWikiPullRequest`, while keeping the
  commit-time expected-head check as defense in depth.
- Added `UpdatesStore.mark_stale(...)`, storing terminal stale run state,
  stale reason, finished timestamp, and a `run_events` status payload with
  expected and actual head SHAs.
- Made completion catch stale delivery, skip billing and `RunDelivered`
  dispatch, and clear conversation ingest state with a stale status.
- Added backend/API/frontend status parity for `stale`, including run DTOs,
  conversation source summaries, frontend DTOs, status labels, and status icon
  rendering.
- Verified Slice 33 focused hosted backend gate with
  `uv run pytest tests/test_updates_contract.py
  tests/test_update_run_events_contract.py tests/test_github_git_contract.py
  tests/test_repositories_api_contract.py -q` (`38 passed, 1 warning`).
- Verified Slice 33 frontend status gates with `npm run test:frontend`
  (`41 passed`) and `npm run test:routes` (`26 passed`).
- Verified Slice 33 hosted hygiene/full backend gates with
  `uv run ruff check .`, `uv run ruff format --check .`,
  `python -m compileall src modal_app -q`, `git diff --check`, `npm run lint`,
  and `uv run pytest -q` (`311 passed, 1 warning`).
- Pushed hosted commit
  `9098b65 feat: record stale delivery outcomes` to
  `origin/codex/workos-authkit-api-foundation`.
- Planned Slice 32 in
  `docs/plans/2026-07-02-slice-32-hosted-run-events.md`.
- Added hosted SQL-backed `run_events` with ordered `(run_id, sequence)`
  storage, event kind, message, timestamp, and optional normalized
  `payload_json`.
- Added hosted `RunEventKind` and `RunEvent` models, `RunEventRow`, and
  `run_event_from_row`.
- Wired `UpdatesStore` transitions to append lifecycle status events for
  queued, running, delivered, and failed runs in the same transaction as the
  run status update.
- Kept event payloads limited to metadata such as `worker_call_id`,
  `commit_sha`, `files_changed`, `summary`, and `error`; source and model
  transcript bodies still stay out of run events.
- Added `run_events` to the launch Supabase init migration.
- Verified Slice 32 focused hosted gate with
  `uv run pytest tests/test_update_run_events_contract.py tests/test_updates_contract.py tests/test_architecture_contract.py -q`
  (`93 passed`), `uv run ruff check .`, `uv run ruff format --check .`, and
  `git diff --check`.
- Verified hosted compile/full backend gates with
  `python -m compileall backend/src backend/modal_app -q` and
  `uv run pytest -q` (`306 passed, 1 warning`).
- Pushed hosted commit
  `12cfc08 feat: persist hosted run events` to
  `origin/codex/workos-authkit-api-foundation`.
- Planned Slice 31 in
  `docs/plans/2026-07-02-slice-31-hosted-direct-maintenance-api.md`.
- Added `codealmanac.maintenance` as the package API for non-CLI callers.
  It routes typed `init` and `ingest` maintenance requests into the existing
  CodeAlmanac workflows and returns run id, run status, harness status,
  summary, and output text.
- Verified the local maintenance API with
  `uv run pytest tests/test_maintenance_api.py tests/test_public_contract.py tests/test_architecture.py -q`
  (`91 passed`), `uv run ruff check .`, and `git diff --check`.
- Verified the full CodeAlmanac suite with `uv run pytest -q`
  (`484 passed`).
- Pushed CodeAlmanac commit
  `f20e928d feat: expose maintenance package api` to `origin/dev`.
- Replaced the hosted Modal worker's public-CLI subprocess bridge with
  `backend/modal_app/codealmanac_engine.py`, which maps hosted
  `PullRequestSource`, `ConversationBatchSource`, and `BranchSource` runs to
  `codealmanac.maintenance` requests.
- Deleted the hosted `backend/src/almanac/services/updates/codealmanac.py`
  command builder. The production update worker no longer imports
  `modal_app.commands`, `run_command`, or `codealmanac_command`.
- Updated the hosted Modal image `CODEALMANAC_GIT_REF` to
  `f20e928d5a62a1bb8b45ad670b90eac000011444`.
- Verified the hosted focused gate with
  `uv run pytest tests/test_modal_worker_contract.py tests/test_architecture_contract.py -q`
  (`81 passed`), `uv run ruff check .`, `uv run ruff format --check .`, and
  `git diff --check`.
- Verified hosted compile/full backend gates with
  `python -m compileall backend/src backend/modal_app -q` and
  `uv run pytest -q` (`303 passed, 1 warning`).
- Pushed hosted commit
  `51c2cb2 feat: call codealmanac maintenance api` to
  `origin/codex/workos-authkit-api-foundation`.
- Planned Slice 30 in
  `docs/plans/2026-07-02-slice-30-cloud-source-bundle-materialization.md`.
- Changed hosted conversation-batch update runs to store source artifact refs,
  not rendered conversation text, in `ConversationBatchSource`.
- Added hosted source-artifact reads through the service/store port and
  protected internal route:
  `GET /api/internal/source-artifacts?ref=...`.
- Changed the hosted conversation ingest scheduler to select only captured
  turns with non-null `source_ref` values and to schedule ingest when capture
  uploads a completed routable turn with a source ref.
- Added Modal worker source materialization:
  `.codealmanac-worker/sources/<batch-id>/manifest.json` plus
  `sessions/<provider>/<provider-session-id>-<hash>.jsonl`.
- Updated hosted worker command construction to use the current Python
  CodeAlmanac maintenance surfaces:
  `codealmanac dev ingest <sources-dir> --foreground --using codex`,
  `codealmanac dev ingest github:pr:<n> --foreground --using codex`, and
  `codealmanac init --using codex --yes`.
- Changed the Modal image to install Python CodeAlmanac from a pinned git ref
  instead of installing the old npm `codealmanac@latest` package.
- Kept the hosted worker on a process bridge for this slice. The next worker
  slice should replace the process command with a direct Python engine/model API
  call.
- Verified Slice 30 focused hosted backend gates with
  `uv run pytest tests/test_conversation_ingest_scheduler.py
  tests/test_capture_upload_api_contract.py tests/test_internal_route_contract.py
  tests/test_modal_worker_contract.py tests/test_updates_contract.py
  tests/test_architecture_contract.py -q` (`119 passed, 1 warning`).
- Verified Slice 30 full hosted backend with `uv run pytest -q`
  (`301 passed, 1 warning`).
- Verified Slice 30 hosted lint/format/diff gates with `uv run ruff check .`,
  `uv run ruff format --check .`, and `git diff --check`.
- Planned Slice 29 in
  `docs/plans/2026-07-02-slice-29-capture-transcript-upload.md`.
- Added hosted source-artifact service seam with a filesystem-backed
  development store and `source-artifacts://...` refs.
- Added hosted capture upload routes:
  `POST /v1/capture/artifacts` and `POST /v1/capture/turns`.
- Added `conversation_sources.source_ref` and migration
  `20260702000000_conversation_source_refs.sql`.
- Added local transcript normalization for Codex and Claude hook payloads,
  including deterministic fallback turn IDs.
- Extended `codealmanac __capture-hook --provider codex|claude` to upload raw
  transcript artifacts with the stored `cap_...` credential, then upload
  normalized turn metadata with `artifactRef`.
- Kept the old inline-message conversation ingest scheduler unchanged. The
  capture-token path stores refs and metadata but does not enqueue empty
  message-based ingest runs in this slice.
- Verified Slice 29 focused hosted backend gates with
  `uv run pytest tests/test_capture_tokens_api_contract.py
  tests/test_capture_upload_api_contract.py
  tests/test_hosted_conversation_sync_contract.py
  tests/test_conversation_ingest_scheduler.py
  tests/test_architecture_contract.py -q` (`88 passed, 1 warning`) and
  `uv run ruff check .`.
- Verified Slice 29 focused local gates with
  `uv run pytest tests/test_capture_transcript_upload.py
  tests/test_cloud_capture_service.py tests/test_cli.py tests/test_public_contract.py
  tests/test_architecture.py -q` (`147 passed`) and `uv run ruff check .`.
- Planned Slice 28 in
  `docs/plans/2026-07-02-slice-28-cloud-capture-install.md`.
- Added hosted `capture_tokens` service/store/table boundary and `/v1`
  capture credential routes:
  `POST /v1/capture/credentials`, `GET /v1/capture/status`, and
  `POST /v1/capture/credentials/revoke`.
- Added hosted `cap_...` capture tokens hashed at rest and separated from
  `alm_...` CLI tokens. Issue/status/revoke use the CLI token; future upload
  endpoints use the capture token.
- Pushed hosted commit `36211ba feat: add capture credential API` to
  `origin/codex/workos-authkit-api-foundation`.
- Added matching frontend capture DTO declarations so hosted backend/frontend
  DTO names and fields stay mirrored.
- Added local `~/.codealmanac/capture.json` mode `0600` and
  `~/.codealmanac/capture-events/events.jsonl` diagnostic event storage.
- Added public cloud capture commands:
  `codealmanac capture status`, `codealmanac capture enable`,
  `codealmanac capture repair`, and `codealmanac capture disable`.
- Added hidden hook entrypoint
  `codealmanac __capture-hook --provider codex|claude`.
- Added Codex and Claude Stop hook installation/removal under
  `~/.codex/hooks.json` and `~/.claude/settings.json`, preserving unrelated
  provider settings.
- Kept transcript parsing/upload and model runs out of Slice 28. Hooks only
  record local diagnostic events until Slice 29.
- Verified Slice 28 hosted backend with `uv run pytest -q` (`291 passed, 1
  warning`), `uv run ruff check .`, and `uv run ruff format --check .`.
- Verified Slice 28 hosted frontend with `npm run test:routes` (`26 passed`),
  `npm run test:frontend` (`41 passed`), and `npm run build`.
- `npm run build` still emits the known non-blocking CSS optimizer warning
  about a comment containing `m-* utility`.
- Verified Slice 28 `codealmanac` with `uv run pytest -q` (`477 passed`),
  `uv run ruff check .`, `git diff --check`, and help checks for
  `capture status`, `capture enable`, `capture repair`, and
  `capture disable`.
- Planned Slice 27 in
  `docs/plans/2026-07-02-slice-27-cloud-cli-auth.md`.
- Added hosted `/v1` CLI auth aliases over the existing CLI token service:
  `/v1/auth/cli/start`, `/v1/auth/cli/sessions/{session_id}`,
  `/v1/auth/cli/sessions/{session_id}/complete`,
  `/v1/auth/cli/sessions/{session_id}/poll`, `/v1/me`, and
  `/v1/auth/logout`.
- Added `codealmanac` cloud auth state, typed HTTP client, token store,
  browser opener port, and browser login workflow.
- Added public cloud identity commands:
  `codealmanac login`, `codealmanac whoami`, and `codealmanac logout`.
- Made `codealmanac setup` cloud-first and not repo-scoped; local-only setup
  remains under `codealmanac local setup`.
- Stored only the issued hosted CLI token in `~/.codealmanac/auth.json` with
  mode `0600`; WorkOS browser tokens are not stored by the local CLI.
- Verified Slice 27 hosted backend with `uv run pytest -q` (`289 passed`),
  `uv run ruff check .`, and `uv run ruff format --check .`.
- Verified Slice 27 `codealmanac` with `uv run pytest -q` (`474 passed`),
  `uv run ruff check .`, `git diff --check`, and help checks for
  `login`, `setup`, `whoami`, and `logout`.
- Created launch plan at
  `docs/plans/2026-07-02-codealmanac-cloud-local-launch.md`.
- Added CLI/onboarding launch note at
  `docs/hosted-local-live-agreement/cli-onboarding-launch-2026-07-02.md`.
- Recorded that launch is not an MVP/V1 shortcut plan.
- Recorded that `usealmanac` will become `codealmanac-hosted`.
- Recorded that the public CLI is not the worker API.
- Recorded that CLI auto-update should research existing libraries before
  custom implementation.
- Created `docs/codealmanac-launch/` as the steering folder for decisions,
  ownership, open questions, verification, and worklog.
- Added `deployment-rename-runbook.md` with GitHub, Vercel, Render, Modal,
  Supabase, Doppler, PostHog, and Autumn rename/deploy steps.
- Recorded that provider CLIs/APIs should be used where available.
- Recorded that Supabase migrations can be rewritten/collapsed/repaired because
  there are no external customers yet.
- Added `overnight-run-contract.md` to make infrastructure/deployment the first
  execution priority before deep product implementation.
- Checked local provider CLI availability: `gh`, `vercel`, `render`,
  `supabase`, `modal`, and `doppler` are present on PATH.
- Verified `atmn` works through `/Users/rohan/Desktop/Projects/usealmanac/frontend`
  with `npm exec -- atmn --version`.
- Verified official PostHog CLI help works through
  `npm exec --package @posthog/cli -- posthog-cli --help`; version command hit
  local spawn error `Unknown system error -88`.
- Added `schema-contract.md` as the single launch contract for local/cloud
  tables, run storage, source artifacts, run artifacts, and cloud-only tables.
- Audited session `019f1be2-83a2-7c03-bf18-f5adc681857d` against the launch
  folder.
- Added `cli-contract.md`, `frontend-surface-contract.md`, and
  `repo-organization.md` to close launch-folder coverage gaps found by the
  audit.
- Copied curated WorkOS research notes from `../almanac/docs/workos/` into
  `docs/codealmanac-launch/references/workos/`.
- Checked WorkOS local setup: `workos` CLI is not installed on PATH.
- Verified WorkOS CLI can run through
  `WORKOS_MODE=agent npx -y workos --help --json`.
- Checked Doppler secret names: `codealmanac` has no WorkOS secret names in
  `dev` or `prd`; older `almanac` has WorkOS secret names in `dev` and `prd`.
- Added `auth-api-contract.md` covering WorkOS/AuthKit, CLI login/token
  storage, capture credentials, public API, internal API, and rate limits.
- Confirmed callback targets:
  `https://codealmanac.com/auth/callback` and
  `http://localhost:3000/auth/callback`.
- Recorded that `codealmanac-hosted` is a rename/evolution of `usealmanac`, and
  the current frontend look and feel should be preserved while internals can be
  refactored.
- Recorded delivery defaults: cloud commit, local commit.
- Recorded worker/package defaults: hosted pins `codealmanac` by git SHA and
  workers call the engine/model API directly rather than the human CLI.
- Recorded that the WorkOS project is `codealmanac`.
- Recorded the source/engine rule: intelligence lives in prompts, and sources
  are passed by reference rather than value.
- Recorded the WorkOS environment rule: use one production environment for now,
  with no dev/staging/prod WorkOS split.
- Recorded the WorkOS GitHub OAuth decision: return provider OAuth tokens, keep
  the default OAuth scope at `user:email`, and use GitHub App installation
  tokens for repository work.
- Stored the new WorkOS `codealmanac` project credentials in Doppler configs
  `dev`, `dev_personal`, `stg`, and `prd` without recording secret values.
- Configured WorkOS redirects, CORS origins, and homepage URL for
  `codealmanac.com` and local `localhost:3000`.
- Removed stale copied `WORKOS_ISSUER` from the CodeAlmanac Doppler configs.
- Probed `codealmanac/prd` GitHub access for `rohans0509`: refreshed the stored
  GitHub App user token, confirmed empty OAuth scopes, listed visible app
  installations, listed installation repositories, checked org role, and checked
  repo permission.
- Copied the init first-build and prompt-restoration plan into the launch
  steering folder as the first local/Python prerequisite for the hosted worker
  path.
- Stopped Browser Use cloud login setup at user request. Browser automation for
  this launch uses the already-working local browser harness / Codex browser,
  not Browser Use cloud auth.
- Renamed the GitHub repository from `AlmanacCode/usealmanac` to
  `AlmanacCode/codealmanac-hosted` and updated the local `usealmanac` origin to
  `https://github.com/AlmanacCode/codealmanac-hosted.git`.
- Updated local hosted repo deploy/package names for the rename:
  `.github/workflows/deploy.yml`, `backend/modal_app/runtime.py`,
  `backend/src/almanac/settings.py`, `backend/pyproject.toml`,
  `backend/uv.lock`, `frontend/package.json`, `frontend/package-lock.json`, and
  local Vercel project metadata now point at `codealmanac-hosted` names.
- Verified the targeted Modal worker contract test passes:
  `cd ../usealmanac/backend && uv run pytest tests/test_modal_worker_contract.py`.
- Deployed Modal app `codealmanac-hosted-updates` in environment `main` with:
  `cd ../usealmanac/backend && PYTHONPATH=src uv run modal deploy modal_app/updates_worker.py --env main`.
- Verified Render service `codealmanac-backend` already points to
  `https://github.com/AlmanacCode/codealmanac-hosted` on branch `main`.
- Verified Vercel project `thealmanac/usealmanac` still has provider project
  name `usealmanac` while serving production URL `https://www.codealmanac.com`.
  The installed Vercel CLI exposes project list/inspect/add/remove/token but no
  project rename command.
- Repaired a frontend design-lab mock DTO that was missing
  `localAgentSetupIntroSeenAt`, which blocked `npm run build`.
- Verified the frontend builds with `cd ../usealmanac/frontend && npm run build`.
- Deployed the frontend to Vercel production with
  `cd ../usealmanac/frontend && vercel deploy --prod --scope thealmanac`.
  Vercel aliased the deployment to `https://www.codealmanac.com`.
- Verified `https://www.codealmanac.com` returns HTTP 200 and
  `https://codealmanac-backend-docker.onrender.com/api/health` returns
  `{"status":"ok"}`.
- Set `MODAL_APP_NAME=codealmanac-hosted-updates` in Doppler project
  `codealmanac`, config `prd`.
- Triggered Render deploy `dep-d930nheh2hms73d259s0` for service
  `codealmanac-backend`; it became live and `/api/health` returned
  `{"status":"ok"}` after deployment.
- Planned Slice 1 in
  `docs/plans/2026-07-02-slice-1-local-control-db.md`.
- Added the local control DB foundation in `codealmanac`:
  `~/.codealmanac/control.sqlite`, `AppConfig.control_db_path`,
  `app.control`, and `src/codealmanac/services/control/`.
- Added the launch control tables locally: `repositories`, `branches`,
  `sessions`, `turns`, `turn_branches`, `trigger_events`, `runs`,
  `run_events`, and `deliveries`.
- Verified Slice 1 with
  `uv run pytest tests/test_control_service.py tests/test_database.py tests/test_architecture.py`
  and `git diff --check`.
- Planned Slice 2 in
  `docs/plans/2026-07-02-slice-2-local-trigger-events.md`.
- Added writable local control service verbs for repository upsert, branch
  trigger policy, trigger event recording, and trigger event listing.
- Implemented branch filtering for local triggers: disabled or unknown branches
  do not write `trigger_events` rows.
- Implemented pending-trigger supersession: when a newer head is recorded for a
  branch, older pending trigger events for that branch become `superseded`.
- Verified Slice 2 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_architecture.py` and
  `git diff --check`.
- Planned Slice 3 in
  `docs/plans/2026-07-02-slice-3-local-trigger-dispatch.md`.
- Added the hidden local hook dispatcher
  `codealmanac __record-local-trigger`.
- Added a `LocalGitStateProbe` port and concrete Git probe that reads
  repository root, current branch, and HEAD SHA.
- Wired the Git probe through `create_app()` into `ControlService`; CLI dispatch
  still does not import Git integrations.
- Verified Slice 3 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_git_workspace_probe.py tests/test_cli.py tests/test_architecture.py`,
  `uv run ruff check .`, and `git diff --check`.
- Planned Slice 4 in
  `docs/plans/2026-07-02-slice-4-local-git-hooks.md`.
- Added `app.local_hooks` with install/uninstall service methods.
- Added the Git hook file adapter for `post-commit`, `post-merge`, and
  `post-rewrite`.
- Hook blocks call `codealmanac __record-local-trigger`, preserve existing user
  hook content, redirect output, and end with `|| true`.
- Verified Slice 4 focused behavior with
  `uv run pytest tests/test_local_hooks.py tests/test_architecture.py`,
  `uv run ruff check .`, and `git diff --check`.
- Planned Slice 5 in
  `docs/plans/2026-07-02-slice-5-control-run-ledger.md`.
- Added SQL-backed control run methods:
  `create_run`, `update_run`, `append_run_event`, and `list_run_events`.
- Added launch run statuses and run event kinds to the control service models.
- Verified Slice 5 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_architecture.py`,
  `uv run ruff check .`, and `git diff --check`.
- Planned Slice 6 in
  `docs/plans/2026-07-02-slice-6-trigger-claim-run-handoff.md`.
- Added `app.control.claim_next_trigger` to atomically claim pending trigger
  events and create queued control run rows.
- Verified Slice 6 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_architecture.py`,
  `uv run ruff check .`, and `git diff --check`.
- Sent the first RelayForge progress update through:
  `doppler run --project almanac --config dev -- relayforge reply --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json --binding rohan-almanac-main`.
- Recorded launch progress percentages in `docs/codealmanac-launch/progress.md`.
- Planned Slice 7 in
  `docs/plans/2026-07-02-slice-7-engine-run-artifacts.md`.
- Added `app.engine_runs` with file-backed shared engine request/result
  artifacts under `~/.codealmanac/runs/<run-id>/`.
- Added `EngineRunRequest`, `EngineRunResult`, typed changed-file records, and
  commit subject validation for the `docs almanac:` style.
- Verified Slice 7 focused behavior with
  `uv run pytest tests/test_engine_runs_service.py tests/test_architecture.py`.
- Verified Slice 7 full gate with `uv run pytest` (`383 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 7 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 38%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 8 in
  `docs/plans/2026-07-02-slice-8-worker-workspaces.md`.
- Added `app.worker_workspaces` with a local worker workspace layout under
  `~/.codealmanac/workspaces/<run-id>/`.
- Added `src/codealmanac/services/worker_workspaces/` with typed paths,
  request objects, a Git worktree port, filesystem store, and service verbs.
- Added `GitDetachedWorktreeManager`, which creates detached worktrees at the
  expected head SHA using `git worktree add --detach`.
- Verified Slice 8 focused behavior with
  `uv run pytest tests/test_worker_workspaces_service.py tests/test_architecture.py`.
- Verified Slice 8 full gate with `uv run pytest` (`389 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 8 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 42%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 9 in
  `docs/plans/2026-07-02-slice-9-local-run-preparation.md`.
- Added control read seams for repositories and branches.
- Extended control run updates to store `source_bundle_ref` and `request_ref`.
- Added `app.workflows.local_runs.prepare_next(...)`, which claims a pending
  trigger, prepares a local worker workspace, creates an engine request
  artifact, stores refs on the control run, and appends a run event.
- Added failure handling for claimed runs that cannot be prepared.
- Verified Slice 9 focused behavior with
  `uv run pytest tests/test_local_run_preparation_workflow.py tests/test_control_service.py tests/test_architecture.py`.
- Verified Slice 9 full gate with `uv run pytest` (`393 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 9 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 47%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 10 in
  `docs/plans/2026-07-02-slice-10-branch-head-staling.md`.
- Added `app.control.get_run(...)`.
- Added branch-head staling inside trigger recording: newer configured
  triggers mark queued/running runs for older expected heads as `stale`.
- Added normalized status run events for stale runs.
- Removed unused `EnsureControlSchemaRequest`.
- Verified Slice 10 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_architecture.py`.
- Verified Slice 10 full gate with `uv run pytest` (`394 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 10 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 50%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 11 in
  `docs/plans/2026-07-02-slice-11-source-bundle-materialization.md`.
- Added control DB verbs for sessions, turns, turn-branch links, and distinct
  branch session selection.
- Added `app.source_bundles` with a manifest-backed local source bundle
  materializer.
- Wired local run preparation to materialize `sources/manifest.json` and copied
  session files before writing the engine request.
- Added architecture guards for the source-bundle service boundary.
- Corrected the launch plan commit-subject example to `docs almanac:`.
- Verified Slice 11 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_source_bundles_service.py tests/test_local_run_preparation_workflow.py tests/test_architecture.py`.
- Verified Slice 11 full gate with `uv run pytest` (`398 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 11 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 53%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 12 in
  `docs/plans/2026-07-02-slice-12-deterministic-local-delivery.md`.
- Added `app.deliveries` over the existing control DB `deliveries` table.
- Added `app.workflows.local_delivery.deliver(...)`.
- Added `GitLocalDeliveryManager` for expected-head reads, wiki-only patch
  collection, patch application, and `docs almanac:` commit delivery.
- Added worker workspace path lookup by run id.
- Verified moved-head behavior: delivery is skipped and the run is marked
  `stale`.
- Verified empty worker diffs skip delivery and mark the run `succeeded`.
- Verified Slice 12 focused behavior with
  `uv run pytest tests/test_deliveries_service.py tests/test_local_delivery_workflow.py tests/test_git_local_delivery.py tests/test_worker_workspaces_service.py tests/test_architecture.py`.
- Verified Slice 12 full gate with `uv run pytest` (`407 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 12 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 58%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 13 in
  `docs/plans/2026-07-02-slice-13-local-engine-execution.md`.
- Added `app.workflows.local_engine.execute(...)`.
- Added `src/codealmanac/workflows/local_engine/` with request/result models,
  update prompt rendering, deterministic result helpers, and run-event
  recording helpers.
- Added `src/codealmanac/prompts/operations/update.md`.
- Wired local engine execution through the existing harness seam:
  `RunHarnessRequest(kind, cwd, prompt, title)`.
- The local engine now reads prepared `request.json`, runs the model in the
  worker repo, writes `result.json`, stores `result_ref`, and leaves delivery
  to `app.workflows.local_delivery`.
- Verified Slice 13 focused behavior with
  `uv run pytest tests/test_local_engine_workflow.py tests/test_engine_runs_service.py tests/test_architecture.py`.
- Verified Slice 13 full gate with `uv run pytest` (`411 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 13 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 63%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 14 in
  `docs/plans/2026-07-02-slice-14-local-worker-orchestration.md`.
- Added `app.workflows.local_worker.run_next(...)`.
- Added `src/codealmanac/workflows/local_worker/` with typed request/result
  models and orchestration over local preparation, engine execution, and local
  delivery.
- The worker returns a no-op when no pending trigger exists, returns a processed
  failed result for preparation or engine failure, and skips delivery if a run
  becomes `stale` while the engine is running.
- Verified Slice 14 focused behavior with
  `uv run pytest tests/test_local_worker_workflow.py tests/test_local_run_preparation_workflow.py tests/test_local_engine_workflow.py tests/test_local_delivery_workflow.py tests/test_architecture.py`.
- Verified Slice 14 full gate with `uv run pytest` (`417 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 14 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 67%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 15 in
  `docs/plans/2026-07-02-slice-15-hidden-local-worker-cli.md`.
- Added hidden CLI command `codealmanac __run-local-worker`.
- The hidden command calls `app.workflows.local_worker.run_next(...)`, can
  filter by `repository_id` and `branch_id`, accepts `--using`, and emits the
  typed workflow result with `--json`.
- Default command output stays quiet so a future hook or background spawner can
  call it without noisy terminal output.
- Verified Slice 15 focused behavior with
  `uv run pytest tests/test_cli.py tests/test_local_worker_workflow.py tests/test_architecture.py`.
- Verified Slice 15 full gate with `uv run pytest` (`419 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 15 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 68%, CLI/public UX 12%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 16 in
  `docs/plans/2026-07-02-slice-16-local-hook-worker-spawn.md`.
- Added `SpawnLocalWorkerRequest` and a `LocalWorkerSpawner` port.
- Added `SubprocessLocalWorkerSpawner`, which starts
  `codealmanac __run-local-worker` in a detached process for a specific
  repository and branch.
- Added `codealmanac __record-local-trigger --spawn-worker`.
- Updated installed local Git hook blocks to record triggers and request a
  detached local worker spawn.
- The hook path still records triggers synchronously and does not run the model
  worker inline.
- Verified Slice 16 focused behavior with
  `uv run pytest tests/test_cli.py tests/test_local_hooks.py tests/test_local_worker_spawner.py tests/test_architecture.py`.
- Verified Slice 16 full gate with `uv run pytest` (`422 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 16 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 72%, CLI/public UX 13%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 17 in
  `docs/plans/2026-07-02-slice-17-local-setup-command.md`.
- Added `app.workflows.local_setup.setup(...)`.
- Added `GitLocalRepositoryProbe`, which reads the current Git checkout,
  current branch, HEAD SHA, and GitHub `origin` identity.
- Added public `codealmanac local setup` with `--branch`, `--delivery
  commit|working-tree`, `--root`, `--skip-hooks`, and `--json`.
- Local setup now writes the repository row and branch trigger policy into
  `~/.codealmanac/control.sqlite` and installs local trigger hooks unless
  `--skip-hooks` is passed.
- Added real `working-tree` local delivery support alongside commit delivery.
  It applies the worker patch to the checkout without creating a commit.
- Verified Slice 17 focused behavior with
  `uv run pytest tests/test_local_setup_workflow.py tests/test_cli.py tests/test_git_local_repository_probe.py tests/test_local_delivery_workflow.py tests/test_git_local_delivery.py tests/test_architecture.py`.
- Verified Slice 17 full gate with `uv run pytest` (`432 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 17 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 76%, CLI/public UX 18%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 18 in
  `docs/plans/2026-07-02-slice-18-local-status-and-jobs.md`.
- Added optional control DB reads for repository-by-local-root,
  branch-by-name, and filtered run listing.
- Added `app.workflows.local_status.status(...)`.
- Added `app.workflows.local_jobs` to wrap run rows with repository and branch
  context for public output.
- Added public `codealmanac local status`.
- Added public `codealmanac local jobs list`, `show`, and `logs`.
- Kept `local update` out of this slice so manual-trigger semantics can be
  designed without overloading the read surface.
- Verified Slice 18 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_local_status_workflow.py tests/test_cli.py tests/test_architecture.py`.
- Verified Slice 18 full gate with `uv run pytest` (`439 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 18 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 78%, CLI/public UX 22%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 19 in
  `docs/plans/2026-07-02-slice-19-local-update-command.md`.
- Added `app.workflows.local_update.update(...)`.
- Added public `codealmanac local update` with `--using` and `--json`.
- `local update` now requires the current checkout and branch to be configured
  by local setup, creates a `manual` trigger event for the current HEAD, and
  runs the same local worker path used by Git hooks.
- Manual triggers may rerun on the same HEAD because local capture/source
  material can change without a code commit.
- `local update` refuses to start when the branch already has a queued or
  running local job.
- Manual trigger recording can replace older pending branch triggers while
  keeping normal duplicate hook-trigger behavior unchanged.
- Verified Slice 19 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_local_update_workflow.py tests/test_cli.py tests/test_architecture.py`.
- Verified Slice 19 full gate with `uv run pytest` (`446 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 19 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 81%, CLI/public UX 26%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 20 in
  `docs/plans/2026-07-02-slice-20-local-trigger-policy-commands.md`.
- Added `app.control.list_branches(...)` for repository-scoped branch policy
  reads.
- Added `app.workflows.local_policy` for local trigger policy listing, trigger
  enable/disable, and delivery mode updates.
- Added public `codealmanac local triggers list`.
- Added public `codealmanac local triggers enable <branch> [--delivery
  commit|working-tree]`.
- Added public `codealmanac local triggers disable <branch>`.
- Added public `codealmanac local delivery set --branch <branch> --mode
  commit|working-tree`.
- Local policy commands mutate local control DB branch rows only; they do not
  install hooks, spawn workers, or run updates.
- Verified Slice 20 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_local_policy_workflow.py tests/test_cli.py tests/test_architecture.py`.
- Verified Slice 20 full gate with `uv run pytest` (`456 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 20 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 83%, CLI/public UX 30%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 21 in
  `docs/plans/2026-07-02-slice-21-prompt-manual-restoration.md`.
- Added `PromptName.OPERATION_INIT`.
- Added packaged prompt resource
  `src/codealmanac/prompts/operations/init.md`.
- Expanded base prompt resources for purpose, notability, and syntax from the
  archive doctrine while adapting them to configured Almanac roots,
  `codealmanac` naming, structured `sources:`, and no new cross-wiki links.
- Expanded ingest and garden operation prompts without restoring the old public
  `absorb` name.
- Replaced bundled `manual/build.md` with `manual/init.md`.
- Updated `ManualDocumentName` so workspace manual installation copies
  `init.md`.
- Kept public `build` command removal and agent-backed `init` runtime behavior
  out of this slice.
- Verified Slice 21 focused behavior with
  `uv run pytest tests/test_ingest_workflow.py::test_ingest_workflow_resolves_sources_runs_harness_and_refreshes_index tests/test_prompts.py tests/test_manual.py tests/test_build_workflow.py tests/test_architecture.py`.
- Verified Slice 21 full gate with `uv run pytest` (`458 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 21 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 84%, CLI/public UX 30%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 22 in
  `docs/plans/2026-07-02-slice-22-init-runtime.md`.
- Added `app.workflows.init` with `initialize_workspace(...)`, `run(...)`, and
  `run_with_run(...)`.
- Removed `app.workflows.build` and the public `codealmanac build` parser and
  dispatcher path.
- Added public first-build `codealmanac init` flags for harness selection,
  foreground/background mode, `--force`, `--verbose`, `--guidance`, and
  background JSON output.
- Added `RunOperation.INIT` and durable init queue specs.
- Added `RunQueueWorkflow.queue_init(...)` and
  `RunQueueWorkflow.start_init_background(...)`.
- Updated the hidden worker drain path so queued init jobs run through
  `InitWorkflow.run_with_run(...)`.
- Added init-specific mutation policy behavior:
  `require_clean_almanac=False` allows init-created scaffold files while still
  rejecting changes outside the configured Almanac root.
- Updated diagnostics and starter README text from `codealmanac build` to
  `codealmanac init`.
- Migrated scaffold-only test setup to
  `app.workflows.init.initialize_workspace(...)`.
- Verified Slice 22 focused behavior with
  `uv run pytest tests/test_init_workflow.py tests/test_cli.py tests/test_diagnostics.py tests/test_run_queue_workflow.py tests/test_runs_service.py tests/test_build_workflow.py tests/test_architecture.py`
  (`158 passed`).
- Verified Slice 22 full gate with `uv run pytest` (`465 passed`),
  `uv run ruff check .`, `git diff --check`, `uv run codealmanac --help`, and
  `uv run codealmanac init --help`.
- Sent the Slice 22 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 87%, CLI/public UX 35%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 23 in
  `docs/plans/2026-07-02-slice-23-dev-lifecycle-cli.md`.
- Added a hidden `codealmanac dev` parser and dispatch namespace.
- Moved manual `ingest` and `garden` CLI access to
  `codealmanac dev ingest` and `codealmanac dev garden`.
- Removed top-level `ingest` and `garden` from lifecycle parser and dispatch.
- Fixed root argparse help so commands registered with `argparse.SUPPRESS`
  do not print as `==SUPPRESS==` in normal top-level help.
- Updated README update examples to use public local commands:
  `local setup`, `local update`, local trigger policy, and local jobs.
- Verified Slice 23 focused behavior with
  `uv run pytest tests/test_cli.py tests/test_architecture.py` (`113
  passed`) and
  `uv run pytest tests/test_public_contract.py tests/test_cli.py tests/test_architecture.py`
  (`140 passed`).
- Verified Slice 23 full gate with `uv run pytest` (`466 passed`),
  `uv run ruff check .`, `git diff --check`, `uv run codealmanac --help`,
  `uv run codealmanac dev ingest --help`, and
  `uv run codealmanac dev garden --help`.
- Sent the Slice 23 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 87%, CLI/public UX 40%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 24 in
  `docs/plans/2026-07-02-slice-24-user-level-jobs-state.md`.
- Added `AppConfig.jobs_path`, defaulting to `~/.codealmanac/jobs`.
- Moved new file-backed lifecycle job records, logs, queue specs, worker locks,
  and sync ledgers to `~/.codealmanac/jobs/<workspace-id>/`.
- Preserved read compatibility for legacy repo-local `<almanac-root>/jobs/`
  run records, logs, queue specs, and sync ledgers.
- Kept `<almanac-root>/jobs/` in new scaffold `.gitignore` blocks as a
  compatibility guard so old legacy files do not dirty preflight checks.
- Updated README, bundled manual, and launch schema docs to teach
  `~/.codealmanac/jobs/<workspace-id>/` as the active lifecycle job state
  location.
- Verified Slice 24 focused behavior with
  `uv run pytest tests/test_runs_service.py tests/test_run_queue_workflow.py tests/test_sync_workflow.py tests/test_cli.py tests/test_public_contract.py tests/test_architecture.py -q`
  (`181 passed`).
- Verified Slice 24 full gate with `uv run pytest` (`466 passed`),
  `uv run ruff check .`, `git diff --check`, `uv run codealmanac --help`,
  `uv run codealmanac dev ingest --help`, and
  `uv run codealmanac dev garden --help`.
- Sent the Slice 24 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 88%, CLI/public UX 40%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 25 in
  `docs/plans/2026-07-02-slice-25-hosted-baseline-convergence.md`.
- Created clean hosted worktree
  `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
  from current `origin/main`.
- Created and pushed hosted branch `codex/hosted-baseline-convergence`.
- Reapplied the small CodeAlmanac-hosted rename/deploy-surface change on top
  of current hosted main without merging the older divergent
  `codex/cli-hosted-redesign-docs` branch.
- Preserved newer hosted conversation-sync work from `origin/main`.
- Pushed hosted commit `1d237db chore: rename hosted deploy surfaces`.
- Verified hosted backend with `uv run pytest` (`290 passed`),
  `uv run ruff check .`, `uv run ruff format --check .`, and
  `uv run pytest tests/test_modal_worker_contract.py` (`9 passed`).
- Verified hosted frontend with `npm run test:routes` (`26 passed`),
  `npm run test:frontend` (`41 passed`), and `npm run build`.
- Sent the Slice 25 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 88%, CLI/public UX 40%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 10%.
- Planned Slice 26 in
  `docs/plans/2026-07-02-slice-26-workos-authkit-api-foundation.md`.
- Created hosted branch `codex/workos-authkit-api-foundation` from the Slice
  25 hosted convergence worktree.
- Migrated hosted browser auth from Supabase Auth helpers to WorkOS/AuthKit:
  `AuthKitProvider`, AuthKit proxy composition, `/sign-in`,
  `handleAuth(...)` callback, WorkOS-backed server auth helpers, and POST
  server-action sign-out.
- Removed frontend Supabase auth packages and deleted
  `frontend/src/lib/supabase/client.ts` and
  `frontend/src/lib/supabase/server.ts`.
- Added backend WorkOS token verification through JWKS and mapped access-token
  `sub` to `workos_user_id`.
- Removed the old backend Supabase Auth adapter from active auth wiring.
- Changed hosted user identity storage from `supabase_user_id uuid` to
  `workos_user_id text`, including CLI token, conversation-source, analytics,
  events, and migration surfaces.
- Kept repository reads/writes/PRs/commits on GitHub App/user tokens; WorkOS
  now owns human identity and sessions only.
- Verified Slice 26 backend focused behavior with
  `uv run pytest tests/test_identity_auth_contract.py tests/test_identity_api_contract.py tests/test_hosted_conversation_sync_contract.py tests/test_store_timestamps_contract.py tests/test_analytics_contract.py -q`
  (`31 passed`).
- Verified Slice 26 backend expanded behavior with
  `uv run pytest tests/test_architecture_contract.py tests/test_repositories_api_contract.py tests/test_wiki_api_contract.py tests/test_repositories_contract.py tests/test_updates_contract.py tests/test_wiki_contract.py -q`
  (`126 passed`).
- Verified Slice 26 full hosted backend gate with `uv run pytest` (`286
  passed`), `uv run ruff check .`, and `uv run ruff format --check .`.
- Verified Slice 26 hosted frontend with `npm run test:routes` (`26 passed`),
  `npm run test:frontend` (`41 passed`), and `npm run build`.
- `npm run build` still emits the known non-blocking CSS optimizer warning
  about a comment containing `m-* utility`.
- Pushed hosted commit `5858ae1 feat: migrate hosted auth to WorkOS` to
  `origin/codex/workos-authkit-api-foundation`.
- Sent the Slice 26 RelayForge update.
- Recorded progress as: CodeAlmanac backend/local 88%, CLI/public UX 40%,
  CodeAlmanac-hosted backend/auth/API 28%, hosted frontend/onboarding 15%, and
  infra/deploy rename 10%.
- Planned Slice 39 in
  `docs/plans/2026-07-02-slice-39-cloud-run-start.md`.
- Added hosted manual cloud run start:
  `POST /v1/repositories/{repo_id}/runs`.
- Added hosted `ManualBranchRuns` so the `Updates` facade stays small and the
  product verb owns authorization, GitHub branch-head resolution, delivery
  policy lookup, duplicate-head idempotency, and worker start.
- Added mirrored frontend `StartRunRequestDTO` to preserve backend/frontend DTO
  parity.
- Added CodeAlmanac `CloudRunsService.start_for_repo`,
  `CloudRunsWorkflow.start`, and public
  `codealmanac runs start --branch <branch>`.
- Pushed hosted commit `14caf8b feat: start cloud runs from CLI` to
  `origin/codex/workos-authkit-api-foundation`.
- Pushed CodeAlmanac commit `0e3879e1 feat: start cloud runs from CLI` to
  `origin/dev`.
- Verified hosted focused behavior with
  `uv run pytest tests/test_updates_contract.py tests/test_cli_runs_api_contract.py -q`
  (`37 passed, 1 warning`).
- Verified hosted backend full behavior with `uv run pytest -q`
  (`333 passed, 1 warning`), `uv run ruff check .`, and
  `uv run python -m compileall src modal_app -q`.
- Verified hosted frontend DTO route/lint surface with `npm run test:routes`
  (`27 passed`) and `npm run lint`.
- Verified CodeAlmanac focused behavior with
  `uv run pytest tests/test_cloud_runs_service.py tests/test_cloud_runs_workflow.py tests/test_cli.py tests/test_architecture.py -q`
  (`123 passed`).
- Verified CodeAlmanac full behavior with `uv run pytest -q` (`496 passed`),
  `uv run ruff check .`, `uv run python -m compileall src -q`, and
  `git diff --check`.
- Recorded progress as: CodeAlmanac backend/local 95%, CLI/public UX 87%,
  CodeAlmanac-hosted backend/auth/API 84%, hosted frontend/onboarding 35%, and
  infra/deploy rename 15%.
- Planned Slice 40 in
  `docs/plans/2026-07-02-slice-40-run-terminal-events.md`.
- Added hosted `RunFailed` and `RunStale` domain events.
- Updated hosted `UpdateCompletion` so failed/blocked worker completions
  dispatch `RunFailed` and stale delivery completions dispatch `RunStale`.
- Kept GitHub Check publishing out of Slice 40 because no check publisher
  exists yet; this slice creates the fanout seam that a later publisher can
  subscribe to.
- Pushed hosted commit `8795849 feat: emit terminal run events` to
  `origin/codex/workos-authkit-api-foundation`.
- Verified hosted focused behavior with
  `uv run pytest tests/test_events_contract.py tests/test_updates_contract.py tests/test_architecture_contract.py -q`
  (`108 passed`).
- Verified hosted backend full behavior with `uv run pytest -q`
  (`334 passed, 1 warning`), `uv run ruff check .`,
  `uv run python -m compileall src modal_app -q`, and `git diff --check`.
- Recorded progress as: CodeAlmanac backend/local 95%, CLI/public UX 87%,
  CodeAlmanac-hosted backend/auth/API 85%, hosted frontend/onboarding 35%, and
  infra/deploy rename 15%.
- Planned Slice 56 in
  `docs/plans/2026-07-02-slice-56-pypi-publish-completion.md`.
- Reran CodeAlmanac publish workflow `28619144624` on `main` at
  `43ec4800311b2f66f6095bff231f5fde7740eb07` after the PyPI trusted publisher
  entry was added.
- Verified the workflow build job passed tests, lint, diff hygiene, artifact
  build, Twine checks, and artifact upload.
- Verified the workflow publish job passed through
  `pypa/gh-action-pypi-publish@release/v1`.
- Verified PyPI now serves `codealmanac` `0.1.0` through both the JSON API and
  simple index; the simple index includes provenance links for the `0.1.0`
  wheel and sdist.
- Verified `uvx --python 3.12 codealmanac==0.1.0 --version` returns `0.1.0`.
- Verified isolated public install with
  `UV_TOOL_DIR=<tmp> UV_TOOL_BIN_DIR=<tmp> uv tool install --python 3.12 codealmanac==0.1.0`;
  the installed executable returned `0.1.0` for `codealmanac --version` and
  exposed the expected public command surface in `codealmanac --help`.
- Recorded progress as: CodeAlmanac backend/local 96%, CLI/public UX 98%,
  CodeAlmanac-hosted backend/auth/API 96%, hosted frontend/onboarding 78%, and
  infra/deploy rename 98%.
- Performed a production clean-slate reset for the launch target.
- Confirmed Render `render.yaml` points backend runtime config at
  `DOPPLER_PROJECT=codealmanac` and `DOPPLER_CONFIG=prd`.
- Confirmed `codealmanac/prd` uses WorkOS client
  `client_01KWGQ30PY07SPTCAHHHFHFV2Y` and Supabase project
  `amlownbvhsmnuhqofknb`.
- Confirmed stale `almanac/*` Doppler configs still point at old WorkOS clients
  and project `bjhtprwkufhojfmzkohg`; those were not used for the reset.
- Linked Supabase CLI to `amlownbvhsmnuhqofknb` with the stored production DB
  password.
- Before reset, WorkOS production contained 3 users: Rohan, Divit, and Kushagra.
- Before reset, Supabase production contained 2 hosted `public.users`, 16 legacy
  `auth.users`, 13 accounts, 15 installations, 135 repositories, 135 repository
  settings, 30 runs, 5,827 webhook deliveries, and hosted wiki read-model rows.
- Wiped Supabase production data by truncating hosted public tables and
  `storage.objects`, then deleting `auth.users`; schema, migration history, and
  bucket definitions were preserved.
- Deleted the 3 WorkOS production users through the WorkOS Python SDK.
- Verified WorkOS production has 0 users after reset.
- Verified the Supabase production count query returned no nonzero rows across
  hosted public tables, `auth.users`, and `storage.objects`.
- Verified `supabase db push --linked --dry-run` reports the remote production
  database is up to date.
- `supabase migration list --linked` hit a temp-role SASL auth retry after the
  dry-run; the dry-run is the schema verification used for this reset.
- Fixed the Slice 59 publish failure from GitHub Actions run `28640593179`.
  The workflow failed because README public-contract tests still expected the
  old local-first section names after the cloud-first README rewrite.
- Commit `571dedb7 fix(slice-59): align public docs contract` updates the
  README, `docs/concepts.md`, and public-contract assertions so root
  `codealmanac setup` stays cloud-only and local automation stays behind the
  explicit local/automation surface.
- Verified CodeAlmanac locally after the fix with `uv run pytest -q`
  (`499 passed`), `uv run ruff check .`, `git diff --check`,
  `uv build --out-dir dist`, `uvx twine check dist/*`, and isolated wheel
  install from `dist/`.
- Pushed `571dedb7` to CodeAlmanac `origin/dev` and `origin/main`.
- GitHub Actions publish run `28640955934` succeeded on `main` for version
  `0.1.1`; both the build job and PyPI publish job completed.
- Verified PyPI JSON and simple index expose `codealmanac` `0.1.1` with the
  wheel and sdist.
- Verified a fresh public install with
  `UV_TOOL_DIR=<tmp> UV_TOOL_BIN_DIR=<tmp> uv tool install --python 3.12 --no-cache codealmanac==0.1.1`;
  the installed executable returned `0.1.1`, and installed setup JSON showed
  `automation_mode: "none"` with `automation: []`.
- Repaired production repository settings after the page failed at
  `/api/capture/status`.
- Root cause: backend code already had `CaptureTokenRow` and
  `CaptureTokensStore.active_for_user()`, but production Supabase did not have
  `public.capture_tokens`.
- Added hosted migration
  `supabase/migrations/20260703010000_capture_tokens.sql` and added
  `capture_tokens` to the clean-slate init schema.
- Applied the migration to production through Doppler-backed `psql`, then
  marked migration `20260703010000` as applied with
  `supabase migration repair --linked --status applied 20260703010000`.
- Verified production DB has `public.capture_tokens` and policy
  `capture_tokens_backend_access` for `{postgres,service_role}`.
- Verified unauthenticated `GET https://api.codealmanac.com/api/capture/status`
  returns `401 not_authenticated`, not a server error.
- Verified signed-in Chrome production settings page loads:
  `https://www.codealmanac.com/dashboard/accounts/264516179/repositories/1212149375/settings`.
- Verified page text shows repository readiness, GitHub App connected, write
  repository access, capture not installed, maintained branches, and delivery
  settings.
- Verified Render logs after the fix include fresh
  `GET /api/capture/status HTTP/1.1" 200 OK` entries at
  `2026-07-03T06:47:13Z`, `06:47:16Z`, and `06:47:33Z`.
- Hosted tests for the repair passed:
  `uv run pytest tests/test_architecture_contract.py tests/test_capture_tokens_api_contract.py`
  (`76 passed, 1 warning`) and `uv run ruff check .`.
- Slice 64 verified the source CLI against production Chrome/AuthKit with a
  temp HOME. The command used `--api-url https://api.codealmanac.com` and
  `--no-browser`; it printed a `/cli-login` URL, Chrome showed
  `CLI login approved`, and the CLI stored auth for `rohans0509`.
- Slice 64 verified `whoami`, `setup --skip-login --skip-instructions`,
  `capture status --check-cloud`, `capture enable --target codex`, and
  `capture disable --target codex` against production. The capture credential
  was issued, visible from cloud status, then revoked.
- Slice 64 found PyPI `codealmanac==0.1.1` still defaults to
  `https://codealmanac-backend-docker.onrender.com`. The repo default was
  changed to `https://api.codealmanac.com`, the app default was changed to
  `https://www.codealmanac.com`, and `pyproject.toml` was bumped to `0.1.2`.
- Slice 64 pushed commit `b0a8c5a3 fix: use canonical cloud endpoints in CLI`
  to `origin/dev` and `origin/main`.
- GitHub push checks passed on both branches, and publish workflow run
  `28648341690` succeeded for `codealmanac` `0.1.2`.
- PyPI JSON reported latest version `0.1.2`.
- Fresh public install with
  `UV_TOOL_DIR=<tmp> UV_TOOL_BIN_DIR=<tmp> uv tool install --python 3.12 --refresh --no-cache codealmanac`
  installed `0.1.2`; `capture status --json` reported
  `api_url: https://api.codealmanac.com`.
- Fresh PyPI `0.1.2` login was verified with no `--api-url`: the installed
  binary printed a `https://www.codealmanac.com/cli-login` URL, Chrome showed
  `CLI login approved`, and `whoami` returned `rohans0509` with cloud
  `https://api.codealmanac.com`.
- Slice 65 adds the public installer path. CodeAlmanac now has
  `scripts/install.sh`, and hosted serves the same bytes from
  `frontend/public/install.sh` at `/install.sh`.
- The installer uses Astral's official `uv` installer when needed, runs
  `uv tool install --python 3.12 --upgrade --force codealmanac`, and warns when
  an existing `codealmanac` earlier on `PATH` would shadow the installed PyPI
  tool.
- Slice 65 restored the README's old banner/product voice while making the
  first install line `curl -fsSL https://www.codealmanac.com/install.sh | sh`.
  The manual install path remains
  `uv tool install --python 3.12 codealmanac`.
- Hosted landing, `/setup`, `/dashboard/local-agent-access`, and design-lab
  experiment copy now use the same curl-first install command.
- Hosted frontend config now defaults to `https://api.codealmanac.com`, not the
  Render service URL, when no backend env override is set.
- Slice 65 verification passed: `sh -n` for both installer files,
  byte-for-byte installer comparison, CodeAlmanac public-contract tests
  (`26 passed`), full CodeAlmanac tests (`501 passed`), CodeAlmanac ruff,
  hosted route tests (`28 passed`), hosted frontend tests (`52 passed`), hosted
  lint, hosted Next build, and a temp-dir installer smoke that installed
  `codealmanac==0.1.2` while correctly warning about the stale Node-era
  `/Users/rohan/.nvm/versions/node/v21.7.3/bin/codealmanac` shadow.
- Slice 65 CodeAlmanac commit `43a88a6e` was pushed to `origin/dev` and
  `origin/main`. Hosted commit `3cb9462` was pushed to the hosted feature
  branch and hosted `origin/main`.
- Slice 65 deployed hosted frontend build `6RT9PwDsTAicKSHid57JjcmDkubA` to
  Vercel production, aliased to `https://www.codealmanac.com`.
- Production `https://www.codealmanac.com/install.sh` returned `HTTP/2 200`
  with `content-type: application/x-sh`, passed `sh -n`, and was
  byte-for-byte identical to `scripts/install.sh`.
- Production homepage contains the curl installer twice and contains no
  `npx codealmanac`, `codealmanac-backend-docker`, `vercel.app`, or
  `render.com` strings. Production API health returned `{"status":"ok"}`.
- Chrome verified signed-in production `/setup` for `rohans0509`: it renders
  the cloud setup checklist, the curl installer, connected GitHub account
  `AlmanacCode`, and no stale npm or old backend host strings.
- Chrome verified signed-in production `/dashboard/local-agent-access`: it
  renders `curl -fsSL https://www.codealmanac.com/install.sh | sh` plus
  `codealmanac setup`, with no `npx`, old backend host, or Vercel URL.
- Chrome verified both source CLI and published PyPI CLI setup handoffs:
  `/cli-login` approved the one-time session, setup exited signed in as
  `rohans0509`, and `whoami` returned cloud `https://api.codealmanac.com`.
- Slice 66 re-ran published PyPI CLI setup from a fresh temp HOME through real
  Chrome. The CLI printed a production `/cli-login` URL, Chrome showed
  `CLI login approved` for code `2XFTF7KK`, setup finished signed in as
  `rohans0509`, and `whoami` returned cloud `https://api.codealmanac.com`.
- Slice 66 verified production capture upload end to end: `capture enable`
  issued cloud credential `ba28b4ec-611e-4549-b6d1-6d0f21fef810`, wrote
  temp `capture.json` with mode `0600`, installed the temp Codex Stop hook, and
  `__capture-hook` uploaded a synthetic transcript with
  `upload_status: uploaded`, `repo_full_name: AlmanacCode/codealmanac`,
  `branch: dev`, and `routing_status: routable`.
- Slice 66 verified the uploaded source artifact can be read back through
  production `GET /api/internal/source-artifacts`. The correct production
  secret source is Render's Doppler target `codealmanac/prd`; using the
  RelayForge target `almanac/dev` gives `401`, as expected.
- Slice 66 revoked the production capture credential and verified final
  `capture status --check-cloud --json` returned no local credential, no hooks,
  and no cloud credentials.
- Slice 66 focused tests passed in CodeAlmanac (`7 passed`) and hosted backend
  capture/internal API tests (`14 passed`, `1` Starlette warning).
- Slice 67 aligns captured conversations with maintained branch triggers. On a
  qualifying branch push, hosted now claims completed, unclaimed, ref-backed
  conversation turns for that repository and branch into a source bundle and
  starts a `ConversationBatchSource` run. If no bundle exists, it falls back to
  the existing `BranchSource` run.
- Slice 67 also removes a delivery split: conversation-batch runs now use the
  same per-branch trigger delivery mode as branch runs, including the old
  scheduler path while it still exists.
- Slice 67 full hosted backend verification passed: focused update/conversation/
  webhook/installation/worker/architecture tests (`172 passed`), full hosted
  backend suite (`380 passed`, `1` Starlette warning), hosted ruff,
  `python -m compileall backend/src -q`, and `git diff --check`.
- Render deployed Slice 67 hosted commit `a9a7ff8` live as deploy
  `dep-d93oj33rjlhs73abh3tg`; both `https://api.codealmanac.com/api/health`
  and `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`.
- Published CLI setup was re-run from fresh temp HOME
  `/tmp/codealmanac-chrome-rerun.Q2tZan` through real Chrome. The CLI printed a
  production `/cli-login` URL with code `DGNVDMWK`, Chrome rendered
  `CLI login approved`, setup finished signed in as `rohans0509`, `whoami`
  returned cloud `https://api.codealmanac.com`, and `capture status
  --check-cloud --json` reached production with `signed_in: true`.
- Slice 68 production branch-trigger smoke passed after two worker fixes.
  Chrome verified signed-in `/setup` and the production repository dashboard
  for `AlmanacCode/codealmanac`. GitHub App `push` delivery is enabled.
- Slice 68 found the first worker bug through production: branch pushes were
  being treated like first wiki initialization. Hosted commit `03c57f8`
  introduced `InitialWikiSource` and mapped `BranchSource` to ingest.
- Slice 68 found the second worker bug through production: branch-source
  workers cloned the live branch at depth 1 instead of materializing the exact
  run snapshot. Hosted commit `eb8dba0` makes branch-like runs checkout the
  exact `head_sha` and fetch `before_sha` for `git:range`.
- Verification for `eb8dba0` passed: hosted backend tests
  `test_architecture_contract.py`, `test_github_checkout_contract.py`,
  `test_modal_worker_contract.py`, `test_updates_contract.py`,
  `test_repositories_api_contract.py`, and `test_cli_runs_api_contract.py`
  (`165 passed`, `1` Starlette warning), hosted ruff, and a real Git
  fetch-by-SHA smoke against the public CodeAlmanac repo.
- Render deploy `dep-d93pp0eq1p3s73cuomp0` is live on hosted commit
  `eb8dba0`. Modal app `codealmanac-hosted-updates` was redeployed from the
  same checkout.
- Fresh production push to disposable branch
  `codealmanac-smoke/slice-68-20260703102325` created run
  `773da5fb-9871-4f83-8797-ddf651c635ce` with
  `before_sha=d11d29b96dbfe334b2d9cb99fa5aafcc7893d98a` and
  `head_sha=23a0a03209ff1804944eb094f589647dc13de47b`. The run delivered with
  summary `No wiki changes made.`
- Chrome refreshed the production dashboard and showed the delivered run at the
  top. Cleanup completed: smoke trigger disabled, temp capture credential
  revoked, remote smoke branch deleted, temp worktree removed.
- Slice 69 re-tested the public CLI path in the user's real Chrome session.
  The shell now resolves `codealmanac` only to
  `/Users/rohan/.local/bin/codealmanac`; the stale global npm executable was
  removed locally.
- Published PyPI `0.1.2` still opens the old
  `https://www.codealmanac.com/wiki/github/AlmanacCode/codealmanac` route for
  `codealmanac open`. That route sends the user back through GitHub OAuth and
  is the wrong public command target.
- Source `0.1.3` resolves the current GitHub checkout through the cloud
  repositories API and opens
  `https://www.codealmanac.com/dashboard/accounts/264516179/repositories/1212149375/wiki`.
- Chrome verified the fixed dashboard wiki URL as signed-in `rohans0509`.
  The page rendered `AlmanacCode/codealmanac`, `Wiki`, and `Default branch /
  62 pages`.
- Source `codealmanac setup --yes --json` stayed cloud-only and idempotent:
  it reported `already_signed_in`, installed no local automation, and found the
  Codex and Claude instruction files already installed.
- GitHub Actions publish run `28659205416` succeeded on `main` at
  `21d3b988`; the workflow built and published
  `codealmanac-0.1.3-py3-none-any.whl` and `codealmanac-0.1.3.tar.gz`.
- PyPI exposed `0.1.3` through both the version-specific JSON endpoint and the
  package latest JSON endpoint.
- Fresh public install with
  `uv tool install --python 3.12 --upgrade --force --refresh codealmanac`
  installed `0.1.3`.
- Installed `codealmanac open` opened
  `https://www.codealmanac.com/dashboard/accounts/264516179/repositories/1212149375/wiki`.
  Chrome verified the signed-in wiki page with `AlmanacCode/codealmanac` and
  `Default branch / 62 pages`.
- Slice 70 fixed the fresh-install regression introduced by the Slice 69
  dashboard-route repair. Source `0.1.4` now falls back only when local cloud
  auth state is missing: `codealmanac open --no-browser` from a fresh HOME
  prints `https://www.codealmanac.com/wiki/github/AlmanacCode/codealmanac`,
  while a signed-in HOME still prints the exact dashboard wiki route.
- Chrome verified the no-auth browser handoff. The public resolver sent the
  user through GitHub OAuth for Almanac Bot and completed at
  `https://www.codealmanac.com/setup` with GitHub connected and no console
  errors.
- Chrome also verified the signed-in dashboard wiki route still renders
  `AlmanacCode/codealmanac`, `Wiki`, and `Default branch / 62 pages` with no
  console errors.
- Slice 70 focused tests passed:
  `uv run pytest tests/test_cloud_open_workflow.py tests/test_cli.py -q`
  (`65 passed`).
- Slice 70 full local gates passed:
  `uv run pytest` (`504 passed`), `uv run ruff check .`, `git diff --check`,
  `uv build --out-dir dist`, and `uvx twine check dist/*`.
