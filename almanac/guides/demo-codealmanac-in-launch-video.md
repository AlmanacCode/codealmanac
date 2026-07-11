---
title: Demo CodeAlmanac In A Launch Video
topics: [guides, product, viewer, cli]
sources:
  - id: public-readme
    type: file
    path: README.md
    note: Public product positioning, viewer command, and agent read commands.
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

See [Launch positioning](../concepts/launch-positioning) for the broader product
distinction.
