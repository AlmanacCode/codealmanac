---
title: Demo CodeAlmanac In A Launch Video
topics: [guides, product, viewer, cli]
sources:
  - id: public-readme
    type: file
    path: README.md
    note: Public product positioning, local viewer command, and agent read commands.
  - id: bookface-post
    type: file
    path: docs/launch/bookface-s26/post.md
    note: Bookface launch draft with the self-updating wiki, local Markdown, and agent-query positioning.
  - id: launch-transcript
    type: file
    path: docs/launch/bookface-s26/transcript.md
    note: Launch draft and reference-post transcript material used to shape the demo narrative.
---

# Demo CodeAlmanac In A Launch Video

Use this guide when making a short product demo for CodeAlmanac. The demo should frame CodeAlmanac as a self-updating wiki for a codebase, maintained for agents, then prove that claim by moving quickly from the local viewer to an agent-style terminal query [@public-readme] [@bookface-post]. The durable rule is to show the wiki as proof that the knowledge base is real, but let `codealmanac search` and `codealmanac show` carry the main product payoff [@public-readme] [@bookface-post].

For the broader YC launch story, comparison points, and final demo-asset notes, read [Launch positioning](../concepts/launch-positioning).

## Start With The Wiki, Not A Tour

Open with the served wiki for a few seconds. `codealmanac serve` is already part of the public quickstart, and it makes the repo-owned Markdown tree visible as a real browseable product surface [@public-readme]. Use that view to establish the noun: CodeAlmanac is not hidden memory, a hosted dashboard, or a loose context file. It is a wiki in the repository.

Do not walk folder by folder. Folder structure explains the wiki before the viewer sees why the wiki matters. Let the page list, topics, and a real article pass on screen as visual evidence, then land on one page that contains a decision, invariant, gotcha, or flow [@bookface-post].

## Land On One Non-Obvious Page

The launch draft says the useful content is what code alone cannot say: decisions, gotchas, invariants, and flows [@bookface-post]. The demo page should therefore contain one fact that a README would not normally preserve. A decision page or gotcha page is stronger than a generic overview page because it answers the viewer's likely objection: why this is not just another docs folder.

The page should be a setup, not the whole payoff. Either read one short line aloud, or show the page title and save the answer for the terminal query. Use the read-aloud version when the fact needs context; use the tease version when the terminal answer is clear enough to land on its own.

## Make The Terminal The Verb

After the page appears, pivot to the terminal: the point is not only that a human can browse the wiki, but that an agent can query it before touching code. The public read surface is built around `codealmanac search`, `codealmanac search --mentions`, and `codealmanac show` [@public-readme]. Use one query that returns the same kind of decision or gotcha the viewer just saw.

The recommended beat is:

1. Show the served wiki briefly.
2. Land on one meaningful page.
3. Say that the agent reads this before it codes.
4. Run the terminal query.
5. Let the query answer reveal the stored decision, invariant, or gotcha.

This order keeps the viewer oriented without turning the video into documentation. The served wiki is the setup; the terminal query is the proof that the knowledge is agent-readable [@public-readme].

## Keep The Product Claim Tight

Use the one-line position from the launch material: CodeAlmanac is a living or self-updating wiki for a codebase, maintained by AI coding agents [@public-readme] [@bookface-post]. The next sentence should connect to the launch transcript's core pain: coding-agent sessions start without the decisions, gotchas, invariants, and flows from previous work [@launch-transcript].

Do not explain implementation mechanics before the query. The launch draft already covers the product mechanics in prose, but the video should reveal them through the action: local wiki, terminal query, agent answer, and optionally the later fact that sync can update pages from conversations [@bookface-post].

## Use The CodeAlmanac Repo When Possible

Use this repository as the demo repo when the selected page is concrete enough for a cold viewer. That makes the proof recursive: CodeAlmanac can demo on the wiki that documents CodeAlmanac itself. If a page needs too much repo-specific context, pick a more relatable decision or gotcha while keeping the same structure.
