---
title: Setup
topics: [architecture, setup, automation, config, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entries for setup, automation, config, and local state.
  - id: automation-update
    type: wiki
    path: architecture/setup/automation-and-update
    note: Architecture page for setup, scheduled automation, update, and uninstall.
  - id: instruction-installation
    type: wiki
    path: architecture/setup/instruction-installation
    note: Architecture page for installing CodeAlmanac guidance into Claude and Codex.
  - id: setup-guide
    type: wiki
    path: guides/setup-local-automation
    note: Operational guide for installing, verifying, and changing local automation.
  - id: config-keys
    type: wiki
    path: reference/config-keys
    note: Reference page for user config keys, harness defaults, and automation policy.
  - id: local-state
    type: wiki
    path: reference/local-state-layout
    note: Reference page for local runtime paths touched by setup and automation.
---

# Setup

Setup is the architecture neighborhood for machine-level CodeAlmanac state:
installed agent instructions, user config, scheduled local automation, package
updates, and uninstall behavior. The setup topic sits near automation and
config because `codealmanac setup` writes user policy and then reconciles local
scheduler state; it is not a repository wiki-writing operation [@topics]
[@automation-update] [@config-keys].

Read this hub when changing setup, uninstall, instruction installation,
automation reconciliation, or update scheduling. For task-oriented recovery and
verification, use the setup guide rather than copying operational steps into
architecture pages [@setup-guide].

## Reading Order

Start with [Setup automation and update](automation-and-update). It explains
the machine-level maintenance layer: setup writes config, installs selected
instruction targets, reconciles sync, Garden, and update jobs through launchd,
and removes CodeAlmanac-owned local artifacts during uninstall
[@automation-update].

Then read [Instruction installation](instruction-installation) when the change
touches Claude or Codex global instructions. That page owns the per-target file
mechanics and the installed guide text. It is separate from scheduled
automation because instruction files live in the user's agent config, while
automation jobs live under scheduler state [@instruction-installation].

Use [Config keys](../../reference/config-keys) for exact user TOML keys,
defaults, controlled harness models, and automation policy fields
[@config-keys]. Use [Local state layout](../../reference/local-state-layout)
when the change touches `~/.codealmanac/`, launchd logs, or other runtime
paths that setup and automation create [@local-state].

## Operator Route

[Setup local automation](../../guides/setup-local-automation) is the operator
path. It covers macOS support, missing-`launchctl` failures, setup flags,
direct config changes, `automation status`, and uninstall commands
[@setup-guide]. Keep platform recovery and verification steps there; keep
architecture pages focused on ownership, boundaries, and state consequences.
