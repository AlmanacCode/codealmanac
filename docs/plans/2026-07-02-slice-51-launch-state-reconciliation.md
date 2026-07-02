# Slice 51: Launch State Reconciliation

Status: planned.
Date: 2026-07-02.

## Scope

Reconcile the launch folder with the actual CodeAlmanac and
codealmanac-hosted state after the setup/auth hardening work.

This slice covers:

- update launch progress percentages after Slice 50 and the GitHub-only auth
  guard
- update the next-agent brief to name Slice 50/51, current commits, current
  deploy state, and the PyPI publish blocker
- change rate limits from launch-blocking work to explicit future work because
  Rohan postponed them
- add route-test guards for `/setup` as the cloud setup entry and for the
  GitHub-only login copy
- record verification evidence in the worklog and verification matrix

This slice does not cover:

- PyPI publishing; this still needs a PyPI token or trusted publishing setup
- provider dashboard changes inside WorkOS
- a new deploy; the hosted code change is test-only and docs-only
- rate-limit implementation

## Design

The launch contract should describe what is true now, not what was true at
Slice 49. `/setup` is the browser-owned cloud setup hub. The route must keep
using Python package install instructions:

```text
uv tool install codealmanac
codealmanac setup
```

Auth remains GitHub-only at launch:

```text
browser login -> GitHub OAuth through WorkOS/AuthKit -> GitHub App install/config
```

Email/password, magic link, and email verification are misconfiguration paths,
not alternate sign-in paths. The code-level guard belongs in route tests because
the WorkOS/AuthKit hosted UI method availability is configured in WorkOS rather
than through the installed AuthKit Next.js helper.

Rate limits remain a future product/security slice. They should stay in docs as
required before broad public scale, but not block the current product-first
launch path.

## Files

Hosted worktree:

- `frontend/tests/routes.test.mjs`

CodeAlmanac repo:

- `docs/codealmanac-launch/auth-api-contract.md`
- `docs/codealmanac-launch/decisions.md`
- `docs/codealmanac-launch/frontend-surface-contract.md`
- `docs/codealmanac-launch/next-agent-brief.md`
- `docs/codealmanac-launch/progress.md`
- `docs/codealmanac-launch/verification-matrix.md`
- `docs/codealmanac-launch/worklog.md`

## Verification

Hosted:

```text
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:routes
npm run lint
```

CodeAlmanac docs:

```text
cd /Users/rohan/Desktop/Projects/codealmanac
git diff --check
```

If route or lint changes surface broader issues, run the frontend build before
commit.
