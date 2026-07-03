---
page_id: architecture-setup-and-automation
title: Setup And Automation
summary: Setup installs local agent instructions and can opt into local scheduler automation for sync and garden.
topics: [architecture, integration]
sources:
  - id: setup-service
    type: file
    path: src/codealmanac/services/setup/service.py
  - id: automation-service
    type: file
    path: src/codealmanac/services/automation/service.py
  - id: launchd
    type: file
    path: src/codealmanac/integrations/automation/scheduler/launchd.py
  - id: readme
    type: file
    path: README.md
---

# Setup And Automation

Setup installs local agent instructions for supported tools and can opt into scheduled local automation. Automation creates scheduler jobs for tasks such as sync and garden; on macOS the current scheduler adapter writes and manages launchd jobs. [@setup-service] [@automation-service] [@launchd]

## What does setup do by default?

Plain setup installs local agent instructions and does not connect to a hosted service. Automation installation is explicit through setup flags or automation commands. [@readme] [@setup-service]

## What does automation run?

Automation schedules ordinary local CodeAlmanac commands with explicit intervals and quiet-window policy. It is not cloud sync. [@readme] [@automation-service]

## What should I read next?

Use `[[reference-cli-commands]]` for command flags and `[[architecture-sync-workflow]]` for scheduled sync behavior.

