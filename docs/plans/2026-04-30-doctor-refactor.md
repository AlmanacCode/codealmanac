# Doctor Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `almanac doctor` easier to read by splitting install, update, wiki, probe, and formatting responsibilities out of the command entrypoint.

**Architecture:** Keep `src/commands/doctor.ts` as the command composition root. Put section-specific checks in `src/commands/doctor-checks/` because `src/commands/doctor.ts` already occupies the `doctor` path. Preserve existing output keys, JSON shape, exit behavior, injection points, and the in-progress ephemeral install path classification behavior.

**Tech Stack:** TypeScript, Vitest, Commander command modules.

---

### Task 1: Extract Types and Shared Duration Formatting

**Files:**
- Create: `src/commands/doctor-checks/types.ts`
- Create: `src/commands/doctor-checks/duration.ts`
- Modify: `src/commands/doctor.ts`

**Steps:**
1. Move `DoctorOptions`, `DoctorResult`, `Check`, `DoctorReport`, and `SqliteProbeResult` into `types.ts`.
2. Move `formatDuration` into `duration.ts`.
3. Re-export public doctor types from `doctor.ts`.
4. Run `npm run lint`.

### Task 2: Extract Check Sections

**Files:**
- Create: `src/commands/doctor-checks/install.ts`
- Create: `src/commands/doctor-checks/updates.ts`
- Create: `src/commands/doctor-checks/wiki.ts`
- Create: `src/commands/doctor-checks/probes.ts`
- Modify: `src/commands/doctor.ts`

**Steps:**
1. Move install checks and hook/guide/import checks to `install.ts`.
2. Move update checks to `updates.ts`.
3. Move wiki checks, counts, registry, last-capture, and health summary to `wiki.ts`.
4. Move install path, SQLite, auth, and package-version probes to `probes.ts`.
5. Run `npm test -- test/doctor.test.ts`.

### Task 3: Extract Report Formatting

**Files:**
- Create: `src/commands/doctor-checks/format.ts`
- Modify: `src/commands/doctor.ts`

**Steps:**
1. Move `formatReport`, `formatCheck`, and status icon logic to `format.ts`.
2. Import shared ANSI constants from `src/ansi.ts`.
3. Run `npm test`, `npm run lint`, and `npm run build`.
