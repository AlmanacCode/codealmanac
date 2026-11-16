# Almanac: The shared knowledge layer for your team's coding agents

> Keep every coding agent on your team working from the same context.

Hey everyone,

We're Rohan, Kushagra, and Divit, the founders of
[Almanac](https://codealmanac.com).

**TL;DR**

**Almanac is the shared knowledge layer for your team's coding agents.** It
brings together the context scattered across Slack, Linear, GitHub,
documentation, and agent sessions, then maintains it as a living wiki that every
agent can use.

**Asks**

Tell us how your team keeps its coding agents on the same page today. Giant
`CLAUDE.md` files? Claude mem? Prompting again and again?

We'll set up Almanac on one of your repositories in under 20 minutes and show
you how to make the same team knowledge available to every coding agent, so your
engineers can stop re-explaining the same context.

[Book a setup](https://cal.com/almanac-demo/30min)

[Try Almanac on GitHub](https://github.com/AlmanacCode/codealmanac)

[Follow Almanac on LinkedIn](https://www.linkedin.com/company/codealmanac/)

## The Problem

Your codebase cannot tell an agent everything your team knows about it.

The code shows what exists, but not why it was built that way, which constraints
must hold, or what the team already tried. That knowledge is scattered across
Linear, Slack, GitHub, documentation, and individual agent sessions.

An agent usually sees only the repository, the current task, and whatever one
engineer remembers to put in the prompt. It repeats old investigations, misses
known gotchas, and reopens decisions the team already settled. As more engineers
use coding agents, the same context gets rediscovered again and again.

## Our Solution

Almanac builds and maintains a wiki for your coding agents.

The wiki is made of connected Markdown pages that capture the knowledge
your team wants its agents to keep using:

- **Decisions:** what the team chose and why.
- **Invariants:** rules every implementation must preserve.
- **Gotchas:** non-obvious failures and how to avoid them.
- **Flows:** how a system works across services and files.

Almanac learns from Slack, Linear, GitHub, documentation, and agent sessions. It
distills durable conclusions from those sources, links each page back to its
evidence, and keeps the wiki organized as the codebase changes. 

Before coding your agents search the wiki and
load only the pages relevant to the task. The wiki is ordinary Markdown in your
repository, so the team can read it, edit it, review it in Git.
