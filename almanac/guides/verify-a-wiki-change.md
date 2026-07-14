---
title: Verify A Wiki Change
topics: [guides, wiki, health]
sources:
  - id: repo_readme
    type: file
    path: README.md
    note: Public read commands for search, health, and validate.
  - id: health_service
    type: file
    path: src/codealmanac/services/health/service.py
    note: Validation service behavior.
  - id: health_page
    type: wiki
    page: architecture/wiki/health-and-validation
    note: Local architecture page explaining health and validation checks.
  - id: usefulness
    type: wiki
    path: concepts/wiki-usefulness-evaluation
    note: Concept page for evaluating wiki value by future-agent task outcomes.
---

# Verify A Wiki Change

Use this guide after editing wiki source under `almanac/`. A verified change has valid page links, usable source citations, no runtime-state files in the wiki tree, and a refreshed index that can represent the current Markdown [@health_service].

For the exact page metadata and citation contract, see [Frontmatter and sources](../reference/page-format/frontmatter-and-sources). For Markdown page-link rules, see [Links and routes](../reference/page-format/links-and-routes).

For Garden work, check [Wiki usefulness evaluation](../concepts/wiki-usefulness-evaluation) before polishing. A wiki change is useful when it helps future agents complete real repository work, while validation and link health are diagnostics for that goal [@usefulness].

## Steps

Run `codealmanac validate` from the repository root. Validation checks source frontmatter shape, rejects runtime-state leaks, refreshes the index, and fails when graph or source-health issues remain [@health_service].

If validation fails, fix the reported wiki source issue rather than editing runtime state. Broken page links need a real target page or plain text. Missing citations need a matching `sources:` entry or a removed citation marker. Unused sources should be cited near the claim they support or removed. See [Health and validation](../architecture/wiki/health-and-validation) for what each check looks for and why [@health_page].

Use `codealmanac health` when you want the same graph report without treating it as a pass/fail gate. Use `codealmanac search`, `codealmanac show`, and `codealmanac topics` to spot-check that the page can be found and read through the public read surface [@repo_readme].

## Recovery

If validation reports runtime state under `almanac/`, remove that generated file from the wiki tree and keep runtime data under `~/.codealmanac/` [@health_page]. If validation reports route collisions, rename or move one Markdown page so each route maps to one file.
