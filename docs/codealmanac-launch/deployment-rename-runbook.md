# Deployment Rename Runbook

Status: partially executed.
Purpose: rename `usealmanac` to `codealmanac-hosted` and redeploy the cloud
product without leaving provider state split across old and new names.

## Operating Assumptions

- No external customers are using the product yet.
- Supabase schema migrations may be rewritten/collapsed/repaired as needed.
- Provider CLIs exist and should be used where they are the cleanest path:
  GitHub CLI, Vercel CLI, Render CLI/API, Supabase CLI, Modal CLI, Doppler CLI,
  PostHog CLI/API, and Autumn `atmn` tooling/API.
- Do not mutate billing/provider production state without an explicit command
  and visible verification step.

## 1. Prepare A Clean Rename Workspace

Do not start from the dirty `usealmanac` checkout.

```bash
cd /Users/rohan/Desktop/Projects/usealmanac
git status --short
```

Create a clean branch or separate worktree for the rename.

## 2. Rename GitHub Repository

Target:

```text
AlmanacCode/usealmanac -> AlmanacCode/codealmanac-hosted
```

Use GitHub UI or `gh` if available.

After rename:

```bash
git remote set-url origin git@github.com:AlmanacCode/codealmanac-hosted.git
git remote -v
```

Executed on 2026-07-02:

```text
AlmanacCode/usealmanac -> AlmanacCode/codealmanac-hosted
local origin -> https://github.com/AlmanacCode/codealmanac-hosted.git
```

## 3. Rename Local Folder

After GitHub remote is correct and local worktree is clean:

```text
/Users/rohan/Desktop/Projects/usealmanac
  -> /Users/rohan/Desktop/Projects/codealmanac-hosted
```

## 4. Repository Text And Package Names

Update visible/project names:

```text
frontend/package.json
backend/pyproject.toml
backend/src/almanac/settings.py
README/docs/scripts/env examples
```

Expected direction:

```text
usealmanac                 -> codealmanac-hosted
usealmanac-backend         -> codealmanac-hosted-backend
usealmanac-updates         -> codealmanac-hosted-updates
```

Search before replacing:

```bash
rg -n "usealmanac|UseAlmanac|USEALMANAC"
```

Keep old names only in historical notes where changing them would corrupt
history.

## 5. Vercel

Use Vercel CLI or dashboard.

Required state:

```text
project name: codealmanac-hosted or codealmanac-web
git repo: AlmanacCode/codealmanac-hosted
project root: frontend/
framework: Next.js
```

Verify:

```bash
vercel project ls
vercel env ls
vercel deploy --prebuilt
```

Update:

- production domain
- preview domain
- GitHub repo connection
- auth callback URLs
- backend API base URL env vars

Observed on 2026-07-02:

```text
provider project: thealmanac/usealmanac
project id: prj_sBOdSIF82roDGnkFeYrh5qdg6epp
production URL: https://www.codealmanac.com
```

The installed Vercel CLI has `project list`, `project inspect`, `project add`,
`project remove`, and `project token`. It does not expose a project rename
command. Rename the provider project through the dashboard or verified Vercel
API, not by guessing an undocumented endpoint.

Executed on 2026-07-02:

```bash
cd /Users/rohan/Desktop/Projects/usealmanac/frontend
npm run build
vercel deploy --prod --scope thealmanac
```

Verified:

```text
https://www.codealmanac.com -> HTTP 200
```

## 6. Render

Use Render CLI/API or dashboard.

Current intended service name is already:

```text
codealmanac-backend
```

Verify/update:

```text
repo connection: AlmanacCode/codealmanac-hosted
dockerfilePath: ./Dockerfile
dockerContext: .
healthCheckPath: /api/health
DOPPLER_PROJECT: codealmanac
DOPPLER_CONFIG: prd
```

After deploy, verify:

```bash
curl https://<backend-domain>/api/health
```

Observed on 2026-07-02:

```text
service: codealmanac-backend
repo: https://github.com/AlmanacCode/codealmanac-hosted
branch: main
healthCheckPath: /api/health
```

Verified:

```text
https://codealmanac-backend-docker.onrender.com/api/health -> {"status":"ok"}
```

Executed on 2026-07-02:

```bash
doppler secrets set MODAL_APP_NAME=codealmanac-hosted-updates --project codealmanac --config prd
render deploys create srv-d8g8nb37uimc739vnnsg --confirm --output json
```

Verified deploy:

```text
dep-d930nheh2hms73d259s0 -> live
```

## 7. Modal

Use Modal CLI.

Rename:

```text
usealmanac-updates -> codealmanac-hosted-updates
```

Verify:

```bash
modal app list
modal run modal_app/updates_worker.py::smoke
```

Cloud workers must use the shared engine contract, not the human CLI.

Executed on 2026-07-02:

```bash
cd /Users/rohan/Desktop/Projects/usealmanac/backend
PYTHONPATH=src uv run modal deploy modal_app/updates_worker.py --env main
```

Verified deployed Modal app:

```text
codealmanac-hosted-updates
```

## 8. Supabase

Use Supabase CLI.

Because no external customers are using the product yet, migrations may be
rewritten/collapsed/repaired instead of preserving every historical migration.

Required launch schema must include:

```text
repositories
branches / trigger policies
sessions
turns
turn_branches
trigger_events
runs
run_events
deliveries
source artifact refs
run artifact refs
```

Also verify:

- auth redirect URLs
- storage buckets for source bundles
- storage buckets for run artifacts
- service role env vars
- local/dev/prod database URLs

Commands to use as appropriate:

```bash
supabase status
supabase migration list
supabase db diff
supabase db push
```

## 9. GitHub App

Update GitHub App settings:

```text
callback URL
setup URL
webhook URL
allowed domains
repository permissions
organization/member permissions if needed
```

Verify:

- install flow works for user account
- install flow works for org account
- selected repositories appear in dashboard
- webhook delivery reaches backend

## 10. Doppler

Use Doppler CLI.

Current intended project is:

```text
DOPPLER_PROJECT=codealmanac
```

Verify:

```bash
doppler configs --project codealmanac
doppler secrets --project codealmanac --config prd
```

Search for stale secret names:

```text
USEALMANAC
usealmanac
```

## 11. PostHog

Use PostHog UI/API/tooling. The official npm package is `@posthog/cli`, whose
binary is `posthog-cli`.

Update visible project/product labels if they still say `usealmanac`.

Verify:

- frontend token points at the intended project
- backend event capture points at the intended project
- signup/onboarding events still arrive
- run/delivery events still arrive

## 12. Autumn

Use Autumn CLI/tooling or dashboard. The Autumn CLI package is `atmn`; in the
current hosted frontend it is available through npm scripts / npm exec.

Update visible product labels from old names to CodeAlmanac where relevant.

Do not mutate production billing state without an explicit provider-mutation
step.

Verify:

```bash
make billing-verify
```

## 13. Final Smoke Checks

From `codealmanac-hosted`:

```bash
make test
make lint
make smoke-backend
make smoke-modal
```

Manual browser checks:

- login
- GitHub App install
- repo selection
- per-branch trigger policy
- per-branch delivery mode
- capture consent
- repo wiki open route
- run history
- billing page

## Rollback Notes

- GitHub repo rename can be reversed if the old name is still available.
- Vercel/Render can point back to the old repo only if the old remote exists.
- Supabase migration rewrites require database backup awareness.
- Provider rename operations should be logged in `worklog.md`.
