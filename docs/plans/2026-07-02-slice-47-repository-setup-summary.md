# Slice 47: Repository Setup Summary

## Goal

Make repository setup understandable from the hosted dashboard without relying
on CLI output alone.

The settings page should summarize:

- GitHub App account connection and repository selection mode.
- Current repository access.
- Capture credential state for the signed-in user.
- Maintained branch trigger count.
- Delivery modes configured across maintained branches.

## Product Contract

- The setup summary is browser-first and rendered from backend DTOs.
- GitHub App install/configuration links go to GitHub, not a fake local wizard.
- Capture status means hosted capture credentials issued for this user; the
  browser does not pretend to know local hook files.
- Branch setup uses existing trigger policies. Enabled branches are maintained
  branches.
- The existing detailed settings form remains the edit surface for same-repo
  PRs and maintained branch delivery modes.
- No new local CLI commands are part of this slice.

## Architecture Wireframe

```tsx
// browser-auth backend route
GET /api/capture/status -> CaptureStatusDTO

// server component data
const [branches, triggerPolicies, captureStatus] = await Promise.all([...])

<RepositorySetupSummary
  account={account}
  repo={repo}
  branches={branches.items}
  triggerPolicies={triggerPolicies}
  captureStatus={captureStatus}
/>

<RepositorySettingsForm ... />
```

`RepositorySetupSummary` is read-only. It renders status from real DTOs and
links to existing edit surfaces. `RepositorySettingsForm` keeps all mutations.

## Hosted Files

- `backend/src/almanac/server/capture_router.py`
- `backend/src/almanac/server/app.py`
- `backend/tests/test_capture_tokens_api_contract.py`
- `frontend/src/lib/api/server.ts`
- `frontend/src/components/repositories/setup-summary.tsx`
- `frontend/src/app/dashboard/accounts/[accountId]/repositories/[repoId]/settings/page.tsx`
- `frontend/tests/frontend/repository-setup-summary.test.tsx`
- `frontend/tests/routes.test.mjs`

## Verification

Focused:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_capture_tokens_api_contract.py tests/test_repositories_api_contract.py -q
uv run ruff check .

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:frontend
npm run test:routes
npm run lint
```

Before commit:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest -q
uv run python -m compileall src modal_app -q

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:routes
npm run test:frontend
npm run lint
npm run build

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence
git diff --check
```

