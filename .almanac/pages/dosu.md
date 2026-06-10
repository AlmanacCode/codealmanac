---
title: Dosu
summary: Dosu is an adjacent hosted knowledge product whose 2026-06-09 experiments showed separate steps for Codex MCP setup, deployment source connection, knowledge submission, and curated retrieval.
topics: [competitive-research, product-positioning]
sources:
  - id: dosu-experiment-session
    type: transcript
    path: /Users/kushagrachitkara/.claude/projects/-Users-kushagrachitkara-Downloads-reverie-codealmanac/767924bf-14a8-48e3-8c5c-a69523619cb9.jsonl
    note: Claude session that tested Dosu MCP retrieval and write tools while asking whether Dosu could draft AGENTS.md and whether sources can be added through CLI or MCP.
  - id: dosu-codex-setup-session
    type: transcript
    path: /Users/kushagrachitkara/.codex/sessions/2026/06/09/rollout-2026-06-09T15-28-27-019eae80-59af-7060-b6de-e0f8d96d48ca.jsonl
    note: Codex session that ran `npx @dosu/cli setup --agent --tool codex`, checked whether setup wrote Codex MCP config, and concluded that the deployment still needed a connected source before retrieval worked.
  - id: dosu-codex-empty-deployment-session
    type: transcript
    path: /Users/kushagrachitkara/.codex/sessions/2026/06/09/rollout-2026-06-09T15-41-37-019eae8c-665b-7842-ac31-481c789a6451.jsonl
    note: Codex session that retried Dosu after authentication, confirmed the deployment had zero connected data sources, checked the public-library fallback for `codealmanac`, and rejected `generate_documentation` as ungrounded for AGENTS.md drafting.
status: active
verified: 2026-06-09
external_version: Observed through the Dosu MCP surface on 2026-06-09
---

`Dosu` is an adjacent managed knowledge product that CodeAlmanac tested as a possible way to draft project instructions and evaluate company-brain tooling. The durable lesson from the 2026-06-09 experiments is not that Dosu "failed"; it is that the observed Dosu surface separates Codex MCP setup, deployment source connection, knowledge submission, curated retrieval, and public-library coverage for repositories that are not part of a connected deployment. [@dosu-experiment-session] [@dosu-codex-setup-session] [@dosu-codex-empty-deployment-session]

## What The Sessions Tested

The first session asked Dosu to draft an `AGENTS.md` file for this repository, then narrowed into tool-surface exploration. The observed MCP calls were `search_documentation`, `init_knowledge`, and `save_topic`, all against an empty deployment. [@dosu-experiment-session]

`search_documentation` returned `No data sources found for this deployment`, and `init_knowledge` returned `No knowledge found`. In the tested state, Dosu could not retrieve or ground an `AGENTS.md` draft from project sources because there were no connected sources and no curated knowledge to search. [@dosu-experiment-session]

The later Codex session tested the local installation path instead of the hosted MCP calls. It ran `npx @dosu/cli setup --agent --tool codex`, hit a browser-auth requirement before setup completed, and then checked `~/.codex/config.toml`, which still had no `mcp_servers.dosu` block at that point. The only new local artifacts the session observed were Dosu CLI files under `~/.config/dosu-cli`. [@dosu-codex-setup-session]

A third Codex session retried the hosted MCP path after authentication. `init_knowledge` still returned `No knowledge found`, `list_available_data_sources` returned zero connected sources, and `find_public_library` returned no public result for `codealmanac`. The session therefore concluded that Dosu still could not ground an `AGENTS.md` draft from its own corpus. [@dosu-codex-empty-deployment-session]

## Observed Setup Boundary

The Codex setup session showed that "connect Dosu to Codex" and "give Dosu project content" are different steps. The setup command prepared an authenticated MCP deployment path, but the follow-up conclusion was still that the deployment needed at least one connected source, such as the `codealmanac` GitHub repo, before `npx @dosu/cli ask "What does this project do?"` could return project knowledge. [@dosu-codex-setup-session]

The session did not observe any successful source attachment during setup itself. In the state it tested, setup without completed browser auth wrote no Codex MCP config, and later guidance still pointed the user to the Dosu dashboard to attach a source to the deployment. [@dosu-codex-setup-session]

## Observed Boundary Between Sources And Knowledge

The sessions did not observe any MCP tool for creating or connecting a data source. They only observed tools for reading existing sources or knowledge, for submitting knowledge-like content such as `save_topic`, and for preparing a Codex MCP connection that still depended on a separately populated deployment. The practical conclusion is that source connection was not available through the tested MCP surface. [@dosu-experiment-session] [@dosu-codex-setup-session]

The three sessions together established a hosted workflow with at least four distinct gates: authenticate or install the MCP connection, attach sources to the deployment, wait for retrievable knowledge to exist behind the search tools, and fall back to Dosu's public-library index only if the repository is actually covered there. The exact product surface for source attachment was only observed indirectly through empty-deployment failures and dashboard-oriented guidance, so future evaluation should still treat "dashboard-only source connection" as a working hypothesis until a post-auth CLI run or product doc confirms it. [@dosu-experiment-session] [@dosu-codex-setup-session] [@dosu-codex-empty-deployment-session]

The same third session clarified one tool-selection boundary. `generate_documentation` was not used because it publishes a background documentation page from connected data sources, and the deployment had no connected sources to ground a repo-specific `AGENTS.md` draft. The safe fallback in that state is direct repo inspection rather than asking Dosu to synthesize from an empty deployment. [@dosu-codex-empty-deployment-session]

## Observed Boundary Between Write And Read

`save_topic` returned `Topic saved.` for a CodeAlmanac architectural note, then an immediate `init_knowledge` call on the same subject still returned `No knowledge found`. The observed write-to-read path is therefore not synchronous. A saved topic did not become searchable curated knowledge immediately in the same session. [@dosu-experiment-session]

The strongest safe interpretation is that Dosu distinguishes submitted knowledge from retrievable curated knowledge. The session inferred a review or async indexing step, but only the delayed or gated read behavior was directly observed. [@dosu-experiment-session]

## Product Lesson For CodeAlmanac

Dosu is useful as a contrast case inside [[company-brain]]. It models hosted, curated knowledge with a managed ingestion layer rather than repo-owned memory. The 2026-06-09 experiments also reinforced one CodeAlmanac product rule: when project instructions must be accurate to the current repository, direct inspection of the repository is more reliable than asking an empty or uncovered external knowledge base to synthesize them. [@dosu-experiment-session] [@dosu-codex-empty-deployment-session]

The later Codex setup session sharpened that contrast from the onboarding side. Dosu's setup path can be smooth for installing a hosted MCP endpoint into an agent tool, but that convenience still leaves source attachment and knowledge population outside the repository. CodeAlmanac's competing trust claim is that the project memory artifact is already present in the repo, reviewable in Git, and readable without a separate hosted knowledge state. [@dosu-codex-setup-session]

CodeAlmanac's differentiator remains the durable artifact. Dosu's observed knowledge state was opaque from the repository, while CodeAlmanac keeps project memory in reviewable markdown pages and Git history.

## Follow-Up Questions

The next meaningful Dosu checks are whether the CLI can connect sources directly after browser auth, whether a saved topic appears in a visible review queue, whether a direct document-write path becomes searchable faster than `save_topic`, and whether public-library coverage for a repo can be discovered anywhere other than `find_public_library`. Those questions were identified in the sessions but not yet verified. [@dosu-experiment-session] [@dosu-codex-setup-session] [@dosu-codex-empty-deployment-session]

## Related Pages

[[company-brain]] explains where hosted knowledge products fit in the broader company-brain market. [[github-native-wiki-maintenance]] explains why CodeAlmanac keeps the canonical memory artifact in the repository even when remote automation is added later.
