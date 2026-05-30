# GitHub Context Connectors And Memory-Aware Review Research

This note researches how CodeAlmanac should ingest GitHub pull requests, issues, and future context sources while keeping the repo-owned wiki as the canonical memory artifact.

## Question

CodeAlmanac can use GitHub events in two different ways:

1. PR-time review assistance: leave comments or checks that help reviewers evaluate the change.
2. Post-merge memory maintenance: open a wiki-maintenance PR when durable project knowledge changed.

The design question is how to make both behaviors generalizable without turning GitHub, issues, Slack, Linear, or provider conversations into one-off pipelines.

## Current CodeAlmanac Shape

The current codebase already has several useful primitives:

- `AgentRunSpec` in `src/harness/types.ts` describes an executable AI run with provider selection, prompt, tool access, metadata, and provider session persistence.
- `OperationKind` is currently `build`, `absorb`, or `garden`.
- `runOperationProcess()` in `src/operations/run.ts` creates the common run lifecycle and sets maintenance sessions to ephemeral provider history.
- `runAbsorbOperation()` accepts a plain `context` string and passes it into the Absorb prompt.
- The process manager owns queued, running, done, failed, and cancelled run records under `.almanac/runs/`.
- Page-level `sources:` frontmatter is parsed by `src/indexer/frontmatter.ts` and normalized by `src/indexer/page-sources.ts`.
- Supported page source types are `file`, `web`, `commit`, `pr`, `conversation`, `wiki`, and `manual`.

That shape is enough for an agent to cite a pull request after it has written a page. It is not yet enough to model GitHub PRs/issues as first-class input records before an agent run.

## Source System Assessment

The current `sources:` system is a page-provenance system, not an ingestion-source system.

That distinction matters:

- Page provenance answers: "What evidence supports this claim in this wiki page?"
- Ingestion provenance answers: "What external object caused this run, what evidence was available, what branch did it apply to, and what has already been processed?"

The page source system is partially generalizable because it already supports `pr`, `commit`, `conversation`, `web`, and `file`. It can represent a merged PR as a citation target. It cannot yet represent GitHub issues, review comments, webhook deliveries, source adapter state, branch-scoped evidence bundles, or dedupe fingerprints.

The missing layer should not be added by bloating page frontmatter. Page frontmatter should stay the durable citation layer. A separate source-adapter layer should normalize GitHub and future connectors into evidence bundles that Absorb, Garden, and PR-time review agents can consume.

## Competitor Research

### CodeRabbit

CodeRabbit positions its knowledge base as context beyond the diff. Its docs list learnings, code guidelines, multi-repo analysis, MCP servers, web search, linked issues, and past pull requests as review context sources. It has configurable `knowledge_base.issues`, `knowledge_base.jira`, `knowledge_base.linear`, and `knowledge_base.pull_requests` fields, with scopes such as local/global/auto. CodeRabbit also documents an opt-out path for knowledge-base features that require retained data.

CodeRabbit's PR walkthrough is a structured PR-level comment. It can include changed-file summaries, sequence diagrams, review-effort estimates, related issues, linked-issue assessment, related PRs, suggested labels, suggested reviewers, custom reviewer rules, and status messages.

The useful lesson is not "copy CodeRabbit reviews." The useful lesson is that context sources need explicit configuration and each output section needs a noise budget. Related issues, related PRs, and linked-issue assessment are useful when they are structured, optional, and scoped.

Sources:

- https://docs.coderabbit.ai/knowledge-base
- https://docs.coderabbit.ai/pr-reviews/walkthroughs
- https://docs.coderabbit.ai/reference/configuration/

### Greptile

Greptile emphasizes automatic PR review with full codebase context. Its docs say it builds a graph of the repository and reviews pull requests using that graph. Greptile also has custom context: rules, style guides, documentation files, and free-form repository context. Its `.greptile/` folder model supports nested configuration, where a PR touching different directories receives the config that applies to each file path. It also exposes output settings such as status checks, summary-only mode, and review update behavior.

The useful lesson is that review context should be scoped by file path and directory. A monorepo cannot have one global context blob. Almanac's existing file-reference index gives us a natural way to retrieve branch-specific pages for changed files, but future connector config should also support source scope and output policy per path.

Sources:

- https://www.greptile.com/docs/introduction
- https://www.greptile.com/docs/code-review-bot/custom-context
- https://www.greptile.com/docs/code-review/greptile-config
- https://www.greptile.com/docs/code-review/greptile-config-reference
- https://www.greptile.com/docs/code-review-bot/greptile-json

## Product Boundary

Almanac should not become another generic code-review bot. Its defensible lane is memory-aware review and reviewed memory maintenance.

PR-time output should be limited to claims grounded in existing repo memory or explicit external evidence:

- invariant checks from existing Almanac pages
- wiki drift warnings when changed files are cited by current pages
- prior rejected approaches that look relevant to the diff
- linked issue assessment when the PR claims to close an issue
- source-quality warnings when the PR references missing or ambiguous rationale

Post-merge output should be a normal wiki-maintenance PR:

- base branch equals the merged PR's target branch
- changed files are under the configured wiki root
- source entries cite the merged PR, commits, files, and linked issues where relevant
- maintainers merge or reject the memory PR through normal GitHub review

## Open Source And Hosted Code Boundary

The code should be split by responsibility, not by "cloud" versus "local" too early.

Recommended open-source core:

- wiki parser, indexer, source provenance, file-reference search
- operation specs and provider harness
- source adapter interfaces
- GitHub evidence bundle construction for local/GitHub Action use
- Absorb/Garden prompts that consume structured source bundles
- source-aware `ingest` command paths such as `almanac ingest --source github:pr:123` or `almanac ingest --source git:range:HEAD~1..HEAD`

Potential hosted-only code:

- billing, tenancy, org installation settings
- webhook receiver deployment
- worker orchestration at scale
- hosted queue/dashboard
- hosted viewer/search cache
- private-repo auth storage and audit logs

The public trust boundary is stronger if the same engine that creates wiki PRs is open source. The hosted product can still be commercial by selling compute, private-repo automation, dashboards, retention controls, SSO, and managed GitHub App setup.

## Amendment: Source Access, Not Preselected Context

The later connector-design discussion corrected the first-pass "EvidenceBundle" framing. The bundle should not be a deterministic relevance packet where TypeScript decides which pages, comments, or issues matter before the agent runs. That violates CodeAlmanac's design rule that judgment belongs in prompts and agent tool use.

The better boundary is:

```text
trigger arrives
  -> connector records source refs
  -> operation receives a small run brief plus source handles
  -> agent uses source and wiki tools to inspect what matters
  -> agent writes review notes or wiki changes
```

Deterministic code may check branch enablement, duplicate webhook delivery, bot/self-origin, permissions, queue ownership, rate limits, and source size. It should not decide that an issue is important, that a review comment is the decision, that specific wiki pages are the only relevant pages, or that a pull request cannot affect durable memory.

This means `EvidenceBundle` below should be read as a source manifest. Large source bodies, diffs, comments, and linked records should be accessible through tools such as `list_sources`, `read_source`, `read_diff`, `read_comments`, and `list_linked_sources`, or through equivalent connector-specific tools. Whether these tools should be normalized across all connectors, exposed per connector, or mounted as a folder-like source filesystem remains unsettled.

## Composio And OpenClaw Connector Lesson

Composio's current model is closer to connector-native tools than to a normalized source folder. A Composio session is scoped to one user, connected accounts, enabled toolkits, auth state, execution logs, and workbench state. The agent can search the tool catalog, fetch tool schemas, execute up to 50 tools, manage OAuth/API-key connections, and use a remote workbench or bash sandbox for larger results. Toolkits can be limited at session creation, individual tools can be enabled or disabled, and behavior tags such as `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` can filter the available tool surface. Composio triggers can deliver app events to a webhook, with GitHub-style events represented as trigger payloads rather than as files.

That is a good fit for Almanac's connector layer if we treat Composio as a connector runtime, not as the core Almanac abstraction. The source layer can expose connector-native read tools to the agent while still requiring the final wiki output to cite normalized page sources. A GitHub connector can offer GitHub-shaped operations such as read pull request, read diff, list review comments, list linked issues, and open pull request. A future Slack connector can offer thread-shaped operations. A future Linear connector can offer issue-shaped operations. The shared Almanac contract is not that every connector must look like a file tree; it is that every connector must declare source refs, tool permissions, trigger identity, and citation targets that can become page `sources:`.

OpenClaw reinforces this direction. Its Tool Search surface lets agents search, describe, and call a large catalog of OpenClaw, plugin, MCP, and client tools without loading every schema into the model up front. Tool descriptors carry owners and executors (`core`, `plugin`, `channel`, `mcp`), availability gates, schemas, annotations, and policy-managed execution. Plugin manifests declare tool contracts so runtime ownership is discoverable without eagerly loading all plugin code. OpenClaw's docs and `AGENTS.md` also emphasize owner boundaries: plugins own optional integrations, core owns generic seams, and policy/approval still applies at tool-call time.

For Almanac, the comparable shape is a source-tool catalog:

```text
source_search(query)
source_describe(sourceOrToolId)
source_call(toolId, args)
```

or a provider-native variant:

```text
github.search_sources(...)
github.read_pull_request(...)
github.read_diff(...)
github.list_review_comments(...)
github.open_wiki_pull_request(...)
```

The Composio/OpenClaw lesson argues against forcing all connectors into one folder abstraction too early. Folder materialization is still useful for run audit, replay, and very large source snapshots, but the agent-facing source access should be allowed to stay connector-native when the source has rich semantics such as pull request reviews, Slack threads, Linear status, labels, reactions, and side effects.

Sources:

- https://docs.composio.dev/docs/how-composio-works
- https://docs.composio.dev/docs/tools-and-toolkits
- https://docs.composio.dev/docs/toolkits/enable-and-disable-toolkits
- https://docs.composio.dev/docs/triggers
- https://github.com/ComposioHQ/openclaw-composio-plugin
- `/Users/rohan/Desktop/Projects/openclaw/docs/tools/tool-search.md`
- `/Users/rohan/Desktop/Projects/openclaw/docs/plugins/tool-plugins.md`
- `/Users/rohan/Desktop/Projects/openclaw/src/tools/types.ts`
- `/Users/rohan/Desktop/Projects/openclaw/AGENTS.md`

## Proposed Abstractions

### Source Adapter

A source adapter registers external evidence and exposes it through provider-neutral source handles. GitHub is the first adapter. Slack and Linear can come later without changing Absorb.

```ts
interface SourceAdapter {
  id: string;
  register(input: SourceRegistrationRequest): Promise<SourceManifest>;
}
```

Examples:

- `github.pull_request`
- `github.issue`
- `git.range`
- `local.conversation`
- `slack.thread` later
- `linear.issue` later

### Source Record

A source record is one addressable external object available to an operation.

```ts
interface SourceRecord {
  id: string;
  type: "file" | "commit" | "pr" | "issue" | "review_comment" | "web" | "conversation";
  target: string;
  title?: string;
  branch?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  preview?: string;
  metadata?: Record<string, unknown>;
}
```

This is not page frontmatter. It is run input and source-access metadata. Large bodies, diffs, comments, and linked records should be read through tools instead of copied into the initial prompt.

### Evidence Bundle

An evidence bundle is the source manifest passed to an AI operation.

```ts
interface EvidenceBundle {
  repo: string;
  branch: string;
  wikiRoot: string;
  trigger: TriggerRecord;
  records: SourceRecord[];
  changedFiles?: string[];
  dedupeKey: string;
}
```

Absorb should receive this as a manifest of available sources, not as a relevance packet or complete prompt context blob. PR-time review can use the same source handles to produce notes.

### Trigger Record

A trigger is the reason a source bundle exists.

```ts
interface TriggerRecord {
  type:
    | "pull_request_opened"
    | "pull_request_synchronized"
    | "pull_request_merged"
    | "issue_labeled"
    | "issue_closed"
    | "push"
    | "schedule"
    | "manual";
  provider: "github";
  externalId: string;
  branch: string;
  receivedAt: string;
}
```

The queue should store operation runs, but the source layer should store trigger/evidence identity so duplicate webhook deliveries and branch merges can be deduped.

### Source Tools

Source tools are the read path an agent uses after receiving a source manifest.

```ts
interface SourceTools {
  listSources(): Promise<SourceRecord[]>;
  readSource(sourceId: string): Promise<SourceContent>;
  searchSources(query: string): Promise<SourceRecord[]>;
  listChangedFiles(sourceId: string): Promise<string[]>;
  readDiff(sourceId: string): Promise<DiffContent>;
  listLinkedSources(sourceId: string): Promise<SourceRecord[]>;
  readComments(sourceId: string): Promise<CommentThread[]>;
}
```

The open design question is whether these are common tools across all connectors, connector-native tools such as `github.read_pr`, or a folder-like source filesystem. The settled requirement is that the agent can inspect source material on demand instead of TypeScript deciding which issue, comment, or page matters before the run.

### Review Note

PR-time review output should be its own type, not a page edit.

```ts
interface ReviewNote {
  kind: "invariant_check" | "wiki_drift" | "prior_decision" | "linked_issue_gap";
  severity: "info" | "warning";
  message: string;
  sources: Array<{ type: string; target: string; title?: string }>;
}
```

That keeps PR-time comments separate from post-merge wiki writes.

## Branch Model

The maintained unit is:

```text
(repo, branch, wikiRoot)
```

When a PR targets `dev`, Almanac reads `dev`'s wiki and opens any memory PR back into `dev`. When `dev` later merges into `main`, Git carries the wiki changes forward naturally. If the wiki update did not land before the branch merge, dedupe by source PR number, merge commit SHA, changed-file fingerprint, and existing page `sources:` entries.

## Connector Configuration

The first config should be explicit and boring:

```yaml
almanac:
  root: docs/almanac
  maintained_branches:
    - main
    - dev
    - release/*

  context:
    github:
      pull_requests: true
      issues: true
      review_comments: true
      prior_pull_requests: false

  pr_notes:
    enabled: true
    max_notes: 3
    kinds:
      - invariant_check
      - wiki_drift
      - linked_issue_gap

  writes:
    on_pr_merge: true
    on_issue_close: candidate_only
    auto_merge: false
```

Slack, Linear, Jira, Sentry, and support systems should not be added until the source adapter model is stable. They have stronger privacy and noise risks than GitHub repo-local evidence.

## Recommended Flow

### PR Opened Or Updated

1. GitHub webhook arrives.
2. The GitHub adapter registers source handles for the pull request, proposed diff or commit range, target branch, changed files, linked issues, review comments, and target-branch Almanac root.
3. A lightweight PR-note operation uses source and wiki tools to produce at most a few memory-aware review notes.
4. Almanac posts one updateable comment or check.
5. No wiki PR is opened.

### PR Merged

1. GitHub webhook arrives with `pull_request.closed` and `merged = true`.
2. The GitHub adapter registers source handles for the merged PR, review discussion, linked issues, changed files, merge commit, and target-branch Almanac root.
3. The per-branch/wiki dedupe layer checks whether the source PR or merge commit is already represented in wiki sources or recent run records.
4. Absorb runs through the existing per-wiki single-writer queue.
5. If wiki files changed, Almanac opens a wiki-maintenance PR targeting the same base branch.
6. Maintainers review and merge through normal GitHub rules.

### Issue Closed Or Labeled

Issue events should usually create candidates, not immediate page edits. A closed issue becomes strong input when it is linked to a merged PR or contains a maintainer decision such as "wontfix because..." or "this behavior is intentional because..."

## Is The Current Source System Generalizable?

Answer: yes for page citations, no for connector ingestion.

Keep:

- page-level `sources:` as the canonical evidence field
- `pr` and `commit` page source types
- index projection through `page_sources`
- `file_refs` derivation for file-aware retrieval

Add:

- `issue` page source type
- source adapter interfaces
- source/evidence bundle serialization in run specs or run sidecar files
- dedupe records keyed by source identity
- PR-time review note output separate from wiki writes
- branch-aware wiki root config

Avoid:

- putting webhook payloads directly in page frontmatter
- making Slack/Linear first-class before GitHub PR/issue ingestion is stable
- hardcoding GitHub logic inside Absorb prompt construction
- making cloud database memory canonical
- noisy generic code review comments

## Strategic Difference From CodeRabbit And Greptile

CodeRabbit and Greptile use context to improve PR review. Almanac should use review and issue context to improve repo memory, then use that memory to improve future reviews.

That creates a loop:

```text
repo memory -> memory-aware review notes -> maintainer discussion -> merged PR -> memory PR -> repo memory
```

The canonical artifact remains reviewed markdown in Git. Hosted state exists to coordinate the loop, not to replace it.
