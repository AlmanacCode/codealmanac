# Config-First Automation Settings

**Date:** 2026-07-10

**Status:** Revised — this is the agreed direction from the config discussion.
**Replaces:** The earlier project-config and `automation install` design.

## Decision

CodeAlmanac will have:

```text
one config file       ~/.codealmanac/config.toml
one mutation command  codealmanac config set ...
one manual apply      codealmanac config apply
one scheduler view    codealmanac automation status
```

We will remove:

```text
almanac/config.toml
codealmanac automation install
codealmanac automation uninstall
```

Reason: nobody has asked for repository-level settings, and automation settings
should not bypass the normal config path.

## The Problem Today

```text
config set ...
    -> writes ~/.codealmanac/config.toml

automation install/uninstall ...
    -> changes launchd directly
    -> does not record the choice in config.toml
```

For example:

```bash
codealmanac automation install sync --every 8h
```

This updates the macOS schedule, but user config still has no `8h` setting.

## The New User Experience

```bash
# Change a schedule
codealmanac config set automation.sync.every 8h

# Disable or enable a task
codealmanac config set automation.garden.enabled false
codealmanac config set automation.update.enabled true

# Inspect desired configuration
codealmanac config get automation.sync.every
codealmanac config list

# Inspect actual macOS scheduler state
codealmanac automation status
```

The TOML becomes:

```toml
auto_commit = true

[harness]
default = "codex"
model = "gpt-5.5"

[automation.sync]
enabled = true
every = "8h"

[automation.garden]
enabled = false
every = "4h"

[automation.update]
enabled = true
every = "24h"
```

## Big Picture

```text
Config CLI / SetupService
          |
          v
    ConfigService --------------------+
          |                            |
          v                            v
     ConfigStore                AutomationService
     (user TOML)                       |
                                       v
                                SchedulerAdapter
                                       |
                                       v
                             LaunchdSchedulerAdapter
```

| Part | Owns |
| --- | --- |
| Config CLI | Parses `list/get/set/apply`. |
| `ConfigService` | Config meaning, validation, and deciding whether an automation effect is required. |
| `ConfigStore` | Reading and updating the one TOML file. |
| `AutomationService` | Turning explicit task settings into install/remove operations. |
| `LaunchdSchedulerAdapter` | Plists and `launchctl`. |
| `SetupService` | Collecting onboarding choices and sending one config update. |

No watcher, daemon, second scheduler, or event framework is added.

## Flow 1: `config set`

```bash
codealmanac config set automation.sync.every 8h
```

```text
1. ConfigService parses 8h.
2. ConfigStore writes it to config.toml.
3. ConfigService reloads and validates the complete UserConfig.
4. ConfigService sees this is a Sync automation key.
5. AutomationService reconciles Sync.
6. launchd is rewritten and reloaded with an 8-hour interval.
```

Pseudocode:

```python
def set(request):
    value = parse_config_value(request.key, request.value)
    store.set_value(request.key, value)

    config = load_user()  # complete validation

    task = automation_task_for_key(request.key)
    if task is not None:
        automation.reconcile_task(
            task=task,
            settings=config.automation.for_task(task),
        )
```

For a normal key such as `auto_commit`, the last step is absent:

```python
store.set_value("auto_commit", False)
load_user()
# no launchd effect
```

## Flow 2: Enable And Disable

```bash
codealmanac config set automation.garden.enabled false
```

```python
def reconcile_task(task, settings):
    job = jobs.job_for_task(task, settings.every)

    if settings.enabled:
        scheduler.install(job)
    else:
        scheduler.uninstall(job)
```

There is no hidden “empty tasks means all tasks” behavior. Every request names
one task and supplies its complete settings.

## Flow 3: Someone Edits TOML Directly

Saving the file alone cannot reload launchd without a watcher. We do not want a
watcher.

The person or agent runs:

```bash
codealmanac config apply
```

```python
def apply():
    config = load_user()

    for task in (SYNC, GARDEN, UPDATE):
        automation.reconcile_task(
            task=task,
            settings=config.automation.for_task(task),
        )
```

Documentation and agent instructions will say:

```text
Prefer `config set` for automation changes.
If you edit config.toml directly, run `config apply` afterward.
```

## Flow 4: Setup

Setup currently writes config and installs automation through separate paths.
That duplication will be removed.

```python
def setup(request):
    config.update(
        UserConfigUpdate(
            auto_commit=request.auto_commit,
            harness=HarnessConfig(request.harness, request.model),
            automation=AutomationConfig(
                sync=TaskConfig(not request.sync_off, request.sync_every),
                garden=TaskConfig(not request.garden_off, request.garden_every),
                update=TaskConfig(request.auto_update, request.update_every),
            ),
        )
    )
```

`ConfigService.update(...)` performs one TOML write, validates once, and
reconciles all three tasks. Setup no longer constructs a separate automation
install request.

## Flow 5: Uninstall

Full uninstall ignores stored enabled values:

```python
def uninstall():
    automation.remove_all()  # Sync, Garden, Update
    instructions.remove()
    global_state.remove()    # includes user config
    package.remove()
```

Repository `almanac/` wiki content is never deleted.

## Why Remove Repository Config

Current precedence is unnecessarily complicated:

```text
defaults -> user config -> project config -> CLI
```

New precedence:

```text
defaults -> user config -> CLI
```

Removing `almanac/config.toml` also removes:

- repository selection during config loading;
- uncertainty about which file `config set` changes;
- the possibility of a repository selecting an unavailable local runner;
- the need for separate `UserConfig` and `ProjectConfig` models;
- the risk of repository config controlling machine-wide automation.

One-off repository choices remain:

```bash
codealmanac garden --using claude
```

If a real persistent repository setting is requested later, design it from that
use case instead of preserving speculative machinery.

### Existing repository config files

This is a clean breaking removal:

```text
existing almanac/config.toml files are no longer read
```

Do not add detection, migration, warnings, fallback reads, or automatic
deletion. The release changelog will state that repository config was removed
and that persistent settings now belong only in
`~/.codealmanac/config.toml`.

## Desired State Versus Actual State

```text
config.toml        desired configuration
launchd            actual installed state
```

Normal `config set` keeps them aligned.

If a direct edit is invalid:

```text
config apply fails
launchd remains unchanged
```

If TOML is valid but launchd fails:

```text
the desired TOML remains saved
launchd retains its previous actual state
the command reports that apply failed
the user retries `codealmanac config apply`
```

Do not fake a transaction or rollback across a file and macOS launchd.

## Models We Add

```python
class TaskAutomationConfig:
    enabled: bool
    every: timedelta


class AutomationConfig:
    sync: TaskAutomationConfig
    garden: TaskAutomationConfig
    update: TaskAutomationConfig


class UserConfig:
    auto_commit: bool
    harness: HarnessConfig
    automation: AutomationConfig
```

Defaults:

```text
Sync    enabled, 5h
Garden  enabled, 4h
Update  enabled, 24h
```

New keys:

```text
automation.sync.enabled
automation.sync.every
automation.garden.enabled
automation.garden.every
automation.update.enabled
automation.update.every
```

Automation receives a config-independent request:

```python
class ReconcileAutomationTaskRequest:
    task: AutomationTask
    enabled: bool
    every: timedelta
```

`AutomationService` does not import TOML or `UserConfig`.

## Exact File Changes

| File | Change |
| --- | --- |
| `services/config/models.py` | Add automation models, defaults, validation, six keys, and apply results. |
| `services/config/requests.py` | Remove `LoadConfigRequest`; add apply and batch user-update requests. |
| `services/config/store.py` | Load one user file; support nested automation tables and one-write batch updates. |
| `services/config/service.py` | Remove repository/project merging; add `set`, `update`, and `apply` reconciliation. |
| `services/automation/requests.py` | Replace overloaded install request with explicit task reconciliation. |
| `services/automation/service.py` | Add `reconcile_task`, keep status, add full `remove_all`. |
| `services/automation/jobs.py` | Build a job from an explicit task and interval; remove interval special cases. |
| `services/automation/selection.py` | Delete empty-means-all and Garden-only disable policy; delete if no longer needed. |
| `cli/parser/config.py` | Add six keys and `config apply`. |
| `cli/dispatch/config_command.py` | Route list/get/set/apply only through `ConfigService`. |
| `cli/render/config.py` | Render durations and apply outcomes in human/JSON formats. |
| `cli/parser/automation.py` | Remove install/uninstall; retain status. |
| `cli/dispatch/automation.py` | Remove mutation dispatch; retain status. |
| `services/setup/*` | Build one complete user-config update; remove parallel automation-install policy. |
| `cli/dispatch/setup*.py` | Use existing user values as defaults and pass one resolved setup request. |
| `app.py` | Wire `AutomationService` into `ConfigService`; remove repositories from config wiring. |
| lifecycle CLI dispatch | Load only user config; retain `--using` command overrides. |

Delete all helpers, imports, tests, and docs for:

```text
PROJECT_CONFIG_NAME
project_config_path(...)
config_source_paths(...)
almanac/config.toml
project-over-user precedence
```

Do not leave compatibility readers or aliases.

## Tests

### Config

- defaults and all six TOML keys;
- duration parsing and rejection of invalid/zero/negative values;
- `set` reconciles the affected automation task;
- non-automation `set` does not call automation;
- `apply` reconciles all tasks;
- invalid direct TOML makes no scheduler calls;
- batch setup update writes once and reconciles once;
- launchd failure keeps desired TOML and returns a clear error;
- remove project-precedence tests.

### Automation

- enabled installs with the explicit interval;
- disabled uninstalls;
- no empty-means-all behavior;
- status remains read-only;
- full uninstall removes all three jobs;
- launchd plist/`launchctl` behavior is preserved.

### CLI and setup

- human and JSON forms of list/get/set/apply;
- removed install/uninstall commands are absent and rejected;
- setup uses existing user values as defaults;
- setup flags override them and persist the final values;
- setup uses the config path, not a second automation path;
- tests use isolated HOME and a fake scheduler.

### Architecture

- TOML imports stay inside `services/config`;
- CLI never calls launchd;
- `ConfigService` knows `AutomationService`, not launchd;
- `AutomationService` knows `SchedulerAdapter`, not config;
- no project-config or empty-task fallback remains.

## README And Documentation

Update `README.md` to:

- name `~/.codealmanac/config.toml` as the only config file;
- show the automation TOML;
- replace automation install/uninstall examples with `config set`;
- document `config apply` after direct edits;
- retain `automation status` for actual state;
- explain that setup writes config and applies launchd;
- clearly state that saving TOML alone does not reload launchd.

Add the breaking change to the release changelog:

```text
Removed repository-level almanac/config.toml support. CodeAlmanac now reads
configuration only from ~/.codealmanac/config.toml.
```

There is no changelog file in the repository today. Create `CHANGELOG.md` as
part of the release/documentation work if one has not been established before
this slice lands.

Also update:

```text
almanac/reference/config-keys.md
almanac/reference/local-state-layout.md
almanac/architecture/setup/automation-and-update.md
almanac/guides/setup-local-automation.md
almanac/decisions/auto-commit-is-prompt-policy.md
shipped prompts/manual resources mentioning almanac/config.toml
```

Teach agents to use `config set`, or `config apply` after a direct edit.

Update `docs/python-port-live-agreement.md` only after implementation and review
confirm the final contract.

## Scope Guard

Do not add:

- project config;
- watchers or daemons;
- automatic apply during unrelated commands;
- non-macOS scheduler work;
- persistent unrelated CLI preferences;
- config/launchd rollback machinery;
- compatibility aliases or legacy config paths;
- project-config detection or migration warnings;
- silent recovery from invalid TOML.

## Verification

```bash
uv run pytest \
  tests/test_config_service.py \
  tests/test_automation_service.py \
  tests/test_setup_service.py \
  tests/test_cli.py \
  tests/test_architecture.py -q

uv run pytest
uv run ruff check .
codealmanac validate
```

Never touch the real user config or LaunchAgents in tests.

## Review Focus

- Does every persistent automation mutation go through config?
- Does direct editing require an explicit, documented `config apply`?
- Is all project-config machinery gone?
- Is the removal documented only as a breaking changelog entry, without a
  runtime migration guard?
- Are automation requests explicit?
- Are CLI, config, automation, and launchd boundaries obvious?
- Did any watcher, fallback, or compatibility path slip in?

Write must-fix, should-fix, and consider findings in the required separate
review-fix plan.
