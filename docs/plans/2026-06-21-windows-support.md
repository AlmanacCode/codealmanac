# Windows Support Implementation Plan

**Issue:** [#1 — Not Detecting Codex CLI](https://github.com/AlmanacCode/codealmanac/issues/1)
**Prior art:** Draft [PR #2](https://github.com/AlmanacCode/codealmanac/pull/2) (`codex/windows-support`, cut from v0.2.23, now CONFLICTING). We borrow its scheduler/setup/doctor/install work and re-apply onto current `main`, but fix the parts it missed and consolidate duplicated primitives.

**Goal:** Make codealmanac work end-to-end on native Windows / PowerShell: provider detection, agent execution (capture/bootstrap), run cancellation, and auto-scheduling. No change to capture/Garden semantics on macOS.

---

## Root cause (verified)

Three independent layers break on native Windows:

1. **Detection (the reported bug).** `commandExists` / `defaultCommandExists` / `resolveClaudeExecutable` shell out to `sh -lc 'command -v X'`. Windows has no `sh`, so every provider reports "not found on PATH". Three duplicated copies:
   - `src/agent/readiness/providers/cli-status.ts:8` ← **the live path the user's screenshot hits** (`codex-cli.ts` → `commandExists`)
   - `src/agent/auth/claude.ts:37` (`resolveClaudeExecutable`)
   - `src/harness/providers/codex/status.ts:4` (`defaultCommandExists`)
2. **Spawning the CLIs.** Every `spawn(command, …)` omits `shell`. On Node ≥20 Windows refuses to spawn npm's `.cmd`/`.ps1` shims without `shell: true` (CVE-2024-27980 hardening). Affects status probes **and** the real run paths (`harness/providers/codex/exec.ts`, `app-server.ts` → `process/process-group.ts`, `agent/auth/claude.ts` `defaultSpawnCli`).
3. **Process-group lifecycle.** `process/process-group.ts` uses `detached:true` + `process.kill(-pgid)` (POSIX negative-PID group signal). On Windows this throws/no-ops, leaking the agent's child tree on cancel. Windows needs `taskkill /PID <pid> /T /F`.

Plus the **scheduling** layer is macOS-launchd-only (`src/automation/`, `/usr/bin/env` hardcoded in setup) — no Windows Task Scheduler path.

PR #2 only patched the **old** single-file `harness/providers/codex.ts` (since refactored into `codex/`) and never touched layer-1's live `agent/readiness` path, `agent/auth/claude.ts`, or layer 3.

---

## Architecture decision

Rather than scatter `if (process.platform === "win32") { where … } else { sh … }` + `shell: process.platform === "win32"` across 5+ spawn sites (PR #2's approach, and a smell this project's CLAUDE.md explicitly pushes back on — "a central status file should not know provider-specific details", "no one-off fixes"), introduce **one shared cross-platform process module** and route every caller through it:

`src/process/exec.ts` (new):
- `commandExists(command): boolean` — pure-Node PATH + PATHEXT scan (no subprocess at all). Removes the `sh` dependency on **every** platform, which is strictly more correct.
- `resolveExecutable(command): string | undefined` — full resolved path (used by claude auth's `pathToClaudeCodeExecutable` and to feed spawns).
- `crossSpawn(command, args, options)` — thin wrapper that sets `shell: true` on win32 and resolves shims; single place that knows the Windows quirk.

This collapses 3 copies of `commandExists` into 1 and removes per-site platform branches.

---

## Tasks (TDD: failing test → implement → verify, per project convention)

### Task 1 — Shared cross-platform exec module
- **Create** `src/process/exec.ts`: `commandExists`, `resolveExecutable`, `crossSpawn`.
- **Test** `test/process-exec.test.ts`: PATHEXT resolution on a faked win32 env, POSIX `command -v`-equivalent behavior, missing-command returns false. Use `withTempHome` style env injection (inject PATH/PATHEXT + platform, no real subprocess).

### Task 2 — Route detection + status spawns through it
- **Modify** `src/agent/readiness/providers/cli-status.ts` — `commandExists` + `runStatusCommand` use the shared module.
- **Modify** `src/agent/auth/claude.ts` — `resolveClaudeExecutable` + `defaultSpawnCli` use the shared module.
- **Modify** `src/harness/providers/codex/status.ts` — delete the duplicated `defaultCommandExists`/`defaultRunStatus`, import shared.
- **Test**: extend existing provider/codex-harness tests to assert detection succeeds with a Windows `.cmd` shim on PATH (faked).

### Task 3 — Route run/execution spawns through it
- **Modify** `src/harness/providers/codex/exec.ts` and `app-server.ts` (via `process-group.ts`) to spawn through the shared helper so `.cmd`/`.ps1` shims launch.
- **Modify** `src/process/background.ts` detached spawn similarly.

### Task 4 — Windows-safe process termination
- **Modify** `src/process/process-group.ts`: on win32, terminate via `taskkill /PID <pid> /T /F` instead of `process.kill(-pgid)`; keep POSIX path unchanged. Guard `detached` semantics per-platform.
- **Test** `test/process-group.test.ts`: win32 branch invokes taskkill (injected exec), POSIX branch unchanged.

### Task 5 — Windows Task Scheduler (borrow PR #2)
- **Create** `src/commands/automation/windows.ts` (install/status/uninstall via `schtasks`, manifests under `~/.almanac/automation/`). Re-apply PR #2's file; fix the stray tab-indentation in its source.
- **Modify** `src/commands/automation.ts` — `platform` injection + win32 branch (from PR #2).
- **Modify** `src/cli/register-wiki-lifecycle-commands.ts` — generic "platform scheduler" descriptions.
- **Test** `test/automation.test.ts` — add `platform:"darwin"` to existing launchd tests; add win32 schtasks tests (from PR #2).

### Task 6 — Setup / doctor / install path platform-awareness (borrow PR #2)
- **Create** `src/install/ephemeral.ts` (`looksEphemeralInstallPath`, handles `%TEMP%`/`%TMP%`/`_npx`).
- **Modify** `src/commands/setup.ts` (win32 `almanac.cmd` program args), `setup/install-path.ts` (`cmd.exe /d /s /c npm.cmd …`), `doctor-checks/install.ts` + `probes.ts` + `types.ts`, `uninstall.ts`.
- **Test**: extend `test/setup.test.ts`, `test/doctor.test.ts`, `test/uninstall.test.ts` with win32 cases (from PR #2).

### Task 7 — CI + docs
- **Modify** `.github/workflows/ci.yml` — add `windows-latest` matrix (Node 20 & 22) (from PR #2).
- **Modify** `README.md` — drop "macOS only", document Windows support + scheduler caveat.
- Update `.almanac/` pages PR #2 touched if still accurate.

---

## Out of scope / risks
- `cursor-agent` on Windows is detected/spawned the same way but unverified (no cursor CLI here).
- WSL is already covered (it's Linux); this targets **native** Windows.
- `taskkill`-based termination is best-effort; can't send graceful SIGTERM-equivalent, so Windows cancel is harder-kill than macOS. Acceptable.
- Path-with-spaces quoting under `shell:true` — covered by resolving full paths and quoting; status/run args are simple flags.

## Verification
`npm run lint` (tsc), `npm test` (vitest), `npm run build` (tsup) — all green. Then a real-machine smoke test on this Windows box: `almanac` status detects Codex, and a `capture`/`bootstrap` dry run launches the agent.
