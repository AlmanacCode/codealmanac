# Topics Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce setup boilerplate in `almanac topics` mutating commands while preserving behavior.

**Architecture:** Keep one command module for the `topics` command group. Extract only the repeated fresh-workspace setup path used by mutating commands: resolve wiki root, refresh index, load `topics.yaml`, and open `index.db`. Do not split each verb into separate files yet.

**Tech Stack:** TypeScript, better-sqlite3, Vitest.

---

### Task 1: Extract Fresh Topics Workspace

**Files:**
- Modify: `src/commands/topics.ts`

**Steps:**
1. Add a `TopicsWorkspace` interface.
2. Add `openFreshTopicsWorkspace(options)` for mutating commands.
3. Add `closeWorkspace(workspace)` to centralize DB cleanup.
4. Replace repeated setup in `create`, `link`, `rename`, `delete`, and `describe`.

### Task 2: Verify Behavior

**Commands:**
- `npm test -- test/topics.test.ts test/tag.test.ts`
- `npm test`
- `npm run lint`
- `npm run build`

**Expected:** No output or JSON semantics change; all tests and build pass.
