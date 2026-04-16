# Slice 1 — Review Fixes

Apply the fixes identified in the slice 1 code review. Run AFTER slice 2 has landed and been committed (to avoid conflicts with in-flight edits to the same files).

## Context

The review pinned issues against commit `9424452` (slice 1). Slice 2 is committed on top of that. These fixes apply to the current HEAD.

## Read before coding

- The review report is part of the conversation history; its content is summarized below
- Current files in `~/Desktop/Projects/codealmanac/src/` — changes may have shifted after slice 2
- Existing tests in `~/Desktop/Projects/codealmanac/test/` — preserve what's there, extend rather than rewrite

## Must fix

### 1. `init` uses `cwd` as the repo path instead of walking up to the nearest `.almanac/`

**File:** `src/commands/init.ts`

**Bug:** If `almanac init` is run from a subdirectory inside a repo that already has `.almanac/`, it creates a nested `.almanac/` at the subdirectory and registers the wrong path.

**Fix:** At the top of `initWiki`, call `findNearestAlmanacDir(cwd)`. If non-null, use it as `repoRoot`; otherwise use `cwd`. Use `repoRoot` consistently for all subsequent operations (`getRepoAlmanacDir`, `basename` for name derivation, `path` in registry entry, `.gitignore` target).

**Test to add:** `test/init.test.ts` — `almanac init` from a subdirectory of an existing wiki updates the existing wiki rather than creating a nested one.

### 2. `.gitignore` writer formatting

**File:** `src/commands/init.ts` (the `.gitignore` append logic, around line 82-84)

**Bug:** Double-newline or bare-blank-line issue when appending to existing `.gitignore`.

**Fix:** Collapse the branches:

```typescript
const sep = existing.length === 0 ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
await writeFile(gitignorePath, existing + sep + "# codealmanac\n" + target + "\n");
```

**Test to add:** `test/init.test.ts` — `.gitignore` formatting is correct whether the file is absent, empty, ends with newline, or doesn't end with newline.

### 3. `autoregister` swallows all errors including malformed JSON

**File:** `src/registry/autoregister.ts` (around line 58-60)

**Bug:** Blanket `} catch { return null; }` swallows JSON parse errors from a corrupted `registry.json`, hiding data corruption from the user.

**Fix:** Narrow the catch to filesystem-not-found errors only. Let JSON parse errors propagate so the CLI surfaces them:

```typescript
try {
  // ... existing logic
} catch (err) {
  if (err instanceof Error && "code" in err && (err.code === "ENOENT" || err.code === "EACCES")) {
    return null;
  }
  throw err;
}
```

**Test to add:** `test/autoregister.test.ts` — malformed registry JSON throws (not silently returns null).

## Should fix

### 4. `readRegistry` silently coerces garbage

**File:** `src/registry/index.ts`

**Bug:** Missing `path` or `name` fields on an entry get coerced to `""` silently. An entry with an empty path becomes unremovable via `--drop` if name is also blank.

**Fix:** Reject entries with missing `name` or `path`. Throw with a clear error pointing at the bad entry.

### 5. Registry writes not atomic

**File:** `src/registry/index.ts` (`writeRegistry`)

**Bug:** Plain `writeFile` is not safe under concurrent `almanac init` calls.

**Fix:** Write to `registry.json.tmp`, then `rename` to `registry.json`. Atomic on all mainstream filesystems.

### 6. Auto-register collision loop is O(N²)

**File:** `src/registry/autoregister.ts` (name-suffix loop, around line 69-79)

**Bug:** `while (true)` with `findEntry` per iteration re-reads the registry file every loop. Degenerate case: O(N²) in collision count.

**Fix:** Read registry once, scan in-memory for next free suffix. Cap at 1000 attempts to prevent pathological cases.

### 7. Delete `.npmignore`

**File:** `.npmignore`

**Bug:** `.npmignore` is the fragile twin of `package.json`'s `files` field. When `files` is present and correct, `.npmignore` becomes a foot-gun that can reintroduce excluded paths.

**Fix:** Delete `.npmignore`. Verify `package.json`'s `files` field covers what should ship: `["dist", "prompts", "README.md", "LICENSE"]`.

Run `npm pack --dry-run` to confirm the tarball contents are correct.

### 8. Missing tests

- Test for `almanac list` from a subdirectory (end-to-end integration for auto-registration)
- Test for `init` re-run from nested subdir (catches issue #1)

## Consider (do if easy, skip if not)

### 9. Extract `toKebabCase` to `src/slug.ts`

Slice 3 adds topic slug canonicalization. Slice 2 adds page slug canonicalization. All three want the same function. Pre-empt duplication:

**New file:** `src/slug.ts`
```typescript
export function toKebabCase(input: string): string {
  // ... move implementation from registry/index.ts
}
```

Update imports in `registry/index.ts`, `registry/autoregister.ts`, `commands/init.ts`, and any slice-2/slice-3 code already using a local variant.

### 10. Standardize command return shape

**File:** `src/cli.ts` + each command

If slice 2/3 commands are already following the `{ stdout, exitCode }` pattern from `listWikis`, add a shared helper in `cli.ts`:

```typescript
function printResult(result: { stdout: string; exitCode: number }): void {
  process.stdout.write(result.stdout);
  process.exitCode = result.exitCode;
}
```

Use it consistently. Cheap DX improvement.

### 11. Case-insensitive path equality

**Files:** `src/registry/index.ts` (where paths are compared in `findEntry` / `addEntry`)

**Note:** macOS and Windows have case-insensitive filesystems. `/Users/x/Project` and `/Users/x/project` should resolve to the same registry entry.

**Fix:** When comparing paths, normalize with `toLowerCase()` on macOS/Windows. Detect via `process.platform`.

Store the original casing in the entry; compare with lowercased paths.

Skip if slice 2 already introduced path normalization utilities — reuse those.

## Don't do

- **Don't rewrite tests.** Extend them. Preserve the `withTempHome` pattern.
- **Don't change command surface area.** No new flags, no removed flags. These are bug fixes and robustness improvements.
- **Don't change design-level decisions.** The review found code quality issues, not design drift. Keep all behaviors identical except for the bugs.

## What "done" looks like

```bash
cd ~/Desktop/Projects/codealmanac
npm install
npm test
# ✓ all tests pass (32 + new tests from this fix slice)

npm run build
# ✓ no errors

# Verify the bugs are actually fixed:

# Test #1 fix: init from subdir
mkdir -p /tmp/subdir-test/src/nested
cd /tmp/subdir-test
git init
almanac init --name subdir-test
cd /tmp/subdir-test/src/nested
almanac init --description "should update existing"
# ✓ no new .almanac/ created at /tmp/subdir-test/src/nested
# ✓ registry entry points to /tmp/subdir-test (not /tmp/subdir-test/src/nested)

# Test #2 fix: .gitignore formatting
cd /tmp/clean-test
git init
echo -n "foo" > .gitignore    # no trailing newline
almanac init
cat .gitignore
# foo
# 
# # codealmanac
# .almanac/index.db
# (one blank line separating, no double blanks)

# Test #3 fix: corrupted registry
echo "not valid json" > ~/.almanac/registry.json
almanac list
# error: ~/.almanac/registry.json is not valid JSON
# (exit code 1)

# Test #7 fix: npm pack
cd ~/Desktop/Projects/codealmanac
npm pack --dry-run
# ✓ only includes dist/, prompts/, README.md, LICENSE
```

## Commit template

```
fix(slice-1-review): apply review findings

Must fix:
- init: walk up to nearest .almanac/ instead of creating nested wiki
- init: .gitignore append preserves single-blank-line separation
- autoregister: narrow error catch; malformed registry JSON propagates

Should fix:
- registry: reject entries with missing name or path
- registry: atomic writes via tmp + rename
- autoregister: single-read name collision scan with cap
- .npmignore removed (files field is authoritative)
- tests: init from subdir, corrupted registry, .gitignore formatting

Consider:
- extracted toKebabCase to src/slug.ts
- case-insensitive path comparison on macOS/Windows
```

Push to origin/main.

## Report format

1. Each fix applied, with before/after line references
2. `npm test` output
3. `npm pack --dry-run` output
4. Manual verification of each must-fix
5. Git commit hash + push confirmation
