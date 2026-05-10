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
  - Capture session discovery for Codex/Cursor and cross-app `--all-apps` still needs the provider-specific resolver layer.

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

## 2026-05-09 20:35 PDT

- Built: foreground event observer path.
- Files changed:
  - `src/process/manager.ts`
  - `src/process/background.ts`
  - `src/operations/types.ts`
  - `src/operations/build.ts`
  - `src/operations/absorb.ts`
  - `src/operations/garden.ts`
  - `src/commands/operations.ts`
  - `src/cli/register-wiki-lifecycle-commands.ts`
  - `test/process-manager.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Behavior: foreground operations can now receive normalized harness events
  while the process manager also writes them to the JSONL run log. CLI
  foreground commands print compact progress lines for text, tool use, errors,
  and done events.
- Tests run:
  - `npm test -- test/process-manager.test.ts test/operation-commands.test.ts test/cli.test.ts`
  - `npm run lint`
- Result: 3 test files passed, 30 tests passed; TypeScript lint passed.

## 2026-05-09 20:39 PDT

- Built: streaming `jobs attach` path.
- Files changed:
  - `src/commands/jobs.ts`
  - `src/cli/register-wiki-lifecycle-commands.ts`
  - `test/jobs-command.test.ts`
  - `docs/plans/2026-05-10-v1-implementation-log.md`
- Behavior: `almanac jobs attach <run-id>` now tails a run log until the run is terminal instead of printing only the current log snapshot.
- Tests run:
  - `npm test -- test/jobs-command.test.ts test/cli.test.ts`
  - `npm run lint`
  - `npm test`
  - `git diff --check`
- Result: focused tests passed, TypeScript lint passed, full suite passed with 47 test files and 476 tests, and diff whitespace check passed.

## 2026-05-09 20:45 PDT

- Built: Phase 8 old architecture cleanup.
- Files removed:
  - `src/commands/bootstrap.ts`
  - `src/commands/capture.ts`
  - `src/commands/captureStatus.ts`
  - `src/agent/sdk.ts`
  - `src/agent/selection.ts`
  - `prompts/bootstrap.md`
  - `prompts/writer.md`
  - `prompts/reviewer.md`
  - old bootstrap/capture/capture-status test suites
- Files changed:
  - `src/agent/prompts.ts`
  - `src/agent/providers/prompt.ts`
  - user-facing hints in list, doctor, setup, and wiki resolution
  - `README.md`
  - V1 implementation and decision logs
- Behavior:
  - V1 operation prompts under `prompts/operations/` are the required bundled prompts.
  - Public guidance now points at `almanac init`, not the removed `almanac bootstrap`.
  - Legacy capture status state readers are gone; status-like UX is the V1 `jobs` surface.
  - Generic non-programmatic-subagent fallback no longer hardcodes reviewer semantics.
- Tests run:
  - `npm run lint`
  - `npm test`
- Result: TypeScript lint passed; full suite passed with 44 test files and 421 tests.

## 2026-05-09 20:54 PDT

- Built: review-fix pass after V1 review agent.
- Files changed:
  - `src/commands/operations.ts`
  - `src/commands/session-transcripts.ts`
  - `test/operation-commands.test.ts`
- Review findings addressed:
  - Foreground operation failures now render error outcomes and nonzero exits.
  - Lifecycle commands now use configured provider/model defaults when `--using` is omitted.
  - Validation errors such as invalid `--using` and `--json` foreground conflicts now honor JSON output.
  - Claude capture discovery now applies `--all`, `--limit`, and `--since`, and fails clearly for unsupported `--all-apps` discovery.
- Tests run:
  - `npm test -- test/operation-commands.test.ts`
  - `npm run lint`
  - `npm test -- test/operation-commands.test.ts test/cli.test.ts`
  - `npm test`
  - `git diff --check`
- Result: focused tests passed, TypeScript lint passed, full suite passed with 44 test files and 424 tests, and diff whitespace check passed.

## 2026-05-09 21:05 PDT

- Built: code-quality review fixes and wiki gardening.
- Review findings addressed:
  - Running-job cancellation can no longer be overwritten by a stale in-memory foreground record.
  - Process finalization failures now still attempt to write a terminal failed run record.
  - Codex and Cursor harness metadata now describes current adapter behavior instead of aspirational provider capabilities.
  - Build, Absorb, and Garden now share the common operation run-spec and process-dispatch plumbing in `src/operations/run.ts`.
- Wiki gardened:
  - Removed stale `bootstrap-agent` page.
  - Added V1 pages for lifecycle operations, process manager runs, harness providers, lifecycle CLI, operation prompts, and build operation.
  - Updated capture/session/harness pages to describe Absorb, `.almanac/runs/`, provider adapters, and old pipeline removal.
  - Updated `.almanac/README.md` and topics so the wiki no longer points future agents at writer/reviewer/bootstrap as current architecture.
- Files changed:
  - `src/process/manager.ts`
  - `src/harness/providers/metadata.ts`
  - `src/operations/run.ts`
  - `src/operations/build.ts`
  - `src/operations/absorb.ts`
  - `src/operations/garden.ts`
  - `.almanac/` wiki pages and taxonomy
  - process/provider tests
- Tests run:
  - `npm test -- test/process-manager.test.ts test/harness-provider-registry.test.ts test/build-operation.test.ts test/absorb-operation.test.ts test/garden-operation.test.ts test/operation-commands.test.ts`
  - `npm run lint`
- Result: focused tests passed and TypeScript lint passed.

## 2026-05-09 21:09 PDT

- Built: second code-quality review fixes.
- Review findings addressed:
  - Queued cancellation markers now prevent the child startup transition from overwriting cancellation before harness execution.
  - Claude harness metadata no longer advertises structured output until the adapter maps `spec.output`.
- Files changed:
  - `src/process/records.ts`
  - `src/process/manager.ts`
  - `src/commands/jobs.ts`
  - `src/harness/providers/metadata.ts`
  - `test/process-background.test.ts`
  - `test/harness-provider-registry.test.ts`
  - `.almanac/pages/process-manager-runs.md`
- Tests run:
  - `npm test -- test/process-background.test.ts test/process-manager.test.ts test/harness-provider-registry.test.ts`
  - `npm run lint`
- Result: focused tests passed and TypeScript lint passed.

## 2026-05-10 Prompt Doctrine Split

- Built: shared base prompt modules for project-memory doctrine, page
  notability/graph structure, and page syntax/writing conventions.
- Files added:
  - `prompts/base/purpose.md`
  - `prompts/base/notability.md`
  - `prompts/base/syntax.md`
- Files changed:
  - `prompts/operations/build.md`
  - `prompts/operations/absorb.md`
  - `prompts/operations/garden.md`
  - `src/agent/prompts.ts`
  - `src/operations/run.ts`
  - operation prompt tests
  - `.almanac/pages/operation-prompts.md`
  - V1 architecture/implementation docs
- Behavior:
  - All operation specs now assemble `base/purpose`, `base/notability`,
    `base/syntax`, the selected operation prompt, runtime context, and
    command-specific context.
  - Build/Absorb/Garden prompts now describe soft algorithms and optional
    helper/subagent usage without reintroducing fixed writer/reviewer roles.
  - Base syntax guidance covers frontmatter, grounding, natural slugs, topics,
    hubs, wikilinks, `files:`, and prompt-level `sources:` conventions.
- Tests run:
  - `npm test -- build-operation.test.ts absorb-operation.test.ts garden-operation.test.ts`
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `node dist/codealmanac.js health`
  - `git diff --check`
- Result: targeted operation tests passed with 3 files and 12 tests; TypeScript
  lint passed; full suite passed with 44 files and 427 tests; build passed;
  wiki health was clean; diff whitespace check passed.
