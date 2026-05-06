# codealmanac — Known Bugs + Fixes Needed

As of v0.1.5 (published 2026-04-16). Organized by severity.

---

## Must-fix (blocking or data-corrupting)

### 1. Hook path points at ephemeral npx cache

**Found by:** install audit (`docs/codealmanac-install-audit.md`)

When a user runs `npx codealmanac`, the setup wizard writes the SessionEnd hook pointing at an **absolute path inside npm's npx cache** (e.g., `~/.npm/_npx/<sha>/node_modules/codealmanac/hooks/almanac-capture.sh`). That cache entry gets GC'd on version bump, `npm cache clean`, or automatic eviction. Hook silently stops working — captures stop, user has no indication.

**Fix:** Copy the hook script to a stable user-owned location (`~/.claude/hooks/codealmanac-capture.sh`) during setup — same pattern already used for guide files. Write THAT path into `settings.json`.

**Status:** user's settings.json manually patched to correct path. Code fix not yet shipped.

### 2. `npx codealmanac` doesn't install globally

**Found by:** install audit

README says `npx codealmanac` "installs globally + runs the setup wizard." It does NOT install globally — `almanac` is not on PATH after running it. Users can't run `almanac search`, `almanac show`, `almanac doctor` from their shell.

**Fix:** When setup detects it's running from an ephemeral path (npx cache, pnpm store), offer to spawn `npm install -g codealmanac`. On `--yes`/`!isTTY`: install automatically. On interactive: prompt `[Y/n]`.

**Status:** not fixed.

### 3. better-sqlite3 ABI mismatch on Node version switch

**Found by:** repeated user experience (3 times in one day), blind user interview, smoke test

When a user switches Node versions via nvm/volta/fnm, the `better-sqlite3` native binding compiled for the old Node version doesn't load under the new Node. Error: "Could not locate the bindings file." Particularly bad with Node 21 (EOL, no prebuilt binary available).

**Fix (short-term):** Startup ABI guard in `src/cli.ts` — detect mismatch before any command runs, print actionable error: "codealmanac was installed for Node 20, you're running Node 21. Run: `npm rebuild better-sqlite3` or `nvm use 20`."

**Fix (long-term, v0.2):** Migrate to N-API-backed SQLite (libsql or wait for node:sqlite in Node 23+ LTS).

**Also:** Tighten `engines` to `"node": "20.x || 22.x || 23.x || 24.x || 25.x"` — matches better-sqlite3's prebuilt coverage.

**Status:** user's Node 21 install manually rebuilt. Code fix not yet shipped.

### 4. `.gitignore` missing capture/bootstrap log patterns

**Found by:** install audit (1.8MB bootstrap log committed to openalmanac's `.almanac/`)

`almanac init` writes `.almanac/index.db*` to `.gitignore` but NOT `.almanac/.capture-*` or `.almanac/.bootstrap-*` patterns. Logs leak into commits.

**Fix:** Extend the `.gitignore` block written by `_init.ts`:
```
.almanac/index.db
.almanac/index.db-wal
.almanac/index.db-shm
.almanac/.capture-*
.almanac/.bootstrap-*
.almanac/.ingest-*
```

**Status:** not fixed.

---

## Should-fix (quality / correctness)

### 5. `codealmanac --yes` (bare + flag) doesn't forward to setup

**Found by:** v0.1.3 smoke test

`codealmanac setup --yes` works. `codealmanac --yes` (bare invocation with flag) errors: "unknown option '--yes'." The `tryParseSetupShortcut` fix in v0.1.3 handles this for the built CLI but may not work correctly in all invocation contexts (npx, symlinks).

**Fix:** Verify `tryParseSetupShortcut` works for: global install, npx, dev-from-source, symlinked binary. Add integration test.

**Status:** partially fixed in v0.1.3. Needs verification across install contexts.

### 6. Setup wizard says "Next: almanac bootstrap" even when wiki exists

**Found by:** team workflow analysis

When Engineer B clones a repo that already has `.almanac/` (committed by Engineer A) and runs setup, the wizard's final message still says "almanac bootstrap" as the next step. Wrong — the wiki already exists, they should start querying.

**Fix:** Setup wizard detects if current cwd has `.almanac/pages/` with content. If yes: "This repo already has a wiki (N pages). Start querying: `almanac search --mentions <file>`." If no: "Next: `almanac ingest .`."

**Status:** not fixed.

### 7. Doctor `install.path` detection uses `require.resolve("codealmanac")`

**Found by:** v0.1.4 smoke test (showed "could not detect codealmanac install path" on a working install)

Fixed in v0.1.4: now uses `import.meta.url` walk-up instead. But doctor still shows `✗` in some contexts (dev mode, npx cache).

**Fix:** Improve `detectInstallPath` to also accept npx cache locations as valid (with a note that it's ephemeral).

**Status:** partially fixed in v0.1.4. Npx-cache case still shows ✗.

### 8. `npm bin -g` usage (deprecated in npm 9)

**Found by:** install audit

Any code or docs that reference `npm bin -g` will fail on npm 9+. Use `npm prefix -g` + `/bin` instead.

**Fix:** Grep codebase for `npm bin`. Replace with `npm prefix -g` + `/bin` construction.

**Status:** not checked.

### 9. Stale npx cache serves old versions

**Found by:** user experience

`npx codealmanac` uses cached version. User who first ran v0.1.0 via npx will keep getting v0.1.0 until they explicitly `npx codealmanac@latest` or clear the npx cache. The setup wizard installs hook/guides from the stale version, then the global install (if they do `npm i -g` separately) has a different version.

**Fix:** README should document `npx codealmanac@latest` (with `@latest`), not bare `npx codealmanac`. Or: the setup wizard detects version mismatch between the running binary and npm's `latest` tag, warns if stale.

**Status:** not fixed.

---

## Polish (non-blocking)

### 10. Update nag banner formatting

**Found by:** v0.1.5 implementation

The `!` / `⚠` banner style is implemented but could be more visually consistent with doctor's `✓` / `✗` / `◇` register.

**Status:** cosmetic, defer.

### 11. `help` command leaks into "Other" group

**Found by:** v0.1.3 review

Commander's implicit `help` subcommand appears as the sole entry in an "Other" group in `--help`. Either add to Setup group or filter out.

**Status:** possibly fixed in v0.1.5 — needs verification.

### 12. Capture log filename inconsistency

**Found by:** v0.1.3 review

Manual `capture` writes `.capture-<timestamp>.jsonl`. Hook writes `.capture-<session-id>.log`. Two formats.

**Status:** v0.1.5 partially addressed (manual uses `.jsonl`, hook uses `.log`). Documented in reference.md.

### 13. `codealmanac --help` vs `almanac --help` binary name

**Fixed in:** v0.1.2. Both now correctly show their invoked name in the usage line.

---

## Architecture notes (not bugs — future direction)

### better-sqlite3 → N-API migration

better-sqlite3 uses old V8 ABI (not N-API). This is the root cause of #3. Long-term options researched:
- `libsql` (napi-rs, N-API stable) — FTS5 bundling uncertain (issue #1930), named params broken (issue #202), 2x slower reads. Research inconclusive.
- `node:sqlite` (built-in, Node 22.5+) — FTS5 merged in Node 23+ only. Not in Node 22 LTS. The correct eventual destination but timing is wrong (Node 22 EOL: April 2027).
- **Decision:** stay on better-sqlite3 + ABI guard for now. Revisit when node:sqlite FTS5 is in an LTS release.

### `ingest` command unification

`bootstrap` and `capture` are being unified into `almanac ingest`. Design doc at `docs/ideas/ingest-design.md`. This is a v0.2 feature, not a bug fix.
