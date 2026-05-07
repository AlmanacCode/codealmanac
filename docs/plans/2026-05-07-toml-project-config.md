# 2026-05-07 TOML and Project Config

## Scope

Move codealmanac config from global JSON to TOML and add a project tier for
repo-local agent settings.

- global config path becomes `~/.almanac/config.toml`
- legacy `~/.almanac/config.json` is read and migrated to TOML
- project config lives at `.almanac/config.toml`
- `config list --show-origin` reports `default`, `user`, or `project`
- `config set --project` / `config unset --project` manage project agent keys
- `update_notifier` remains user-level only

## Precedence

For `bootstrap` and `capture`:

```text
--agent / --model
ALMANAC_AGENT / ALMANAC_MODEL
.almanac/config.toml
~/.almanac/config.toml
provider default
```

Project config is intentionally scoped to agent provider/model settings. The
update notifier is global process behavior and is still read from user config
before command execution.

## Format

Supported TOML shape:

```toml
update_notifier = true

[agent]
default = "claude"

[agent.models]
claude = "claude-sonnet-4-6"
codex = "default"
```

TOML has no null value, so `"default"` in `[agent.models]` means provider
inheritance. The CLI already accepts `default` and `null` as reset spellings.

## Verification

- migration from JSON creates TOML
- config commands read/write TOML
- project config overrides user agent settings
- project origins are visible in JSON and human output
- full lint/build/test before commit
