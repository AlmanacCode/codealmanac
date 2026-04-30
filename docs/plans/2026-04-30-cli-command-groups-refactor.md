# CLI Command Groups Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep CLI command registration readable after extracting it from `src/cli.ts`.

**Architecture:** Keep `src/cli/registerCommands.ts` as the command-group composition root. Move each help group into a matching registration module under `src/cli/`: query, edit, wiki lifecycle, and setup. Preserve all Commander option mappings and command order.

**Tech Stack:** TypeScript, Commander, Vitest.

---

### Task 1: Split Command Group Registration

**Files:**
- Create: `src/cli/registerQueryCommands.ts`
- Create: `src/cli/registerEditCommands.ts`
- Create: `src/cli/registerWikiLifecycleCommands.ts`
- Create: `src/cli/registerSetupCommands.ts`
- Modify: `src/cli/registerCommands.ts`

**Steps:**
1. Move query commands to `registerQueryCommands.ts`.
2. Move edit commands to `registerEditCommands.ts`.
3. Move bootstrap/capture/hook/reindex commands to `registerWikiLifecycleCommands.ts`.
4. Move setup/doctor/update/uninstall commands to `registerSetupCommands.ts`.
5. Keep `registerCommands.ts` as the ordered group caller.

### Task 2: Verify

**Commands:**
- `npm test -- test/cli.test.ts`
- `npm test`
- `npm run lint`
- `npm run build`

**Expected:** Command behavior, help grouping, and build output remain unchanged.
