---
page_id: architecture-diagnostics-and-updates
title: Diagnostics And Updates
summary: Diagnostics report install and wiki health, while updates plan foreground package-manager upgrades for the installed CLI.
topics: [architecture, integration]
sources:
  - id: diagnostics
    type: file
    path: src/codealmanac/services/diagnostics/service.py
  - id: updates
    type: file
    path: src/codealmanac/services/updates/service.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Diagnostics And Updates

Diagnostics and updates are local support surfaces. `DiagnosticsService` combines install checks and wiki checks into a doctor report, while `UpdatesService` inspects install metadata and plans a foreground `uv tool` or `pip` package upgrade when the install method supports it. [@diagnostics] [@updates]

## What does doctor check?

Doctor reports the CodeAlmanac version, Python support, registry path, manual availability, and selected wiki checks through install and wiki check helpers. [@diagnostics]

## What does update refuse?

The update service refuses editable source installs and unknown installers because it cannot safely self-update them. [@updates]

## What decision constrains it?

The live agreement says manual update is a foreground package-manager command and must not be scheduled until an update-notification policy exists. [@live-agreement]

## What should I read next?

Use `[[reference-cli-commands]]` for the `doctor` and `update` commands, and read `[[decision-python-local-v1]]` for the local-only product boundary behind them.
