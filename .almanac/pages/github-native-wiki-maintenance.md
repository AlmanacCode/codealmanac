---
title: GitHub-Native Wiki Maintenance
summary: GitHub-native wiki maintenance is the remote CodeAlmanac product thesis where hosted automation surfaces and updates repo-owned Almanac memory through normal GitHub workflows.
topics: [product-positioning, competitive-research, wiki-design]
sources:
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-24-15-019e70e7-1dc0-7e30-a996-f47b766b4ee6.jsonl
  - docs/research/2026-05-28-open-source-codebase-wiki-and-review-tools.md
  - docs/research/2026-05-29-github-context-connectors.md
  - docs/strategy/2026-05-28-remote-codealmanac-product-concept.md
  - docs/strategy/2026-05-29-open-source-almanac-concept.md
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-27-05-019e70e9-b7d7-7900-9fc0-da2a6f0b532d.jsonl
  - https://docs.coderabbit.ai/platforms/github-com
  - https://docs.coderabbit.ai/knowledge-base
  - https://www.greptile.com/docs/introduction
  - https://www.greptile.com/docs/how-greptile-works/graph-based-codebase-context
  - https://supermemory.ai/docs/concepts/how-it-works
  - https://docs.github.com/en/webhooks/webhook-events-and-payloads
  - https://docs.github.com/en/rest/pulls/pulls
  - https://docs.github.com/en/rest/repos/contents
  - https://www.mintlify.com/docs/organize/settings
  - https://www.mintlify.com/docs/deploy/github
  - https://www.mintlify.com/docs/deploy/preview-deployments
status: active
verified: 2026-05-29
---

# GitHub-Native Wiki Maintenance

GitHub-native wiki maintenance is the remote CodeAlmanac product direction that keeps the repository as the canonical memory artifact while using hosted infrastructure for GitHub event handling, indexing, checks, comments, scheduled maintenance, and wiki-update pull requests. The durable product boundary is that the hosted service can compute, cache, search, and propose, but durable project memory lands as reviewed markdown changes in the repository.

The 2026-05-28 remote-product research session clarified the distinction from hosted memory products. A remote CodeAlmanac should not be a hosted replacement for repo-owned Almanac pages, because that would weaken the branch, review, provenance, blame, rollback, and local-agent trust boundary that makes CodeAlmanac different from broad memory layers such as [[codex-supermemory]] and company-brain products discussed in [[company-brain]].

The same session tested and rejected a required `ALMANAC.md` file or top-level `almanac/` directory. Those options add a new repo-root concept, compete with existing docs surfaces, and make adoption feel more invasive for maintainers. The later directory discussion made `docs/almanac/` the preferred public/team knowledge root because it reads as project documentation without adding a branded root directory. `.almanac/` remains the quiet local/private profile. The durable rule is that the Almanac root contains reviewable project memory only; generated indexes, run history, extracts, caches, and hosted job state should live in user cache directories or hosted coordination storage by default.

## Competitive Lesson

CodeRabbit and Greptile validate GitHub as the workflow surface for AI coding teams. CodeRabbit's GitHub installation requests selected repository access and repository permissions for review-oriented work, and its knowledge base combines team learnings, code guidelines, multi-repo context, MCP servers, web search, linked issues, and past pull requests. Greptile describes itself as an AI code review agent that installs as a GitHub or GitLab app, builds a repository graph, reviews pull requests automatically, posts PR comments, and learns from team reactions and replies over time.

The CodeAlmanac lane is different. CodeRabbit and Greptile use memory to review code; CodeAlmanac should maintain the memory that future agents and reviewers use before changing code. Competing as another general PR reviewer would put CodeAlmanac against products whose core surface is bug-finding, summaries, inline comments, and fix suggestions. Competing as repo-governed project memory keeps the product centered on decisions, invariants, flows, gotchas, architecture views, and source-backed synthesis.

Supermemory illustrates the hosted-memory alternative. Its public docs describe raw documents becoming dynamically connected memories through extraction, chunking, embedding, indexing, update relationships, extension relationships, and derived memories. That model is useful for cross-tool recall, but it is not branch-scoped Git memory. CodeAlmanac should treat hosted memory systems as adjacent infrastructure and possible source adapters, not as the canonical store for codebase knowledge.

## GitHub Shape

A remote CodeAlmanac should be a GitHub App before it is a GitHub Action. GitHub App webhooks give event-driven access to `pull_request`, `pull_request_review`, `pull_request_review_comment`, `issue_comment`, `push`, and related events, and GitHub's docs require at least read-level pull request permission for pull request webhook subscriptions.

The permission model should have tiers:

- **Read mode** reads `.almanac/`, repository contents, pull request diffs, issues, and metadata so it can surface relevant pages and detect missing context.
- **Comment/check mode** adds pull request or check permissions so it can post one compact PR comment or status when wiki context matters.
- **Maintenance mode** adds contents write and pull request write so it can push a branch that edits the repo-owned Almanac directory and open a normal wiki-maintenance PR.

GitHub's REST docs make this boundary concrete. Reading repository contents requires `Contents: read`, creating or updating file contents requires `Contents: write`, listing pull request files requires `Pull requests: read`, and creating a pull request requires `Pull requests: write`. Those permissions map directly to CodeAlmanac's trust tiers.

## Product Loop

The remote product should make local wiki knowledge available at the moments when teams already review change:

1. On PR open or update, register source handles for the pull request, diff or commit range, review thread, linked issues, changed files, and target-branch Almanac root.
2. Run a small review-note agent with source and wiki tools when the repository has enabled PR-time notes.
3. Post a short "project memory for this PR" comment only when the agent can cite existing memory or explicit source material that changes review behavior.
4. After merge, run Absorb or Garden with source handles for the merged diff, PR discussion, issues, reviews, and branch wiki.
5. Open a separate wiki-maintenance PR when durable knowledge changed.
6. Keep quiet when no useful wiki action exists.

The highest-value checks are not generic code review comments. They are docs-drift checks, invariant conflicts, missing decision or flow updates, stale pages, broken file references, and "this change deserves an Almanac update" signals. That keeps the product aligned with [[just-in-time-context-surfacing]]: a few cited constraints at action time, not broad context injection.

The concrete product name for this loop is Almanac for GitHub. Its durable units are Context Cards, Memory PRs, Decision Capture, and Almanac Queue. Context Cards are compact issue or pull-request comments that cite existing Almanac pages when the page would reduce maintainer repetition or contributor confusion. Memory PRs are ordinary GitHub pull requests that change the repo-owned Almanac after a merge, review discussion, or maintainer decision creates reusable project memory. Decision Capture is the event detector that turns a maintainer statement such as "do not support this flag because it conflicts with workspace-local config" into a proposed page update instead of letting the rationale remain buried in review comments. Almanac Queue is the hosted workflow surface that shows pending capture candidates, Memory PRs that need review, and pages or areas that need an owner.

GitHub ingestion should not copy the local transcript-capture scheduler model. Local capture uses periodic quiet-window sweeps because Claude, Codex, and Cursor do not share one reliable session-end event. GitHub already has explicit lifecycle events, so pull requests, issues, labels, reviews, maintainer comments, releases, and pushes should enqueue source-event records directly. Periodic jobs should be reconciliation and cleanup for missed webhooks, stale pages, and slow Garden work, not the primary way fresh GitHub activity enters the system.

The clean architecture is event-driven enqueue plus per-wiki single-writer execution plus periodic reconciliation. A GitHub event becomes a cheap classified source-event record, then an [[evidence-bundles|evidence bundle]] that names available source handles, then a queued Absorb or Garden job with source tools, then a Memory PR when durable wiki source changes. Issues and pull requests remain evidence; they should not directly become wiki pages. The page should preserve the distilled invariant, decision, flow, or maintenance rule, while the GitHub object becomes a source.

The hosted app should expose product navigation around the work it performs: Overview, Pages, Topics, Files, Issues and PRs, Decisions, Maintainers, Queue, and Settings. Queue is the paid-product surface because it turns memory maintenance from a hidden background job into governed work: "needs capture" items from PRs or issues, "needs review" Memory PRs, and "needs owner" pages whose stewardship is unclear.

## Trigger Policy

The v1 trigger policy should group GitHub events by product intent, not by whether a webhook exists. Pull request activity before merge is a read-heavy context path: `pull_request.opened`, `pull_request.synchronize`, `pull_request.reopened`, and `pull_request.ready_for_review` should read the target branch Almanac, inspect the proposed diff, and optionally post one Context Card or status check. They should not normally open a wiki-update PR because the code is still provisional.

Pull request review events are decision evidence. `pull_request_review.submitted`, `pull_request_review_comment.created`, and `issue_comment.created` on a pull request can record maintainer rationale, repeated explanations, or missing-memory candidates. They should usually create queue evidence rather than immediately edit the wiki, because review threads often change before merge.

The main write trigger is `pull_request.closed` with `merged == true`. That event has a stable base branch, merged diff, discussion, review history, linked issues, and changed files. Almanac should run Absorb for the branch that received the merge and open a Memory PR back to that same branch only when durable project memory changed.

Pushes to maintained branches are reconciliation triggers. They catch direct commits, missed PR webhooks, and branch merges that do not provide enough pull-request context, but they should be conservative and dedupe against existing source identities such as PR number, merge commit SHA, changed file fingerprints, and wiki source entries.

Issue events are candidate triggers. `issues.opened`, `issues.edited`, and `issues.labeled` can surface existing context or create evidence candidates; `issues.closed` can become durable memory when the close reason contains a maintainer decision or when a linked pull request fixed a recurring project pattern. Most issues should not create wiki pages directly because issues are noisy source material rather than maintained synthesis.

Release events are version-memory triggers. `release.published` can update support, upgrade, compatibility, or release-behavior pages when the release changes durable project facts. It should target the release branch or default branch according to the repository's maintained-branch configuration.

Periodic jobs are cleanup and reconciliation, not primary ingestion. Weekly or scheduled work should handle missed webhooks, stale pages, broken references, slow Garden cleanup, queue health, and backlog compaction. GitHub activity already has explicit lifecycle events, so a hosted GitHub product should not depend on time-based polling for fresh pull requests and issues.

## End-to-End GitHub Flow

The exact hosted flow starts with installation, not with a hidden memory database. A maintainer installs the Almanac GitHub App on selected repositories, chooses an Almanac root such as `docs/almanac/` or `.almanac/`, and grants only the permissions needed for the selected mode. The repository remains the canonical store for pages, topics, config, and issue policy; hosted storage keeps webhook deliveries, queue items, source fingerprints, rendered indexes, run logs, billing settings, and other coordination state.

Hosted Absorb needs five runtime inputs after a GitHub trigger: a GitHub App installation token, a repository checkout or sandbox for the target branch, Almanac-controlled agent-provider credentials, an operation brief that names the source event, and queue/run state for dedupe, logs, status, and output publishing. The installation token is the GitHub access path. Composio is not part of the core GitHub path unless the operation also needs a secondary system referenced by the GitHub source.

Human and bot edits converge through Git. A maintainer can edit an Almanac page directly, a contributor can include an Almanac update in a feature pull request, and the Almanac App can open a Memory PR after it detects durable knowledge. All three paths produce ordinary branches and pull requests against the repository's Almanac root. GitHub review, CODEOWNERS, merge rules, blame, rollback, and branch history remain the trust boundary.

For a pull request, the App receives `pull_request` and review events, records a source-event row, registers source handles, and may run a review-note agent with repo and source tools. That PR-time path is read-heavy and should stay quiet unless the agent can cite memory or explicit source material that would change review behavior or reduce maintainer repetition.

After a pull request merges, the App receives the merge or push event, registers source handles for the merged diff, commits, PR body, reviews, comments, linked issues, changed files, and target-branch Almanac root, then enqueues one Absorb run for that repository. The per-wiki single-writer queue is still the execution boundary: hosted workers can process many repositories at once, but only one write-capable Almanac run should edit a given repository's Almanac root at a time.

The worker clones or checks out the repository, runs the Almanac engine against the evidence bundle, and leaves the working tree unchanged when no durable project memory changed. When pages, topics, or policy files change, the worker pushes a branch such as `almanac/update-gateway-auth-memory` and opens a Memory PR. The Memory PR body should cite the GitHub sources that caused the update and summarize the page changes, but the durable output is still markdown in the repo-owned Almanac root.

Once maintainers merge the Memory PR, the target branch contains the updated canonical wiki for that branch. The hosted viewer and connector then reindex from the merged repository state. If maintainers reject or edit the Memory PR, that Git outcome is the source of truth; hosted state should follow the repository instead of preserving a conflicting private memory record.

Periodic jobs are secondary in this flow. They reconcile missed webhooks, find stale pages, check dead references, batch slow Garden work, and surface queue health. They should not be the primary discovery mechanism for GitHub activity because GitHub already emits explicit events for pull requests, issues, comments, labels, releases, and pushes.

The same operation model should also work without the hosted App. In local mode, a maintainer can run an explicit command against a pull request, issue, or git range using the current checkout plus a user GitHub token; in GitHub Action mode, the workflow checkout and action token provide the runtime; in hosted mode, Almanac Cloud uses a sandbox or worktree and GitHub App credentials. The product boundary is not "local engine versus cloud engine." The stable boundary is a source connector plus evidence bundle plus operation runtime plus publisher, with each runtime supplying the repo checkout and credentials differently.

## Branch Scope

There is no branch-independent hosted Almanac for a repository when the wiki is stored in Git. Each maintained branch can carry a different Almanac root because each branch can carry different code, docs, config, and reviewed project memory. Almanac Cloud therefore maintains the wiki on the branch that owns the code state being discussed.

For a merged pull request, the maintenance target is the base branch that received the merge. A pull request merged into `dev` should produce a Memory PR targeting `dev`, not `main`. A hotfix merged into `release/2026.5` should update the `release/2026.5` Almanac root when that branch is configured for maintenance. A later merge from `dev` to `main` can carry the wiki edits through normal Git history or trigger a separate main-branch maintenance run if the resulting main state needs different synthesis.

Hosted configuration should distinguish maintained branches from preview branches. Maintained branches are branch patterns whose Almanac roots the App is allowed to update through Memory PRs. Preview branches can be rendered, searched, or inspected for a pull request without becoming a durable maintenance target. Feature branches may include contributor-authored Almanac changes, but the App should treat those as proposed changes until they merge into a maintained branch.

Mintlify is useful precedent for this branch model, not a content-model template. Its GitHub docs describe a connected repository, branch, and optional subdirectory as the documentation source; its troubleshooting asks users to verify that they are pushing to the configured deployment branch; and its preview-deployment docs say automatic previews are created for pull requests targeting the deployment branch while manual previews can be created for arbitrary branches. Almanac should copy the source-branch and preview distinction: maintained branches get automatic memory maintenance, while other branches can get preview rendering and context.

## Connector Boundary

An Almanac connector is the agent-facing read path for remote CodeAlmanac. It should expose repo wiki knowledge through tools such as `search_almanac(repo, query)`, `show_page(repo, slug)`, `context_for_files(repo, files)`, `context_for_pr(repo, pr_number)`, and `list_topics(repo)`. It should also expose enabled source systems through source-access tools or connector-specific tools, so an agent can inspect a GitHub pull request, issue, comment thread, or commit range on demand instead of receiving a preselected context blob. Those tools let Codex, Claude, Cursor, OpenHands, and custom agents ask what the repo already knows before they edit files.

The connector should not own the self-updating loop. It is read and retrieval infrastructure: agent-queryable wiki pages, file-aware context, branch or repository selection, and links back to the reviewed source pages. The write path still needs GitHub events through an Action, App, cron job, or webhook worker that runs Absorb and opens a normal wiki-maintenance PR.

The compact architecture is one repo-owned wiki with two product edges: a connector for agent queries and a GitHub Action or App for PR-maintained updates. The product sentence is: Almanac is a connector-readable wiki and source-access layer for repositories, kept current by GitHub pull requests.

## MVP Validation

The 2026-05-29 MVP discussion narrowed the first product test to a GitHub-backed, agent-queryable wiki that updates itself through pull requests. The smallest useful loop is not Scout, queue triage, maintainer routing, billing, comments, or a hosted dashboard. It is a repo with an Almanac root, agents that can query it, and a post-merge job that opens a reviewed wiki-update PR when durable project memory changed.

The implementation should start inside this repository because CodeAlmanac already has search, show, topics, capture, [[ingest-operation]], Absorb, and page-writing concepts. A narrow source-aware `ingest` path can read a merged diff, pull request, or issue through connector-provided tools, ask whether durable memory changed, edit pages when needed, and print the files changed. A GitHub Action can run that path on pushes to the default branch and use `peter-evans/create-pull-request` or an equivalent step to open the wiki-maintenance PR.

OpenClaw or another active public repository can still be a testbed, but only through a fork or read-only experiment. The success criterion is simple: a code PR merges, the Action runs, Almanac updates or creates a page, a PR opens, and a human says the memory update is useful. If that loop works, Scout, queue views, context comments, maintainer routing, and a hosted App become workflow layers rather than the core product proof.

OpenClaw is useful as a scale example because a high-activity public repository already has issue and pull-request automation for readiness, proof quality, merge risk, and maintainer status. Almanac's missing value there would not be another blanket triage bot. The useful loop is maintainer repetition reduction, decision capture, PR-time context from existing pages, post-merge Memory PRs, and strict silence unless cited repo memory or a high-confidence missing-memory signal exists.

## Canonical State Boundary

The default canonical state should stay in the same repository. The current implementation uses `.almanac/` for reviewed wiki source and local machinery, but the product boundary should be a configurable `almanac root` rather than a hard-coded hidden path. Same-repo ownership gives project memory the same branch, review, merge history, CODEOWNERS, blame, rollback, and access boundary as the code it describes.

The root choice is an adoption profile. `docs/almanac/` is the preferred public/team default when a repository can carry project memory under `docs/`; it is visible, conventional, and low-clutter. `.almanac/` is the quiet profile for local/private use or for projects whose `docs/` tree is a curated product-docs surface. A top-level `almanac/` has the strongest brand visibility and the highest repo-root clutter cost, so it should remain opt-in.

Generated state should not live inside the public/team Almanac root by default. Local commands can hash the repository identity and store `index.db`, run history, extracts, and caches in platform user-cache locations such as `~/Library/Caches/almanac/<repo-id>/`, `~/.cache/almanac/<repo-id>/`, or `%LOCALAPPDATA%/Almanac/<repo-id>/`. Hosted state should be cache and coordination state: indexed Almanac pages, source provenance, embeddings if later needed, webhook deliveries, run history, stale-page findings, source extracts, and pending maintenance jobs. Hosted state can make the experience fast and team-friendly, but correctness should not depend on an opaque memory record that cannot be reviewed with the code.

Separate storage is an escape hatch, not the default. It fits multi-repo architecture memory, company-wide policy pages, regulated deployments that need a separate repository, private source caches, or an org-wide Almanac that intentionally spans repositories. Even then, the durable page artifact should still be Git-backed markdown somewhere.

## Hosted Browsing Boundary

The 2026-05-28 follow-up clarified that the canonical wiki root does not have to be the primary human reading surface. The repo path and the reading surface should be separate: pages under the configured Almanac root are the reviewed source of truth, the CLI, connector, GitHub App, and raw markdown are agent and automation surfaces, and a hosted site such as `almanac.dev/{owner}/{repo}` should be the human wiki surface for public repos and teams.

The hosted viewer is not a replacement store. Its job is to render the repo-owned graph with search, topics, backlinks, related files, PR and issue provenance, stale-page status, maintainer ownership, changed-since views, and agent-ready context packs. GitHub can render a markdown file, but it cannot make an Almanac page behave like a navigable project-memory object with file references, source provenance, graph context, and drift state.

This boundary also separates Almanac from public product docs. README files, tutorials, API references, changelogs, and user documentation explain how to use a project. Almanac pages explain how the project thinks, changes, and gets maintained: architecture decisions, rejected approaches, subsystem owners, issue triage rules, compatibility constraints, review expectations, and known maintenance traps. The product promise is "reviewed in Git, browsed on Almanac, used by agents everywhere," not "replace the docs folder."

Mintlify is the closest product-pattern precedent for this storage and rendering split. Its docs describe `docs.json` as the central site configuration for a documentation project, use a GitHub App to sync documentation from a connected repository, automatically deploy when changes land on the connected branch, and create pull-request preview URLs so reviewers can inspect rendered docs before merge. Mintlify's source root is intentionally visible because it is a docs source tree: `docs.json` and MDX pages can live at the repository root, under a `docs/` directory, or in a dedicated docs repository. Almanac should copy the Git-backed source plus hosted rendering pattern, not Mintlify's public-docs content model: pages and topics under the configured Almanac root stay the source for code repositories, while the hosted viewer renders project memory with graph navigation, provenance, drift status, and agent context.

## Team Need

The first-principles team need is not remote memory storage. Teams need trusted current project context that answers what was decided, whether it is true on this branch, what evidence supports it, whether an agent will see it before editing, and whether humans can review changes to that memory like code.

That makes the hosted product a governed maintenance layer over project memory:

- PR-time relevant page surfacing for changed files.
- Drift detection when code changes invalidate pages.
- Wiki-maintenance PRs after merges.
- CODEOWNERS-aware or configured maintainer routing for wiki-maintenance PRs and subsystem-specific context.
- Scheduled Garden runs for stale pages, dead file references, unresolved questions, and broken source links.
- Hosted viewer and search for humans who will not browse markdown pages directly.
- MCP or API retrieval that returns cited repo memory packets to agents.
- Multi-repo indexes without hiding canonical pages in a hosted database.

## Buyer And Payment Thesis

Teams will pay for this only when the product saves expensive engineering time or reduces change risk. The pain is strongest when senior engineers repeat the same architectural context in reviews, agents violate hidden invariants, stale docs cause bad implementation choices, onboarding into complex repos is slow, or compliance and process knowledge drifts away from the code.

The strongest buyer is a team using multiple AI coding agents, many junior contributors, external contractors, or a complex long-lived codebase where project-specific context changes review outcomes. In that setting, "project memory maintenance" is a workflow cost and risk product. "AI wiki" or "memory database" is weaker positioning because it sounds like optional storage.

The paid boundary should therefore be private-team governance rather than memory volume. The product name for that tier should be Almanac Teams. The local CLI and public-repo convention can remain free, while paid features cover private repo GitHub App automation, org-wide almanacs, cross-repo context, hosted viewer and search, drift dashboards, SSO, audit logs, retention controls, private model routing, self-hosted or VPC workers, and CODEOWNERS-aware wiki PR routing.

Free open-source use is strategic because it can make `.almanac/` a normal repository convention for agents and contributors. Private teams then pay for the governance, automation, security, and cross-repo scale needed to make the same convention reliable inside a company.

Almanac Teams should be explained through the concrete problem, not a feature list: engineering teams are losing project memory while AI increases the rate of code change. Engineering managers want new engineers and agents to stop interrupting senior people for context. Tech leads want invariants and decisions to be hard to miss before code changes. Platform and DevEx teams want every repo to have current, searchable, reviewable project knowledge. Security and compliance teams want architecture, release, and process knowledge to stay auditable. AI tooling buyers want agents to inherit real project memory rather than grep the repo and guess.

## Open-Source Research Lesson

The 2026-05-28 open-source research pass found direct overlap on both sides of the product. `aictx/memory`, Cline Memory Bank, and similar local memory projects validate repo-owned agent memory but make the local storage pattern easier to commoditize. CodeWiki, DeepWiki-Open, RepoAgent, and docAider validate repo-scale decomposition, generated architecture documentation, diagrams, AST-aware updates, and pull-request-triggered documentation maintenance. PR-Agent, Claude Code Action, OpenReview, and OpenHands validate GitHub comments, checks, webhook jobs, sandboxed workers, agent-triggered reviews, and PR-creating agents as normal engineering surfaces.

That comparison strengthens the GitHub-native thesis rather than weakening it. A remote CodeAlmanac should not be "local wiki plus sync," because local agent memory and generated repo documentation are already becoming legible categories. The unresolved surface is team governance: PR-time context from reviewed memory, drift detection when code invalidates pages, post-merge wiki-maintenance PRs, and a hosted queue that keeps project memory current without making hidden hosted state canonical.

OpenReview is the most relevant implementation pattern from the open-source set. Its GitHub App webhook starts a durable workflow, creates a sandbox, clones the pull request branch, runs an agent, and posts comments or commits back to the branch. A remote CodeAlmanac worker can use the same event-to-job shape, but its output should be wiki context and Almanac maintenance PRs rather than general code-review findings.

The product sentence after the research is: CodeAlmanac keeps the repo's agent wiki true as code changes, with every durable memory update reviewed in GitHub.

## Open-Source Route

[[open-source-almanac]] is the public-repository adoption path for the same GitHub-native maintenance loop. The 2026-05-29 open-source research pass found that maintainers struggle most with attention scarcity, support burden, stale process surfaces, contributor onboarding, and low-quality AI-generated reports or pull requests. That makes free OSS Almanac a maintainer-attention product rather than a hosted wiki giveaway.

The free OSS version should make an Almanac root a public convention for contributors and coding agents without requiring a visible top-level brand directory. It should index public repo docs, issues, pull requests, release notes, and existing Almanac pages; post quiet cited context only when it can reduce maintainer repetition; suggest likely maintainers when ownership is known; and open reviewed maintenance PRs after decisions change project memory. It should not auto-close issues, generate a giant wiki on day one, or make hidden hosted memory canonical for public projects.

The strongest OSS social protocol is: if a contribution was AI-assisted, cite the Almanac pages it used. That turns AI disclosure into a testable context habit and connects public-agent behavior to reviewed project memory.

## Open Questions

The remaining product questions are operational, not category-level. PR-time comments need a noise budget before developers mute them. Post-merge wiki PRs need a batching rule so the system does not create doc churn. Remote Absorb jobs need a minimum evidence bundle before they can edit the repo-owned Almanac. Blocking checks should start as opt-in because false-positive wiki drift can damage trust. Org-level almanacs need a clear boundary between same-repo memory and cross-repo architecture memory.

## Related Pages

[[open-source-almanac]] explains the free public-repo product path for maintainers, contributors, and AI-assisted open-source work. [[company-brain]] places this product direction inside the broader market for agent-readable organizational memory. [[almanac-product-family]] explains why scoped Almanacs should preserve source material separately from maintained wiki synthesis. [[just-in-time-context-surfacing]] explains the local runtime version of the same surfacing principle. [[codex-supermemory]] explains why automatic hosted recall is compelling but should not become CodeAlmanac's canonical project memory.
