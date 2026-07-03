---
title: Prompt And Manual Resources
topics: [architecture, prompts, manual]
sources:
  - id: renderer
    type: file
    path: src/codealmanac/prompts/renderer.py
  - id: manual
    type: file
    path: src/codealmanac/manual/library.py
  - id: package
    type: file
    path: pyproject.toml
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Prompt And Manual Resources

Prompts and wiki manuals are package resources, not Python string literals. Package data includes `codealmanac.manual` Markdown files and prompt files under `prompts/base/` and `prompts/operations/` [@package].

The prompt renderer loads named Markdown sections and appends runtime JSON context supplied by each workflow [@renderer]. Init, ingest, garden, and update prompts reuse the base kernel plus an operation-specific prompt.

The manual library loads bundled manual pages so `init` can install wiki-writing doctrine into the configured root [@manual]. This shape implements the decision recorded in [[prompts-manuals-as-package-resources]] and supports lifecycle pages such as [[init-ingest-garden-workflows]].
