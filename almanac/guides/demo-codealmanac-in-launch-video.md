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
  - id: setup-options
    type: file
    path: src/codealmanac/cli/dispatch/setup_wizard/options.py
    note: Interactive setup telemetry option labels and explanatory copy.
  - id: setup-parser
    type: file
    path: src/codealmanac/cli/parser/setup.py
    note: Non-interactive setup telemetry opt-out flag.
---

# Demo CodeAlmanac In A Launch Video

Use a real repository wiki and keep the sequence short [@public-readme]:

1. Open `codealmanac serve` to establish that the artifact is a browsable,
   repo-owned Markdown wiki.
2. Show one page containing a decision, invariant, gotcha, or multi-file flow.
3. Run `codealmanac search` and `codealmanac show` to retrieve the same durable
   knowledge as an agent would before coding.

If the video includes onboarding, show the final telemetry choice truthfully:
Yes is recommended to improve the CLI, No remains visible, and the copy excludes
code, paths, arguments, prompts, and transcripts. For a recording that should
not generate product signals, run `codealmanac setup --yes --no-telemetry`
[@setup-options] [@setup-parser].

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

Team-chat tools such as TagIt and agentchattr route work and conversation among
agents [@tagit] [@agentchattr]. They are adjacent rather than equivalent:
CodeAlmanac's primary artifact is the maintained repository wiki that later
agents query before changing code, not a chat channel between agents.
