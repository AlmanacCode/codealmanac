---
title: Evidence Bundles
summary: Evidence bundles are the connector-ingestion manifest that gives Almanac operations stable source handles, connector runtime access, branch context, and dedupe identity before agent reasoning begins.
topics: [wiki-design, product-positioning, agents]
sources:
  - id: github-context-research
    type: file
    path: docs/research/2026-05-29-github-context-connectors.md
    note: Defines the source-adapter, source-record, evidence-bundle, trigger-record, and review-note abstractions for GitHub and future connectors.
  - id: connector-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-27-05-019e70e9-b7d7-7900-9fc0-da2a6f0b532d.jsonl
    note: Records the discussion that first distinguished webhook notifications from normalized run input, then narrowed that input into source briefs, connector runtime access, and provenance metadata.
  - id: composio-tools-and-toolkits
    type: web
    url: https://docs.composio.dev/docs/tools-and-toolkits
    note: Documents Composio toolkit-scoped sessions, meta tools, and direct-tool preloading.
  - id: composio-typescript-sdk
    type: web
    url: https://docs.composio.dev/reference/sdk-reference/typescript
    note: Shows TypeScript SDK tool fetching with toolkit filters such as GitHub.
  - id: notion-connector-branch
    type: file
    path: .git/refs/remotes/origin/codex/feat/add-wiki-connectors
    note: Shows the older Notion connector implementation that used Composio as an auth/API proxy, normalized fetched Notion content into a bundle, and wrote a run-local source artifact before Absorb.
  - id: github-source-ref
    type: file
    path: src/ingest/source-ref.ts
    note: Parses the implemented local GitHub PR source-ref syntax.
  - id: github-source-resolver
    type: file
    path: src/ingest/github.ts
    note: Resolves GitHub PR and issue sources through repository identity and configured Composio GitHub accounts.
  - id: ingest-command-source-wiring
    type: file
    path: src/cli/commands/operations.ts
    note: Wires source refs into ingest command context and GitHub PR guidance for Absorb.
  - id: github-source-tests
    type: file
    path: test/github-source-resolver.test.ts
    note: Verifies GitHub remote parsing and setup/auth error behavior for local source ingest.
  - id: source-architecture-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/30/rollout-2026-05-30T18-19-49-019e7b2f-c7d8-7640-a485-6de2f5a4a62f.jsonl
    note: Records the architecture analysis that corrected the boundary between indexer-owned markdown source metadata and external source-connector input before adding another source kind.
  - id: hosted-github-connector-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/31/rollout-2026-05-31T23-31-46-019e8173-bc02-7503-a102-e9de99d6bb9c.jsonl
    note: Records the hosted GitHub App decision to use GitHub App installation tokens and native GitHub source tools for the core hosted path while keeping Composio for broader connectors.
status: proposed
verified: 2026-06-02
---

# Evidence Bundles

Evidence bundles are the operation input boundary for connector-driven Almanac work. They record the external event that caused a run, the source handles available to inspect, branch and wiki-root context, provenance metadata, connector runtime access, and dedupe identity before Absorb, Garden, or a PR-time review-note operation spends model tokens. The useful local-ingest flow is `SourceAddress -> IngestConnector.resolve() -> SourceBrief -> ConnectorRuntime -> AbsorbRequest`: the user-facing address identifies the source, the connector interprets it, the brief carries focus and provenance hints, the runtime exposes tools, and Absorb decides whether durable wiki knowledge changed. [@github-context-research] [@connector-session]

The concept is separate from [[source-provenance]]. `sources:` in page frontmatter explains why a durable wiki claim is supported after a page has been written. An evidence bundle explains what happened before a page exists, what branch it applies to, which source box the agent may inspect, and whether that trigger has already been processed. [@github-context-research] [@connector-session]

A later connector-design discussion reframed the surrounding architecture as five roles: a connector gives the agent source tools, a `SourceRef` is a stable pointer to an external object, a `SourceCatalog` lets the agent discover readable sources and source tools, an operation tells the agent what happened, and a publisher writes back through the target system such as opening a GitHub Almanac update PR. In that model the flow is `Trigger -> Operation starts -> Agent reads source tools -> Agent decides -> Agent responds through publisher`; the evidence bundle is the manifest and source-reference part of that larger operation boundary. [@connector-session]

## Why It Exists

GitHub webhooks and future connector events are notifications, not clean agent context. A `pull_request.opened` delivery can identify the repository, pull request, base branch, and API URLs, but it does not give the agent a stable way to inspect the pull request, diff, linked issues, review comments, commit range, or target-branch Almanac pages. [@connector-session]

The bundle exists so deterministic code can do operational work without taking over judgment. It should create a source box, record provenance, and grant source tools to the agent. It should not decide which facts matter, which wiki pages are relevant, or whether durable project memory changed. [@connector-session]

The 2026-05-30 architecture analysis concluded that this boundary needs cleanup before the next source kind lands. The problem is not that `almanac ingest github:pr:123` is too large; the problem is that "source" now names page evidence, operation input, and future connector runtime concepts at the same time. The recommended scope is a medium source-connector refactor, plus clearer ownership for page-source metadata helpers, not a whole-codebase rewrite. [@source-architecture-session]

The cheap deterministic layer may answer these questions before invoking an LLM:

- is this branch maintained by Almanac
- is this webhook delivery or source trigger already processed
- is this event from Almanac's own Almanac update PR or maintenance bot
- does Almanac have permission to read the source system
- is the source too large to fetch without pagination, caching, or rate limiting
- is the per-wiki operation queue already responsible for this source

The agent should answer semantic questions such as whether a comment is a decision, whether a pull request affects memory, which pages should change, and whether a PR-time note would be useful. That preserves the project rule that intelligence lives in prompts and agent tool use, not in a TypeScript relevance pipeline.

That mirrors the capture-sweep cost invariant from [[capture-automation]] and [[capture-ledger]] without copying the old mistake. The deterministic layer classifies provenance and reserves work before model reasoning starts; the LLM still decides what knowledge is worth preserving after it reads the available sources.

## Shape

The research note names five proposed primitives. [@github-context-research]

`SourceAdapter` receives or fetches source-system objects and converts them into Almanac-owned source references. GitHub is the first adapter. Slack, Linear, Jira, Sentry, support systems, and local conversations should wait until the GitHub adapter model is stable because they carry stronger privacy and noise risks.

`SourceRef` or `SourceRecord` is one addressable source object inside a run. It can represent a file, commit, pull request, issue, review comment, web page, conversation, or commit range. It should carry stable identity, source kind, target, branch, timestamps, permissions, fingerprint, and enough metadata for listing. Large bodies, diffs, and comment threads should be read through tools rather than stuffed into the prompt by default.

`TriggerRecord` explains why the bundle exists. For GitHub, useful trigger types include `pull_request_opened`, `pull_request_synchronized`, `pull_request_merged`, `issue_labeled`, `issue_closed`, `push`, `schedule`, and `manual`.

`EvidenceBundle` is the manifest passed to an Almanac operation. It should include the repository, branch, Almanac root, trigger, available source refs, provenance metadata, permission scope, and dedupe key. It may include small display metadata such as source titles and changed-file names, but it should not be a final relevance packet.

`SourceTools` are the agent-facing access path. Candidate tools include `list_sources()`, `read_source(source_id)`, `search_sources(query)`, `list_changed_files(source_id)`, `read_diff(source_id)`, `list_linked_sources(source_id)`, and `read_comments(source_id)`. The important contract is that the agent can inspect source material on demand instead of receiving every possible source in the initial prompt.

`SourceAddress` is the user-facing pointer such as `github:pr:123`, `github:issue:456`, or `linear:issue:ENG-22`. It answers what the user asked Almanac to ingest before any source-system lookup happens. [@connector-session]

`IngestConnector` is the source-specific interpreter for a `SourceAddress`. GitHub owns the meaning of a pull-request address, how to infer owner and repository from local git remotes, which PR facts matter, which provenance hint should be offered, and which runtime connector scope is required. [@connector-session]

`SourceBrief` is the operation-facing artifact for source-aware ingest. It is a better name than the earlier `SourcePackage` because the object should not imply a large materialized bundle of source data. Its v1 shape should include connector id, address, kind, canonical URL, prompt brief, provenance hint, and runtime requirement; it should not carry a per-brief tool list. The preferred local command spelling is `almanac ingest github:pr:123`, because the pull request is the source being ingested rather than an option on a public `absorb` command. For `github:pr:123`, the GitHub connector should produce a brief with GitHub PR guidance and PR provenance such as URL, number, target repository, target branch when known, and citation type. Dedupe identity is useful for hosted webhooks and later replay protection, but it was explicitly cut from the local GitHub v1 plan. [@connector-session]

Tool availability is an operation runtime concern derived from the brief connectors. If a run includes `github:pr:123` and `github:issue:456`, Almanac should produce two source briefs but only one enabled GitHub connector for the runtime. If a run includes `github:pr:123` and `linear:issue:ENG-22`, the runtime should enable GitHub and Linear once each. This keeps source identity on the brief while keeping external connector access deduplicated at the operation boundary. [@connector-session]

The Composio-backed runtime should start with toolkit-scoped access rather than a hand-maintained direct-tool list. Composio sessions expose meta tools that let an agent search tools, fetch schemas, manage authentication, and execute selected app tools without loading every app-tool schema into context. Composio also supports direct tool fetching with toolkit filters such as `toolkits: ["github"]` when deterministic preloading is needed. [@composio-tools-and-toolkits] [@composio-typescript-sdk]

Connector authentication now goes through Composio for native Almanac connectors. GitHub is the first supported connector UX: `almanac connect github` creates a Composio connected account, stores only the connected-account id/status and local alias, and requires a Composio API key from the configured environment variable. The implemented command surface accepts `almanac ingest github:pr:123`, `almanac ingest github:issue:11`, GitHub pull-request URLs, GitHub issue URLs, and generic HTTP(S) URLs. Known GitHub URLs resolve into PR or issue source briefs; unknown HTTP(S) URLs resolve into `web.url` sources and are still handed to Absorb as source material. Malformed explicit GitHub source refs still fail early. [@github-source-ref]

The resolver infers the owner and repository from `git remote get-url origin` for shorthand GitHub refs, accepts GitHub HTTPS and SSH remotes, and uses repository identity embedded in GitHub URLs when present. GitHub PR and issue sources require a configured `ACTIVE` Composio GitHub account before producing a small source fact object with kind, raw ref, `owner/repo`, canonical URL, source number, and connector account identity. Setup failures are ordinary `Error` subclasses with actionable fix text for `almanac connect github`. Generic web URL sources do not require the GitHub connector. [@github-source-resolver] [@github-source-tests]

`ingestContext()` renders those source facts into source-specific guidance instead of prefetching PR material into a bundle. The prompt tells Absorb to inspect the source through `almanac source github pr ...` or `almanac source github issue ...`, treat GitHub discussion as evidence rather than final truth, prefer current code and merged diffs for present-tense claims, cite supporting PRs with `sources[type=pr]`, cite supporting issues as web sources, and no-op when the source does not improve durable project memory. [@ingest-command-source-wiring]

The current local boundary deliberately excludes mixed path/source ingest, live source tools, hosted webhook dedupe, source sidecar files, and connector-runtime registration. If any input in an `almanac ingest` invocation is a source ref or URL source, all inputs must be source inputs; mixed local paths and source inputs fail with a clear message. This validates whether source-aware ingest improves the wiki before the product pays for webhooks, hosted workers, connector breadth, prefetch artifacts, live tool sessions, or source dedupe. [@ingest-command-source-wiring] [@connector-session]

This keeps GitHub as a first-class source connector while Composio supplies connector account auth and toolkit-scoped runtime access. GitHub owns source semantics such as pull-request versus issue guidance, provenance type, and repository identity; Composio owns connected accounts and proxy execution. [@connector-session]

The next implementation slice should make the operation-input layer explicit before adding GitHub issues, git ranges, Composio-backed tools, or hosted publishers. The proposed naming is `SourceAddress` for the raw user string, `SourceRef` for parsed stable identity, and `SourceBrief` for resolved operation-facing facts plus provenance hints. A `source-connectors` module should own source-address parsing, GitHub resolution, GitHub prompt guidance, and source-specific errors. Page-source parsing and normalization should stay with the markdown-to-SQLite projection path, while the deterministic legacy-frontmatter rewrite stays under `[[src/wiki/health/]]` because only `health --fix` applies it. [@source-architecture-session]

Hosted GitHub App runs separate the trigger from the source-access path. A GitHub webhook explains why the run exists, while the GitHub App installation token gives the worker access to pull requests, diffs, comments, linked issues, repository contents, branches, and write-back actions allowed by the selected mode. Core GitHub Absorb therefore does not require Composio; Composio is only an optional secondary access runtime when the GitHub source points to non-GitHub systems such as Linear, Slack, Gmail, or Notion. [@hosted-github-connector-session]

The hosted worker should give the agent two surfaces: a repository checkout for code, tests, docs, and the configured Almanac root, and GitHub source tools for PR title and body, files, diffs, commits, issue comments, reviews, review comments, linked issues, and labels. Those tools should be backed by Octokit or direct GitHub REST or GraphQL calls using the GitHub App installation token; the official GitHub MCP server can remain a possible tool transport, but it is not the core hosted connector strategy. [@hosted-github-connector-session]

The older `origin/codex/feat/add-wiki-connectors` branch implemented a different Notion-shaped connector model. `almanac connect notion` stored a Composio connected account globally, and `almanac ingest notion` used Almanac code to call Notion through Composio, normalize pages or search results into a `NormalizedSourceBundle`, write a `.almanac/runs/<run-id>.notion-source.md` artifact for background execution, and pass Notion-specific guidance into Absorb. That branch still treated external material as evidence rather than wiki output, but it pre-fetched document content before the agent ran instead of exposing live Composio tools to the agent. [@notion-connector-branch] [@connector-session]

That distinction matters for GitHub source-aware ingest. Notion page ingest can often be a document-prefetch problem: read the page, render the blocks, and ask Absorb whether project memory changed. A GitHub pull request is more interactive because the useful source may be the PR body, merged diff, review comments, linked issues, commits, labels, or file-at-ref reads. The current GitHub path keeps the agent-driven brief but swaps local `gh` access for `almanac source github ...` backed by Composio. TypeScript resolves the address and setup, while the agent decides which source reads are needed. [@notion-connector-branch] [@connector-session]

`SourceCatalog` is the discovery surface for source refs and source tools. It lets an operation tell the agent that GitHub, Slack, Linear, or another connector is available without forcing all connector data into one filesystem-like source folder.

`Publisher` is the write-back boundary for operation outputs. A publisher can open a GitHub Almanac update PR, post a PR-time review note, leave a source question for a maintainer, or record a no-change result. It should receive the agent's chosen output after source reading and reasoning, not before.

`ReviewNote` is a PR-time output object, not a page edit. Its useful kinds are memory-specific: invariant checks, wiki drift warnings, prior-decision reminders, and linked-issue gaps.

## Connector Architecture

The OpenClaw comparison sharpened the source-connector boundary. Almanac should copy the split between manifest, capability, and runtime implementation instead of hardcoding GitHub, Slack, Linear, or MCP branches into Absorb. A connector manifest should declare cheap static facts such as connector id, source kinds, trigger kinds, auth and setup needs, config schema, source-ref kinds, and provided source tools. Runtime connector code should own fetching, pagination, source-specific authentication, webhook handling, and connector-specific read/list/search tools. [@connector-session]

Core should own the generic capability contract: source connector, source reference, trigger record, evidence bundle, source catalog, and publisher. The agent-facing source access may stay connector-native when the source has rich semantics, such as pull-request reviews, Slack threads, Linear labels, reactions, or side effects. The shared Almanac contract is that sources are declared, permission-aware, discoverable, readable, and citeable after they become page evidence; it is not that every connector must be flattened into one filesystem-like context packet. [@github-context-research] [@connector-session]

MCP is a possible connector transport, not the connector architecture itself. A source connector can be native code, a plugin-style bundle, or an MCP-backed adapter, but Almanac core should still see normalized source refs, trigger records, source tools, and publisher capabilities. That keeps source-specific behavior connector-owned while preserving the project rule that operation judgment belongs in prompts and agent tool use. [@connector-session]

The same boundary applies to Composio. Composio is the chosen first access backend for connector breadth, but it is not the core Almanac source model. The operation layer should receive a `SourceBrief` with GitHub semantics, prompt guidance, metadata, and provenance type, plus a runtime connector set such as `["github"]` when a hosted or Composio-backed path needs live connector access. Core code should not make "Composio source briefs"; it should ask the source layer to resolve `github:pr:123` into a GitHub source brief and an enabled GitHub connector for the operation runtime. [@connector-session]

A Composio-backed runtime still needs Almanac scope. The GitHub connector provides the source meaning that Composio does not: the user asked to ingest this PR, the agent should focus on this repository and source ref, the run is read-oriented, and the PR evidence should be cited through source provenance after wiki edits. If Composio cannot enforce the repository, action, or seed-ref scope itself, the Almanac wrapper has to enforce that before tool calls reach the backend. [@connector-session]

That placement keeps source briefs below lifecycle operations and above provider harness execution. The CLI parses a source ref such as `almanac ingest github:pr:123`; the source layer resolves it through an ingest connector and replaceable runtime backend; Absorb, review-note operations, `ask`, or future Garden flows consume the resolved brief; the harness receives the operation prompt plus runtime connector access needed to run the selected provider. `SourceBrief` should therefore live in a source or connector module rather than inside `operations/absorb.ts`, because Absorb is only the first consumer of source-backed operation input. [@connector-session]

## Operation Outputs

The operation flow is `Trigger -> Operation starts -> Agent reads source tools -> Agent decides -> Agent responds through publisher`. The trigger and evidence bundle start the run, but they do not imply that a wiki edit must happen. [@connector-session]

The agent response can have several shapes:

- `wiki_patch` edits the Almanac root and asks the publisher to open or update an Almanac update PR.
- `review_note` posts a bounded PR-time comment or check when existing project memory changes review behavior.
- `source_question` asks a maintainer to clarify source material that is likely durable but not safely inferable.
- `no_change_summary` records that the agent inspected the source handles and found no durable memory change.
- `publisher_action` asks the publisher to perform a connector-specific side effect such as opening a GitHub pull request, posting a check, or leaving a queued candidate.

This response boundary keeps connector code from becoming a hidden relevance engine. The connector exposes source refs and tools, the operation prompt tells the agent what happened, the agent decides what output is warranted, and the publisher performs the external write. [@connector-session]

## Runtime Boundary

Evidence bundles should not encode whether an operation runs locally, in a GitHub Action, or in hosted cloud infrastructure. The bundle names the source event, source refs, branch, repository, Almanac root, permission scope, and dedupe identity. The operation runtime decides where the repository checkout lives and how the agent may read code. [@connector-session]

Local mode can use the user's existing working tree and GitHub token, so a manual command can run against a pull request, issue, or git range without webhooks or hosted state. GitHub Action mode can use the checked-out repository supplied by the workflow and open an Almanac update PR through the action's token. Hosted mode can allocate a sandbox or worktree, check out the maintained branch, attach GitHub source tools, run the same operation model, and publish through a GitHub App. These are runtime implementations of the same operation contract, not separate product concepts. [@connector-session]

The source connector still owns GitHub-specific reads such as pull request body, diff, review comments, linked issues, commits, labels, and file-at-ref access. The repository checkout gives the agent full codebase and wiki access for the relevant branch. A serious GitHub ingestion run needs both surfaces: source objects explain what happened, and the checkout lets the agent verify code, tests, docs, and existing Almanac pages before deciding whether durable memory changed. [@connector-session]

This boundary postpones a premature `cloud` versus `local` abstraction in the core API. The core concepts are source connector, evidence bundle, operation runtime, per-wiki queue, and publisher. A hosted product can later use Daytona-style sandboxes or another worker substrate, but that choice should sit behind the runtime layer rather than leak into source refs or page provenance. [@connector-session]

## Local Command Boundary

`almanac ingest <paths...>` is the current local command for file and folder input. It resolves concrete filesystem paths, builds a text command context, and runs Absorb with `targetKind: "path"`. That command is still right when the user already has a document, folder, transcript, research note, or export on disk.

The settled local CLI direction is to keep `ingest` as the front-facing command and expand it for addressable sources, for example `almanac ingest github:pr:123`. That form starts from a source address rather than a local path, lets an ingest connector resolve the source against the current repository and credentials, and gives the operation enough source-specific guidance, provenance metadata, and source material for the agent to inspect pull-request metadata, diff, review comments, linked issues, commits, and file-at-ref reads. The value is not the command spelling; the value is that the source type can brief the operation on intent and provenance before the operation runs. [@connector-session]

The local GitHub MVP should therefore not require hosted webhooks or remote sandboxes. It can run in the current working tree, resolve the GitHub owner and repository from local remotes, use the configured Composio GitHub account as the source access path, render source guidance from a small `Source` fact object, and leave wiki edits as ordinary local Git changes. Hosted mode, GitHub Action mode, and Daytona-style sandbox mode should reuse the same source connector and operation contract later rather than creating a separate "cloud Absorb" path. [@connector-session]

MCP can provide the transport for some source tools, but it does not replace the connector model. Almanac still needs normalized source refs, operation briefs, permission boundaries, dedupe identity, source catalogs, and publisher contracts so native connectors, plugin connectors, and MCP-backed connectors all look like operation inputs instead of ad hoc prompt text. [@connector-session]

## GitHub Flow

For pull requests before merge, the GitHub adapter should create source refs for the pull request, proposed diff or commit range, changed files, linked issues, review comments, and target-branch Almanac root. A lightweight review-note operation can then use source and wiki tools to decide whether one updateable Context Card or check would help review. It should not normally open an Almanac update PR because the code is still provisional. [@github-context-research] [@connector-session]

For merged pull requests, the adapter should create source refs for the merged pull request, commits, merged diff, reviews, comments, linked issues, changed files, and current Almanac root on the base branch. Absorb should then run against that branch with source tools available and open an Almanac update PR only when durable project memory changed. The target branch of the Almanac update PR should match the branch that received the merge. [@github-context-research] [@connector-session]

For issue events, the bundle should usually create a candidate source record rather than a direct page edit. A closed issue becomes strong evidence when the agent reads it and finds a linked merged pull request or maintainer rationale such as an intentional `wontfix` decision.

## Contract Boundaries

Evidence bundles should be serialized as run input or run sidecar data, not as page frontmatter. Page frontmatter remains the durable citation layer for claims that land in the wiki. A page created or updated after a bundle-driven run can cite the merged pull request, issue, commit, file, or conversation through `sources:`, but the transient webhook payload, source registry rows, and queue state do not belong in the page. [@github-context-research]

GitHub logic should not be hardcoded inside Absorb prompt construction. A GitHub adapter should register GitHub source refs and expose GitHub source tools, while Absorb receives a provider-neutral run brief and source handles. That keeps future Slack, Linear, Jira, Sentry, and conversation adapters from requiring new Absorb-specific branches.

The connector-tool boundary is settled as `SourceBrief` plus operation-level source access. GitHub remains the ingest connector because GitHub PRs, issues, diffs, reviews, and linked objects need source-specific prompt guidance and provenance. Local v1 satisfies source access by telling the agent to use `almanac source github ...`, which reads through Composio for the selected GitHub account. Absorb receives source briefs and readable source handles; it should not know GitHub internals. Sources must still be addressable, searchable or listable, permission-aware, and readable by the agent without making TypeScript preselect the important material.

`almanac source github pr 123 --comments`, `--diff`, `--reviews`, `--files`, and similar commands are acceptable CLI surface only when they stay source-inspection adapters for agents and local debugging. They should sit over the same GitHub source connector core as any hosted MCP or native tool adapter, not become a separate GitHub client for approving reviews, merging pull requests, labels, or other general GitHub operations. MCP is the cleaner hosted agent surface when it works because it gives structured tool calls and schemas; the CLI remains useful for local runs, tests, GitHub Actions, and agents that can only run shell commands. [@hosted-github-connector-session]

The maintained unit is `(repo, branch, almanac root)`. A pull request merged into `dev` should use `dev`'s Almanac pages and target `dev` with any Almanac update PR. A release branch can carry different project memory from `main`, and preview branches can be rendered or reviewed without becoming durable maintenance targets.

## Related Pages

[[github-native-wiki-maintenance]] describes the hosted product loop that turns GitHub events into Context Cards, queued work, and Almanac update PRs. [[source-provenance]] describes the page-level evidence model that records why completed wiki claims are believable. [[almanac-product-family]] places source adapters, records, triggers, runs, pages, topics, and operations inside the generalized Almanac object model.
