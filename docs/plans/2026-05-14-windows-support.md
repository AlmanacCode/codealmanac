# Windows Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the setup, automation, and doctor surfaces work on Windows without changing capture or Garden semantics.

**Architecture:** Keep `almanac automation` as the public command and split scheduler behavior by platform. macOS continues to use launchd plists; Windows uses Task Scheduler through `schtasks` and records small local manifests under `~/.almanac/automation/` so status and doctor can report what was installed.

**Tech Stack:** TypeScript, Node child processes, Windows `schtasks`, macOS launchd, Vitest.

---

## Research Notes

Microsoft documents `schtasks /Create` with `/SC MINUTE`, `/MO <modifier>`, `/TN <taskname>`, `/TR <taskrun>`, and `/F` for replacing existing tasks. Minute schedules accept intervals in the 1-1439 minute range, while daily schedules accept day modifiers. Node's `child_process` documentation says Windows `.bat` and `.cmd` files cannot be launched directly with `execFile`; callers should use `cmd.exe`, `exec`, or `spawn` with shell behavior. This matters because npm's Windows global bins are command shims such as `almanac.cmd` and `npm.cmd`.

## Task 1: Windows Scheduler Adapter

**Files:**
- Modify: `src/commands/automation.ts`
- Create: `src/commands/automation/windows.ts`
- Test: `test/automation.test.ts`

**Steps:**
1. Add failing tests for `runAutomationInstall({ platform: "win32" })` that expect `schtasks /Create` calls for capture and Garden.
2. Add failing tests for Windows status and uninstall that use manifests under `~/.almanac/automation/`.
3. Implement Windows install/status/uninstall helpers behind the existing automation command entry points.
4. Preserve existing launchd behavior for non-Windows platforms.

## Task 2: Setup and Doctor Platform Awareness

**Files:**
- Modify: `src/commands/setup.ts`
- Modify: `src/commands/doctor-checks/install.ts`
- Modify: `src/commands/doctor-checks/types.ts`
- Test: `test/setup.test.ts`
- Test: `test/doctor.test.ts`

**Steps:**
1. Add failing setup coverage proving Windows npx bootstrap writes `almanac.cmd` scheduler commands, not `/usr/bin/env`.
2. Add failing doctor coverage proving Windows checks the Task Scheduler manifest instead of a launchd plist.
3. Add `platform` injection points for tests while defaulting production behavior to `process.platform`.
4. Update CLI descriptions and comments so user-facing language says platform scheduler, not macOS launchd.

## Task 3: Shared Ephemeral Install Detection

**Files:**
- Create: `src/install/ephemeral.ts`
- Modify: `src/commands/setup/install-path.ts`
- Modify: `src/commands/doctor-checks/probes.ts`
- Test: `test/setup.test.ts`
- Test: `test/doctor.test.ts`

**Steps:**
1. Add failing tests for Windows temp/npx paths such as `C:\Users\<user>\AppData\Local\Temp\_npx\...`.
2. Extract shared path-prefix classification that normalizes slashes and case.
3. Use the shared helper from setup and doctor so they do not drift.

## Task 4: Windows npm Command Shims

**Files:**
- Modify: `src/commands/setup/install-path.ts`
- Test: `test/setup.test.ts`

**Steps:**
1. Add failing coverage for the command used to install the global package on Windows.
2. Use `cmd.exe /d /s /c npm.cmd install -g codealmanac@latest` on Windows.
3. Keep the direct `npm install -g codealmanac@latest` command on Unix-like platforms.

## Verification

Run:

```bash
npm run lint
npm test
npm run build
```
