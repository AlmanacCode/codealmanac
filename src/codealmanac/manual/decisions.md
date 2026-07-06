---
title: Decisions
topics: [manual]
---

# Decisions

Use this manual when writing a page under `almanac/decisions/`. A decision page
records one architecturally meaningful choice so future maintainers do not have
to accept or reverse it blindly.

Write a decision page for choices that affect the structure of the system,
dependencies, interfaces, workflows, persistence, provider boundaries,
construction techniques, or important operational behavior.

The lead should summarize the choice, the context that made it necessary, and
the consequence future work must respect.

A decision page should usually cover:

- context
- decision
- status
- consequences

The context explains the forces at play. Name the tradeoffs, constraints,
alternatives, and pressures that made the choice meaningful. Keep this section
factual and value-neutral.

The decision states the chosen path clearly. Use full sentences and active
voice. Say what the project does or will do.

The consequences explain the resulting situation after the decision. Include
positive, negative, and neutral consequences. A useful consequence says what is
now easier, harder, required, forbidden, risky, or intentionally deferred.

Do not bundle several unrelated choices into one decision page.
