---
title: Setup Instruction Installers
topics: [architecture, setup]
sources:
  - id: service
    type: file
    path: src/codealmanac/services/setup/service.py
  - id: planning
    type: file
    path: src/codealmanac/services/setup/planning.py
  - id: instructions
    type: file
    path: src/codealmanac/integrations/setup/instructions.py
  - id: codex
    type: file
    path: src/codealmanac/integrations/setup/codex.py
---

# Setup Instruction Installers

Setup installs global agent instructions, optionally signs into cloud, and optionally installs automation. `SetupService` delegates target file writes to an instruction installer port, automation to `AutomationService`, and cloud login to `CloudLoginWorkflow` [@service].

Planning builds the setup plan, automation recommendations, and next-step commands separate from the installer mechanics [@planning]. The file instruction installer dispatches target-specific behavior for Codex and Claude [@instructions].

Codex setup writes a managed block into the resolved AGENTS file, while Claude setup writes a guide file and import line. Exact managed-block behavior is in [[setup-managed-blocks-reference]], and scheduling is in [[automation-launchd]].
