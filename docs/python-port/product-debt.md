# Python Port Product Debt

Updated: 2026-06-29

This file lists old assumptions that future agents must not accidentally keep
alive while rebuilding in Python.

## Quarantined Assumptions

| Assumption | Status | Reason |
|---|---|---|
| Hosted CLI verbs such as `login`, `connect`, `upload` | out of scope, guarded by tests | Python v1 is local-only. Hosted control plane work belongs to a later agreement. |
| Public `almanac`, `alm`, or `absorb` aliases | out of scope, guarded by tests | Public naming is `codealmanac`; compatibility aliases were explicitly rejected. |
| `capture` as a public command | out of scope, guarded by tests | Conversation collection belongs under `sync` or a future explicit local source workflow. |
| CLI shell-out as an internal API | forbidden | Automation and future server wrappers must call Python services/workflows directly. |
| Hosted-shipping work merged from `origin/dev` | archive/reference only | The branch may contain hosted assumptions that are not v1 product direction. |
| TypeScript module boundaries | archive/reference only | The old code is behavior evidence, not a shape to preserve. |
| Semantic/vector search | out of scope | FTS5 and explicit refs come first. |
| Hard-coded `.almanac/` root | rejected | Python v1 targets new users and defaults to `almanac/`; `.almanac/` is only valid when explicitly configured. |
| `<almanac-root>/wiki/` nesting | forbidden | The configured Almanac root remains flat; future files are peers. |

## Open Debts To Resolve During Slices

| Debt | Pressure test |
|---|---|
| `jobs` vs `runs` public noun | resolved: public CLI noun is `jobs`; internal service noun is `runs`. |
| Local `add` command | Decide only when source-pool behavior is concrete. |
| `serve` slice timing | resolved: read-only local viewer exists; remaining risk is browser-harness visual verification. |
| Agent harness contract | Re-evaluate old Codex app-server and Claude SDK adapters before implementing lifecycle workflows. |
| Codex app-server parity | The Python v1 Codex adapter uses `codex exec`; port app-server only if the harness contract needs streaming, usage, structured tool display, structured output, or subagents. |
| Background sync reconciliation | Foreground `codealmanac sync` now writes a durable pending claim with a run id before Ingest, status reports active/terminal linked runs separately, and sync reconciles terminal linked runs before selecting more work. Background execution still needs an explicit queue owner, retry budget, and unattended failure policy. |
| Scheduled update automation | Manual `codealmanac update` now exists. Do not schedule update automation until package-manager behavior has more real install dogfood. |
| Legacy automation migration | The Python rewrite does not port TypeScript capture-sweep migration in the first automation slice. Add only if real installed legacy jobs must be migrated. |
| Index refresh cost | `ensure_fresh` skips unchanged projection writes using source signatures, but still parses page markdown to compute them. Optimize only after real large-repo dogfood shows this is too slow. |
| Viewer source-code preview | Not a v1 viewer feature. The restored file route lists wiki pages mentioning a file/folder reference; source-content reading belongs to source runtime snapshots used by lifecycle workflows. |
| Filesystem directory ranking | Directory runtime now uses Git listing, respects nested ignore semantics, and ranks changed/untracked files before unchanged files. Clean large directories may still need semantic diversity or recency ranking after dogfood proves which unchanged files are wrong. |
| Configurable Almanac root migration | Current implementation still assumes `.almanac/` in paths, prompts, tests, viewer, safety checks, and dogfood docs. Replace that with a workspace-owned root setting before calling the local product surface complete. |
| Manual package updates | `<almanac-root>/manual/` is copied missing-only during build/init. If bundled doctrine needs to update existing workspace manual files, add an explicit maintenance policy rather than overwriting local edits silently. |
| CLI dispatch/render domain split | `src/codealmanac/cli/main.py` is now thin and parser construction is split by command domain. `dispatch/root.py` and `render/root.py` are separated from main but still broad; split them by command domain when the next CLI change creates pressure. |
