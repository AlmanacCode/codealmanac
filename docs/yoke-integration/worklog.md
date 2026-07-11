# Yoke integration worklog

## 2026-07-10

- Integration branch created from freshly fetched `origin/main` at CodeAlmanac
  0.4.0. The dirty local `dev` checkout was left untouched.
- Baseline gate: 426 tests passed and Ruff was clean.
- `dev` divergence contains Almanac/launch documentation, not newer product
  implementation absent from `main`.
- Current provider integrations duplicate more than 3,000 lines now owned by
  Yoke. The product harness port and persisted event projection remain useful.
- Prompt audit found no provider-specific prompt mutation. A description-only
  Yoke root agent preserves the exact current system/developer prompt behavior.
- Replaced both provider trees with a three-module Yoke adapter/projection
  boundary and removed roughly 4,200 lines of duplicate provider code/tests.
- Published Yoke 0.1.1-0.1.4 as live integration exposed callback, timeout,
  Claude cwd/session, auth diagnostics, system-event, and Codex delegation bugs.
- Real Codex build created and validated an 11-page wiki. Its persisted helper
  prompts, models, first messages, writes, and completions matched assignments.
- Real Claude ingest created and committed a grounded export decision. A garden
  run verified the corrected single-session event stream.
- Audited the published CLI/viewer activity projection. Yoke 0.1.4 removes
  Codex's internal message/reasoning lifecycle wrappers from tool activity while
  retaining real assistant text, tools, subagents, statuses, and failures.
- CodeAlmanac intentionally retains its historical trusted-agent permission
  model: full, non-interactive local access with prompt/commit policy rather
  than an OS-enforced `almanac/` sandbox.
- Aligned local and remote `dev`/`main`, then published CodeAlmanac 0.4.2 to
  GitHub and PyPI with Yoke 0.1.4 as the minimum supported runtime.

## 2026-07-11

- Replaced the CodeAlmanac-specific prompt resource layer with Yoke's native
  collection and agent-folder contract.
- Moved the unchanged kernel and operation words into self-contained build,
  ingest, and garden `instructions.md` files. Workflows now send typed runtime
  context as the task prompt.
- Published Yoke 0.1.5 with typed, non-global `Harness.environment` support
  after the Almanac integration exposed that missing embedder boundary.
- Rewrote active harness and agent-resource wiki pages around the Yoke boundary.
- Fresh installed-wheel smoke loaded all three agent folders from package data.
  A live Codex build through the packaged build agent used native helpers,
  created 13 grounded wiki pages, validated before and after commit, and ended
  with a clean worktree.
- Merged the separate Almanac task's concurrent wiki commits, aligned local and
  remote `dev`/`main`, and published CodeAlmanac 0.4.3 to GitHub and PyPI. A
  fresh public install loaded build, ingest, and garden with Yoke 0.1.5.
