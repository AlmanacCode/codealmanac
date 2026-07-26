---
title: Setup Architecture
topics: [architecture, setup, automation, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entries for setup, automation, config, and local state.
  - id: setup-automation
    type: wiki
    path: architecture/setup/automation-and-update
    note: Architecture page for setup, scheduled automation, update, and uninstall behavior.
  - id: instruction-installation
    type: wiki
    path: architecture/setup/instruction-installation
    note: Architecture page for Codex and Claude instruction installation.
  - id: setup-guide
    type: wiki
    path: guides/setup-local-automation
    note: Task guide for installing and verifying local scheduled work.
  - id: config-keys
    type: wiki
    path: reference/config-keys
    note: Reference page for setup and automation configuration keys.
---

# Setup Architecture

Setup architecture is the machine-level part of CodeAlmanac: it installs local
agent instructions, writes user configuration, reconciles launchd automation,
and supports update and uninstall behavior. The topic graph places setup under
architecture and connects nearby automation, config, and local-state pages, so
this hub gives the reading order for that cluster [@topics].

Read this hub when changing `codealmanac setup`, uninstall, instruction
targets, scheduler defaults, config reconciliation, or the local update path.

## Reading Order

Start with [Setup automation and update](automation-and-update). It explains
how setup writes one config update, how automation reconciles scheduled sync,
Garden, and update jobs, how scheduled package updates stay local, and why
uninstall removes machine-level state without deleting a repository's
`almanac/` tree [@setup-automation].

Then read [Instruction installation](instruction-installation). It explains why
Codex and Claude receive the same packaged guide through different home-directory
mechanics, and why those instructions are separate from the repo-owned wiki
source [@instruction-installation].

Use [Config keys](../../reference/config-keys) when the change touches
`auto_commit`, harness defaults, model choice, automation intervals, or
`config apply`. Setup persists those choices as user configuration, while the
config service owns reconciliation with machine automation [@config-keys].

## Task Path

[Setup local automation](../../guides/setup-local-automation) is the maintainer
procedure for installing and verifying the local scheduled work [@setup-guide].
Use it after changing setup or automation behavior, because it checks the
visible workflow rather than only the service internals.
