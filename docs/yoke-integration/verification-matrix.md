# Yoke integration verification matrix

| Requirement | Evidence | State |
| --- | --- | --- |
| Prompt instructions preserved | Packaged prompt files forwarded unchanged in boundary and live lifecycle runs | Verified |
| One Yoke provider boundary | Old Claude/Codex integration trees deleted; wheel contains only `integrations/harnesses/yoke` | Verified |
| Persisted event JSON | Exhaustive projection/serialization checks plus live run-ledger inspection | Verified |
| Claude lifecycle | Real authenticated file, session, workflow, ingest, and garden runs | Verified |
| Codex lifecycle | Real app-server file, session, workflow, subagent, and build runs | Verified |
| Child prompt/model fidelity | Persisted build spawn prompts, first child messages, models, tools, and results inspected | Verified |
| Failure/timeout visibility | Real invalid-model, logged-out OAuth, Claude timeout, and Codex timeout probes | Verified |
| Full local quality | 452 tests, Ruff, wheel/sdist, Twine, and installed PyPI dependency checks | Verified |
| Released Yoke | GitHub releases and trusted PyPI publish through `almanac-yoke` 0.1.3 | Verified |
| Released CodeAlmanac | GitHub/PyPI release after merge | Pending |
