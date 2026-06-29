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
| Registry cleanup | resolved for local v1: `list --json` reports registry availability, `list --drop <selector>` removes one entry, and `list --drop-missing` explicitly removes unreachable entries. Read commands do not auto-prune. |
| `serve` slice timing | resolved: read-only local viewer exists; renderer token-safety is covered by tests; UseAlmanac visual language is reference material only. Do not copy the current UseAlmanac wiki page/search UX. Keep the earlier CodeAlmanac sidebar-first reader shape and improve the design layer around it. Slice 51 tightened rail wording, active page/topic state, compact mobile density, and browser-verified desktop/mobile behavior through an isolated Chrome profile. |
| Agent harness contract | partially resolved: lifecycle workflows record normalized `HarnessEvent` values before validation. Current CLI adapters emit terminal events only. Re-evaluate old Codex app-server and Claude SDK adapters only if local lifecycle dogfood needs complete text/tool/usage/warning transcript events, structured output, subagents, or stronger transcript controls. |
| Codex app-server parity | The Python v1 Codex adapter uses `codex exec`; port app-server only if the normalized harness event contract needs richer streaming, tool display, usage, structured output, actor/subagent attribution, or root-turn lifecycle control. |
| Background sync reconciliation | resolved for local v1: scheduled sync runs foreground `sync` with an explicit automation claim owner, pending timeout, and failed-attempt budget. A separate queue/worker remains out of scope unless a later agreement adds it. |
| Scheduled update automation | Manual `codealmanac update` exists and has pip/uv non-editable install dogfood. Do not schedule update automation until a notifier/check cadence, dismissal policy, and release-channel policy are agreed. |
| Legacy automation migration | The Python rewrite does not port TypeScript capture-sweep migration in the first automation slice. Add only if real installed legacy jobs must be migrated. |
| Index refresh cost | `ensure_fresh` skips unchanged projection writes using source signatures, but still parses page markdown to compute them. Slice 50 split read-only query views from projection writes; it did not optimize refresh cost. Optimize only after real large-repo dogfood shows this is too slow. |
| Viewer source-code preview | Not a v1 viewer feature. The restored file route lists wiki pages mentioning a file/folder reference; source-content reading belongs to source runtime snapshots used by lifecycle workflows. |
| Viewer frontend build step | out of scope | Static ES modules now provide feature/shared boundaries. Add React/Next/Vite only when real viewer complexity exceeds static package-data maintainability. |
| Filesystem directory ranking | resolved for local v1: directory runtime uses Git listing, respects nested ignore semantics, ranks changed/untracked files before unchanged files, and interleaves clean directory groups with role-bearing files first. Add recency only after new dogfood proves diversity is insufficient. |
| Arbitrary custom root source-runtime ignores | resolved: Ingest passes `workspace.almanac_root` through `SourceRuntimeContext`; filesystem runtime no longer hard-codes Almanac root names. |
| Manual package updates | Drift visibility is resolved: `doctor` reports complete manual files that differ from bundled docs as informational review work. Replacement remains explicit-only; build/init still copy missing files and never overwrite local edits. |
| CLI dispatch/render domain split | Admin dispatch/render is now split for `doctor`, `update`, `jobs`, and `automation`. `dispatch/root.py` and `render/root.py` still own wiki/lifecycle commands; split those only when a concrete command change creates pressure. |
