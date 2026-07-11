---
title: Launch Positioning
topics: [concepts, product]
sources:
  - id: repo-readme
    type: file
    path: README.md
    note: Public product tagline, local-first product surface, and command examples.
  - id: bookface-post
    type: file
    path: docs/launch/bookface-s26/post.md
    note: YC S26 Bookface launch draft and product narrative.
  - id: launch-assets
    type: file
    path: docs/launch/bookface-s26/assets/
    note: Final launch demo video and GIF assets.
  - id: openwiki-notes
    type: file
    path: docs/research/openwiki-launch-traction/notes.md
    note: OpenWiki launch traction research notes.
  - id: openwiki-export-script
    type: file
    path: docs/research/openwiki-launch-traction/fetch-github-stargazers.mjs
    note: Script that exports GitHub stargazers with starred timestamps and public profile fields.
  - id: stargazer-combine-script
    type: file
    path: docs/research/openwiki-launch-traction/combine-stargazers.mjs
    note: Script that combines enriched stargazer exports for OpenWiki, Graphify, CodeAlmanac, and Google OKF.
  - id: combined-stargazers-csv
    type: file
    path: docs/research/openwiki-launch-traction/combined-stargazers-deduped.csv
    note: Deduplicated enriched GitHub stargazer export across OpenWiki, Graphify, CodeAlmanac, and Google OKF.
  - id: sqlite-framing-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/08/rollout-2026-07-08T20-50-32-019f44ff-a4ea-7713-8f45-c0beb43c73ee.jsonl
    note: Launch-copy discussion that framed CodeAlmanac as a compiled layer of understanding and placed SQLite index language in the How it works section.
  - id: traction-export-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/07/rollout-2026-07-07T11-48-21-019f3de8-e706-7c10-ab2d-f4cffe903abf.jsonl
    note: Stargazer export, validation, DM-availability, and copy-paste artifact run for launch outreach.
  - id: tagit
    type: web
    url: https://github.com/liliang-cn/tagit
    note: GitHub repository for TagIt, an agent-in-team-chat comparison point.
  - id: agentchattr
    type: web
    url: https://github.com/bcurts/agentchattr
    note: GitHub repository for agentchattr, a local Slack-like agent chat comparison point.
  - id: pr-first-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/10/rollout-2026-07-10T19-01-57-019f4ee8-f32b-7e40-97ba-55c47580df71.jsonl
    note: Outreach discussion that compared permission-seeking with finished documentation PRs.
---

# Launch Positioning

Launch positioning is the reusable product story behind CodeAlmanac launch work. The current line is that CodeAlmanac is a living wiki for a codebase, maintained by AI coding agents, with plain Markdown in `almanac/`, local indexes, Git review, and read commands such as `codealmanac search` and `codealmanac show` [@repo-readme]. Launch material should make that concrete as agent memory: coding agents start from zero, while CodeAlmanac preserves the decisions, gotchas, invariants, and flows they would otherwise rediscover [@bookface-post].

## Core Claim

The Bookface draft frames CodeAlmanac as open source, local, and free, then contrasts it with tools that make graphs or code search surfaces but do not maintain detailed connected Markdown articles from agent conversations [@bookface-post]. The skeptical-objection section should stay specific: the durable contrast is not "better docs"; it is conversation-updated Markdown in the repository, scheduled gardening, and an agent-native CLI read surface [@bookface-post] [@repo-readme].

The precompilation framing is useful for explaining why CodeAlmanac is not just transcript search. Search retrieves what was said, while the wiki preserves the version of understanding worth carrying forward: what is true now, why it is true, what changed, and where the next agent should look [@sqlite-framing-transcript]. It can be compared loosely to a cache, but launch copy should avoid making it sound like passive storage; the important claim is that CodeAlmanac selects, compresses, updates, and organizes raw conversations into a compiled wiki layer [@sqlite-framing-transcript].

The strongest example pattern is a future agent being asked to add Okta SSO and finding a previous WorkOS decision plus a webhook replay gotcha before coding [@bookface-post]. That example works because it names a concrete task, a concrete prior decision, and a concrete failure mode instead of only restating the product category.

SQLite belongs in the "How it works" explanation, not in the opening definition. The opener should say that CodeAlmanac is a self-updating wiki that lives in the repo as Markdown; the mechanics section can then say that the agent queries the wiki through a local SQLite index with `codealmanac search` and `codealmanac show` [@repo-readme] [@sqlite-framing-transcript].

## Demo Asset

The launch demo asset is a 35-second product video under `docs/launch/bookface-s26/assets/`, with MP4 and GIF versions present in the launch folder [@launch-assets]. The GIF asset is 17 MB in the current checkout, which leaves little headroom for platforms that recompress uploads [@launch-assets].

For demo structure, use [Demo CodeAlmanac in a launch video](../guides/demo-codealmanac-in-launch-video). That guide keeps the video centered on the served wiki as proof and the terminal query as the product payoff.

## Market Comparison Notes

OpenWiki research is raw launch analysis, not a final report. The reusable conclusion is that OpenWiki's early growth looked like a developer-viral open-source launch: the notes record about 9k GitHub stars in roughly a week, Trendshift daily rankings, HN activity, and LinkedIn/X repost waves, while also stating that exact referral sources are not public without repository-owner traffic data [@openwiki-notes]. That makes OpenWiki a useful comparison for launch mechanics, but not proof that the same channels will work for CodeAlmanac.

The stargazer export work is useful as audience research rather than as a standing operating procedure. The export fetched GitHub stargazers through GraphQL in `STARRED_AT` order with public profile fields, then combined OpenWiki, Graphify, CodeAlmanac, and Google OKF into one lowercased-login dataset with per-repository membership fields [@openwiki-export-script] [@stargazer-combine-script] [@combined-stargazers-csv]. The validated combined file contained 92,576 unique GitHub accounts, including 9,774 OpenWiki stargazers, 80,469 Graphify stargazers, 241 CodeAlmanac stargazers, and 6,513 Google OKF stargazers [@traction-export-transcript]. Those numbers are evidence for the July 2026 launch research set, not a live product metric.

The agent-chat comparison set from the July 8 lookup has two useful anchors. TagIt positions itself as a self-hosted chat interface where a team can `@mention` coding agents, register Claude Code and Codex CLIs, and route Slack or Feishu messages to the configured agent [@tagit]. agentchattr is the Slack-like local chat comparison: its README describes `@claude`, `@codex`, and other agent mentions, shared channels, and agent-to-agent wakeups through a local chat server [@agentchattr]. These tools are not direct wiki-memory substitutes, but they are relevant when launch copy mentions teams routing work to multiple agents.

## Repository Outreach

For open-source repository outreach, a finished pull request can be stronger than asking maintainers to imagine the value first. The recommended framing is that the PR itself is the demo: ordinary Markdown under `almanac/`, no runtime impact, clear preview instructions, validation evidence, and no expectation that the project adopt CodeAlmanac automation [@pr-first-transcript].

This strategy should stay selective. It fits repositories that accept documentation contributions, have enough complexity to justify a repo-local architecture wiki, and allow a high-quality source-grounded contribution. It should not be used for automated generic PRs or for pages that merely summarize files; the outreach value depends on proving that CodeAlmanac captured decisions, flows, gotchas, and contributor-navigation problems the maintainers can inspect directly [@pr-first-transcript].
