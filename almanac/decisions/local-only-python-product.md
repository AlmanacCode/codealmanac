---
title: Local-Only Python Product
topics: [decisions, product]
sources:
  - id: live_agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active Python rewrite agreement and local-only product decisions.
  - id: notes
    type: file
    path: notes.md
    note: Design notes recording the reset away from hosted/cloud product direction.
  - id: readme
    type: file
    path: README.md
    note: Public product documentation for setup, lifecycle commands, jobs, automation, and local state.
  - id: manual
    type: file
    path: MANUAL.md
    note: Repo engineering rules and local product constraints.
---

# Local-Only Python Product

CodeAlmanac's Python v1 is a local-only product. It is a Python CLI named `codealmanac` that writes a repo-local Markdown wiki, stores derived and operational state under `~/.codealmanac/`, and uses local agent harnesses for lifecycle work [@live_agreement][@readme]. Hosted login, cloud capture, upload, SDK, and MCP surfaces are outside this rewrite [@live_agreement].

This decision is the reset that makes the current codebase coherent. Earlier branches moved toward a hosted or cloud product, but the active agreement treats that direction as reference material rather than product truth [@live_agreement][@notes]. Future work should extend the local product described here, not reintroduce hosted workflow language casually.

## Context

The product needed a clear center. The design notes say the correct branch point was the local Python product, while later hosted/cloud work moved in the wrong direction [@notes]. The live agreement also says the Python rewrite targets new users and should not preserve legacy aliases, old roots, old page layouts, or hosted assumptions [@live_agreement].

The public README reflects that reset. Setup installs local instructions and automation, init creates a repo wiki, read commands use the local index, lifecycle commands invoke local Codex or Claude harnesses, and scheduler logs plus runtime state live under `~/.codealmanac/` [@readme]. The manual repeats the same repo-specific constraint: the committed wiki is under `almanac/`, while runtime state is local user state [@manual].

## Decision

CodeAlmanac Python v1 is built as a local Python CLI. The product name and public command are `codealmanac`, the package targets Python 3.12+, and the main read/write workflows operate on a local repository wiki [@readme].

The product does not build hosted shipping, hosted CLI, login/connect/upload flows, an SDK, MCP integration, or cloud capture in this rewrite [@live_agreement]. If those surfaces become real again, they require a new explicit decision because they change the product boundary.

## Consequences

The local product makes [Local repo wiki](../concepts/local-repo-wiki) the central model. Repository registration, runs, run events, sync state, and worker locks belong in the local database under `~/.codealmanac/`, while the committed wiki source stays in the repo [@live_agreement][@readme].

The decision also narrows public language. Docs and commands should not mention hosted dashboards, cloud upload, `capture`, legacy `almanac` or `alm` aliases, or Node-era installation paths as active product surfaces [@live_agreement]. This keeps [Local state](../architecture/repositories/local-state) and [Only almanac root](only-almanac-root) from carrying compatibility branches for retired product shapes.

The cost is that remote collaboration, hosted capture, and cloud account flows are intentionally deferred. The benefit is a smaller, testable product whose state boundaries are visible on disk and in the local database.
