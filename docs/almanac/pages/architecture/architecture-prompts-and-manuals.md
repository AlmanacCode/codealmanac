---
page_id: architecture-prompts-and-manuals
title: Prompts And Manuals
summary: Prompt rendering combines base prompt sections, operation-specific sections, manual guidance, and runtime context for lifecycle harnesses.
topics: [architecture, lifecycle]
sources:
  - id: prompt-renderer
    type: file
    path: src/codealmanac/prompts/renderer.py
  - id: ingest
    type: file
    path: src/codealmanac/workflows/ingest/service.py
  - id: garden
    type: file
    path: src/codealmanac/workflows/garden/service.py
  - id: manual-library
    type: file
    path: src/codealmanac/manual/library.py
---

# Prompts And Manuals

Prompts and manuals are the instruction layer for write-capable lifecycle operations. Ingest and garden render base purpose, notability, syntax, and operation-specific prompt sections, then append runtime context before handing the prompt to a harness. [@prompt-renderer] [@ingest] [@garden]

## What belongs in prompts?

Prompts contain agent instructions about how to write or garden wiki pages. Runtime context contains the current workspace, Almanac root, selected sources, index summary, health report, and user guidance. [@ingest] [@garden]

## What belongs in manuals?

The manual library packages durable guidance files and installs them into initialized wiki roots. [@manual-library]

## What decision shapes this?

See `[[decision-prompts-not-pipelines]]`.

