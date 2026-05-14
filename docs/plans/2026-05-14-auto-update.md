# Auto Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `almanac update` idempotent and scheduleable, then expose self-update as a normal Almanac automation task.

**Architecture:** `update` owns update semantics: check, no-op when current, install when newer, and serialize installs with a global lock. `automation` owns scheduler mechanics and treats update as another selected scheduled task beside capture and Garden. No private update command or scheduler-only update path is introduced.

**Tech Stack:** TypeScript, Commander, launchd plists, Vitest, npm global installs.

---

### Task 1: Update Core Cleanup

**Files:**
- Create: `src/update/version.ts`
- Create: `src/update/install.ts`
- Create: `src/update/lock.ts`
- Modify: `src/commands/update.ts`
- Modify: `src/update/check.ts`
- Modify: `src/update/announce.ts`
- Modify: `src/update/state.ts`
- Test: `test/update.test.ts`

**Steps:**
1. Extract package-version lookup into `src/update/version.ts`.
2. Extract npm install execution into `src/update/install.ts`.
3. Add a simple stale-aware global update lock in `src/update/lock.ts`.
4. Change bare `runUpdate()` to call `checkForUpdate({ force: true })`, no-op when current, skip dismissed versions, and install only when newer.
5. Preserve `--check`, `--dismiss`, and deprecated notifier flags.
6. Add tests proving current/no-op, newer/install, dismissed/skip, npm failure, and lock behavior.

### Task 2: Automation Task Selection

**Files:**
- Modify: `src/automation/tasks.ts`
- Modify: `src/commands/automation.ts`
- Modify: `src/commands/setup/automation-step.ts`
- Modify: `src/cli/register-wiki-lifecycle-commands.ts`
- Modify: `src/cli/sqlite-free.ts`
- Test: `test/automation.test.ts`
- Test: `test/cli.test.ts`

**Steps:**
1. Add `update` to `ScheduledTaskId` with label `com.codealmanac.update`, default interval `1d`, logs, plist path, and command `almanac update`.
2. Refactor automation install/status/uninstall around selected task IDs while preserving default install behavior for capture + Garden.
3. Add positional task selection: `almanac automation install update --every 1d`, `status update`, `uninstall update`.
4. Keep existing `--garden-off`, `--garden-every`, and setup behavior compatible.
5. Update sqlite-free parsing to match Commander.
6. Add tests for task selection, update plist output, status, uninstall, and fast-path parsing.

### Task 3: Diagnostics and Verification

**Files:**
- Modify: `src/commands/doctor-checks/updates.ts`
- Modify: `src/commands/doctor-checks/install.ts`
- Modify: `README.md` if command docs need adjustment

**Steps:**
1. Report update state after idempotent update changes.
2. Report auto-update scheduler status through the automation task status path where possible.
3. Run focused update/automation tests.
4. Run `npm test`.
