# Provider, Codex, and CLI Bootstrap Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce one-off provider install logic, split the overgrown Codex harness adapter, and replace ad hoc SQLite-free CLI parsing with a clearer dispatch layer without changing external behavior.

**Architecture:** Introduce shared provider install-target helpers used by setup, uninstall, and doctor. Move SQLite-free command dispatch into a dedicated CLI module with small command descriptors. Split Codex provider code into focused modules while preserving the existing public imports used by tests.

**Tech Stack:** TypeScript ESM, Commander, Vitest, Node fs/process APIs.

---

### Task 1: Provider Instruction Targets

**Files:**
- Create: `src/agent/install-targets.ts`
- Modify: `src/commands/setup.ts`
- Modify: `src/commands/uninstall.ts`
- Modify: `src/commands/doctor-checks/install.ts`
- Test: `test/setup.test.ts`, `test/uninstall.test.ts`, `test/doctor.test.ts`

**Steps:**
1. Extract Claude import-file and Codex inline-block behavior behind provider instruction target helpers.
2. Keep setup and uninstall output compatible with existing tests.
3. Add doctor checks for Codex instructions while preserving existing stable install keys.
4. Run targeted setup/uninstall/doctor tests.

### Task 2: SQLite-Free CLI Bootstrap

**Files:**
- Create: `src/cli/sqlite-free.ts`
- Modify: `src/cli.ts`
- Test: `test/cli.test.ts`

**Steps:**
1. Move SQLite-free dispatch and flag parsers into a focused module.
2. Use a small descriptor table for recovery-safe command dispatch.
3. Preserve setup shortcut behavior and worker/update fast paths.
4. Run CLI tests.

### Task 3: Codex Harness Adapter Split

**Files:**
- Create: `src/harness/providers/codex/request.ts`
- Create: `src/harness/providers/codex/app-server.ts`
- Create: `src/harness/providers/codex/events.ts`
- Modify: `src/harness/providers/codex.ts`
- Test: `test/codex-harness-provider.test.ts`

**Steps:**
1. Move request construction and unsupported-field validation into `request.ts`.
2. Move app-server process/JSON-RPC runner into `app-server.ts`.
3. Move notification/event/usage mapping into `events.ts`.
4. Re-export existing public test imports from `codex.ts`.
5. Replace hard-coded app-server client version with package version lookup.
6. Run Codex harness tests.

### Task 4: Full Verification

**Steps:**
1. Run `npm run lint`.
2. Run `npm test`.
3. Run `almanac health` and note remaining wiki-only dead refs if unchanged.

---

## Implementation Log

- 2026-05-13: Initial plan created after reading `provider-install-layer`, `harness-providers`, `sqlite-free-cli-bootstrap`, and `lifecycle-cli`.
- 2026-05-13: Began Task 1 by creating `src/agent/install-targets.ts` to centralize Claude import-file and Codex inline-instruction behavior.
- 2026-05-13: Updated `src/commands/setup.ts` and `src/commands/uninstall.ts` to call the shared instruction helpers while preserving legacy exports used by tests.
- 2026-05-13: Updated `doctor` install checks so `install.import` validates both Claude import and Codex managed instructions while keeping the existing stable key list.
- 2026-05-13: Verified Task 1 with `npm test -- test/setup.test.ts test/uninstall.test.ts test/doctor.test.ts` and `npm run lint`.
- 2026-05-13: Completed Task 2 by moving recovery-safe command routing and setup shortcut parsing into `src/cli/sqlite-free.ts`.
- 2026-05-13: Verified Task 2 with `npm test -- test/cli.test.ts` and `npm run lint`.
- 2026-05-13: Began Task 3 by extracting Codex request construction to `src/harness/providers/codex/request.ts` and Codex readiness probes to `src/harness/providers/codex/status.ts`.
- 2026-05-13: Replaced the hard-coded Codex app-server client version with package-version lookup from the request module.
- 2026-05-13: Verified the Codex extraction with `npm test -- test/codex-harness-provider.test.ts` and `npm run lint`.

## Decision Log

- Keep this as a refactor, not a feature expansion: no new public commands and no behavior change unless required to remove a smell safely.
- Preserve existing exported compatibility functions from `setup.ts` and `uninstall.ts` so current tests and external callers do not need a coordinated migration.
- Do not implement Cursor install behavior in this pass. Cursor remains gated/placeholder; the target abstraction should make it easier later without pretending support exists now.
- Keep `install.import` as the stable doctor key rather than adding a new Codex-specific install key. The message now describes "Agent instruction entries" so JSON consumers do not see a breaking key list.
- Keep `tryParseSetupShortcut` re-exported from `src/cli.ts` even though its implementation moved, because tests and external code may already import it from the process entrypoint.
- Keep deeper Codex event/app-server extraction incremental. The request and status seams are now isolated; the remaining event/protocol split should be a follow-up with no behavior changes and the fake app-server suite as the guardrail.
