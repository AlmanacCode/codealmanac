---
title: Codex Supermemory
summary: Codex Supermemory is a lightweight Supermemory hook integration whose smooth prompt-time recall sharpens CodeAlmanac's activation-gap lesson.
topics: [product-positioning, agents]
files:
  - docs/strategy/codealmanac-vs-deepwiki-supermemory.md
sources:
  - /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T01-30-45-019e2a1d-a038-7633-81ea-a1dfc6cb50bd.jsonl
  - /Users/rohan/.codex/sessions/2026/05/27/rollout-2026-05-27T15-11-37-019e6b10-6850-7512-ac56-e74118e4c6d2.jsonl
  - /Users/rohan/.codex/hooks.json
  - /Users/rohan/.codex/supermemory/recall.js
  - /Users/rohan/.codex/supermemory/flush.js
  - /Users/rohan/.codex/supermemory/search-memory.js
  - /Users/rohan/.codex/supermemory/save-memory.js
  - /Users/rohan/.codex/supermemory/forget-memory.js
  - /Users/rohan/.codex/supermemory/login.js
  - https://github.com/supermemoryai/supermemory
  - https://supermemory.ai/docs/concepts/how-it-works
  - https://supermemory.ai/docs/concepts/graph-memory
  - https://supermemory.ai/docs/concepts/memory-vs-rag
  - https://supermemory.ai/docs/concepts/user-profiles
verified: 2026-05-27
---

`codex-supermemory` is the Codex-specific Supermemory integration tested during the 2026-05-19 competitor evaluation. It installed `codex-supermemory@1.0.5`, copied hook scripts into `~/.codex/supermemory/`, added Supermemory skills under `~/.codex/skills/`, enabled Codex hooks, and used Supermemory's hosted API instead of a local daemon.

## Runtime Shape

The integration hooks Codex at `UserPromptSubmit` and `Stop`. `UserPromptSubmit` runs `node ~/.codex/supermemory/recall.js`, and `Stop` runs `node ~/.codex/supermemory/flush.js` after the existing Almanac capture hook in `~/.codex/hooks.json`.

`recall.js` does two jobs. It can capture recent transcript entries when enough turns have accumulated, and it searches Supermemory for memories relevant to the current prompt. When it finds results, it returns Codex hook JSON whose `additionalContext` contains a `[SUPERMEMORY CONTEXT]` block.

`flush.js` captures remaining transcript entries at session end. Both `recall.js` and `flush.js` parse the transcript path from the hook payload, strip `<private>` blocks, remove `<system-reminder>` and prior Supermemory context blocks, and save content to both a user container and a project container.

Project and user scope are hashed container tags. The default project tag is `codex_project_<sha256(cwd)>`, and the user tag is based on the git email or username. Explicit skills call `search-memory.js`, `save-memory.js`, `forget-memory.js`, and `login.js`.

There was no obvious `codex-supermemory` uninstall subcommand in the npm package metadata inspected on 2026-05-20. Local cleanup is therefore file-and-hook cleanup: remove only hook commands whose `command` references `.codex/supermemory`, preserve unrelated hooks such as Almanac's `almanac-capture.sh`, and then delete `~/.codex/supermemory/`, the Supermemory skills under `~/.codex/skills/`, `~/.codex-supermemory/`, `~/.codex-supermemory.log`, and `~/.codex/supermemory.json`. That local cleanup does not delete memories already saved to Supermemory's hosted service; those require Supermemory's console or `forget-memory.js` while credentials still exist.

## Ingestion Model

`codex-supermemory` automatically ingests Codex transcript chunks, not curated wiki facts. On `UserPromptSubmit`, `recall.js` resolves the active transcript, captures new entries since the last tracker index when the minimum turn threshold is met, then searches Supermemory for the current prompt. On `Stop`, `flush.js` captures any remaining transcript entries.

The installed default config has `signalExtraction: false` and `autoSaveEveryTurns: 3`. That makes the default capture broad: conversation turns are saved after enough activity instead of being filtered down to explicit decisions, bugs, preferences, or architecture notes. The scripts include keyword-based signal filtering settings, but the inspected install leaves that path disabled by default.

The Supermemory API and docs describe a deeper hosted memory layer behind those transcript writes. Supermemory distinguishes raw documents from extracted memories, builds profile context from static and dynamic facts, and describes graph relationships between facts: updates, extends, and derives. Its public docs say ingestion can process text, URLs, files, and conversations into memories with embeddings and relationships, while search can return either extracted memories or document chunks in hybrid mode.

The public `supermemoryai/supermemory` repo exposes the app, docs, SDK/tool packages, MCP app, and UI packages, but not the full hosted memory engine implementation. The algorithmic details for extraction, contradiction handling, profile updates, and forgetting should therefore be treated as product contract and hosted-service behavior, not fully inspectable local code.

The quality difference is therefore not "Supermemory stores raw chunks and CodeAlmanac stores summaries." Supermemory's hosted layer claims to extract and maintain evolving memory records from broad inputs. The sharper difference is that Supermemory's canonical unit is a hosted memory/document record with profile and graph retrieval semantics, while CodeAlmanac's canonical unit is a repo-local markdown page with topics, `files:` frontmatter, wikilinks, backlinks, health checks, and Git review.

## Tested Behavior

The first explicit project search for CodeAlmanac returned no memories. After saving a short project-scoped evaluation note with `save-memory.js`, the same integration returned the saved note through both `search-memory.js --project` and a manual `recall.js` `UserPromptSubmit` payload.

That test verified the product feel rather than only the code shape: once authenticated, Supermemory can make a memory appear in the next Codex prompt without the agent deciding to search first.

The 2026-05-27 personal Gmail workflow showed the same product mechanic in a non-code task inside the CodeAlmanac repo. `UserPromptSubmit` injected a `[SUPERMEMORY CONTEXT]` block before the assistant answered, and a later turn injected prior findings from the same task thread so the assistant could continue from the previous action order without re-reading every email result.

That behavior is useful and risky for CodeAlmanac positioning. It demonstrates why automatic recall feels immediate, but it also shows that broad user and project memories can enter a coding workspace even when the task is not about the repo. CodeAlmanac should treat this as a boundary lesson: prompt-time memory needs scope, source labels, and user-visible evidence when the retrieved facts may cross personal, project, and company contexts.

## Product Lesson

`codex-supermemory` feels like automatic cloud recall for Codex sessions. Its first-run path is a consumer-product loop: run one installer, authenticate once, then let prompt hooks inject relevant memories. The user does not need to learn a wiki model, inspect topics, or run file-aware searches before seeing value.

CodeAlmanac feels like a governed engineering artifact. Its memory lives in `.almanac/pages/`, is readable as markdown, is reviewable in Git, and is tied to repo concepts through `files:`, topics, wikilinks, backlinks, and health checks. That trust boundary is stronger, but the value is easier to skip because agents must still remember to search and read pages.

`codex-supermemory` is a real competitor for the broad "agent memory" job. It can store overlapping facts about CodeAlmanac, and many solo users may treat prompt-time recall as enough even when the source is an opaque hosted memory record. CodeAlmanac is not clearly better as a day-one memory product while its retrieval remains pull-based.

CodeAlmanac's current advantage is the artifact, not the delivery experience. Existing pages such as [[provider-lifecycle-boundary]], [[accidental-special-case-architecture]], and [[sqlite-indexer]] preserve synthesized boundaries, rejected designs, and implementation gotchas that are more actionable than raw transcript memories. That advantage matters only when agents actually see the relevant page before an edit.

The user-problem boundary is sharper than the implementation boundary. Supermemory is best framed as solving "my agent forgets": it gives the next Codex prompt remembered user, session, and project context. CodeAlmanac is best framed as solving "my codebase forgets": it promotes hard-won engineering knowledge into repo-owned pages that teams and future agents can inspect, link to files, and review in Git.

The durable lesson is the same as [[just-in-time-context-surfacing]]: CodeAlmanac should keep the repo-owned wiki as canonical memory, but the experience needs automatic, cited surfacing at the moment an agent is about to act. Competing with `codex-supermemory` as generic cross-session memory would weaken CodeAlmanac's differentiation; competing with a small set of file-aware constraints from governed pages keeps the product distinct.

## Related Pages

[[agentmemory-competitor]] covers the heavier local-daemon memory product inspected in the same research arc. [[company-brain]] places Supermemory-style prompt injection inside the broader company-brain market. [[just-in-time-context-surfacing]] describes the CodeAlmanac response: automatic surfacing without automatic believing.
