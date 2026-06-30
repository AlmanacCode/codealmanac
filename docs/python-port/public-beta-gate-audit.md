# Public Beta Gate Audit

Date: 2026-06-30

## Verdict

CodeAlmanac has enough local-product evidence for an internal alpha and is close
to public beta. The remaining blocker is not a missing architecture seam. Slice
69 reran current-head package rehearsal successfully. The remaining product
blocker is one more real lifecycle dogfood pass against a non-toy project source
shape to judge prompt quality.

## Gate Audit

| Area | Status | Evidence | Remaining Risk |
|---|---|---|---|
| Fresh install | Ready | Slice 69 built current-head wheel and sdist artifacts into `/tmp/codealmanac-release-slice69`, installed each into clean uv-managed Python 3.12.9 environments, and ran installed `codealmanac --help`, `init`, `search`, `show`, `topics`, `health`, `jobs`, `sync status`, `doctor`, `serve`, and `update --check`. | No current implementation blocker; final publish still needs the human release decision. |
| Package metadata | Ready | Slice 69 ran `uv build`, `uvx twine check`, wheel metadata inspection, sdist inspection, and package-data assertions for README, Apache-2.0 license metadata, license file, server assets, manual files, and prompts. | No current implementation blocker; re-run if package metadata changes before publish. |
| Public docs | Ready with guard | `tests/test_public_contract.py` rejects Node/npm install language, `almanac` aliases, hosted dashboard language, `absorb`, and stale README examples. Slices 64-66 dogfooded README scaffold, quickstart, and lifecycle source examples. | Future docs edits must keep the public-contract guard current. |
| Release guide | Ready with guard | Slice 62 replaced the npm release guide with the Python/PyPI release flow and added public-contract tests rejecting npm release commands. | Final publish still needs the human release decision and PyPI credentials. |
| Local wiki read path | Ready | Slice 61 clean-installed artifacts ran `init`, `search`, `show`, `topics`, `health`, `jobs`, `sync status`, `doctor`, and `serve`. Slices 64 and 65 dogfooded the README init/search/read path in fresh temp repos. | No current blocker; rerun clean install smoke before publish. |
| Lifecycle write path | Needs prompt-quality dogfood | Slice 57 ran real Codex ingest and fixed prompt/manual guidance after broken wikilinks. Slice 58 ran real Claude ingest and produced a health-clean wiki page with readable `jobs logs`. | One more real ingest against a non-toy project source shape should happen before public beta, because prompt quality is the main remaining product risk. |
| Sync path | Ready | Slice 59 discovered a real temp Codex transcript, claimed it, ran real Claude-backed ingest, advanced the ledger, skipped unchanged transcript content on the second status run, and left CLI readback readable. | More transcript-provider diversity can improve confidence later, but the required local sync path has evidence. |
| Safety | Ready | Ingest/garden workflow tests, lifecycle mutation policy tests, harness failure-log tests, and slice 54 dogfood prove non-wiki mutation rejection, dirty app file preservation, and harness event recording before terminal errors. | Continue testing any new lifecycle writer or mutation path against the same safety invariant. |
| Viewer | Ready | Slice 60 browser-harness checked live `serve` desktop overview, page, topic, search, and file routes plus mobile page route with no horizontal overflow. | Future visual changes still require browser-harness. |
| Contract guards | Ready | Public-contract tests reject hosted verbs, compatibility aliases, public SDK/MCP modules, stale README install language, stale release guide language, and stale next-agent brief slice numbers. | Keep adding contract tests when a product boundary becomes user-visible. |
| Release command | Ready | Slice 48 dogfooded non-editable pip and uv-tool installs. `codealmanac update --check` reports package-manager plans, and editable/source installs refuse mutation with a local development fix. | Scheduled update automation remains intentionally out of scope until notifier cadence, dismissal, and release-channel policy exist. |

## Next Release Work

1. Run one more real lifecycle dogfood against a non-toy project source shape,
   then inspect the wiki diff for page quality, links, topic fit, and `jobs`
   readability.
2. If that passes, public beta risk moves from implementation completeness to
   release operations: PyPI credentials, versioning, changelog, and the human
   publish decision.
