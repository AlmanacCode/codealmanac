---
title: Configuration
topics: [reference, cli, operations]
sources:
  - id: config-models
    type: file
    path: src/codealmanac/services/config/models.py
    note: Config keys, defaults, HarnessKind values, and model lists.
  - id: config-service
    type: file
    path: src/codealmanac/services/config/service.py
    note: Config load, set, and project-config path resolution.
  - id: config-store
    type: file
    path: src/codealmanac/services/config/store.py
    note: TOML deep-merge load and in-place set-value logic.
  - id: readme
    type: file
    path: README.md
    note: Public product README documenting config file locations, keys, and CLI paths.
---

# Configuration

CodeAlmanac reads configuration from two TOML files: the user config at
`~/.codealmanac/config.toml` and the project config at `almanac/config.toml`
[@config-service] [@readme]. Both files are optional; missing files are silently
skipped.

When both files exist they are deep-merged. Project config values take
precedence over user config for the same keys; for nested tables such as
`[harness]`, keys present in only one file are preserved from that file
[@config-store]. This lets a repository provide defaults for everyone working in
it without requiring changes to their personal user config.

## Keys

Three keys are supported [@config-models]:

**`auto_commit`** (bool, default `true`): When true, lifecycle prompts tell the
selected harness that it may commit wiki source changes using normal Git
commands. When false, the harness leaves changes uncommitted in the working
tree. CLI flags override this value per run. See [Runs](../architecture/runs)
for how the commit policy reaches the operation prompt [@config-service].

**`harness.default`** (string, default `"codex"`): The harness used when
`--using` is not passed. Accepted values are `"codex"` and `"claude"`
[@config-models].

**`harness.model`** (string, default `"gpt-5.5"` for Codex,
`"claude-sonnet-4-6"` for Claude): The model passed to the selected harness.
The model must be in the allowed set for `harness.default`; `codealmanac config
set harness.default` also resets `harness.model` to that harness's default
[@config-service].

## Setting Values

`codealmanac config set <key> <value>` always writes to the user config file
[@config-service]:

```bash
codealmanac config set auto_commit false
codealmanac config set harness.default claude
codealmanac config set harness.model claude-opus-4-7
```

`codealmanac setup` provides an alternative path for `auto_commit`:

```bash
codealmanac setup --no-auto-commit
codealmanac setup --yes   # enables auto_commit (the default happy path)
```

## Precedence

From highest to lowest: CLI flags > project config (`almanac/config.toml`) >
user config (`~/.codealmanac/config.toml`) > built-in defaults [@config-service].
