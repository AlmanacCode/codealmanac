# Yoke integration verification matrix

| Requirement | Evidence | State |
| --- | --- | --- |
| Prompt instructions preserved | Packaged prompt files forwarded unchanged in boundary and live lifecycle runs | Verified |
| One Yoke provider boundary | Old Claude/Codex integration trees deleted; wheel contains only `integrations/harnesses/yoke` | Verified |
| Persisted event JSON | Exhaustive projection/serialization checks plus live run-ledger inspection | Verified |
| Human-readable activity | Live CLI log and viewer projection retain concise assistant, tool, agent, status, and error steps; Yoke suppresses Codex internal lifecycle wrappers | Verified |
| Claude lifecycle | Real authenticated file, session, workflow, ingest, and garden runs | Verified |
| Codex lifecycle | Real app-server file, session, workflow, subagent, and build runs | Verified |
| Child prompt/model fidelity | Persisted build spawn prompts, first child messages, models, tools, and results inspected | Verified |
| Failure/timeout visibility | Real invalid-model, logged-out OAuth, Claude timeout, and Codex timeout probes | Verified |
| Full local quality | 452 tests, Ruff, wheel/sdist, Twine, and installed PyPI dependency checks | Verified |
| Released Yoke | GitHub releases and trusted PyPI publish through `almanac-yoke` 0.1.4 | Verified |
| Released CodeAlmanac | GitHub/PyPI release 0.4.3 from aligned `dev`/`main` | Pending |
| Yoke-native agents | Packaged collection loads build, ingest, and garden folders; previous prompt words compare exactly; a live Codex build used native helpers, wrote 13 pages, validated, and committed | Verified |
| Scoped environment | Yoke 0.1.5 passes per-Harness environment to Claude SDK and Codex app-server without global mutation | Verified |
