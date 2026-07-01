# Python Port Product Debt

Updated: 2026-07-01

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
| Node/npm README and `almanac` command docs | rejected, guarded by tests | The Python public surface is `codealmanac`, Python 3.12+, local-only, and defaults to `almanac/`. |
| Semantic/vector search | out of scope | FTS5 and explicit refs come first. |
| Hard-coded `.almanac/` root | rejected | Python v1 targets new users and defaults to `almanac/`; `.almanac/` is only valid when explicitly configured. |
| `<almanac-root>/wiki/` nesting | forbidden | The configured Almanac root remains flat; future files are peers. |

## Open Debts To Resolve During Slices

| Debt | Pressure test |
|---|---|
| `jobs` vs `runs` public noun | resolved: public CLI noun is `jobs`; internal service noun is `runs`. |
| Local `add` command | Decide only when source-pool behavior is concrete. |
| Public release bar | resolved as a gate: `docs/python-port/public-release-readiness.md` lists required evidence. Current status is implementation-complete local alpha with release operations left: version/changelog, PyPI credentials, publish ownership, and human publish decision. |
| Registry cleanup | resolved for local v1: `list --json` reports registry availability, `list --drop <selector>` removes one entry, and `list --drop-missing` explicitly removes unreachable entries. Read commands do not auto-prune. |
| `serve` slice timing | resolved: read-only local viewer exists; renderer token-safety is covered by tests; UseAlmanac visual language is reference material only. Do not copy the current UseAlmanac wiki page/search UX. Keep the earlier CodeAlmanac sidebar-first reader shape and improve the design layer around it. Slice 51 tightened rail wording, active page/topic state, compact mobile density, and browser-verified desktop/mobile behavior through an isolated Chrome profile. Slice 81 restores multi-wiki local scope: default `serve` lists available registered wikis, and `serve --wiki` narrows the viewer to one wiki. |
| Agent harness contract | resolved for normalized provider events: `PageRunWorkflow` records normalized `HarnessEvent` values before validation, run logs persist structured harness payloads, Codex maps app-server notifications, and Claude maps SDK dataclasses into text/tool/usage/provider-session/helper/error/done events. Slice 136 dogfooded the real Codex app-server path, and slice 137 dogfooded the real Claude SDK path. |
| Codex app-server parity | resolved for Python default path | The Python Codex adapter now uses `codex app-server --listen stdio://` for lifecycle execution. Keep `codex exec` references as historical slice evidence only unless a future product decision deliberately reintroduces a legacy transport. |
| Background jobs | resolved for manual lifecycle operations and manual sync: `jobs attach`/`jobs cancel` use durable run-ledger state; queued background work has `<run-id>.spec.json`, oldest spec-backed selection, a per-wiki worker lock, stale-lock recovery, in-process queue draining, detached worker spawning, hidden worker entrypoint, explicit `ingest --background` / `garden --background`, and `sync --background` with pending ledger claims linked to queued runs. Still missing: explicit product decision on whether any lifecycle verb should default to background, and whether scheduled automation should use background sync by default. |
| Setup terminal UX | partially resolved: slice 79 restores setup/uninstall-owned Codex and Claude instruction artifacts; slice 80 adds Rich-backed branded panels, status rows, and a next-step box; slice 86 exposes default agent and automation recommendations as typed setup plan facts; slice 87 adds explicit setup-owned automation install/uninstall flags. Still missing: raw-mode target selection UI and provider model selection if that product decision is reopened. |
| Scheduled update automation | Manual `codealmanac update` exists and has pip/uv non-editable install dogfood. Do not schedule update automation from setup until a notifier/check cadence, dismissal policy, and release-channel policy are agreed. |
| Legacy automation migration | The Python rewrite does not port TypeScript capture-sweep migration in the first automation slice. Add only if real installed legacy jobs must be migrated. |
| Index refresh cost | `ensure_fresh` skips unchanged projection writes using source signatures, but still parses page markdown to compute them. Slice 50 split read-only query views from projection writes; it did not optimize refresh cost. Optimize only after real large-repo dogfood shows this is too slow. |
| Viewer source-code preview | Not a v1 viewer feature. The restored file route lists wiki pages mentioning a file/folder reference; source-content reading belongs to source runtime snapshots used by lifecycle workflows. |
| Viewer frontend build step | out of scope | Static ES modules now provide feature/shared boundaries. Add React/Next/Vite only when real viewer complexity exceeds static package-data maintainability. |
| Filesystem directory ranking | resolved for local v1: directory runtime uses Git listing, respects nested ignore semantics, ranks changed/untracked files before unchanged files, and interleaves clean directory groups with role-bearing files first. Add recency only after new dogfood proves diversity is insufficient. |
| Arbitrary custom root source-runtime ignores | resolved: Ingest passes `workspace.almanac_root` through `SourceRuntimeContext`; filesystem runtime no longer hard-codes Almanac root names. |
| Manual package updates | Drift visibility is resolved: `doctor` reports complete manual files that differ from bundled docs as informational review work. Replacement remains explicit-only; build/init still copy missing files and never overwrite local edits. |
| CLI dispatch/render domain split | resolved for current scope: root delegates to lifecycle, wiki, and admin dispatch modules; render root is a facade; wiki render is split into search, pages, topics, health, and tagging modules. Future output families should get their own renderer when they have a separate reason to change. |
