# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, push, and RelayForge update.

## Last Completed Slice

Slice 28 implemented explicit cloud capture setup and hosted capture
credentials.

Implemented:

- hosted worktree at
  `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- hosted branch `codex/workos-authkit-api-foundation`
- hosted `capture_tokens` service, store, table, DTOs, and router
- hosted `/v1/capture/credentials`, `/v1/capture/status`, and
  `/v1/capture/credentials/revoke`
- `cap_...` capture tokens, hashed at rest and separated from `alm_...` CLI
  tokens
- frontend capture DTO mirrors for hosted DTO parity
- local `~/.codealmanac/capture.json` mode `0600`
- local `~/.codealmanac/capture-events/events.jsonl`
- public cloud commands: `codealmanac capture status`,
  `codealmanac capture enable`, `codealmanac capture repair`, and
  `codealmanac capture disable`
- hidden provider hook entrypoint:
  `codealmanac __capture-hook --provider codex|claude`
- Codex and Claude Stop hook install/remove under `~/.codex/hooks.json` and
  `~/.claude/settings.json`

Verified:

```text
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest -q
uv run ruff check .
uv run ruff format --check .

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:routes
npm run test:frontend
npm run build

cd /Users/rohan/Desktop/Projects/codealmanac
uv run pytest -q
uv run ruff check .
git diff --check
uv run codealmanac capture status --help
uv run codealmanac capture enable --help
uv run codealmanac capture repair --help
uv run codealmanac capture disable --help
```

Counts: hosted backend `291 passed, 1 warning`; hosted routes `26 passed`;
hosted frontend `41 passed`; codealmanac `477 passed`.

## Next Pressure Test

Slice 29 should implement transcript parsing and upload through the capture
token.

Pressure points:

- normalize Codex and Claude hook payloads into one capture upload request
- read provider transcripts by reference from hook-provided paths
- upload conversation/session/turn evidence without passing transcript content
  through the CLI token path
- write hosted session, turn, branch mapping rows using the same branch/repo
  algorithm planned for cloud runs
- keep hooks fast and non-model-running

## Known Repo State

The CodeAlmanac branch is `dev`. Slice 27 is pushed to `origin/dev` at
`494e5694 feat: add cloud CLI auth`; Slice 28 is ready to commit and push from
the current dirty tree.

The hosted auth branch is
`/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
on `codex/workos-authkit-api-foundation`. Slice 27 is pushed to origin at
`c91e162 feat: add v1 CLI auth routes`; Slice 28 is pushed to origin at
`36211ba feat: add capture credential API`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
