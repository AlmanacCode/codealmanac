---
title: Automation Launchd
topics: [architecture, automation]
sources:
  - id: service
    type: file
    path: src/codealmanac/services/automation/service.py
  - id: jobs
    type: file
    path: src/codealmanac/services/automation/jobs.py
  - id: launchd
    type: file
    path: src/codealmanac/integrations/automation/scheduler/launchd.py
  - id: defaults
    type: file
    path: src/codealmanac/services/automation/defaults.py
---

# Automation Launchd

Automation schedules local sync and garden commands through a scheduler port. `AutomationService` resolves task selection, builds scheduled jobs, installs/uninstalls them through the adapter, and reports status [@service].

Job construction owns command argv, plist path, launch PATH, interval, quiet window, and working directory [@jobs]. The launchd adapter writes plists with `plistlib`, bootstraps and bootouts jobs with `launchctl`, and parses installed plist values for status [@launchd].

Automation is opt-in from setup or explicit `automation install`. It supports [[setup-instruction-installers]] and launches foreground `sync`/garden-style commands rather than embedding lifecycle logic in scheduler code [@defaults].
