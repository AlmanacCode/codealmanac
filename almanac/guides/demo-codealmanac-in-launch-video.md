---
title: Demo CodeAlmanac In A Launch Video
topics: [guides, product, viewer, cli]
sources:
  - id: public-readme
    type: file
    path: README.md
    note: Public product positioning, viewer command, and agent read commands.
  - id: tagit
    type: web
    url: https://github.com/liliang-cn/tagit
    note: Agent-in-team-chat comparison point.
  - id: agentchattr
    type: web
    url: https://github.com/bcurts/agentchattr
    note: Local multi-agent chat comparison point.
  - id: launch-video-session
    type: conversation
    path: /Users/divitsheth/.codex/sessions/2026/07/09/rollout-2026-07-09T19-26-19-019f49d8-e706-7d73-9fa0-1cd8009b02cb.jsonl
    note: Launch-video implementation session and follow-up scope check.
  - id: product-positioning-session
    type: conversation
    path: /Users/divitsheth/.codex/sessions/2026/07/11/rollout-2026-07-11T19-18-29-019f541e-72eb-7e01-8644-b2a5e139fcd7.jsonl
    note: Product-origin and three-pillar positioning discussion.
---

# Demo CodeAlmanac In A Launch Video

Use a real repository wiki and keep the sequence short [@public-readme]:

1. Open `codealmanac serve` to establish that the artifact is a browsable,
   repo-owned Markdown wiki.
2. Show one page containing a decision, invariant, gotcha, or multi-file flow.
3. Run `codealmanac search` and `codealmanac show` to retrieve the same durable
   knowledge as an agent would before coding.

The viewer establishes the noun; the terminal demonstrates the verb. Avoid a
folder tour or implementation explanation before the query. The payoff is that
future coding agents can retrieve maintained project understanding rather than
starting from raw source and disconnected conversations [@public-readme].

Use this repository for the demo when one of its pages is concrete enough for a
cold viewer. Otherwise choose a repository with a relatable decision or failure
mode while keeping the same viewer-to-query sequence.

## Positioning For The Demo

The useful contrast is not generic "better documentation." CodeAlmanac preserves
decisions, invariants, gotchas, flows, and operating knowledge that future agent
sessions would otherwise rediscover. Git keeps that knowledge reviewable, while
build, ingest, garden, and sync keep it current [@public-readme].

Keep launch-video claims local to the current product. The companion feature
video covers ingest, background jobs, session sync, Garden maintenance, and
local-only automation; it does not mention a hosted product, PR automation,
GitHub workflows, or cloud features [@launch-video-session].

Use three plain pillars when explaining how CodeAlmanac solves the context
problem:

1. **Updates from conversations:** CodeAlmanac reads coding-agent conversations
   and saves decisions, rejected ideas, bug lessons, and other context the code
   does not explain [@product-positioning-session].
2. **Made for agents:** The wiki is a set of connected Markdown pages, so
   agents can search for relevant context instead of reading one large
   instruction file [@product-positioning-session].
3. **Gardens itself:** CodeAlmanac regularly checks and reorganizes the wiki,
   removing stale information as the codebase changes [@product-positioning-session].

Keep the wording direct and a little imperfect. The approved origin story is
that this problem appeared while building OpenAlmanac and earlier products with
coding agents: decisions, rejected approaches, and lessons kept disappearing
between sessions, so agents repeated old mistakes or changed code without
understanding why it had its shape [@product-positioning-session].

Team-chat tools such as TagIt and agentchattr route work and conversation among
agents [@tagit] [@agentchattr]. They are adjacent rather than equivalent:
CodeAlmanac's primary artifact is the maintained repository wiki that later
agents query before changing code, not a chat channel between agents.
