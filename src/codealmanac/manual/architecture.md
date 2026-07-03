---
title: Architecture
topics: [manual]
---

# Architecture

An architecture page explains how a system area works and how it fits into the
whole codebase.

The lead should summarize the system area: what owns it, how it works at a high
level, and why its shape matters.

Cover the facts a maintainer needs to change the area safely:

- ownership and boundaries
- entrypoints
- data or control flow
- important files
- dependencies and integrations
- invariants
- consequences of the current shape
- related concepts, decisions, guides, and reference pages

Architecture coverage should form a system map. Do not write only one or two
architecture pages when the repository has many real subsystems.

Split architecture pages by owner and flow. If one page would need to explain
several entrypoints, adapters, state machines, or storage boundaries, it is
probably several pages with links between them.
