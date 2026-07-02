# Hosted Run Event Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose persisted hosted run events through the API and dashboard so users can inspect what happened inside a run.

**Architecture:** `services/updates` already owns SQL-backed `run_events`; this slice adds a read-only query method, a backend `RunEventDTO`, an account-safe route, and a browser-callable BFF path. The frontend renders the normalized event timeline from real DTOs under an expandable run row. No worker behavior, source capture, billing, or GitHub check-run surface changes belong in this slice.

**Tech Stack:** Python FastAPI backend, SQLModel store methods already added in Slice 32, Pydantic DTOs, Next.js/TypeScript frontend, node:test, pytest.

---

## Read Before Coding

- `/Users/rohan/.codex/skills/slow-development/SKILL.md`
- `/Users/rohan/.codex/skills/python-code-quality/SKILL.md`
- `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/AGENTS.md`
- `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/MANUAL.md`
- Hosted wiki pages: `backend-update-pipeline`, `backend-event-fanout`, `update-bundle-contract`

## Design Decision

Do not rebuild GitHub check-run fanout in this slice. The current launch code no longer has an active check publisher or check-action parser, and repository settings are `disabled|auto` rather than `ask|auto`. Reintroducing GitHub checks requires a separate product slice.

Expose run events as an API/dashboard read model now because the backend already stores normalized events and users need a way to inspect run outcomes.

## Wireframe

```python
# Backend
events = almanac.updates.run_events_for_user(user, run_id)
return [RunEventDTO.of(event) for event in events]

# Frontend
page = await listRepositoryRuns(accountId, repoId)
events = await listRunEvents(run.runId)
<RunRow run={run} events={events} expanded />
```

## Task 1: Backend Read Contract

**Files:**
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/updates/queries.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/updates/service.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/server/dtos/runs.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/server/dtos/__init__.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/server/dto.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/server/runs_router.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_updates_contract.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_repositories_api_contract.py`

**Steps:**
1. Add `RunEventDTO` with `run_id`, `sequence`, `timestamp`, `kind`, `message`, and `payload`.
2. Add `UpdateQueries.run_events_for_user(user, run_id)`.
3. Authorize by loading the run, authorizing `VIEW_REPO` on `run.repo_id`, then reading ordered events.
4. Add `Updates.run_events_for_user(...)`.
5. Add `GET /api/runs/{run_id}/events`.
6. Prove the service authorizes against the run's repository.
7. Prove the route returns DTO-shaped run events.

## Task 2: Frontend DTO and BFF

**Files:**
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/lib/api/dto/runs.ts`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/lib/api/bff.ts`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/lib/api/server.ts`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/lib/api/gateway.ts`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/tests/frontend/gateway.test.ts`

**Steps:**
1. Add frontend `RunEventDTO` and `RunEventKind` matching backend DTO names.
2. Add `listRunEvents(runId)` to BFF and server clients.
3. Allow `GET /api/dashboard/runs/<uuid>/events` in the BFF gateway.
4. Prove unknown routes remain rejected and the run-events route is allowlisted.

## Task 3: Dashboard Timeline UI

**Files:**
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/components/runs/runs-list.tsx`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/components/runs/run-row.tsx`
- Create or modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/tests/frontend/runs.test.tsx`

**Steps:**
1. Add expandable row state in `RunsList`.
2. Fetch events lazily with `listRunEvents(run.runId)` when the row expands.
3. Render a compact event timeline below the row: relative timestamp, kind, message, and normalized payload fields.
4. Keep existing polling/load-more behavior unchanged.
5. Prove the timeline renders event messages and payload fields from `RunEventDTO`.

## Task 4: Verification and Commit

**Commands:**
- Backend focused:
  - `cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend && uv run pytest tests/test_updates_contract.py tests/test_repositories_api_contract.py tests/test_update_run_events_contract.py -q`
- Frontend focused:
  - `cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend && npm run test:frontend && npm run test:routes`
- Hosted hygiene/full:
  - `cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend && uv run ruff check . && uv run ruff format --check . && python -m compileall src modal_app -q && uv run pytest -q`
  - `cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend && npm run lint`
  - `cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence && git diff --check`

**Docs:**
- Update local launch docs:
  - `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/worklog.md`
  - `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/progress.md`
  - `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/verification-matrix.md`
  - `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/next-agent-brief.md`

**Commit Plan:**
1. Hosted: `feat: expose run event timeline`
2. Local docs: `docs: record hosted run event visibility slice`
3. Push both branches.
4. Send RelayForge update.
