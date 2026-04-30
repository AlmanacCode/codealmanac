# CLI Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the CLI entrypoint easier to read by moving command wiring and help formatting into named modules without changing command behavior.

**Architecture:** Keep `src/cli.ts` as the process-level entrypoint: invocation-name handling, update scheduling, setup shortcut routing, and `program.parseAsync`. Move Commander registration into `src/cli/registerCommands.ts`, shared CLI helpers into `src/cli/helpers.ts`, and root help rendering into `src/cli/help.ts`. Do not introduce a framework, domain layer, or new runtime behavior.

**Tech Stack:** TypeScript, Commander, Vitest.

---

### Task 1: Extract Shared CLI Helpers

**Files:**
- Create: `src/cli/helpers.ts`
- Modify: `src/cli.ts`

**Steps:**
1. Move `emit`, `collectOption`, `parsePositiveInt`, and `readStdin` into `src/cli/helpers.ts`.
2. Export a small `CommandResult` interface from `src/cli/helpers.ts`.
3. Import helpers from `src/cli.ts`.
4. Run `npm run lint`.

### Task 2: Extract Help Rendering

**Files:**
- Create: `src/cli/help.ts`
- Modify: `src/cli.ts`

**Steps:**
1. Move `HELP_GROUPS`, `configureGroupedHelp`, and the default subcommand help renderer into `src/cli/help.ts`.
2. Keep the existing ANSI formatting and Commander behavior unchanged.
3. Import `configureGroupedHelp` from `src/cli.ts`.
4. Run `npm test -- test/cli.test.ts`.

### Task 3: Extract Command Registration

**Files:**
- Create: `src/cli/registerCommands.ts`
- Modify: `src/cli.ts`

**Steps:**
1. Move all `program.command(...)` wiring into `registerCommands(program)`.
2. Keep command actions calling the same command modules with the same option mapping.
3. Keep `src/cli.ts` responsible for creating the `Command`, configuring metadata, setup shortcut routing, grouped help, and parsing.
4. Run `npm test -- test/cli.test.ts`.

### Task 4: Verify Full Baseline

**Commands:**
- `npm run lint`
- `npm test`

**Expected:** TypeScript passes and the full Vitest suite remains green.
