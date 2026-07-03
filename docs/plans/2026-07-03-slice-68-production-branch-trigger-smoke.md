# Slice 68 - Production Branch Trigger Smoke

Status: completed and production-verified.

## Goal

Prove the deployed Slice 67 path in production: a normal GitHub branch push on
an enabled cloud trigger claims captured conversation source refs for that
repository/branch, creates a `conversation_batch` run, and records the branch
policy delivery target.

## Why This Slice

Slice 67 has backend tests and a live Render deploy, but the live proof is still
indirect. The remaining pressure test is the real provider path:

```text
capture upload -> GitHub branch push webhook -> trigger policy lookup
  -> source bundle claim -> run row -> worker start effect
```

This slice verifies that flow against production with a disposable branch.

## Read Before Coding

- `/Users/rohan/.codex/skills/slow-development/SKILL.md`
- `/Users/rohan/.codex/skills/python-code-quality/SKILL.md`
- `MANUAL.md`
- `.almanac/README.md`
- `docs/reference/cosmic-python/chapter_04_service_layer.md`
- `docs/reference/cosmic-python/chapter_05_high_gear_low_gear.md`
- `docs/reference/cosmic-python/chapter_06_uow.md`

Cosmic Python transfer: use the service-layer behavior as the proof target,
and use the production SQL row only as read-only evidence that the service
persisted the correct source and delivery contracts.

## Production Smoke Shape

Use a disposable branch because `dev`/`main` should not receive smoke commits.

```text
branch = codealmanac-smoke/slice-68-<timestamp>

1. Create temp git worktree on branch.
2. Commit and push an initial smoke file.
   - This creates the branch; production intentionally ignores created pushes.
3. Enable cloud trigger on that branch with delivery mode `commit`.
4. Enable capture in a temp HOME.
5. Run `codealmanac __capture-hook --provider codex` from the temp worktree.
   - Expect upload_status=uploaded, repo=AlmanacCode/codealmanac, branch=branch.
6. Commit and push a second smoke-file change.
   - This is the qualifying branch push.
7. Poll `codealmanac runs list --json` from the temp branch.
   - Expect newest run source.kind=`conversation_batch`.
8. Query production DB read-only for the run row.
   - Expect `source_json.kind=conversation_batch`.
   - Expect `source_json.branch=branch`.
   - Expect `delivery_json.kind=commit_to_branch`.
   - Expect `delivery_json.branch=branch`.
   - Expect `delivery_json.expected_head_sha=<second push sha>`.
9. Cleanup:
   - Disable the temp branch trigger.
   - Revoke temp capture credential.
   - Cancel the smoke run if it is still active.
   - Delete the remote smoke branch after proof is collected.
   - Remove the temp worktree.
```

## Out Of Scope

- Waiting for the model worker to finish a durable wiki update.
- Testing `pr` delivery mode. The delivery mode proof is from persisted
  `delivery_json`; `commit` is the launch default.
- Reworking the run DTO to expose delivery details. That is a product/API
  slice if we decide users need it.

## Verification Gates

- CLI production auth works from the temp HOME.
- Capture hook upload returns `upload_status=uploaded`.
- GitHub push webhook creates exactly one relevant production run.
- CLI run list shows the run as `Captured chats on <branch>`.
- Production DB row proves `conversation_batch` source and `commit_to_branch`
  delivery for the second-push SHA.
- Cleanup commands complete or leave explicitly documented residue.

## Result

Executed on 2026-07-03 against production.

The original proof target was a `conversation_batch` run, but the production
smoke correctly exercised the branch-source fallback because no eligible
captured conversation bundle was claimed for the final smoke push.

Verified:

- Chrome loaded signed-in production `/setup` for `rohans0509`.
- Chrome loaded the production repository dashboard for
  `AlmanacCode/codealmanac`.
- GitHub App `push` webhook delivery is enabled.
- Render backend service `srv-d8g8nb37uimc739vnnsg` deployed hosted commit
  `eb8dba042c80ed573ad53399f002126d2e14bc29`.
- Modal app `codealmanac-hosted-updates` was redeployed after the worker
  checkout fix.
- A fresh push to
  `codealmanac-smoke/slice-68-20260703102325` created run
  `773da5fb-9871-4f83-8797-ddf651c635ce`.
- The run source was immutable:
  `before_sha=d11d29b96dbfe334b2d9cb99fa5aafcc7893d98a`,
  `head_sha=23a0a03209ff1804944eb094f589647dc13de47b`.
- The run delivered with summary `No wiki changes made.`
- Chrome showed the delivered run at the top of the production dashboard.
- Cleanup completed: smoke trigger disabled, temp capture credential revoked,
  remote smoke branch deleted, temp worktree removed.

Fixes required during the smoke:

- Hosted commit `03c57f8` split initial wiki creation from branch updates so
  branch pushes map to `ingest` rather than `init`.
- Hosted commit `eb8dba0` made branch-source workers checkout the exact run
  `head_sha` and fetch the `before_sha` object needed for `git:range`.

Known residue:

- Older failed smoke runs remain in the dashboard as useful evidence.
- Old conversation-batch smoke run
  `aeb55370-cbdd-4ded-af6a-5e0e22f0ef0a` is still marked `running` from a stale
  pre-fix worker image; do not treat it as current pipeline evidence.

## Risk Controls

- Never push to `dev` or `main`.
- Do not stage the pre-existing untracked webhook-hardening plan.
- Use a temp branch name that can be deleted safely.
- Keep smoke file content under a clearly named temporary path on that branch.
- If the worker starts before cancellation, let the DB/run evidence decide
  whether cleanup waits or cancels.
