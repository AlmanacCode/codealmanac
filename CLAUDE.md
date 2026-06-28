> **COMPULSORY — read [`MANUAL.md`](MANUAL.md) before implementing any feature.**
> It defines *how we build*: living architecture (the unit of work is "reshape
> the codebase so the feature fits, then build it"), the seam-vs-machinery rule,
> the duty to **stop and flag** when the current shape won't hold a feature
> cleanly, and the wireframe-in-chat habit. Reason from it; don't bolt features
> onto a misshapen base.

codealmanac is a living wiki for codebases, maintained by AI coding agents. It documents what the code can't say — decisions, flows, invariants, incidents, gotchas — as atomic, interlinked markdown pages living at `.almanac/` in each repo. Primary consumer is the AI coding agent; humans benefit secondarily.

**Full spec:** `/Users/rohan/Desktop/Projects/openalmanac/docs/ideas/codebase-wiki.md` — source of truth. Read it before making design changes. This file is the working context for implementation.

## Design philosophy

Intelligence lives in prompts, not pipelines. When judgment is needed — deciding what a session produced, scoring notability, evaluating a proposed page against the graph — we hand a concrete-but-open prompt to an agent. We do not wrap agents in propose/review/apply state machines, intermediate proposal files, or `--dry-run` rehearsals. The writer owns outcomes and calls the reviewer as a subagent when it wants feedback; there is no orchestration JSON schema between them. Everything is **local-only** (`.almanac/` per repo, `~/.almanac/registry.json` globally, no hosted service), the `.almanac/` namespace is **flat** (no `.almanac/wiki/` subdir — future features get peer files), and only lifecycle operations invoke AI or write page prose. Read commands may refresh derived local index state and read committed markdown for display or validation. Organization commands may deterministically rewrite wiki metadata through explicit verbs such as `tag`, `topics`, `review`, and `migrate`.

## Engineering taste

There is no prize for preserving awkward code. Prefer the structure a new maintainer would understand immediately.

- Prefer obvious architecture over local patching when a bug exposes mixed responsibilities.
- Before accepting a solution, ask whether it creates a one-off mechanism where the existing general model could be extended instead. If it does, require an explicit architectural justification: why the general path is insufficient, whether the exception is temporary or permanent, how it is bounded, and what would make it safe to remove or generalize later.
- Existing special conditions are not automatically legitimate just because they are already in the codebase. This project has been built with AI, and AI agents can leave behind locally effective one-off fixes that were never consciously accepted as architecture. Treat extra flags, copied files, fallback paths, bespoke state, provider-specific branches, and helper scripts as provisional until they earn their place.
- Weight special cases by cost and evidence. Do not remove them reflexively; compatibility, migration, safety, platform, and provider constraints can be real. But a narrow exception with high maintenance cost needs stronger justification than a small localized shim.
- Assume the agents using this repo are capable: they can read files, inspect history, follow wiki pages, call tools, and reason over context. Do not build rigid preprocessing, copied context bundles, artificial staging files, or elaborate orchestration solely because an agent might need help. Prefer giving the agent real source material and a clear contract unless there is evidence that the general agentic workflow fails.
- This is an open-source project, so every new tracked file is public surface area and future maintenance burden. Before adding a file, ask who will own it, whether it belongs in an existing prompt/doc/module, and what keeps it from becoming stale.
- Keep modules honest: a file named `auth.ts` should not secretly mean "Claude auth"; a central status file should not know provider-specific details.
- Short files are good, but responsibility boundaries matter more than line count. Split when a file has multiple reasons to change.
- Delete dead compatibility layers once callers have moved. Compatibility shims are temporary bridges, not architecture.
- When code feels ugly, treat that as design feedback. Naming, file shape, and import direction are part of correctness because they teach future agents how to extend the system.



## Codebase map

| Directory | What it is | Key files |
|-----------|-----------|-----------|
| `bin/` | npm bin shim — error-formatter around `src/cli.ts` | `codealmanac.ts` |
| `src/` | TypeScript source | `cli.ts` (commander wiring), `paths.ts` (walk-up to nearest `.almanac/`), `slug.ts` (kebab-case canonicalization) |
| `src/edges/cli/` | Commander registration, process argv handling, sqlite-free recovery path, and CLI-edge event rendering | `register-commands.ts`, `register-query-commands.ts`, `register-edit-commands.ts`, `register-review-commands.ts`, `register-page-topic-commands.ts`, `register-migrate-commands.ts`, `register-topics-commands.ts`, `register-lifecycle-run-commands.ts`, `register-sync-commands.ts`, `register-jobs-commands.ts`, `register-automation-commands.ts`, `register-setup-commands.ts` |
| `src/edges/viewer/` | Local HTTP viewer edge, static asset serving, route handling, and viewer-only read models | `server.ts`, `static.ts`, `read-model/` |
| `src/edges/viewer/read-model/` | Viewer-specific API DTO assembly over wiki stores, review store, and job projections | `api.ts`, `global-api.ts`, `jobs.ts`, `jobs-api.ts`, `review-api.ts`, `job-types.ts` |
| `src/cli/commands/` | CLI command adapters and command-private helpers | `operations.ts`, `list.ts`, `search.ts`, `show/index.ts`, `reindex.ts` |
| `src/stores/config/` | Config schema, TOML/JSON codec, raw-object editing, origin tracking, and global/project config store | `schema.ts`, `codec.ts`, `store.ts`, `editor.ts`, `origins.ts`, `paths.ts`, `index.ts` |
| `src/platform/` | Local machine integration for install, self-update, scheduler automation, diagnostics probes, local transcript discovery, external source mechanics, and child-process spawning | `install/`, `update/`, `automation/`, `diagnostics/`, `transcripts/`, `github/`, `jobs/` |
| `src/agent/` | Agent provider identity, readiness, auth, instructions, and runtime support | `provider-id.ts`, `readiness/`, `auth/`, `runtime/` |
| `src/agent/runtime/` | Provider-neutral lifecycle execution contract and provider runtime adapters | `types.ts`, `events.ts`, `providers/claude.ts`, `providers/claude/`, `providers/codex.ts`, `providers/codex/` |
| `src/stores/wiki/` | Local wiki index, query, topic-file, source-frontmatter, and health-check mechanics | `indexer/`, `query/`, `topics/`, `sources/`, `health/` |
| `src/stores/wiki/indexer/` | SQLite indexer — schema, frontmatter parse, `[[...]]` classifier, freshness | `schema.ts`, `index.ts`, `frontmatter.ts`, `wikilinks.ts`, `paths.ts` (normalization), `resolve-wiki.ts` |
| `src/shared/` | Small cross-cutting helpers with no product ownership | `duration.ts` |
| `src/services/agents/` | Agent-facing provider view and provider/model config workflows over readiness and config services | `agents.ts`, `index.ts` |
| `src/services/automation/` | Automation product workflows, task catalog/parsing, scheduled-task planning, legacy hook cleanup, and legacy automation migration over platform scheduler mechanics | `automation.ts`, `catalog.ts`, `legacy-hooks.ts`, `migration.ts`, `planning.ts`, `types.ts`, `index.ts` |
| `src/services/config/` | User-facing config verbs and config-key catalog over persisted config mechanics | `config.ts`, `keys.ts`, `index.ts` |
| `src/services/diagnostics/` | Install, agent, update, and wiki diagnostic read models for `almanac doctor` | `doctor.ts`, `install.ts`, `agents.ts`, `updates.ts`, `probes.ts`, `types.ts`, `index.ts` |
| `src/services/jobs/` | Job product workflows, execution lifecycle, queue coordination, and viewer/job read-model projection | `jobs.ts`, `types.ts`, `runtime/`, `projections/`, `index.ts` |
| `src/services/jobs/runtime/` | Job execution lifecycle over persisted records/specs/logs and agent runtime execution | `start.ts`, `background-start.ts`, `executor.ts`, `worker.ts`, `events.ts`, `finalization.ts`, `wiki-effects.ts` |
| `src/services/jobs/projections/` | Derived job read models for viewer titles, transcript source labels, agent traces, warnings, and parsed log events | `view.ts`, `log-events.ts`, `agent-traces.ts`, `warnings.ts`, `types.ts` |
| `src/services/lifecycle/` | Lifecycle product workflows for init, Absorb, Garden, and prepared operation handoff | `workflows.ts`, `operation-results.ts`, `operations/`, `absorb/`, `index.ts` |
| `src/services/lifecycle/operations/` | Provider-neutral Build/Absorb/Garden operation spec and run construction | `run.ts`, `build.ts`, `absorb.ts`, `garden.ts`, `spec.ts`, `types.ts`, `reports.ts` |
| `src/services/lifecycle/absorb/` | Absorb input parsing, source normalization, context rendering, and run-start shaping | `input.ts`, `source-ref.ts`, `input-source.ts`, `context.ts`, `start.ts` |
| `src/services/setup/` | Setup and uninstall product workflows over agent readiness/config state, instruction targets, automation cleanup, and guide cleanup while CLI setup files own terminal UI | `agent-choice.ts`, `auto-commit.ts`, `instructions.ts`, `uninstall.ts`, `index.ts` |
| `src/services/update/` | Self-update product workflow over registry, config, lock, state, and npm-install mechanics | `update.ts`, `types.ts`, `index.ts` |
| `src/services/wiki/` | Wiki product workflows that coordinate stores/indexes/filesystem mechanics | `initialization.ts`, `search.ts`, `page-view.ts`, `health.ts`, `reindex.ts`, `registry.ts`, `autoregistration.ts`, `topic-read.ts`, `topic-description.ts`, `topic-graph-mutations.ts`, `topic-page-mutations.ts`, `topic-page-rewrite.ts`, `page-topic-mutations.ts`, `page-topic-pages.ts`, `page-topic-types.ts`, `reviews.ts`, `review-types.ts`, `review-text.ts`, `review-workspace.ts`, `source-migration.ts`, `doctor.ts`, `doctor-index.ts`, `doctor-health.ts`, `doctor-absorb.ts`, `doctor-registry.ts`, `doctor-types.ts` |
| `src/stores/wiki-registry/` | Global registry persistence at `~/.almanac/registry.json` — atomic read/write | `store.ts`, `index.ts` |
| `src/stores/jobs/` | Job record, spec, log, lock, and persisted job/log schema mechanics under `.almanac/jobs/` | `records.ts`, `specs.ts`, `logs.ts`, `worker-lock.ts`, `types.ts`, `record-schema.ts`, `log-entry.ts` |
| `src/stores/wiki-files/` | Mechanical `.almanac/` scaffolding and repo file writes used by wiki initialization | `scaffold.ts` |
| `src/stores/wiki-review/` | Review queue persistence at `.almanac/review.yaml` — validation, ID generation, atomic writes | `store.ts` |
| `src/stores/wiki/topics/` | Topic DAG serialized to `.almanac/topics.yaml` + page frontmatter rewrites | `yaml.ts`, `frontmatter-rewrite.ts` |
| `test/` | Vitest suites, one per feature area | `helpers.ts` (`withTempHome`, `makeRepo`, `writePage`), `*.test.ts` |
| `prompts/` | Agent prompts bundled in the npm package | `bootstrap.md`, `writer.md`, `reviewer.md` |
| `docs/plans/` | Slice-by-slice implementation plans + review-fix plans | `slice-N-*.md`, `fixes-slice-N-review.md` |
| `docs/research/` | Research notes compiled before implementation | `agent-sdk.md` (Claude Agent SDK reference for slices 4-5) |
| `dist/` | Build output from `tsup` — gitignored | — |

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

Keep commits buildable and test-passing. `npm test` must be green on every commit.

### Testing

Vitest (`npm test` → `vitest run`). Every test that touches `~/.almanac/` or spawns a wiki MUST wrap its body in `withTempHome` from `test/helpers.ts` — it sandboxes `HOME` to a tmpdir so we never touch the real user registry. Use `makeRepo`, `scaffoldWiki`, `writePage` helpers from the same file rather than reinventing fixtures. Structure a slice's test file around the commands/features it adds; extend existing tests rather than rewriting them when a slice layers on top.

## Design decisions

_Cross-cutting architectural choices. Keep current, concise, and explanatory. Update this when a conversation settles a structural choice._

- **Providers own their runtime truth.** Each provider exposes metadata, readiness, and run behavior instead of scattering provider conditionals through commands.
- **`runAgent()` is a compatibility facade.** It stays stable for command callers, but provider modules are the real boundary.
- **Claude is SDK-backed; Codex is app-server-backed.** Cursor remains a disabled experimental readiness/config surface unless explicitly enabled; no Cursor runtime adapter is implemented. The Codex SDK spike was not adopted because it lacks the ephemeral run, managed process, and actor/notification controls Almanac lifecycle jobs require.
- **Claude auth lives under the Claude provider.** Generic agent status code should not import Claude-specific auth plumbing.
- **Review prompts are separate by job.** `prompts/reviewer.md` reviews wiki page changes; `.claude/agents/review.md` reviews code architecture and implementation.

## Non-negotiables

Design rules every change must respect. The spec has the full rationale; these are the ones that trip people up.

- **Only lifecycle operations invoke AI or write page prose.** Read commands may refresh derived local index state and read committed markdown for display or validation. Organization commands may deterministically rewrite wiki metadata through explicit verbs such as `tag`, `topics`, `review`, and `migrate`.
- **Reindex is silent and implicit.** Every query command compares `pages/*.md` mtimes against `index.db` and rebuilds if stale. No progress bars, no "indexing..." chatter, no opt-in flag. `almanac reindex` is the escape hatch for "I want to force it."
- **Unified `[[...]]` syntax.** One link form, disambiguated by content: contains `:` before `/` → cross-wiki; contains `/` → file ref (trailing `/` = folder); otherwise → page slug. Do not introduce a second link syntax.
- **Use `GLOB` not `LIKE` for path queries**, and **escape `*?[` before concatenating stored paths into a GLOB pattern.** SQLite's `LIKE` treats `_` as a wildcard (spurious matches on `src/my_module/`); `GLOB` treats it literally. A Next.js-style stored path like `src/[id]/page.tsx` contains GLOB metacharacters — unescaped, it matches things it shouldn't. See `fixes-slice-2-review.md` for the bug and fix.
- **Paths are normalized at index time and at query time.** Lowercase (macOS is case-insensitive), forward slashes, no `./` prefix, trailing slash iff directory, no redundant slashes. Normalize on both sides of a comparison.
- **Slugs are kebab-case of the filename.** `checkout_flow`, `Checkout Flow.md`, `checkout-flow.md` all canonicalize to `checkout-flow`. Enforced at write time and checked by health.
- **DAG cycle prevention is belt-and-suspenders.** `CHECK (child_slug != parent_slug)` in the schema, pre-insert cycle check on `topics link`, and a depth cap of 32 on any recursive CTE.
- **Registry entries are never auto-dropped.** Unreachable paths are silently skipped in `--all` queries. `almanac list --drop <name>` is the only explicit removal. Cloning a repo with a committed `.almanac/` that isn't registered triggers silent auto-registration on any command except `init` (which registers explicitly) and `list --drop` (intent is to shrink).
- **Archived pages are excluded from search by default**, are not flagged for dead-refs by `health`, and keep their backlinks resolvable. `--include-archive` and `--archived` change scope.
- **Prompts are shipped from the npm package.** They live in `prompts/` at repo root, are bundled into `files` in `package.json`, and the agent runtime reads them from the package install path at runtime. They are not embedded as TS string literals.

## Philosophy anti-patterns

Things we do not do. If a plan proposes one, push back.

- **No propose/apply flows.** No proposal JSON files, no `--apply` or `--confirm` step. Agents write directly; users read the diff in `git status`.
- **No `--dry-run` flags.** The agent is either doing the work or it isn't. Rehearsal is not a feature.
- **No interactive prompts.** The CLI is pipeable and scriptable; scheduled sync runs in the background. Nothing blocks on user input.
- **No pipeline scaffolding where a prompt would do.** If a task calls for judgment, extend the prompt — don't add a pre-processing step in TypeScript that hard-codes the judgment.
- **No state machines between writer and reviewer.** Writer invokes reviewer via `agents: { reviewer }` in the SDK, reads the text critique, decides. No approve/revise/reject enum.
- **No semantic search yet.** FTS5 first. Add vectors only when FTS5 proves insufficient against a real repo.
- **No raw `almanac query`.** The schema is simple; open `index.db` directly if you need to.
- **No `almanac read/write/edit`.** The agent has Read/Write/Edit tools.

## Key file locations

- **Design spec:** `/Users/rohan/Desktop/Projects/openalmanac/docs/ideas/codebase-wiki.md`
- **Slice plans:** `docs/plans/slice-N-*.md`, `docs/plans/fixes-slice-N-review.md`
- **Agent SDK reference:** `docs/research/agent-sdk.md` — version pin, auth, message types, streaming, subagent routing, pitfalls. Read before slice 4 or 5 work.
- **Prompts:** `prompts/bootstrap.md`, `prompts/writer.md`, `prompts/reviewer.md`
- **SQLite schema DDL:** `src/stores/wiki/indexer/schema.ts` (single-source, applied idempotently on open)
- **Init scaffolding:** `src/services/wiki/initialization.ts` (creates `.almanac/`, starter README, runtime `.gitignore` entries, and registry entry)
- **Registry I/O:** `src/stores/wiki-registry/store.ts` (atomic read/write) and `src/services/wiki/autoregistration.ts` (silent-on-command policy)
- **Walk-up resolver:** `src/paths.ts` — nearest `.almanac/` from a `cwd`, like git's nearest `.git/`
- **Test sandbox helpers:** `test/helpers.ts`
