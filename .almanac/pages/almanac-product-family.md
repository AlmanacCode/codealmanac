---
title: Almanac Product Family
summary: Almanac is the product name for project-scoped, maintained knowledge layers whose user-facing loop is adding sources and querying knowledge.
topics: [product-positioning, wiki-design]
sources:
  - /Users/rohan/.codex/sessions/2026/05/27/rollout-2026-05-27T16-27-22-019e6b55-bee7-79d3-ba21-2852c5372082.jsonl
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T11-12-35-019e6f5b-eaff-7600-abd8-c83c7cdc491a.jsonl
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T12-14-55-019e6f94-fae1-7780-b2c9-3e2f3d6b6f3e.jsonl
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-24-15-019e70e7-1dc0-7e30-a996-f47b766b4ee6.jsonl
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-27-05-019e70e9-b7d7-7900-9fc0-da2a6f0b532d.jsonl
status: active
verified: 2026-05-29
---

# Almanac Product Family

Almanac is the product name for a maintained body of useful knowledge over a project-scoped source world. [[company-brain]] remains useful as market-category language, but the product vocabulary should use "Almanac" for the artifact a user creates, asks, reviews, and gardens.

CodeAlmanac is the codebase-shaped member of this family. Its source world is a repository: source files, tests, docs, commits, sessions, and project decisions. The current implementation stores maintained knowledge in `.almanac/pages/`, `.almanac/topics.yaml`, and `.almanac/README.md`, with local derived state in `.almanac/index.db` and `.almanac/runs/`.

The 2026-05-28 remote-product discussion tested whether public and team repositories should move canonical shared knowledge to `ALMANAC.md` plus `almanac/pages/`. The follow-up rejected that as the default because it adds repo-root visual clutter, makes the product feel like another docs surface, and is more invasive for open-source maintainers. The later Mintlify comparison produced a better rule: the wiki root should be configurable, `docs/almanac/` is the preferred public/team profile when the repository can carry project memory under `docs/`, and `.almanac/` remains the quiet local/private profile. Current repos use `.almanac/` for both durable knowledge and local state; the product direction is to move generated indexes, runs, extracts, and caches out of the canonical Almanac root by default, using user cache or hosted coordination storage instead of an in-root `.state/` directory. A top-level `almanac/` should remain opt-in because it has the highest repo-root footprint.

The product split should make `almanac` the general engine, but profile names are not the starting primitive. The reusable model should first define objects and operations that keep the CodeAlmanac knowledge model transferable: projects, sources, source adapters, source records, extracts, pages, topics, runs, triggers, indexing, `ask`, `search`, `show`, Absorb, Garden, and `serve`. Code-specific behavior can then be expressed as repo-aware source adapters, file and folder wikilinks, coding-session capture, code-specific README instructions, AGENTS.md installation, and query affordances such as `--mentions src/path`.

The generalized product should feel like a project workspace that gets smarter when the user adds sources. Originals are preserved as sources, maintained understanding lives in reviewed Almanac pages, and ambiguous or risky changes remain visible instead of silently overwriting current memory. The wiki must not become the workspace where raw documents, extracted text, generated summaries, agent scratchpads, entity pages, and durable conclusions collapse together.

The 2026-05-27 Reverie examples sharpened the writing target. A generalized Almanac page should read like a Wikipedia-style article about the named thing, not like a document index, source summary, or operations memo. A page such as `reverie-project-inc.md` should state sourced facts about the company itself: incorporation jurisdiction, entity type, formation channel, E-Verify status, governance state, records, people, and open factual uncertainties. Source documents such as bylaws, certificates, EIN letters, passports, and emails are citations and evidence; they are not the product surface.

Claims that come from source documents should carry inline citations close to the claim, especially for dates, legal status, identifiers, authority, employment facts, immigration facts, and current-state assertions. A final "Sources" list is not enough if the reader cannot tell which source supports which sentence. The page should still read as an article; citations support the prose rather than turning the page into a source inventory.

The product model is therefore `sources -> indexing and evidence extraction -> inferred facts -> wiki articles -> citations -> query answers`. It is not `documents -> organized document index -> summaries`. This distinction matters because a user asking the Almanac should usually get an answer or read the page without reopening the PDFs, while still being able to inspect the cited sources when a claim needs verification.

The same citation model applies to CodeAlmanac itself. Web sources should be first-class source objects, not pasted background context, because external SDK docs, specs, competitor pages, papers, and design references can shape project decisions. `files:` remains useful for `almanac search --mentions` and other file-aware queries, but it is too narrow for provenance. The product path is to keep `files:` as the mechanical repo-file index, add structured `sources:` entries for provenance, and eventually derive file mentions from `sources[type=file]` once the index supports that.

## Product Scopes

The same product primitive can be scoped to different source worlds:

- **Code Almanac**: maintained project memory over a codebase.
- **Personal Almanac**: maintained memory over life administration, preferences, documents, relationships, immigration, housing, finances, and open loops.
- **Company Almanac**: maintained memory over an organization, including workers, officers, contractors, advisors, ownership, legal documents, tax records, banking, compliance, product operations, and investor materials.
- **Project Almanac**: maintained memory over a named project that may span code, docs, meetings, and external research.
- **Research Almanac**: maintained memory over a research corpus, papers, notes, interviews, and conclusions. A Karpathy-style LLM wiki is the model case: a user keeps adding useful papers, notes, videos, and transcripts, and the Almanac turns them into a navigable, agent-queryable body of synthesis rather than a pile of source files.

Scoped almanacs prevent source leakage. A shared original such as a passport, contract, email thread, or receipt can support multiple almanacs, but each almanac needs its own projection and charter. A company almanac should only preserve the company-relevant fact an identity document supports, while a personal almanac can preserve broader private context.

## Individual And Team Products

The 2026-05-28 source-portability discussion clarified that individual and team Almanacs can share the same object model while requiring different trust policies. An individual Almanac optimizes for one developer or owner continuing their own work across sessions. It can treat local transcripts, account-specific files, and private notes as useful sources because the trust question is whether the owner can understand and resume their work.

A team Almanac optimizes for another authorized collaborator verifying and continuing shared work. Anything outside the current repository is not guaranteed to exist on every laptop, and conversations are often tied to one machine, account, or agent transcript store. A team-facing wiki should therefore treat local or private conversations as provenance for how an edit originated, not as the only evidence for current shared truth.

The same source schema can support both products if it records source portability. `repo` sources are committed with the project or present in shared Git history. `web` sources are reachable by URL and need retrieval metadata. `workspace` sources live in shared systems such as GitHub, Google Drive, Slack, Gmail, DocuSign, Stripe Atlas, or Mercury and depend on inherited permissions. `local` sources live on one machine or account. `private` sources are intentionally not shared.

For the current shared-repo case, maintained claims should prefer `repo`, `web`, or permissioned `workspace` evidence. A future team health policy should warn when a current factual claim depends only on `local` or `private` sources. Individual products can allow that weaker portability because their continuity goal is personal rather than collaborative.

## GUI Product Loop

The GUI should organize the product around projects, not around folders, page management, or a blank editor. A project is the unit of memory, permissions, Git backing, source indexing, and querying.

The first screen should let the user choose or create a project. Inside a project, the two primary actions are **Add Sources** and **Ask**. Sources can be files, folders, links, YouTube URLs, Git repos, Google Drive docs, or later email threads. The user should not have to choose `papers/`, `lectures/`, `notes/`, or `transcripts/` before the product becomes useful.

The first user-facing promise is auto-indexing: drop sources into a project and immediately query them. Auto-indexing means fingerprinting sources, extracting text, classifying source type, building search or embedding indexes, connecting sources to current knowledge, and making the material available to answers with citations. Auto-organizing is a stronger later promise: grouping sources, suggesting topics, updating pages, merging duplicate concepts, and detecting contradictions. That distinction matters because auto-indexing is easier to trust and ship, while auto-organizing implies reliable curation of the knowledge graph.

The core project UI should have three surfaces:

- **Ask**: the primary screen for questions such as "What do we know about attention?", "Which sources explain tokenization best?", "What changed since I added Karpathy's lectures?", "What are the open questions?", and "Which claims cite the Transformer paper?"
- **Sources**: the add/manage surface for indexed source material and source metadata.
- **Knowledge**: the browse surface for maintained pages, topics, backlinks, citations, open questions, and reviewable knowledge changes.

The answer surface should cite maintained project knowledge first and raw sources second. The user should not have to browse the wiki to benefit from it, but the maintained wiki must remain available for inspection, editing, review, Git diff, and agent-native retrieval.

## CLI Product Loop

The CLI should expose projects as the user-facing abstraction while preserving the `.almanac/` directory as the implementation contract. A research user should be able to run commands such as `almanac projects`, `almanac init llm-wiki`, `almanac use llm-wiki`, `almanac add ./attention-is-all-you-need.pdf`, `almanac ask "what do we know about attention?"`, `almanac search "tokenization"`, and `almanac show transformer-architecture`.

Command names should keep the same semantic meaning across source worlds. `init` creates or attaches an Almanac project at a root, `add` registers source material, `absorb` updates maintained knowledge from bounded source context, `ask` answers from maintained knowledge and indexed sources, `search` retrieves matching knowledge objects, `show` displays one knowledge object, `garden` improves graph organization, and `serve` browses the project locally. Compatibility shortcuts can compose these operations, but the underlying verbs should not mean different things in code, research, personal, and company almanacs.

The current CodeAlmanac `init` behavior is heavier than the generalized meaning because it creates the project structure and performs the first codebase build. The generalized core should separate container creation from knowledge absorption: `init` creates `.almanac/`, the charter, starter pages, config, and local state, while `absorb` turns a repo, folder, document set, or session into maintained pages. A code-specific wrapper can still compose `init + absorb .` for the existing user experience.

First-run setup needs two valid paths. `almanac init llm-wiki` creates a new project folder and initializes its source tree and `.almanac/` state. `cd ~/Documents/llm-wiki && almanac init .` attaches Almanac to an existing folder. The product should also support a registry-backed active project so `almanac use llm-wiki` lets commands run from outside the project directory, but `cd project && almanac ...` should remain the primary Git-like mode.

Project resolution should prefer an explicit project argument, then the nearest `.almanac/` from the current working directory, then the active project from user config, then an error with setup help. That order keeps scripts deterministic, preserves the current walk-up behavior for repo-local use, and lets non-code Almanacs feel like named projects rather than hidden folders.

`almanac add <file-or-folder-or-url>` should begin with source ingestion, not page creation. It should preserve or reference the original according to project policy, fingerprint it, extract text and metadata, index it, run Absorb when the source changes durable understanding, and print the pages updated, pages created, and useful next questions. The command is the CLI equivalent of the GUI Add Sources action.

## General Directory Shape

A generalized Almanac should keep CodeAlmanac's attach-to-a-project shape, but the wiki root path should become configurable. The important invariant is not the literal directory name; it is that each project has one canonical root for maintained pages and that rebuildable machine state is not confused with reviewable memory. Public/team mode should separate those concerns by default.

The current implementation shape is:

```text
project-root/
  .almanac/
    README.md
    pages/
      architecture.md
      open-questions.md
    topics.yaml
    config.yaml
    index.db
    runs/
    extracted/
    cache/
```

The public/team product shape should put reviewed knowledge under a visible docs path while keeping local machinery outside the wiki root:

```text
project-root/
  docs/
    almanac/
      README.md
      pages/
        architecture.md
        open-questions.md
      topics.yaml
      config.yaml
      issues.yaml
```

In that shape, `docs/almanac/` is the wiki root and the only source of truth for pages. Local commands can store `index.db`, run history, extracts, and caches under a platform user-cache path keyed by repository identity, while hosted deployments can store equivalent derived state in the hosted job/index store.

The hidden local/private shape can use `.almanac/` for both reviewed knowledge and local state:

```text
project-root/
  .almanac/
    README.md
    pages/
      architecture.md
      open-questions.md
    topics.yaml
    config.yaml
    issues.yaml
    local.yaml
    index.db
    runs/
    extracted/
    cache/
```

`README.md`, `pages/`, `topics.yaml`, `config.yaml`, and `issues.yaml` are the reviewed project memory and policy surfaces. `index.db`, `runs/`, `extracted/`, and `cache/` are rebuildable machinery and should move out of the Almanac root by default when the product can do so without breaking existing local workflows.

`docs/almanac/` has a real adoption benefit because it reads like documentation-scoped project memory without adding a top-level branded folder. It also has a real cost for projects whose `docs/` directory is a curated product documentation site, a Mintlify or static-site source tree, or an area owned by a docs team. For those projects, `.almanac/` is cleaner because it behaves like `.github/`, `.cursor/`, `.claude/`, or `.vscode/`: repository infrastructure that agents and maintainers know to inspect, but normal users do not have to see.

For personal, local, or early generalized Almanacs, the same all-in-one profile can sit beside project sources:

```text
project-root/
  sources/
  .almanac/
    README.md
    pages/
      getting-started.md
      open-questions.md
    topics.yaml
    index.db
    runs/
    extracted/
    events.jsonl
```

The project root is the source world. In CodeAlmanac the source world is code, docs, tests, commits, and sessions. In a research, personal, company, or project Almanac the source world can include `sources/`, connected external systems, and any ordinary project folders the user adds. The charter tells agents what the project memory is for, who it should help, and what it should avoid. The page directory holds maintained synthesis. The topics file is optional until the page graph needs neighborhoods. Indexes, runs, extracted text, fingerprints, and event logs are local derived state.

The GUI can expose "Project", "Sources", "Knowledge", and "Ask" as product concepts without making those names the filesystem contract. The filesystem contract should preserve the same query and editing model across code, research, personal, and company projects, with `pages/` under the chosen Almanac root remaining the maintained page directory.

Typed page folders such as `.almanac/pages/people/`, `.almanac/pages/organizations/`, and `.almanac/pages/projects/` are not the starting primitive. They are object-class browsing folders that Garden can propose after an almanac grows large enough that flat `.almanac/pages/` becomes painful. A page is first a maintained named thing: `gagan-sharma.md`, `reverie.md`, `immigration.md`, `taxes-2025.md`, `identity-documents.md`, or `open-questions.md`. The title, lead, links, topics, and evidence tell readers what kind of thing it is.

This is close to the `subject:` and `type:` frontmatter idea rejected for CodeAlmanac, but the final product rule is the same in both domains: folders, subjects, and page types should not become primary semantic machinery before there is a mechanical need. For codebase wikis, folders-as-types such as `.almanac/pages/decisions/` or `.almanac/pages/flows/` are especially wrong because a page often has several roles at once. For general almanacs, object-class folders are less risky but should still be treated as a later navigation optimization.

When a generalized Almanac does allow page folders, the folder path under `.almanac/pages/` must become part of page identity rather than a visual-only grouping. `.almanac/pages/reverie/equity.md` should have the page id `reverie/equity`, and `.almanac/pages/people/rohan-sharma.md` should have the page id `people/rohan-sharma`. A namespace main page can use `index.md`, so `.almanac/pages/reverie/index.md` resolves as the page id `reverie` while `.almanac/pages/reverie/governance.md` resolves as `reverie/governance`. This prevents collisions such as `.almanac/pages/reverie/overview.md` and `.almanac/pages/immigration/overview.md`, gives humans a useful file tree, and gives agents a placement hint without replacing topics or links.

The generalized navigation model is therefore: folder equals namespace or primary home, topics equal conceptual neighborhoods, and links equal relationships. `almanac serve` should expose folder browsing when folders exist, but it should also expose topic browsing, search, recent changes, backlinks, and open questions so the folder tree does not become the only map.

## Primitive Model

The generalized engine should be described in terms of objects before it introduces product variants. A project is the root that owns one `.almanac/` wiki. A source is raw material the project can learn from, such as a file, folder, URL, transcript, repo file, or email export. A source adapter discovers or reads one kind of source. A source record stores durable metadata such as id, path or URL, hash, type, status, and last-indexed time. An extract is derived text or metadata rebuilt from a source. A page is maintained markdown synthesis. A topic is a conceptual neighborhood in `topics.yaml`. A run records one deterministic or agentic operation. A trigger is a rule that decides when to run an operation.

A source record should be broad enough for code and non-code Almanacs. Supported source types should include repo file, test, migration, config, prompt, web URL, commit, PR, issue, conversation, manual note, wiki page, email export, and external document. Web source records need URL, title when known, retrieved date, and optionally an archived snapshot or content hash. Source IDs should be stable enough for prose citations such as `[@writer-prompt]`, and source notes should say what the source supports rather than merely naming it.

The allowed modification vocabulary should stay small. Source modifications register a source, update a source hash or version, mark a source unavailable, or record extraction metadata. Index modifications rebuild extracted text, update search tables, or update source-page mention edges. Page modifications create, update, merge, split, archive, redirect or alias, or no-op. Topic modifications create topics, retopic pages, link or unlink topic parents, or remove empty topics when safe. Run modifications start, finish, fail, cancel, or reconcile pending work.

This primitive model keeps CodeAlmanac's current behavior understandable as a composition rather than a separate product. Coding-session capture is a transcript source adapter plus a quiet-session trigger plus the Absorb operation plus code-specific `.almanac/README.md` instructions.

## Automation And Triggers

The current repo does not implement `.almanac/triggers.yaml`. Automation is still the known-task scheduler described in [[automation]]: OS scheduler jobs invoke `almanac capture sweep`, `almanac garden`, and opt-in `almanac update`. `capture sweep` is a coordinator that discovers quiet transcripts and may enqueue Absorb runs; scheduled Garden invokes one Garden operation.

A generalized trigger model would move one level above the current scheduled-task model. Instead of installing separate scheduler jobs for each known command, a future `almanac sweep` could read `.almanac/triggers.yaml` and evaluate rules such as "index changed sources every 30 minutes after two minutes of quiet", "absorb new sources when extraction finishes", or "garden every two days when the graph has changed". The durable primitive would be `trigger = event or condition + operation + inputs + cadence + dedupe state`, but that is a proposed generalization, not current CodeAlmanac behavior.

## Ingestion Flow

The drag-and-drop flow should let the almanac root act as the user-facing inbox. A user should be able to drop `Bylaws.pdf`, a passport scan, an email export, or a receipt directly into `reverie-almanac/` without navigating to `sources/inbox/`. The product then moves processed files into an organized `sources/` tree and keeps root-level clutter from becoming part of the durable layout.

For a research Almanac, source-type folders such as `sources/papers/`, `sources/lectures/`, `sources/notes/`, `sources/links/`, and `sources/transcripts/` are system-organized homes for originals, not top-level folders the user must choose before ingestion. The user-facing action is still "add this material to the project"; the product sorts the original into a source family, then updates synthesis pages such as `.almanac/pages/attention.md`, `.almanac/pages/transformer-architecture.md`, or `.almanac/pages/tokenization.md` when the material changes durable understanding.

The ingestion flow begins with sources, not page creation:

1. A user drops files into the almanac root.
2. The system fingerprints originals and preserves them.
3. The system extracts text and metadata into derived local artifacts.
4. The system classifies document kinds and matches entities.
5. The system detects duplicates, near-duplicates, stale facts, and contradictions.
6. The system moves processed originals under `sources/` using readable discovered groupings such as `sources/legal/`, `sources/identity/`, `sources/email/`, or `sources/receipts/`.
7. The system proposes or applies page updates based on the risk of the claim.
8. Uncertain or conflicting claims are written to `.almanac/pages/open-questions.md` or to an `Open Questions` section on the relevant named page.
9. Garden-style maintenance keeps pages current and marks stale evidence or claims as archived in metadata, not necessarily in a top-level source folder.

The central question after ingestion is what durable understanding changed. A dropped document should not automatically become a wiki page. A passport, receipt, contract, or email thread is usually evidence for a page, not the page itself. Low-risk source organization can be automatic for duplicates, known legal documents, receipts, bank statements, and files matching an existing source family. High-risk organization should not silently promote meaning for passports, legal identity documents, medical documents, conflicting names or dates, company ownership or officer changes, and any move that broadens visibility from personal to company context. A later product can add a visible `reviews/` queue for unresolved human judgment, but v0 can keep uncertainty on open-question pages.

## User And Agent Flow

A first-run user flow should feel like creating a project that can learn from sources:

1. The user creates or opens a project such as `reverie-almanac/`.
2. The setup creates `sources/`, `.almanac/README.md`, `.almanac/pages/getting-started.md`, `.almanac/pages/open-questions.md`, optional `.almanac/topics.yaml`, and local `.almanac/` state.
3. The user adds documents through the GUI or drops them directly into the project.
4. Absorb preserves the originals under `sources/`, extracts derived text under `.almanac/`, updates flat named pages such as `.almanac/pages/reverie.md`, `.almanac/pages/identity-documents.md`, or `.almanac/pages/taxes-2025.md`, and records uncertain facts in open questions.
5. The user reads and edits through `almanac serve` or by opening markdown files directly.
6. Later drops reconcile against existing pages instead of overwriting human-authored synthesis silently.

An agent using the almanac should start from `.almanac/README.md`, then search or read `.almanac/pages/` for current synthesis, then inspect `sources/` only when evidence is needed. It should treat `.almanac/index.db`, `.almanac/runs/`, extraction caches, and event logs as machine state and should not make raw extracted text or run logs into user-facing knowledge unless the content changes a maintained page.

The agent query contract should stay command-shaped instead of requiring the agent to read the whole folder. The durable retrieval path is `almanac search "<query>"`, `almanac show <page>`, topic browsing, backlinks, source inspection for cited evidence, and eventually `almanac ask "<question>"` for synthesized answers over the same index. That contract keeps the maintained pages as the first retrieval surface, with sources as evidence and `.almanac/` as derived state.

## Human Editing

Human editing belongs in the maintained layer. A human can edit pages through `almanac serve`, edit pages directly in a text editor, edit `.almanac/topics.yaml` when reading neighborhoods change, and resolve open questions when sources conflict or the system is unsure.

Originals in `sources/` are evidence and should not be rewritten by the maintenance agent. Extracted text and OCR are rebuildable derived artifacts. A future review queue is operational state: it exists so the product can ask for approval before broadening scope, overwriting a current fact, deleting a stale derived document, or moving a sensitive source into a company-visible area.

The first practical experiment should be manual. A Reverie Almanac can start with 10-20 real documents, a small `sources/` tree, four to six synthesis pages, and open questions for ambiguous facts. That test should reveal which source moves are safely automatable and which updates require human judgment before the product adds drag-and-drop automation or a dedicated review queue.

## Version Control Boundary

For a GitHub launch, the default should track the maintained synthesis and ignore raw sources:

```text
tracked:
  .almanac/README.md
  .almanac/pages/
  .almanac/topics.yaml
  source metadata / citations

ignored by default:
  sources/
  .almanac/index.db
  .almanac/runs/
  .almanac/extracted/
```

`.almanac/README.md`, `.almanac/pages/`, `.almanac/topics.yaml`, and source metadata are reviewable product memory. `sources/` can contain passports, bank documents, emails, medical records, contracts, and receipts, so publishing it should be explicit opt-in. A public research Almanac can opt into tracking public source files or source references when the corpus is meant to be shared. `.almanac/index.db`, `.almanac/runs/`, extracted text, fingerprints, and event logs are local machine state. A later company mode can allow selected public or company-safe source folders, but v0 should make source publication a deliberate choice.

## Team Source Systems

A team Almanac should usually treat Google Drive, Gmail, Slack, DocuSign, Stripe Atlas, Mercury, GitHub, and similar tools as original source systems rather than copying every file into the Almanac folder. The shared Almanac repository can track `.almanac/README.md`, `.almanac/pages/`, `.almanac/topics.yaml`, and source metadata, while cached files, extracted text, private local copies, and other local `.almanac/` state remain ignored.

The source object for a team document can be a reference instead of a copied file: origin system, canonical URL, provider id, title, source kind, last-seen time, hash or version marker, and inherited access policy. A page then cites the source object, and a reader who clicks the citation needs permission in the original system. This keeps Google Drive or another document store as the system of record for shared originals while Almanac remains the maintained wiki and source index over those systems.

The public/team product names should be Almanac OSS, Almanac Teams, Almanac Enterprise, and Almanac Orgs. Almanac Teams names the private-repository GitHub App product; it sells governance and workflow rather than storage volume. The customer problem is that engineering teams lose project memory while AI increases the rate of code change. The concrete buyer wants senior engineers to stop repeating context, agents to stop violating hidden invariants, contributors to arrive prepared, and project decisions to remain reviewable as code changes.

Reference mode and archive mode are distinct product modes. Reference mode keeps originals in source systems and stores citations, metadata, extraction caches, and maintained pages; it fits teams. Archive mode copies originals into `sources/`; it fits personal, local, offline, or legal-archive use cases where the Almanac folder intentionally owns the evidence.

## Naming Implication

Use "Almanac" for the owned product surface: create an almanac, attach sources, absorb documents, garden the almanac, review conflicts, ask the almanac, show evidence, and archive stale claims. Use "brain" only when discussing external market language such as the company-brain category or when comparing against products that use that vocabulary.

## Related Pages

[[company-brain]] explains the adjacent market category and why CodeAlmanac's wedge should stay narrower than a broad enterprise memory platform. [[superpaper]] explains why an Obsidian-first personal knowledge system is useful prior art but should not become the model for source-document ingestion. [[wiki-organization-primitives]] explains the page, link, topic, anchor, hub, and Garden primitives that keep Almanac graphs coherent.
