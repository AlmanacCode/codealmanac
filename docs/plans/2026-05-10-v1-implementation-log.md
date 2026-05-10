# V1 Implementation Log

This log tracks implementation checkpoints for the V1 harness/process refactor.

## 2026-05-10 Initial Plan Checkpoint

- Built: branch `v1`; committed and pushed architecture/research docs; created implementation plan.
- Files changed:
  - `docs/plans/2026-05-10-harness-process-architecture.md`
  - `docs/research/2026-05-08-auto-generating-wikis-deep-research.md`
  - `docs/research/2026-05-09-claude-harness-capabilities.md`
  - `docs/research/2026-05-09-codex-harness-capabilities.md`
  - `docs/plans/2026-05-10-v1-harness-refactor-implementation.md`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
  - `docs/plans/2026-05-10-v1-decision-log.md`
- Tests run: not yet for implementation; first checkpoint is docs/planning only.
- Result: plan ready for implementation.
- Next: start Phase 1 prompt system reset.

## 2026-05-09 19:42 PDT

- Built: Phase 1.1 minimal prompt layout.
- Files changed:
  - `prompts/operations/build.md`
  - `prompts/operations/absorb.md`
  - `prompts/operations/garden.md`
  - `prompts/agents/.gitkeep`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Tests run: `npm test -- test/auth.test.ts test/bootstrap.test.ts test/capture.test.ts`
- Result: 3 test files passed, 58 tests passed.
- Next: Phase 1.2 path-based prompt loader and `joinPrompts`.

## 2026-05-09 19:44 PDT

- Built: Phase 1.2 path-based prompt loading and `joinPrompts`.
- Files changed:
  - `src/agent/prompts.ts`
  - `test/bootstrap.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Tests run: `npm test -- test/bootstrap.test.ts`
- Result: 1 test file passed, 28 tests passed.
- Next: Phase 2.1 provider-neutral harness types/events/tools.

## 2026-05-09 19:45 PDT

- Built: Phase 2.1 provider-neutral harness types, events, and base tool registry.
- Files changed:
  - `src/harness/types.ts`
  - `src/harness/events.ts`
  - `src/harness/tools.ts`
  - `src/harness/index.ts`
  - `test/harness-types.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Tests run:
  - `npm test -- test/harness-types.test.ts`
  - `npm run lint`
- Result: 1 test file passed, 5 tests passed; TypeScript lint passed.
- Next: Phase 2.2 harness provider registry.

## 2026-05-09 19:47 PDT

- Built: Phase 2.2 harness provider registry with explicit provider metadata and placeholder adapters.
- Files changed:
  - `src/harness/providers/index.ts`
  - `src/harness/providers/metadata.ts`
  - `src/harness/providers/not-implemented.ts`
  - `src/harness/providers/claude.ts`
  - `src/harness/providers/codex.ts`
  - `src/harness/providers/cursor.ts`
  - `src/harness/index.ts`
  - `test/harness-provider-registry.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
  - `docs/plans/2026-05-10-v1-decision-log.md`
- Tests run:
  - `npm test -- test/harness-types.test.ts test/harness-provider-registry.test.ts`
  - `npm run lint`
- Result: 2 test files passed, 9 tests passed; TypeScript lint passed.
- Next: Phase 3.1 process run records and ids.

## 2026-05-09 19:49 PDT

- Built: Phase 3.1 process run ids, run records, atomic writes, listing, finishing, and stale detection.
- Files changed:
  - `src/process/types.ts`
  - `src/process/ids.ts`
  - `src/process/records.ts`
  - `src/process/index.ts`
  - `test/process-records.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Tests run:
  - `npm test -- test/process-records.test.ts`
  - `npm run lint`
- Result: 1 test file passed, 5 tests passed; TypeScript lint passed.
- Next: Phase 3.2 wiki page snapshot and delta accounting.

## 2026-05-09 19:51 PDT

- Built: Phase 3.2 wiki page snapshots and delta accounting.
- Files changed:
  - `src/process/snapshots.ts`
  - `src/process/index.ts`
  - `test/process-snapshots.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Tests run:
  - `npm test -- test/process-snapshots.test.ts`
  - `npm run lint`
- Result: 1 test file passed, 5 tests passed; TypeScript lint passed.
- Next: Phase 3.3 foreground process manager start path.

## 2026-05-09 19:53 PDT

- Built: Phase 3.3 foreground process manager start path with run records, event logs, page deltas, reindex, and failure handling.
- Files changed:
  - `src/process/logs.ts`
  - `src/process/manager.ts`
  - `src/process/index.ts`
  - `src/harness/types.ts`
  - `test/process-manager.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Tests run:
  - `npm test -- test/process-manager.test.ts`
  - `npm run lint`
- Result: 1 test file passed, 2 tests passed; TypeScript lint passed.
- Next: Phase 3.4 background job execution.

## 2026-05-09 19:58 PDT

- Built: Phase 3.4 background job execution.
- Files changed:
  - `src/process/background.ts`
  - `src/process/spec.ts`
  - `src/process/types.ts`
  - `src/process/records.ts`
  - `src/process/index.ts`
  - `src/cli.ts`
  - `test/process-background.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
  - `docs/plans/2026-05-10-v1-decision-log.md`
- Tests run:
  - `npm test -- test/process-records.test.ts test/process-manager.test.ts test/process-background.test.ts`
  - `npm run lint`
- Result: 3 test files passed, 10 tests passed; TypeScript lint passed.
- Next: Phase 4.1 Claude harness adapter port.

## 2026-05-09 20:03 PDT

- Built: Phase 4.1 Claude harness adapter port.
- Files changed:
  - `src/harness/providers/claude.ts`
  - `test/claude-harness-provider.test.ts`
  - `test/harness-provider-registry.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
  - `docs/plans/2026-05-10-v1-decision-log.md`
- Tests run:
  - `npm test -- test/claude-harness-provider.test.ts test/harness-provider-registry.test.ts`
  - `npm run lint`
- Result: 2 test files passed, 6 tests passed; TypeScript lint passed.
- Next: Phase 4.2 Codex harness adapter port.

## 2026-05-09 20:06 PDT

- Built: Phase 4.2 Codex harness adapter port.
- Files changed:
  - `src/harness/providers/codex.ts`
  - `test/codex-harness-provider.test.ts`
  - `test/harness-provider-registry.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
  - `docs/plans/2026-05-10-v1-decision-log.md`
- Tests run:
  - `npm test -- test/codex-harness-provider.test.ts test/harness-provider-registry.test.ts`
  - `npm run lint`
- Result: 2 test files passed, 9 tests passed; TypeScript lint passed.
- Next: Phase 4.3 Cursor harness adapter or Phase 5 operation spec builders,
  depending on whether we keep Cursor in V1.

## 2026-05-09 20:09 PDT

- Built: Phase 4.3 Cursor decision and Phase 5.1 Build operation.
- Files changed:
  - `src/operations/types.ts`
  - `src/operations/build.ts`
  - `src/commands/init.ts`
  - `test/build-operation.test.ts`
  - `test/init-helper.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
  - `docs/plans/2026-05-10-v1-decision-log.md`
- Tests run:
  - `npm test -- test/build-operation.test.ts test/init-helper.test.ts`
  - `npm run lint`
- Result: 2 test files passed, 19 tests passed; TypeScript lint passed.
- Next: Phase 5.2 internal Absorb operation for capture/ingest.

## 2026-05-09 20:11 PDT

- Built: Phase 5.2 internal Absorb operation.
- Files changed:
  - `src/operations/absorb.ts`
  - `test/absorb-operation.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Tests run:
  - `npm test -- test/absorb-operation.test.ts`
  - `npm run lint`
- Result: 1 test file passed, 4 tests passed; TypeScript lint passed.
- Next: Phase 5.3 Garden operation.

## 2026-05-09 20:12 PDT

- Built: Phase 5.3 Garden operation.
- Files changed:
  - `src/operations/garden.ts`
  - `test/garden-operation.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Tests run:
  - `npm test -- test/garden-operation.test.ts`
  - `npm run lint`
- Result: 1 test file passed, 4 tests passed; TypeScript lint passed.
- Next: Phase 6.1 CLI command surface and shared `--using` parsing.

## 2026-05-09 20:15 PDT

- Built: Phase 6.1 CLI command surface and shared `--using` parsing.
- Files changed:
  - `src/commands/operations.ts`
  - `src/cli/register-wiki-lifecycle-commands.ts`
  - `test/operation-commands.test.ts`
  - `test/cli.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Tests run:
  - `npm test -- test/operation-commands.test.ts test/cli.test.ts`
  - `npm run lint`
- Result: 2 test files passed, 25 tests passed; TypeScript lint passed.
- Next: Phase 6.2 Jobs commands over `.almanac/runs/`.

## 2026-05-09 20:18 PDT

- Built: Phase 6.2 Jobs commands over `.almanac/runs/`.
- Files changed:
  - `src/commands/jobs.ts`
  - `src/cli/register-wiki-lifecycle-commands.ts`
  - `test/jobs-command.test.ts`
  - `test/cli.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Tests run:
  - `npm test -- test/jobs-command.test.ts test/cli.test.ts`
  - `npm run lint`
- Result: 2 test files passed, 24 tests passed; TypeScript lint passed.
- Next: run broader V1 verification, then request review.

## 2026-05-09 20:30 PDT

- Built: Review fixes after V1 review agent.
- Files changed:
  - `src/cli/help.ts`
  - `src/cli/register-wiki-lifecycle-commands.ts`
  - `src/commands/operations.ts`
  - `src/harness/providers/codex.ts`
  - `src/harness/providers/metadata.ts`
  - `src/operations/build.ts`
  - `src/process/background.ts`
  - `test/build-operation.test.ts`
  - `test/capture-status.test.ts`
  - `test/cli.test.ts`
  - `test/codex-harness-provider.test.ts`
  - `test/deprecations.test.ts`
  - `test/harness-provider-registry.test.ts`
  - `test/operation-commands.test.ts`
  - `test/process-background.test.ts`
- Review findings addressed:
  - Retired public `almanac bootstrap` command wiring from V1 lifecycle commands.
  - Added populated-wiki guard for `almanac init` unless `--force` is passed.
  - Stopped empty `capture` invocations from launching an Absorb run without transcript context.
  - Added child-side cancelled-record check before a background job starts harness execution.
  - Rerouted `capture status` and `ps` to the V1 jobs surface with deprecation warnings.
  - Tightened Codex capabilities and rejected unsupported Codex exec fields.
- Tests run:
  - `npm test`
  - `npm run lint`
  - `git diff --check`
- Result: 47 test files passed, 473 tests passed; TypeScript lint passed; diff whitespace check passed.
- Remaining known follow-up:
  - `jobs attach` still needs a true streaming/tail implementation.
  - Foreground mode records normalized events but needs a human-readable live event renderer.
  - Capture session discovery for Codex/Cursor, `--since`, `--limit`, and `--all` still needs the provider-specific resolver layer.

## 2026-05-09 20:33 PDT

- Built: Claude transcript discovery for V1 `capture`.
- Files changed:
  - `src/commands/session-transcripts.ts`
  - `src/commands/operations.ts`
  - `test/operation-commands.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
  - `docs/plans/2026-05-10-v1-decision-log.md`
- Behavior:
  - Explicit transcript files are validated and passed to Absorb.
  - No-arg `capture` defaults to Claude transcript discovery.
  - `capture --session <id>` finds matching Claude `<id>.jsonl`.
  - Codex/Cursor capture discovery still fails clearly unless transcript files are provided.
- Tests run:
  - `npm test`
  - `npm run lint`
  - `git diff --check`
- Result: 47 test files passed, 474 tests passed; TypeScript lint passed; diff whitespace check passed.
