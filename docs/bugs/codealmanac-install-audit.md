# codealmanac install audit

**Version examined:** 0.1.5 (from https://github.com/AlmanacCode/codealmanac.git, cloned `2026-04-16`).
**Context:** User ran `npx codealmanac` in `/Users/kushagrachitkara/Downloads/reverie/openalmanac`. Bootstrap and capture hook produced output; `almanac` is not on PATH; `which almanac` returns nothing.
**Scope:** Install surface only. The wiki data model, capture/writer/reviewer agents, and query CLI design are out of scope — those work.

---

## TL;DR

Three real problems, compounding:

1. The README advertises `npx codealmanac` as *"installs globally + runs the setup wizard."* The wizard does not install anything globally. It installs a hook, copies guide files, and edits `~/.claude/CLAUDE.md`. The `almanac` binary stays inside npx's per-invocation cache and is never linked onto PATH.
2. The `SessionEnd` hook written into `~/.claude/settings.json` is an **absolute path into npx's content-addressed cache** (`~/.npm/_npx/<sha>/node_modules/codealmanac/hooks/almanac-capture.sh`). That `<sha>` is a hash of the resolved dependency tree for the exact version that was run. A future version bump, an npm cache GC, or a `npm cache clean` silently invalidates the hook and captures stop firing.
3. The setup wizard's side-effect model is **inverted**: it performs globally persistent modifications to the user's Claude config (hook, CLAUDE.md import, two guide files in `~/.claude/`) while refusing to do the one locally-reversible thing (install itself on PATH). The things that require consent are automated; the thing that could be automated is skipped.

---

## Evidence

### Evidence 1 — the README claim

`README.md:22` states:

```bash
npx codealmanac                # installs globally + runs the setup wizard
```

This is not what happens. Searching the entire `src/` tree for any call that would install the package globally:

```
grep -rn 'npm i -g\|spawn.*npm\|install.*codealmanac' src/
```

returns **zero hits in `src/commands/setup.ts`**. The only references to `npm i -g` anywhere in the source are:

- `src/commands/update.ts:17` — the separate `almanac update` command, which does shell out to `npm i -g codealmanac@latest` but is invoked explicitly by the user, not by `setup`.
- `src/commands/doctor.ts:196` — a *diagnostic string* printed when the binary isn't detectable: `"reinstall with: npm install -g codealmanac"`. Doctor knows the install can end up in a broken state; setup doesn't prevent it.

So `setup.ts` — the thing that runs when you invoke bare `codealmanac` or `npx codealmanac` — installs the hook, the guides, and the CLAUDE.md import, and that is all. The package binary is wherever `npx` put it.

### Evidence 2 — the hook path on this machine

`~/.claude/settings.json` (this user, post-install):

```json
{
  "SessionEnd": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "/Users/kushagrachitkara/.npm/_npx/1123f5c16135f0b0/node_modules/codealmanac/hooks/almanac-capture.sh",
          "timeout": 10
        }
      ]
    }
  ]
}
```

The directory `1123f5c16135f0b0` is npm's content-addressed cache identifier — a SHA of `(package name, version, resolved dependency set)`. Per-machine, per-version. The equivalent path does not exist on any other machine, and will not exist on this machine once:

- `codealmanac` publishes a new version and `npx codealmanac` is run again (new hash, new directory, **old hook path still points at the old cache entry**);
- npm GCs old npx cache entries (happens automatically on some npm versions, or on `npm cache clean`);
- the user runs `rm -rf ~/.npm/_npx/*` to reclaim disk space.

In every one of those cases the hook script file disappears and Claude Code invokes a nonexistent command at session end. By design, SessionEnd failures don't surface to the user, so the wiki silently stops being captured. The user's evidence that the hook *did* fire in the current session is `~/.almanac/.capture-e09d8ede-…jsonl` (1.2MB, today) — but that only proves it worked *once*, while the cache entry still existed.

### Evidence 3 — the hook script itself knows about this

`hooks/almanac-capture.sh:38-40`:

```bash
# Prefer `almanac` on PATH; fall back to `npx codealmanac` if the
# binary isn't linked (happens with non-global installs).
if command -v almanac >/dev/null 2>&1; then
  CMD="almanac"
```

The script is aware that `almanac` may not be on PATH and falls back to `npx codealmanac`. **But this fallback only helps if the shell script itself is reachable.** The fallback lives *inside* the script; the path *to* the script is the unprotected part. The outer invocation is the single point of failure, and the setup wizard puts that single point of failure on an ephemeral cache directory.

### Evidence 4 — npm bin discovery is stale

Attempting to run `npm bin -g` during this audit returned:

```
Unknown command: "bin"
```

`npm bin` was removed in npm 9. Any install documentation or script that relies on it is broken against modern Node distributions. This isn't the root cause of the user's issue but indicates the install tooling hasn't been tested against current npm in some time.

### Evidence 5 — the wiki is fine

To rule out wiki-level corruption: `.almanac/` in the user's project contains:

- 12 markdown pages in `pages/` (aws-s3, doppler, electron-gui, mcp-server, meilisearch, observability, quill-agent, redis, ref-token, research-pipeline, supabase, wiki-data-model)
- `topics.yaml` (topic DAG)
- `index.db` (SQLite FTS index, 139KB, fresh)
- `README.md` (the notability bar + conventions)
- `.bootstrap-20260416-131328.log` (1.8MB) — **from a different user** (`cwd: /Users/rohan/Desktop/Projects/openalmanac`). This is fine and expected: a collaborator scaffolded the wiki on their machine and committed it; every subsequent clone auto-registers on first query. This is the intended cross-user workflow, not a bug.

The wiki *content* is healthy. The problem is purely that this user cannot query it from the shell because `almanac` is not on PATH.

---

## Root causes

### Root cause 1 — documentation diverges from behavior

`setup.ts` is documented (in its own docstring, lines 21–44) as doing hook install, guide install, and CLAUDE.md import. Those are the three steps it performs. The README, however, positions bare `npx codealmanac` as the canonical install invocation and claims it "installs globally." Either:

- `setup.ts` should do a global install (or warn loudly that it didn't), or
- the README should tell users explicitly that `npm i -g codealmanac` is the install step and `codealmanac` is only the post-install configurator.

Currently the README makes the user believe the first thing happened. It didn't.

### Root cause 2 — encoding install-path-at-time-of-run into user config

`hook.ts` resolves the bundled `hooks/almanac-capture.sh` *relative to the running codealmanac module* and writes that absolute path into `~/.claude/settings.json`. When codealmanac is running from `~/.npm/_npx/<sha>/…`, that's the path it writes. The written config is therefore only valid for the exact package directory that was running at configuration time.

The cleaner primitive is: copy the hook script into a stable location under the user's own config tree — for example `~/.claude/hooks/codealmanac-capture.sh` — and write *that* path into settings.json. Then the hook survives version bumps, cache GC, and uninstall/reinstall cycles. This is what `hook.ts` does for guide files (they get copied to `~/.claude/codealmanac.md` and `~/.claude/codealmanac-reference.md`); the same pattern should extend to the hook script itself.

### Root cause 3 — inverted side-effect asymmetry

The setup wizard happily modifies user-global, user-visible configuration:

- edits `~/.claude/settings.json` to register a hook;
- copies `mini.md` to `~/.claude/codealmanac.md`;
- copies `reference.md` to `~/.claude/codealmanac-reference.md`;
- appends `@~/.claude/codealmanac.md` to `~/.claude/CLAUDE.md`.

All of these are *persistent*, span every Claude Code project the user has, and touch files the user might have their own edits to. They are the right side-effects for this tool — but they are also the ones with the highest blast radius if wrong.

The one thing setup *won't* do — put `almanac` on PATH — is (a) locally reversible (`npm uninstall -g codealmanac`), (b) the specific side-effect the user unambiguously wants from running an "install" command, and (c) the thing whose absence leaves the user confused. The priority ordering is backwards: the high-blast-radius actions are automated, the low-blast-radius action is skipped.

### Root cause 4 — "branded TUI" prioritized over mechanics

`setup.ts` lines 97–110 define an 11-letter ASCII banner with a six-stop grey gradient. The file has more code dedicated to banner rendering and ANSI color helpers than to validating that the resulting install is functional. Doctor *does* have a `detectInstallPath()` primitive (`doctor.ts:799–827`) that walks up from `import.meta.url` looking for `package.json` with `name === "codealmanac"` — the right tool to detect "I am running from an ephemeral npx cache." Setup does not use it. If it did, it could print:

```
! codealmanac is running from an npx cache directory
  (~/.npm/_npx/1123f5c16135f0b0/node_modules/codealmanac).
  The `almanac` binary will not be on your PATH after this completes.

  To put it on PATH:   npm install -g codealmanac
  Or continue anyway:  the hook will fall back to `npx codealmanac`
                       at session end, but this is fragile — the cache
                       path may be GC'd between invocations.
```

That is five lines of code and it closes the entire failure class.

---

## Impact

On a fresh machine, a user running `npx codealmanac` ends up with:

| Resource | State | Persistent? |
|---|---|---|
| `~/.claude/settings.json` SessionEnd hook | Registered, pointing at ephemeral cache path | Yes (until cache evicted) |
| `~/.claude/codealmanac.md` | Present | Yes |
| `~/.claude/codealmanac-reference.md` | Present | Yes |
| `~/.claude/CLAUDE.md` | Modified to import the guide | Yes |
| `almanac` on PATH | **Not present** | N/A |
| `codealmanac` on PATH | **Not present** | N/A |

The user cannot run the documented query commands (`almanac search`, `almanac show`, `almanac doctor`) from their shell. Capture *may* continue to work for some period — until one of the cache-invalidation events in Evidence 2 fires — at which point it silently stops and the user has no indication until they inspect their sessions and notice no `.almanac/.capture-*.jsonl` files appearing.

The failure is **silent**, **time-delayed**, and **invisible to the tool's own diagnostics** unless the user specifically runs `almanac doctor` — which they can't run, because `almanac` is not on PATH.

---

## Recommendations

### For the codealmanac maintainer

In rough priority order:

1. **Fix the README, today.** Either delete the line that says `npx codealmanac` "installs globally," or change the wizard to actually do that when invoked under npx. The current divergence is the single highest-leverage bug because it mis-sets user expectations before any code runs.

2. **Copy the hook script into a stable location on install.** Write `~/.claude/hooks/codealmanac-capture.sh` (or equivalent) during setup and point settings.json at that copy. Follows the existing pattern for guide files. Removes the ephemeral-cache failure mode entirely.

3. **Detect ephemeral-install in setup and warn.** Reuse `detectInstallPath()` from `doctor.ts`. If the resolved install path is under `/.npm/_npx/`, `/.pnpm-store/`, a Yarn cache, or similar, print a prominent warning with the `npm i -g codealmanac` fix. Exit zero — don't block — but make sure the user sees it.

4. **Have `codealmanac` (bare) self-install on first run.** If the current process isn't reachable via PATH, prompt: "Install codealmanac globally so you can run `almanac` from your shell? [Y/n]". On yes, spawn `npm install -g codealmanac`. This is what users think `npx codealmanac` does and what the README already claims.

5. **Fix `npm bin`-era tooling.** Replace `npm bin -g` with `npm prefix -g` + `/bin` construction, which works on npm 9+.

6. **Add a smoke test for the install surface.** A CI job that runs `npx codealmanac --yes` in a clean container, then asserts `which almanac` succeeds, `settings.json` hook path exists, and `almanac doctor` reports no errors. The current failure mode survived to a shipping release because nothing tests the post-install invariant.

### For a user stuck in this state (the reader of this audit)

Execute in order:

```bash
npm install -g codealmanac
which almanac                               # should resolve under your npm prefix
almanac hook install                        # rewrites settings.json to the global-install path
almanac doctor                              # reports binary location + hook + guides + import line + wiki stats
```

After `almanac hook install`, inspect `~/.claude/settings.json` and verify the hook path is under your *global* `node_modules` (e.g. `~/.nvm/versions/node/v20.19.2/lib/node_modules/codealmanac/hooks/…`) and no longer under `~/.npm/_npx/<sha>/…`. Any query command (`almanac search --mentions <path>`, `almanac show <slug>`) should now work.

---

## Appendix A — what's actually good

Flagging this so the audit isn't purely negative:

- **`detectInstallPath` in `doctor.ts:799`** is the right primitive for self-location. It just isn't called from the place that needs it most (setup).
- **The hook script's fallback** (`command -v almanac || npx codealmanac`) is defensive in the right direction. It just can't protect against its own path disappearing.
- **Wiki auto-registration on first query** handles the cross-user committed-`.almanac/` case gracefully. The fact that `rohan`'s bootstrap log is intact in the user's repo and the wiki data is queryable once the CLI is installed shows this works.
- **Hook script itself is careful**: JSON payload parsing, walks up looking for `.almanac/`, backgrounds capture, exits zero on all paths. Zero complaints.
- **`almanac doctor`'s install-probe design** (walk `import.meta.url` → find `package.json` with matching name) is correct and portable. Works for global, npx, local, and dev-from-source installs. Good primitive.

The install surface problems are concentrated in roughly three files (`setup.ts`, `hook.ts`, `README.md`) and are all fixable without touching the wiki data model, the query commands, or the agent pipeline. The core of the product is sound; the onboarding is where it falls down.
