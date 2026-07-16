# codealmanac — Known Bugs + Fixes Needed

As of v0.1.6. Fixed v0.1.5 install issues have been removed from this
list; see `docs/bugs/codealmanac-install-audit.md` for the historical audit.

---

## Smoke run 2026-07-07 — `codealmanac init` on v0.3.1

Environment: macOS arm64, Node v22.22.2 via nvm, `codealmanac 0.3.1`,
`~/.codealmanac/config.toml` → `harness.default = "codex"`,
`harness.model = "gpt-5.4-mini"`. Run in this repo's checkout. Job:
`build-20260707051020-7c12ba63`.

### S1. `init` fails hard when the codex CLI binary is missing (root cause: broken codex install, environmental)

```text
codealmanac: harness codex failed with status failed: Error: spawn
/Users/divitsheth/.nvm/versions/node/v22.22.2/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/codex/codex ENOENT
```

The `@openai/codex` global npm package is broken on this machine: the
platform package `@openai/codex-darwin-arm64` is installed and its
`vendor/aarch64-apple-darwin/codex/` directory exists but is **empty** — the
native binary was never extracted (or was removed, e.g. by an interrupted
install/update or a disk cleanup). `codex --version` run directly fails with
the exact same spawn ENOENT, so every codex invocation on this machine fails,
not just ours. codealmanac correctly surfaced a real harness failure.

**Repaired 2026-07-07:** `npm install -g @openai/codex` restored the binary in
seconds (`codex-cli 0.142.5`) and the ChatGPT login survived — codex keeps
auth under `~/.codex`, outside the npm package. The README troubleshooting
entry documents this repair.

### S2. `init` does not preflight the configured harness before starting the build job — FIXED 2026-07-07

`init` announced the job id, printed the tagline ("every codebase deserves a
biography"), created the job record, and only then died — in 0s — because the
harness executable couldn't spawn.

**Fix:** `BuildWorkflow.start` calls `HarnessesService.ensure_ready` before
registering the repository or creating the run record, and
`OperationRunner` checks readiness separately before every provider invocation
(covers queued ingest/garden and sync runs picked up later by the worker). Verified
end-to-end against the broken codex install: init exits 1 with a repair
message, no job record, no `almanac/` scaffold.

### S3. Harness failure error is raw and gives no remediation — FIXED 2026-07-07

The user-facing error was the wrapped Node `spawn ... ENOENT` string with no
repair path, stored verbatim in the job's `error:` field.

**Fix:** `HarnessReadiness` gained an adapter-owned `repair` hint; the
unavailable-harness error now reads (one line, so run records keep it whole):
`harness codex is not available: <cause> — <repair>; or switch harness:
codealmanac config set harness.default claude`. Runtime failures after a
passing preflight still surface the honest raw output.

### S4. Registry `almanac_root` is `.almanac`, contradicting the `almanac/`-only decision — RESOLVED, stale legacy file

`~/.codealmanac/registry.json` (with `"almanac_root": ".almanac"`) is a
leftover from the retired npm CLI. The Python CLI references it nowhere;
repositories live in `~/.codealmanac/codealmanac.db` and `almanac_root` is
validated to be exactly `almanac` (`require_default_almanac_root`). The stale
file can be deleted by hand; nothing reads it.

### S5. README quickstart drifted from the public-contract tests — FIXED 2026-07-07

Found while landing S2/S3: `df627dfd` (2026-07-06) reworded the quickstart to
`codealmanac search "getting started"` without running the gates, so
`tests/test_public_contract.py` had two failures sitting on main. The tests
were updated to the newer README wording. Related: the blanket
`"npm install"` README ban was narrowed to `npm install codealmanac` forms —
harness CLIs (codex, claude) are npm packages and the new troubleshooting
section legitimately names their reinstall commands.

### S6. SQLite connection leak crashed a 40-minute build at event recording — FIXED 2026-07-07

Job `build-20260707063602-deac88ea`: the codex agent finished and committed
the wiki, then init crashed with `sqlite3.OperationalError: unable to open
database file` while recording harness events, leaving the job stuck at
`running` and a raw Python traceback in the terminal.

Root cause: every store used `with self.connect() as connection:` where
`connect()` returned a raw `sqlite3.Connection`. Python's sqlite3 context
manager scopes a **transaction**, not the connection — nothing ever closed.
Each recorded event opened two connections (sequence read + insert), each
holding db/WAL/shm descriptors; a long run's hundreds of events exhausted the
process fd limit and `sqlite3.connect` itself started failing.

**Fix:** `codealmanac.database.open_local_database(path, schema)` is a real
context manager that opens, applies the store's schema, and always closes.
All five stores (repositories, runs, run events, worker locks, sync state)
route through it; regression test asserts every opened connection is closed.

**Still open from this incident:** (a) a hard crash mid-run leaves the run
record at `running` forever — runs need pid-liveness reconciliation like
worker locks already have; (b) unexpected non-CodeAlmanacError exceptions
reach the user as raw tracebacks; (c) event recording opens two connections
per event — correct now, but worth batching for long runs.

### S7. Concurrent runs on one repo, and safety validation misattributes foreign edits — OPEN

Found in the same session's ledger: scheduled garden
`garden-20260707064814-10359b5f` executed against this repo while build
`build-20260707063602-deac88ea` was still running. Two problems:

- **No cross-kind run exclusion per repository.** `has_active_run` guards
  garden-vs-garden only, so a scheduled garden gardened a half-built wiki
  while the build agent was mid-write. Lifecycle runs on one repository
  should be mutually exclusive regardless of kind.
- **Mutation safety blames the harness for concurrent edits.** The guard
  diffs whole-repo git status snapshots around the agent run; a human (or
  another agent) editing source concurrently fails the run with "harness
  reported change outside almanac/: src/..." even though the harness never
  touched that file. Fail-safe is the right default, but the attribution and
  message are wrong, and the run had already committed its wiki changes by
  then.

---

## Must-fix

### 1. better-sqlite3 native binding can break across Node installs

**Found by:** repeated user experience, smoke tests, local dev checkout.

codealmanac uses `better-sqlite3` for the local `.almanac/index.db` search
index. `better-sqlite3` ships a native Node addon compiled against Node's V8
module ABI. When a user switches Node versions via `nvm`, `volta`, `fnm`, or
similar tools, the native binding installed for the old Node version can fail
to load under the new one.

Typical symptoms:

```text
Could not locate the bindings file
```

or:

```text
better-sqlite3 native binding failed: Cannot find module 'better-sqlite3'
```

Current mitigation: installed package bins now point at `dist/launcher.js`.
During `postinstall`, `dist/install-launchers.js` records the Node executable
that installed the package in `install-runtime.json`. The launcher runs before
the real CLI imports SQLite; it spawns `dist/codealmanac.js` with the recorded
Node path so interactive terminals, agents, launchd, and other callers do not
choose different Node runtimes through ambient `PATH`.

If the recorded Node executable is later removed, the launcher prints a
reinstall repair path before loading the real CLI:

```bash
npm install -g codealmanac@latest
```

There is still a startup ABI guard in `src/abi-guard.ts` for users who bypass
the launcher and execute `dist/codealmanac.js` directly. When the native binding
is broken, users get a direct rebuild hint instead of a deep stack trace:

```bash
cd "<codealmanac install dir>" && npm rebuild better-sqlite3
```

This improves the failure mode but does not remove the underlying fragility.

**Why this survives:** `better-sqlite3` is not N-API-stable. It is tied to the
Node/V8 ABI of the runtime that installed it. codealmanac is a CLI users may
run from many shells and Node versions, so the package can be installed under
one ABI and executed under another.

**Short-term fix:** keep the pinned launcher and startup guard, improve the
doctor report, and add install smoke tests that cover Node manager/version-switch
scenarios.

**Long-term fix:** migrate the index layer to an N-API-stable SQLite binding
or to `node:sqlite` once FTS5 support is available in the relevant LTS target.

---

## Should-fix / verify

### 2. Install-surface smoke coverage is still thin

The 0.1.6 code appears to fix the old `npx` install hazards:

- setup detects ephemeral `npx`/`pnpm dlx` paths and offers global install
- setup installs scheduled auto-capture from a durable global command path
- `.gitignore` includes `.almanac/.capture-*` and `.almanac/.bootstrap-*`
- setup detects existing committed wikis before suggesting bootstrap

These should be protected by a smoke test that runs in a clean environment:

```bash
npx codealmanac@latest --yes
which almanac
almanac doctor
```

The test should also verify that scheduled auto-capture is installed from a
durable Node/program path rather than an ephemeral npm cache path.

### 3. Stale npx cache can serve old codealmanac versions

README still documents:

```bash
npx codealmanac
```

Users who previously ran an older version may get that cached version again.
Prefer documenting:

```bash
npx codealmanac@latest
```

or make setup detect when the running package version lags the npm `latest`
dist-tag.

### 4. `codealmanac --yes` shortcut needs invocation-level verification

`tryParseSetupShortcut` now handles bare setup flags such as:

```bash
codealmanac --yes
codealmanac --skip-automation
codealmanac --skip-guides
```

Unit coverage exists for the parser, but the original bug involved invocation
contexts. Verify global install, `npx`, source/dev, and symlinked binary paths.

### 5. Doctor install-path classification needs npx/dev smoke coverage

Doctor now detects install paths by walking from `import.meta.url`, and it can
classify ephemeral paths. Keep this open until `almanac doctor --install-only`
has been smoke-tested under global install, `npx`, and local dev execution.

### 6. Help output grouping may still leak Commander internals

`src/cli/help.ts` still has an `Other:` fallback group. Verify whether the
implicit Commander `help` command appears there in `almanac --help`.

### 7. Capture run artifacts need current scheduler docs

Current scheduled capture behavior intentionally separates:

```text
.almanac/runs/<run-id>.json        # run metadata and lifecycle status
.almanac/runs/<run-id>.jsonl       # provider event log
.almanac/runs/capture-ledger.json  # scheduled sweep cursor state
```

This is probably acceptable, but docs and doctor output should make the split
clear so users know whether to inspect job logs, sweep cursor state, or
automation status.

---

## Architecture notes

### better-sqlite3 -> N-API migration

The native binding issue is the main remaining architecture risk in 0.1.6.
Options researched:

- `libsql` has an N-API-backed implementation, but prior research found FTS5
  bundling and named-parameter concerns.
- `node:sqlite` is the clean eventual destination, but FTS5 support is not yet
  available in the Node LTS target codealmanac can rely on.

Decision for now: keep `better-sqlite3` plus guardrails, and revisit once
`node:sqlite` with FTS5 is available in an LTS release.

### `ingest` command unification

`bootstrap` and `capture` are planned to become `almanac ingest` in a future
release. This is product direction, not a current 0.1.6 bug.

---

## Resolved 2026-07-10 — `jobs cancel` stops a running job

Slice 139 split queue management from execution. `__run-worker` now starts one
`__run-executor <run-id>` process at a time, and the running record stores a
verified execution identity. `jobs cancel` records cancellation intent,
terminates the executor and its complete harness process tree, confirms those
processes stopped, and only then writes the terminal `cancelled` status.

Queued jobs still cancel directly because they have no executor. Completed
edits or commits are intentionally not rolled back.

Relevant code: `workflows/run_queue/{control,executor,worker}.py`,
`integrations/runs/process.py`, and `services/runs/{store,transitions}.py`.
