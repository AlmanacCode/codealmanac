> **COMPULSORY — read [`MANUAL.md`](MANUAL.md) before implementing any feature.**
> It defines *how we build*: living architecture (the unit of work is "reshape
> the codebase so the feature fits, then build it"), the seam-vs-machinery rule,
> the duty to **stop and flag** when the current shape won't hold a feature
> cleanly, and the wireframe-in-chat habit. Reason from it; don't bolt features
> onto a misshapen base.

codealmanac is a living wiki for codebases, maintained by AI coding agents. It documents what the code can't say — decisions, flows, invariants, incidents, gotchas — as atomic, interlinked markdown pages living in the repo-local `almanac/` tree. New Python repos use `almanac/` only. There is no `docs/almanac/`, `.almanac/`, custom-root, or old CLI compatibility path. Primary consumer is the AI coding agent; humans benefit secondarily.

**Historical spec:** `/Users/rohan/Desktop/Projects/openalmanac/docs/ideas/codebase-wiki.md` — useful background, not current product truth where it conflicts with `notes.md` and `implementation-tickets.md`. Read it before making design changes, then apply the current reset decisions in this repo.

## Python rewrite architecture references

The active rewrite is a local-only Python codebase. Before non-trivial Python
implementation, read `docs/python-port-live-agreement.md` and the relevant
local Architecture Patterns with Python chapters under
`docs/reference/cosmic-python/`.

Use the book as architecture reference, not as a package template. The main
transfer is: services own product verbs, stores own persistence, ports live
near the service that owns the contract, integrations implement those ports,
and `src/codealmanac/app.py` is the composition root.

Useful chapter map:

- Persistence/store boundaries: `chapter_02_repository.md`
- CLI/API-to-service boundary: `chapter_04_service_layer.md`
- Service-level tests: `chapter_05_high_gear_low_gear.md`
- Transaction boundaries: `chapter_06_uow.md`
- Command/request objects: `chapter_10_commands.md`
- Composition root/dependency wiring: `chapter_13_dependency_injection.md`

When a Cosmic Python idea justifies a design choice, quote the relevant line
briefly in the plan or response and cite the local chapter path. Keep the
generated Markdown reference files as book text; CodeAlmanac notes belong in
`docs/reference/cosmic-python/CODEALMANAC.md`, repo docs, or wiki pages.

## Design philosophy

Intelligence lives in prompts, not pipelines. When judgment is needed — deciding what a session produced, scoring notability, evaluating a proposed page against the graph — we hand a concrete-but-open prompt to an agent. We do not wrap agents in propose/review/apply state machines, intermediate proposal files, or `--dry-run` rehearsals. The writer owns outcomes and calls the reviewer as a subagent when it wants feedback; there is no orchestration JSON schema between them. Everything is **local-only**: each repo has one `almanac/` tree, `~/.codealmanac/registry.json` is global state, and there is no hosted service in this v1. The committed `almanac/` tree is browseable nested Markdown, not hidden runtime state. Only lifecycle operations invoke AI or write page prose. Read commands may refresh derived local index state and read committed markdown for display or validation. Organization commands may deterministically rewrite wiki metadata through explicit verbs such as `tag`, `topics`, `review`, and `migrate`.

## Engineering taste

There is no prize for preserving awkward code. Prefer the structure a new maintainer would understand immediately.

- Prefer obvious architecture over local patching when a bug exposes mixed responsibilities.
- Before accepting a solution, ask whether it creates a one-off mechanism where the existing general model could be extended instead. If it does, require an explicit architectural justification: why the general path is insufficient, whether the exception is temporary or permanent, how it is bounded, and what would make it safe to remove or generalize later.
- Existing special conditions are not automatically legitimate just because they are already in the codebase. This project has been built with AI, and AI agents can leave behind locally effective one-off fixes that were never consciously accepted as architecture. Treat extra flags, copied files, fallback paths, bespoke state, provider-specific branches, and helper scripts as provisional until they earn their place.
- Weight special cases by cost and evidence. Do not remove them reflexively; compatibility, migration, safety, platform, and provider constraints can be real. But a narrow exception with high maintenance cost needs stronger justification than a small localized shim.
- Assume the agents using this repo are capable: they can read files, inspect history, follow wiki pages, call tools, and reason over context. Do not build rigid preprocessing, copied context bundles, artificial staging files, or elaborate orchestration solely because an agent might need help. Prefer giving the agent real source material and a clear contract unless there is evidence that the general agentic workflow fails.
- This is an open-source project, so every new tracked file is public surface area and future maintenance burden. Before adding a file, ask who will own it, whether it belongs in an existing prompt/doc/module, and what keeps it from becoming stale.
- Keep modules honest: a file named `auth.py` should not secretly mean "Claude auth"; a central status file should not know provider-specific details.
- Short files are good, but responsibility boundaries matter more than line count. Split when a file has multiple reasons to change.
- Delete dead compatibility layers once callers have moved. Compatibility shims are temporary bridges, not architecture.
- When code feels ugly, treat that as design feedback. Naming, file shape, and import direction are part of correctness because they teach future agents how to extend the system.



## Codebase map

| Directory | What it is | Key files |
|-----------|-----------|-----------|
| `archive/code/` | Archived TypeScript/Node implementation and old viewer | behavior reference only |
| `docs/python-port-live-agreement.md` | Active Python rewrite agreement | local-only scope, service/workflow/integration structure |
| `docs/reference/cosmic-python/` | Vendored Architecture Patterns with Python reference | Markdown-only book files plus `CODEALMANAC.md` |
| `almanac/` | Current target wiki tree | nested Markdown pages plus `topics.yaml` |
| `src/codealmanac/` | Active Python implementation root | `app.py`, `cli/`, `services/`, `workflows/`, `integrations/` |
| `tests/` | Active Python test suite | pytest files plus temp-home helpers |
| `.github/` | GitHub workflow and contribution metadata | CI/publish templates may need rewrite after Python scaffold |

## How we work

### Slice-by-slice

Implementation is split into numbered slices. Each slice gets a plan in `docs/plans/slice-N-*.md` written before code. The plan states scope, out-of-scope, design decisions, file changes, test coverage, and explicit "Read before coding" pointers. After a slice lands, a review finds bugs and omissions; fixes go in a separate `docs/plans/fixes-slice-N-review.md` plan and ship as their own commit. **Write the plan, build, review, fix, then move to the next slice.** Don't collapse slices to save a step — the review pass is where latent bugs surface.

Plans use **must-fix / should-fix / consider** framing for review findings. Must-fix = correctness or contract bug. Should-fix = consistency, structure, or edge case that will bite later. Consider = taste call worth flagging, author decides.

### Background agents

When tasks are independent (e.g., "write slice-3 plan" and "draft reviewer prompt"), dispatch multiple subagents in parallel. Don't serialize work that doesn't need serializing.

### Code review

When the user asks for a code review or reviewer, read `.claude/agents/review.md` first and treat it as the authoritative code-review prompt for this repo. Do not confuse it with `prompts/reviewer.md`, which is the wiki reviewer subagent used by Absorb.

Use code review after meaningful structural changes, especially changes to command flows, provider boundaries, indexer behavior, SQLite queries, prompt contracts, or filesystem writes. The review standard is not "does it pass tests?" but "would a fresh maintainer understand why this is the obvious shape?"

### Commit conventions

- `feat(slice-N): <summary>` — new slice landing
- `fix(slice-N-review): <summary>` — review fixes for slice N
- `docs: <summary>` — plans, research, README, this file
- `refactor(slice-N): <summary>` — structural cleanup within a slice's surface area

Keep commits buildable and test-passing. Use the Python gates defined in this
repo rather than the archived Node/Vitest commands.

### Testing

Use `uv run pytest` and `uv run ruff check .` as the default gates. Tests that touch user-level state must sandbox `HOME` and never touch the real user registry. The archived Vitest suite under `archive/code/test/` is behavior reference only.

## Design decisions

_Cross-cutting architectural choices. Keep current, concise, and explanatory. Update this when a conversation settles a structural choice._

- **CLI is an adapter, not the internal API.** CLI dispatch builds request objects and calls the app composition root. Workflows, automation, tests, and future server wrappers call services/workflows directly.
- **Workspace owns repo selection and the Almanac tree.** The repo-local wiki tree is `almanac/` only.
- **Stores own persistence behavior.** Shared SQLite mechanics live in `codealmanac.database`; store packages own schemas, migrations, queries, and row conversion.
- **Integrations implement service-owned ports.** Harnesses, transcript discovery, source runtime, Git probes, and scheduler adapters stay behind service/workflow contracts.
- **All lifecycle runs go through the run queue.** `init`, `ingest`, and `garden` queue a durable run spec and a detached worker executes the agent run; no CLI command blocks a terminal on an agent. Enqueue-time work is only fast local validation, registration, scaffolding, and harness preflight — everything slow happens in the worker and is observable via `jobs attach`/`jobs show`.
- **Review prompts are separate by job.** `src/codealmanac/prompts/operations/garden.md` and `ingest.md` guide wiki writes; `.claude/agents/review.md` reviews code architecture and implementation.
- **Terminal output is behavior.** One render path per command — the human shape, with `cli/render/style.py` color constants degrading to empty strings when piped or `NO_COLOR` is set; `--json` is the piping format. Refactors must preserve output byte-for-byte.
- **Code-style principles live in the wiki.** `almanac/style/` (query: `codealmanac search --topic style`) holds the standing principles — types, naming, boundaries, libraries, behavior-frozen refactoring. Read them before any large write or refactor.

## Non-negotiables

Design rules every change must respect. The spec has the full rationale; these are the ones that trip people up.

- **Only lifecycle operations invoke AI or write page prose.** Read commands may refresh derived local index state and read committed markdown for display or validation. Organization commands may deterministically rewrite wiki metadata through explicit verbs such as `tag`, `topics`, `review`, and `migrate`.
- **Reindex is silent and implicit.** Every query command compares `almanac/**/*.md` mtimes against the derived index and rebuilds if stale. No progress bars, no "indexing..." chatter, no opt-in flag. `codealmanac reindex` is the escape hatch for "I want to force it."
- **Markdown links are the authored page-link syntax.** Do not use double-bracket links. File evidence belongs in `sources:`.
- **Use `GLOB` not `LIKE` for path queries**, and **escape `*?[` before concatenating stored paths into a GLOB pattern.** SQLite's `LIKE` treats `_` as a wildcard (spurious matches on `src/my_module/`); `GLOB` treats it literally. A Next.js-style stored path like `src/[id]/page.tsx` contains GLOB metacharacters — unescaped, it matches things it shouldn't. See `fixes-slice-2-review.md` for the bug and fix.
- **Paths are normalized at index time and at query time.** Lowercase (macOS is case-insensitive), forward slashes, no `./` prefix, trailing slash iff directory, no redundant slashes. Normalize on both sides of a comparison.
- **Slugs are kebab-case of the filename.** `checkout_flow`, `Checkout Flow.md`, `checkout-flow.md` all canonicalize to `checkout-flow`. Enforced at write time and checked by health.
- **DAG cycle prevention is belt-and-suspenders.** `CHECK (child_slug != parent_slug)` in the schema, pre-insert cycle check on `topics link`, and a depth cap of 32 on any recursive CTE.
- **Workspace roots are not configurable.** New repos use `almanac/`. `docs/almanac/`, `.almanac/`, custom roots, and root migration shims are retired.
- **Registry entries are never auto-dropped.** Unreachable paths are silently skipped in `--all` queries. `codealmanac list --drop <name>` is the only explicit removal.
- **Archived pages are excluded from search by default**, are not flagged for dead-refs by `health`, and keep their backlinks resolvable. `--include-archive` and `--archived` change scope.
- **Prompts and manual docs are shipped as Python package resources.** They live under `src/codealmanac/prompts/` and `src/codealmanac/manual/`. They are not embedded as Python string literals.

## Philosophy anti-patterns

Things we do not do. If a plan proposes one, push back.

- **No propose/apply flows.** No proposal JSON files, no `--apply` or `--confirm` step. Agents write directly; users read the diff in `git status`.
- **No `--dry-run` flags.** The agent is either doing the work or it isn't. Rehearsal is not a feature.
- **No interactive prompts.** The CLI is pipeable and scriptable; scheduled sync runs in the background. Nothing blocks on user input.
- **No pipeline scaffolding where a prompt would do.** If a task calls for judgment, extend the prompt — don't add a pre-processing step in TypeScript that hard-codes the judgment.
- **No state machines between writer and reviewer.** Writer invokes reviewer via `agents: { reviewer }` in the SDK, reads the text critique, decides. No approve/revise/reject enum.
- **No semantic search yet.** FTS5 first. Add vectors only when FTS5 proves insufficient against a real repo.
- **No raw `codealmanac query`.** The schema is simple; open `index.db` directly if you need to.
- **No `codealmanac read/write/edit`.** The agent has Read/Write/Edit tools.

## Key file locations

- **Design spec:** `/Users/rohan/Desktop/Projects/openalmanac/docs/ideas/codebase-wiki.md`
- **Python port agreement:** `docs/python-port-live-agreement.md`
- **Slice notes:** `docs/python-port/slice-*.md`
- **Prompts:** `src/codealmanac/prompts/`
- **Manual resources:** `src/codealmanac/manual/`
- **SQLite schema/read model:** `src/codealmanac/services/index/store.py`
- **Init/build scaffolding:** `src/codealmanac/services/wiki/service.py`
- **Workspace roots and registry:** `src/codealmanac/services/workspaces/`
- **CLI edge:** `src/codealmanac/cli/`
- **Test sandbox helpers:** `tests/conftest.py`
