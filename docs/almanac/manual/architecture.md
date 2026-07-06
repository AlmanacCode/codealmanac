---
title: Architecture
topics: [manual]
---

# Architecture

Use this manual when writing a page under `pages/architecture/`. An
architecture page explains one system area: its responsibility, boundary,
collaborators, and runtime behavior.

The lead should summarize the area, what owns it, how it fits into the larger
system, and why its shape matters.

Write the page so a maintainer can safely change the area. Explain the static
shape, the runtime flow, and the constraints that future work must preserve.

Architecture pages should use design evidence when it exists. Look for
architecture docs, ADRs, RFCs, design notes, plans, live agreements, README
sections, and other Markdown files that explain why the system is shaped this
way.

Use source code and tests to verify what exists. Use design evidence to explain
intent, constraints, tradeoffs, and historical reasons. If design evidence
conflicts with current code, say so or trust the code for runtime behavior.

Cover the angles that matter for the area:

- ownership and boundaries
- entrypoints
- important collaborators
- data or control flow
- storage, adapters, or external integrations
- invariants and failure modes
- consequences of the current shape
- related concepts, decisions, guides, and reference pages

Do not use these as required sections. Use headings that fit the system area.

Do not turn an architecture page into a file-by-file tour. Mention files when
they anchor the explanation, but keep the page about responsibility, flow, and
system shape.

Architecture coverage should form a system map. Do not write only one or two
architecture pages when the repository has many real subsystems.

Split architecture pages by owner and flow. If one page would need to explain
several entrypoints, adapters, state machines, or storage boundaries, it is
probably several pages with links between them.
