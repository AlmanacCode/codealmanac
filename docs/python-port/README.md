# Python Port Steering

This directory is the slow-development steering trail for the Python rewrite.
It complements `docs/python-port-live-agreement.md`, which is the product and
architecture contract.

Read these before implementing a slice:

- `ownership-map.md` - service ownership, dependency direction, data flow
- `product-debt.md` - old assumptions to delete, quarantine, or re-evaluate
- `idea-evolution.md` - hypothesis changes and the evidence that changed them
- `worklog.md` - compact running log for the long rewrite
- `verification-matrix.md` - requirement-to-evidence tracker
- `public-beta-gate-audit.md` - current public beta gate status and remaining
  release work
- `next-agent-brief.md` - current state and next move after checkpoints

The current rewrite uses the local Markdown copy of Architecture Patterns with
Python in `docs/reference/cosmic-python/` as architecture reference. The useful
transfer is service boundaries, repository/store boundaries, service-layer
tests, explicit transaction ownership, and a composition root.
