# CLI Command Groups Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep CLI command registration readable after extracting it from `src/cli.ts`.

**Architecture:** Keep `src/cli/register-commands.ts` as the command-group composition root. Move each help group into a matching registration module under `src/cli/`: query, edit, wiki lifecycle, and setup. Preserve all Commander option mappings and command order.

**Tech Stack:** TypeScript, Commander, Vitest.

---

### Task 1: Split Command Group Registration

**Files:**
- Create: `src/cli/register-query-commands.ts`
- Create: `src/cli/register-edit-commands.ts`
- Create: `src/cli/register-wiki-lifecycle-commands.ts`
- Create: `src/cli/register-setup-commands.ts`
- Modify: `src/cli/register-commands.ts`

**Steps:**
1. Move query commands to `register-query-commands.ts`.
2. Move edit commands to `register-edit-commands.ts`.
3. Move bootstrap/capture/hook/reindex commands to `register-wiki-lifecycle-commands.ts`.
4. Move setup/doctor/update/uninstall commands to `register-setup-commands.ts`.
5. Keep `register-commands.ts` as the ordered group caller.

### Task 2: Verify

**Commands:**
- `npm test -- test/cli.test.ts`
- `npm test`
- `npm run lint`
- `npm run build`

**Expected:** Command behavior, help grouping, and build output remain unchanged.
