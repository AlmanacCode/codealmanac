# Python Port Product Debt

Updated: 2026-06-29

This file lists old assumptions that future agents must not accidentally keep
alive while rebuilding in Python.

## Quarantined Assumptions

| Assumption | Status | Reason |
|---|---|---|
| Hosted CLI verbs such as `login`, `connect`, `upload` | out of scope | Python v1 is local-only. Hosted control plane work belongs to a later agreement. |
| Public `almanac`, `alm`, or `absorb` aliases | out of scope | Public naming is `codealmanac`; compatibility aliases were explicitly rejected. |
| `capture` as a public command | out of scope | Conversation collection belongs under `sync` or a future explicit local source workflow. |
| CLI shell-out as an internal API | forbidden | Automation and future server wrappers must call Python services/workflows directly. |
| Hosted-shipping work merged from `origin/dev` | archive/reference only | The branch may contain hosted assumptions that are not v1 product direction. |
| TypeScript module boundaries | archive/reference only | The old code is behavior evidence, not a shape to preserve. |
| Semantic/vector search | out of scope | FTS5 and explicit refs come first. |
| `.almanac/wiki/` nesting | forbidden | `.almanac/` remains flat; future files are peers. |

## Open Debts To Resolve During Slices

| Debt | Pressure test |
|---|---|
| `jobs` vs `runs` public noun | Decide before implementing the run ledger CLI surface. |
| Local `add` command | Decide only when source-pool behavior is concrete. |
| `serve` slice timing | Restore after core read model works unless a viewer need becomes the highest-risk boundary. |
| Agent harness contract | Re-evaluate old Codex app-server and Claude SDK adapters before implementing lifecycle workflows. |
| Codex app-server parity | The Python v1 Codex adapter uses `codex exec`; port app-server only if the harness contract needs streaming, usage, structured tool display, structured output, or subagents. |
| Background sync reconciliation | Foreground `codealmanac sync` now runs Ingest and commits the cursor after success. Background/scheduled sync still needs pending cursor fields, a durable owner, stale recovery, and reconciliation before unattended automation. |
| Scheduled update automation | Manual `codealmanac update` now exists. Do not schedule update automation until package-manager behavior has more real install dogfood. |
| Legacy automation migration | The Python rewrite does not port TypeScript capture-sweep migration in the first automation slice. Add only if real installed legacy jobs must be migrated. |
| Index refresh cost | `ensure_fresh` skips unchanged projection writes using source signatures, but still parses page markdown to compute them. Optimize only after real large-repo dogfood shows this is too slow. |
| Viewer source-code preview | Not a v1 viewer feature. The restored file route lists wiki pages mentioning a file/folder reference; source-content reading belongs to source runtime snapshots used by lifecycle workflows. |
