---
title: Prompts And Manuals
topics: [architecture, runtime-resources, prompts, manuals]
sources:
  - id: prompt-renderer
    type: file
    path: src/codealmanac/prompts/renderer.py
  - id: prompt-models
    type: file
    path: src/codealmanac/prompts/models.py
  - id: prompt-requests
    type: file
    path: src/codealmanac/prompts/requests.py
  - id: manual-library
    type: file
    path: src/codealmanac/manual/library.py
  - id: manual-models
    type: file
    path: src/codealmanac/manual/models.py
  - id: pyproject
    type: file
    path: pyproject.toml
  - id: build-service
    type: file
    path: src/codealmanac/workflows/build/service.py
  - id: ingest-service
    type: file
    path: src/codealmanac/workflows/ingest/service.py
  - id: garden-service
    type: file
    path: src/codealmanac/workflows/garden/service.py
---

# Prompts And Manuals

Prompts and manuals are packaged runtime resources. Prompts tell lifecycle agents what job they are doing; manuals tell them how to write pages, cite evidence, link pages, assign topics, and follow page-type rules. Workflows render these resources with concrete JSON context before handing a prompt to a harness [@prompt-renderer] [@build-service] [@ingest-service] [@garden-service].

This shape matches CodeAlmanac's broader design rule that judgment belongs in prompts, not in a Python proposal pipeline. The workflow supplies real repository facts, source material, health reports, manual text, and source-control policy; the agent writes or edits the wiki directly under that instruction set. The related decision is [no propose/apply or dry-run](../../decisions/no-propose-apply-or-dry-run).

## Prompt Resources

Prompt names are a closed enum: `base/kernel.md`, `operations/build.md`, `operations/ingest.md`, and `operations/garden.md` [@prompt-models]. `PromptRenderer` loads those Markdown files from the `codealmanac.prompts` package with `importlib.resources`, strips each section, appends runtime context strings, and joins non-empty sections with visible `---` separators [@prompt-renderer].

The render request requires at least one prompt section. Runtime context strings must be non-empty when provided [@prompt-requests]. This gives workflows a small, typed prompt composition API without embedding long prompt literals in Python code.

The package data configuration includes prompt files under `base/*.md` and `operations/*.md`, so installed packages can render prompts without relying on a source checkout layout [@pyproject].

## Manual Resources

`ManualLibrary` reads manual Markdown from the `codealmanac.manual` package, returns an inventory of all bundled manuals, installs missing manuals into a target directory, and reports repository manual status by comparing repository files with bundled bytes [@manual-library].

The manual inventory is explicit. It includes general manuals such as `how-to-write.md`, `evidence.md`, `links.md`, and `topics.md`; page-type manuals such as `architecture.md`, `concepts.md`, `decisions.md`, `reference.md`, and `how-to-guides.md`; and operation-specific manuals such as `sources.md`, `ingest.md`, and `garden.md` [@manual-models].

Manual documents carry a name, relative path, and non-empty body. Relative paths are validated so bundled manuals cannot claim absolute paths or parent-directory traversal [@manual-models]. The package data configuration includes `codealmanac.manual = ["*.md"]`, which makes the manuals available at runtime after installation [@pyproject].

## Lifecycle Prompt Payloads

Build, ingest, and garden each choose the base kernel plus their operation-specific prompt section. They then add a `Runtime context:` block containing a JSON serialization of the workflow payload [@build-service] [@ingest-service] [@garden-service]. This is the bridge between static prompt text and the current repository state.

Build context includes repository name, repository root, almanac root, wiki source root, topics file, bundled manual documents, source-control policy, and optional guidance [@build-service]. Ingest context includes repository facts, resolved source briefs, source runtime snapshots, manual documents, source-control policy, and optional guidance [@ingest-service]. Garden context includes repository facts, index summary, health report, manual documents, source-control policy, and optional guidance [@garden-service].

The workflows pass the rendered prompt to the operation runner, which passes it to the selected harness. The prompt is already complete when it reaches the harness boundary; provider adapters should not know how build, ingest, or garden prompts are assembled.

## Why Manuals Travel With Prompts

Manual documents are included in lifecycle prompt payloads so the agent has the current writing contract in the same prompt as the job context [@build-service] [@ingest-service] [@garden-service]. That is why page format, evidence, and linking rules are runtime resources instead of separate developer memory. The exact frontmatter and citation rules are described in [frontmatter and sources](../../reference/page-format/frontmatter-and-sources).

This resource model also keeps the product local and installable. A packaged CodeAlmanac command has the prompts and manuals it needs, while repository-local wiki pages remain ordinary Markdown under `almanac/`.
