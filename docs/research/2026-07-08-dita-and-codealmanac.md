# DITA and CodeAlmanac research

Date: 2026-07-08

## Question

What does DITA, as documented at <https://dita-lang.org/>, teach us about CodeAlmanac? The working question is not whether CodeAlmanac should adopt DITA. It is whether DITA's content architecture contains useful concepts for local agent-maintained repo wikis.

## Current hypothesis

CodeAlmanac should probably not adopt DITA as an authoring format or processing stack. DITA is valuable as prior art for stronger content modeling: topic units, maps, typed metadata, reuse, conditional processing, and specialization. The likely fit is "borrow architectural ideas, not XML machinery."

## Repo context

This was written in almanac, based on what was written in these pages on almanac:

- `concepts/local-repo-wiki`: CodeAlmanac's committed source is a local `almanac/` Markdown tree, with derived runtime state outside the repo.
- `concepts/source-material`: ingest source material is raw input for synthesis, while page `sources:` frontmatter is evidence for claims already written.
- `decisions/local-only-python-product`: the active product is a local-only Python CLI, not a hosted or cloud documentation service.

These pages make "adopt DITA wholesale" feel misaligned. They also make DITA's explicit separation between authored source, processing rules, and generated deliverables worth studying.

This was written in almanac, based on what was written in these additional pages on almanac:

- `reference/page-format/frontmatter-and-sources`: the current parser only treats `title`, `summary`, `topics`, and `sources` as modeled frontmatter; other keys are ignored.
- `decisions/markdown-links-and-sources`: CodeAlmanac deliberately uses normal Markdown links and structured `sources:`, not double-bracket links or legacy file lists.
- `architecture/viewer/local-viewer`: the local viewer is read-only and projects existing read models; it does not own a separate write path.

## Evidence log

### dita-lang.org landing page

The site defines DITA as an XML-based open standard for structured content, reuse, and publishing technical documentation at enterprise scale. Its own landing page frames the promise as: structure content, scale documentation, deliver everywhere.

Initial read: DITA is about content architecture and publishing pipelines, not just a docs theme or static site generator.

### DITA 2.0 cover page

The DITA 2.0 draft describes the spec as defining document types for authoring and organizing topic-oriented information, plus mechanisms for combining, extending, and constraining document types.

Initial read: this is the strongest conceptual overlap with CodeAlmanac. CodeAlmanac already has pages, topics, sources, and processing commands. DITA asks whether those should be seen as a formal information architecture rather than a pile of Markdown conventions.

### Overview of DITA

The overview says DITA is topic-oriented, information-typed, reusable, and single-sourced. It also says specialization creates new document types and information domains based on existing ones, while preserving compatibility with tools built for the more general types.

Initial read: "specialization" is a serious idea for CodeAlmanac page types. A `decision` page, `gotcha` page, and `workflow` page could be specialized forms of a general page contract without requiring separate pipelines.

### DITA maps

DITA maps organize topics, navigation hierarchies, relationships, and subject schemes. Subject schemes define controlled values and subject definitions for taxonomies and ontologies.

Initial read: CodeAlmanac's `topics.yaml` is a lightweight map. It may be underpowered for relationship semantics, but that may be intentional.

### DITA addressing

DITA has direct URI addressing and indirect key-based addressing. Keys let resources, metadata, and variable text be defined at the map level instead of inside each topic.

Initial read: key-based indirection is tempting, but it might violate CodeAlmanac's preference for obvious Markdown source. A small version could help with stable cross-repo references or source aliases.

### DITA processing

DITA processing includes navigation, indexes, content references, conditional processing, metadata cascading, chunking, branch filtering, sorting, and effective attribute precedence.

Initial read: CodeAlmanac already has implicit processors: index refresh, search, health, validation, ingest, garden, and viewer rendering. The interesting lesson is to name processor responsibilities explicitly and keep authored source distinct from derived behavior.

### Configuration and specialization

DITA separates document-type configuration, specialization, generalization, constraints, and expansion modules. Constraints remove options from content models; expansion modules add options.

Initial read: this maps unusually well to CodeAlmanac's "seams before machinery" rule. A page contract can be constrained or expanded without turning every page into a bespoke format.

### Lightweight DITA

LwDITA is a simplified DITA form expressed in XML, HTML5, and Markdown. MDITA is the Markdown authoring format; it has a core profile aligned with GitHub Flavored Markdown and an extended profile with more DITA-like behavior.

Initial read: LwDITA proves that "DITA ideas in Markdown" is a real path. That matters more than the exact syntax.

### DITA site colophon

The site itself is generated from DITA source pulled from GitHub, plus generated content derived from DITA RelaxNG schemas. It has multiple viewing profiles: default, implementer, source, and debug.

Initial read: this is highly relevant to CodeAlmanac. The same authored knowledge can be shown differently to different readers: agent view, human view, maintainer/debug view, maybe API/JSON view.

### DITA basic concepts

DITA's basic concepts page names topic, map, information typing, addressing, content reuse, conditional processing, configuration, specialization, and constraints as first-class concepts.

Initial read: this is a clean checklist for CodeAlmanac's own architecture vocabulary. CodeAlmanac already has most of these concepts informally. The question is which ones deserve product names and which should stay implementation detail.

### DITA content references

Conref lets one topic or map reuse content from another topic or map. DITA processors must ensure that reused content remains valid in the new context, including attribute behavior and nested references.

Initial read: CodeAlmanac should be cautious here. Agent-written wiki pages benefit from prose locality. Reusing snippets could reduce duplication, but it could also make pages harder for agents to read in raw Markdown. The safer borrowing is the invariant: if content is reused, validation must check the destination context.

### Conditional processing and DITAVAL

DITA conditional processing filters or flags information at render time based on attributes in source content. DITAVAL documents define include, exclude, or flag rules. Subject schemes can define controlled values for those attributes.

Initial read: CodeAlmanac could use conditional display for audiences or surfaces, but probably not inside committed prose. Better fit: viewer/search profiles that filter by page metadata, not inline conditional paragraphs.

### Metadata cascading

DITA metadata on maps or topic references can cascade to nested references. Cascading applies to containment hierarchy, not specialization hierarchy.

Initial read: CodeAlmanac's topics and folder README pages could support inherited defaults someday, but this is dangerous unless precedence is very obvious. Hidden metadata inheritance may make raw Markdown less inspectable.

### Chunking

DITA separates authoring granularity from delivery granularity. A map can tell processors to combine multiple source documents for rendering or split one source document into separate rendered documents.

Initial read: this is very relevant. CodeAlmanac can keep atomic pages for agents while rendering larger human-readable guides, onboarding paths, or architecture packets. This should be a viewer/export concern, not an authored page-format concern.

### Branch filtering

DITA branch filtering applies different condition profiles to different branches of a map. It can also clone a branch under multiple condition sets, which forces processors to manage resource and key names carefully.

Initial read: this is probably too much machinery for CodeAlmanac. The useful idea is "profile-aware views must define conflict and naming behavior." The product should not casually add branch-specific filtering without a concrete need.

### DITA Open Toolkit

DITA-OT is the open-source publishing engine for DITA content. It transforms DITA maps and topics into outputs such as HTML, PDF, Markdown, normalized DITA, Eclipse Help, and HTML Help. It is plugin-extensible, but built around Java, Ant, and XSLT.

Initial read: this confirms that adopting the ecosystem means adopting a heavy processing stack. CodeAlmanac should avoid that unless it needs enterprise DITA interoperability. DITA-OT is more useful as a mature example of a map-driven pipeline than as a dependency.

### DITA-OT architecture

DITA-OT uses a multi-stage, map-driven processing architecture. It keeps source files unmodified and works through temporary resources. Processing order matters: DITA-OT chooses filtering before conref resolution because that best matches user expectations, even though the DITA specification does not force a single order.

Initial read: this is a strong analogy for CodeAlmanac. `validate`, `search`, `garden`, `ingest`, and viewer/export operations should state their processing order when order affects behavior. Source files should remain authored source; generated or normalized views belong outside the source tree.

### DITA-OT Markdown support

Markdown DITA uses CommonMark. Headers become topics. Header attributes can set IDs and classes. Classes such as `concept`, `task`, and `reference` select built-in topic types. YAML metadata maps into DITA metadata, and unrecognized keys become data elements. Shortcut links can become key references.

Initial read: this is the closest prior art to a "Markdown-first but typed" CodeAlmanac page model. It suggests page type can be signaled with compact metadata rather than new syntax.

### CodeAlmanac current page format

The current CodeAlmanac page parser models only `title`, `summary`, `topics`, and `sources`; page identity comes from the path. This is intentionally small and supports raw Markdown readability.

Initial read: adding DITA-like page kinds would be a real product decision, not a hidden convention. It would require parser, validation, prompt, and viewer changes. That makes it a possible future slice, not a casual docs tweak.

### CodeAlmanac local viewer

The local viewer already projects Markdown pages, topics, links, sources, file refs, and jobs through service read models. It is explicitly read-only.

Initial read: DITA-like profiles and chunking fit the viewer boundary. They do not need to alter ingest or authored source first. A viewer profile can change what is displayed without creating AI-writing complexity.

## Concept mapping

| DITA concept | CodeAlmanac analogue | Fit |
| --- | --- | --- |
| Topic | Markdown page | Strong |
| Map | `topics.yaml`, folder READMEs, viewer nav | Strong, but keep lighter |
| Information typing | page kinds: decision, concept, guide, gotcha, workflow | Strong |
| Specialization | specific page contracts derived from general page contract | Strong as design vocabulary |
| Constraints | validation rules for page kinds | Strong if kept small |
| Conref | reusable page snippets | Weak; risks hurting raw readability |
| Keys | stable aliases for URLs/pages/sources | Medium; useful only with pain evidence |
| Conditional processing | audience/profile-specific output | Medium for viewer/export, weak in prose |
| Metadata cascading | inherited defaults from topics/folders | Risky; hidden behavior |
| Chunking | render/export packets from atomic pages | Strong |
| DITA-OT plugins | extension points | Weak as implementation, useful as pattern |

## Emerging options

1. Do nothing: keep current Markdown conventions.
2. Borrow vocabulary only: page types, maps, source/evidence distinction, processing profiles.
3. Add lightweight content-type contracts: explicit page kinds with validation and rendering hints.
4. Add DITA-like maps: richer topic maps, relationship tables, controlled values, and metadata cascade.
5. Adopt LwDITA or DITA-OT: use existing standards/tooling as a backend.

## Ideation for CodeAlmanac

### Idea: page kinds

Add a small optional frontmatter field such as `kind: decision | concept | guide | workflow | gotcha | reference`. Validation checks kind-specific expectations. Prompts use the kind to write with better shape. Viewer can filter by kind.

Why it might fit: DITA's information typing maps well to "what question does this page answer?" CodeAlmanac already has topic folders such as `concepts`, `decisions`, `guides`, `reference`, and `architecture`, but those are path conventions rather than explicit page contracts.

Why it might not fit: current pages are path-identified and prose-first. A `kind` field could duplicate folder structure and become stale unless validation and prompts care about it.

### Idea: profiles in the local viewer

Add viewer modes like `agent`, `human`, and `debug`.

- `agent`: raw-ish page body, sources, backlinks, file refs, and related pages.
- `human`: cleaner rendered article and navigation.
- `debug`: frontmatter, citations, link resolution, source health, index metadata.

Why it might fit: dita-lang.org itself has default, implementer, source, and debug profiles. CodeAlmanac's viewer already reads the same underlying source through projections.

Why it might not fit: profile UI can become clutter. The agent view may already be good enough if CLI commands remain the primary agent surface.

### Idea: export packets through chunking

Let the viewer or a future export command assemble "packets" from atomic pages: architecture overview, onboarding guide, subsystem dossier, review context bundle.

Why it might fit: DITA chunking separates authoring granularity from delivery granularity. CodeAlmanac pages should stay atomic for agents, but humans may want longer flows.

Why it might not fit: the repo already rejects artificial context bundles when they exist only because an agent might need help. Packets are justified only for real reader workflows: onboarding, review, sharing, or launch materials.

### Idea: topic maps with relationship types

Extend `topics.yaml` or add a small map model that can express relationships such as "depends on", "supersedes", "implements", "explains", or "troubleshoots".

Why it might fit: DITA maps can model explicit and implicit relationships between topics. CodeAlmanac currently has links, backlinks, topics, and related pages, but relationship semantics are mostly prose.

Why it might not fit: relationship metadata may be too expensive to maintain. Agents can read prose and links. A typed relationship should exist only if search, validation, or viewer behavior uses it.

### Idea: source aliases or keys

Add named aliases for common sources, repos, docs, or pages. A page could cite a stable alias rather than repeat a URL or path.

Why it might fit: DITA keys decouple local references from concrete addresses. CodeAlmanac has recurring references like manuals, prompts, and architecture files.

Why it might not fit: indirection weakens raw readability. The current `sources:` block is explicit and local to the page. Aliases become worthwhile only when repeated source definitions are causing errors.

### Idea: constraints without XML

Use validation rules as "constraints" over Markdown pages. For example, a decision page must have sources, a decision title, and a consequence section; a reference page must cite code paths; a guide page must link to commands or workflows.

Why it might fit: DITA constraints are a powerful idea without requiring DITA syntax. CodeAlmanac already has `validate` and health checks.

Why it might not fit: over-validating prose can make wiki writing brittle. Validation should catch structural rot, not force every page into a template.

## Working recommendation

Option 2 is clearly useful. Option 3 may be useful if there are real validation or viewer needs. Option 4 is risky unless topic relationships are currently failing. Option 5 looks wrong for the local-first, agent-first product unless a specific enterprise interoperability requirement appears.

Sharper recommendation after the second pass: use DITA as a conceptual reference for a future "page architecture" plan. Do not introduce DITA syntax, DITA-OT, XML schemas, conref, or metadata cascade now. The most promising concrete product ideas are:

1. Page kinds as lightweight contracts.
2. Viewer/export profiles such as agent, human, and debug.
3. Render-time chunking into guides or packets.
4. Validation that checks page kind, sources, links, and topic fit.
5. Optional source/page aliases only if current references become painful.

## Provisional product stance

The strongest CodeAlmanac interpretation is:

> CodeAlmanac is already a lightweight, agent-first cousin of DITA: atomic topics, a map, metadata, sources, validation, and projections. Its advantage is that it stays readable Markdown in a local repo. Its danger is accidentally rebuilding DITA's heavier machinery without DITA's enterprise interoperability payoff.

The next useful design artifact would be a short plan for "page kinds and viewer profiles" that explicitly refuses XML, conref, metadata cascade, and DITA-OT.

## Open questions

- Are CodeAlmanac pages meant to stay prose-first forever, or should some page classes have stricter content models?
- Does `topics.yaml` need relationship semantics beyond hierarchy?
- Would "agent/default/debug" views make the local viewer more useful?
- Are source aliases or cross-repo references painful enough to justify key-based indirection?
- Could page-type specialization be enforced by prompts and validation rather than schema-heavy machinery?
