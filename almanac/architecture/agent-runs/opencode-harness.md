---
title: OpenCode Harness
topics: [architecture, harnesses, agent-runs]
sources:
  - id: adapter
    type: file
    path: src/codealmanac/integrations/harnesses/opencode/adapter.py
  - id: events
    type: file
    path: src/codealmanac/integrations/harnesses/opencode/events.py
  - id: models
    type: file
    path: src/codealmanac/integrations/harnesses/opencode/models.py
  - id: defaults
    type: file
    path: src/codealmanac/integrations/harnesses/__init__.py
  - id: contract
    type: file
    path: src/codealmanac/services/harnesses/ports.py
  - id: setup
    type: file
    path: src/codealmanac/integrations/setup/opencode.py
  - id: tests
    type: file
    path: tests/test_opencode_harness.py
---

# OpenCode Harness

## What It Owns

`OpenCodeHarnessAdapter` is a first-class harness integration that runs
lifecycle jobs through the local OpenCode CLI (`opencode run`), not through
Yoke [@adapter] [@defaults]. It implements the same service-owned harness port
as Yoke adapters: `check()` readiness and `run()` execution returning a
normalized `HarnessRunResult` [@contract] [@adapter].

Unlike Codex/Claude, OpenCode model ids are dynamic `provider/model` strings
(possibly with nested segments such as `openrouter/z-ai/glm-5`). The adapter
and config accept any well-formed OpenCode model id; listing uses `opencode
models` when the CLI is present [@models].

## Project Agents

Before each lifecycle run, the adapter stages a packaged primary agent under
the product-owned path `runtime_root/opencode/agents/codealmanac-<agent>.md`
(typically under `~/.codealmanac/harnesses/opencode/agents/`), never the target
repository's tree. The CLI is invoked with `OPENCODE_CONFIG_DIR` pointing at
that directory — OpenCode loads it as an additive agents/commands source after
global and project config, so user auth and providers stay on the real OpenCode
config while generated agents stay out of `git status` [@adapter]. The runtime
prompt is supplied on stdin [@adapter].

## Events And Transcripts

JSON lines from `opencode run` are projected into CodeAlmanac harness events
by `integrations/harnesses/opencode/events.py` [@events]. Live runs may
surface a session id for job linkage. Separate from live runs, sync discovers
historical OpenCode sessions from OpenCode's SQLite store
(`~/.local/share/opencode/opencode.db`); see
[Source resolution and runtime](../sources/source-resolution-and-runtime).

## Setup

`codealmanac setup` can install guide text into OpenCode's global
`~/.config/opencode/AGENTS.md` as a managed block [@setup]. Uninstall removes
that block without touching unrelated user content [@setup].

## Related Pages

See [Harness contract](harness-contract), [Yoke harness boundary](provider-adapters),
[Instruction installation](../setup/instruction-installation), and
[Controlled model catalog](../../decisions/controlled-model-catalog).
