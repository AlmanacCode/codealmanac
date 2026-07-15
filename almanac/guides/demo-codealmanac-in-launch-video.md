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
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Local-only product boundary and excluded hosted/cloud surfaces.
  - id: differentiation
    type: file
    path: docs/strategy/codealmanac-vs-deepwiki-supermemory.md
    note: Product positioning around git-native repo memory maintained by agents.
  - id: show-hn
    type: web
    url: https://news.ycombinator.com/item?id=48849361
    note: Initial Show HN post for CodeAlmanac.
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

Keep launch-video claims local to the current product. The Python rewrite is a
local-only CLI and explicitly excludes hosted shipping, login/connect/upload,
SDK, MCP, and cloud capture surfaces in this version [@live-agreement].

Use three plain pillars when explaining how CodeAlmanac solves the context
problem:

1. **Updates from conversations:** CodeAlmanac reads coding-agent conversations
   and saves decisions, rejected ideas, bug lessons, and other context the code
   does not explain [@public-readme] [@differentiation].
2. **Made for agents:** The wiki is a set of connected Markdown pages, so
   agents can search for relevant context before changing the repo [@public-readme]
   [@differentiation].
3. **Gardens itself:** CodeAlmanac regularly checks and reorganizes the wiki,
   reducing stale, duplicated, or poorly connected knowledge [@public-readme]
   [@differentiation].

Keep the wording direct and a little imperfect. The durable story is that
CodeAlmanac is a git-native living wiki for one codebase, maintained by coding
agents as a side effect of real development and optimized for the next coding
agent before it edits the repo [@differentiation].

Team-chat tools such as TagIt and agentchattr route work and conversation among
agents [@tagit] [@agentchattr]. They are adjacent rather than equivalent:
CodeAlmanac's primary artifact is the maintained repository wiki that later
agents query before changing code, not a chat channel between agents.

## Public Launch Notes

When answering public launch questions, be transparent that CodeAlmanac already
had an initial Show HN on July 9, 2026 [@show-hn]. The later Launch HN should
be framed as a fuller introduction to the same local, open-source CLI rather
than as a major product-change announcement [@public-readme] [@live-agreement].

The concise answer for a missing demo video is that HN users can install and
try the CLI directly without creating an account [@public-readme]
[@live-agreement].
Keep privacy claims tied to the local product boundary: the CLI has no Almanac
account, telemetry, analytics, or usage tracking; user code, transcripts, and
wiki content stay local except for the selected model provider used by the
user's own Codex or Claude account during lifecycle runs [@public-readme]
[@live-agreement].

## Related Pages

See [Local viewer](../architecture/viewer/local-viewer),
[CLI public command surface](../reference/cli/public-command-surface),
[Local-only Python product](../decisions/local-only-python-product), and
[Wiki usefulness evaluation](../concepts/wiki-usefulness-evaluation).
