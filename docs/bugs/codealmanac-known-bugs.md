# codealmanac — Known Bugs + Fixes Needed

As of v0.1.6. Fixed v0.1.5 install issues have been removed from this
list; see `docs/bugs/codealmanac-install-audit.md` for the historical audit.

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

Current mitigation: the CLI has a startup ABI guard that tries to open an
in-memory SQLite database before command routing. When the native binding is
broken, users get a direct rebuild hint instead of a deep stack trace:

```bash
cd "<codealmanac install dir>" && npm rebuild better-sqlite3
```

This improves the failure mode but does not remove the underlying fragility.

**Why this survives:** `better-sqlite3` is not N-API-stable. It is tied to the
Node/V8 ABI of the runtime that installed it. codealmanac is a CLI users may
run from many shells and Node versions, so the package can be installed under
one ABI and executed under another.

**Short-term fix:** keep the startup guard, improve the doctor report, and add
install smoke tests that cover Node manager/version-switch scenarios.

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
