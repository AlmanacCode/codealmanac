---
title: GitHub-Native Wiki Maintenance
summary: GitHub-native wiki maintenance is the remote CodeAlmanac product thesis where hosted automation surfaces and updates repo-owned Almanac memory through normal GitHub workflows.
topics: [product-positioning, competitive-research, wiki-design]
sources:
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-24-15-019e70e7-1dc0-7e30-a996-f47b766b4ee6.jsonl
  - docs/research/2026-05-28-open-source-codebase-wiki-and-review-tools.md
  - docs/strategy/2026-05-28-remote-codealmanac-product-concept.md
  - docs/strategy/2026-05-29-open-source-almanac-concept.md
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
  - id: pr-12-hosted-app-smoke
    type: pr
    url: https://github.com/AlmanacCode/codealmanac/pull/12
    note: Records the live same-repository smoke test for the hosted Almanac GitHub App update loop.
status: active
verified: 2026-06-05
---

# GitHub-Native Wiki Maintenance

GitHub-native wiki maintenance is the remote CodeAlmanac product direction that keeps the repository as the canonical memory artifact while using hosted infrastructure for GitHub event handling, indexing, checks, comments, scheduled maintenance, and wiki-update pull requests. The durable product boundary is that the hosted service can compute, cache, search, and propose, but durable project memory lands as reviewed markdown changes in the repository.

The 2026-05-28 remote-product research session clarified the distinction from hosted memory products. A remote CodeAlmanac should not be a hosted replacement for repo-owned Almanac pages, because that would weaken the branch, review, provenance, blame, rollback, and local-agent trust boundary that makes CodeAlmanac different from broad memory layers such as [[codex-supermemory]] and company-brain products discussed in [[company-brain]].

The same session tested and rejected a required `ALMANAC.md` file or top-level `almanac/` directory. Those options add a new repo-root concept, compete with existing docs surfaces, and make adoption feel more invasive for maintainers. The durable directory rule is a configurable wiki root plus a clear local control/state root. Current repos use `.almanac/` for both; a public or docs-friendly profile could choose `docs/almanac/` for pages, topics, and config while keeping `.almanac/` for indexes, runs, extracts, caches, and the local pointer to the wiki root. This is not split brain when `docs/almanac/pages/` is the only page source of truth and `.almanac/` is only machinery.

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

The remote product should make local wiki knowledge unavoidable at the moments when teams already review change:

1. On PR open or update, read the changed files and retrieve relevant Almanac pages through file mentions, topics, links, and FTS.
2. Post a short "project memory for this PR" comment only when high-signal pages exist or a likely wiki drift condition exists.
3. Flag contradictions between the diff and known invariants with citations to wiki pages, not inferred hidden learnings.
4. After merge, run Absorb or Garden against the merged diff, PR discussion, issues, reviews, and affected pages.
5. Open a separate wiki-maintenance PR when durable knowledge changed.
6. Keep quiet when no useful wiki action exists.

The highest-value checks are not generic code review comments. They are docs-drift checks, invariant conflicts, missing decision or flow updates, stale pages, broken file references, and "this change deserves an Almanac update" signals. That keeps the product aligned with [[just-in-time-context-surfacing]]: a few cited constraints at action time, not broad context injection.

The 2026-06-05 hosted GitHub App smoke test narrowed the first production update loop. For v1 live delivery, a same-repository pull request receives one Almanac check, a maintainer approves the update, the hosted worker runs CodeAlmanac against the PR context, and the hosted backend commits only repo-owned Almanac files back to the PR branch [@pr-12-hosted-app-smoke]. Fork follow-up PR delivery is intentionally out of the first loop, and GitHub commits remain a backend responsibility rather than something delegated to local CLI code or a contributor-side agent [@pr-12-hosted-app-smoke].

The same smoke test exposed a GitHub API product constraint: check-action copy must stay within GitHub Check Runs API limits, so the PR-facing status should remain compact and point reviewers toward the wiki diff or hosted view instead of becoming a long report body [@pr-12-hosted-app-smoke].

## Canonical State Boundary

The default canonical state should stay in the same repository. The current implementation uses `.almanac/` for reviewed wiki source and local machinery, but the product boundary should be a configurable `almanac root` rather than a hard-coded hidden path. Same-repo ownership gives project memory the same branch, review, merge history, CODEOWNERS, blame, rollback, and access boundary as the code it describes.

The root choice is an adoption profile. `.almanac/` is least invasive and fits agent and maintainer infrastructure, but it is hidden in GitHub's normal browsing surface. `docs/almanac/` is more human-visible and fits repos that already treat `docs/` as a documentation home, but it can conflict with projects whose docs tree is a curated user-facing product site or static-site source. A top-level `almanac/` has the strongest brand visibility and the highest repo-root clutter cost. The product should support `.almanac/` first while leaving `docs/almanac/` as a configured profile rather than forcing all projects into one social convention.

Hosted state should be cache and coordination state: indexed Almanac pages, source provenance, embeddings if later needed, webhook deliveries, run history, stale-page findings, source extracts, and pending maintenance jobs. Hosted state can make the experience fast and team-friendly, but correctness should not depend on an opaque memory record that cannot be reviewed with the code.

Separate storage is an escape hatch, not the default. It fits multi-repo architecture memory, company-wide policy pages, regulated deployments that need a separate repository, private source caches, or an org-wide Almanac that intentionally spans repositories. Even then, the durable page artifact should still be Git-backed markdown somewhere.

## Hosted Browsing Boundary

The 2026-05-28 follow-up clarified that `.almanac/` being canonical does not mean humans should browse raw markdown trees as the primary product experience. The repo path and the reading surface should be separate: `.almanac/pages/*.md` is the reviewed source of truth, the CLI, MCP, GitHub App, and raw markdown are agent and automation surfaces, and a hosted site such as `almanac.dev/{owner}/{repo}` should be the human wiki surface for public repos and teams.

The hosted viewer is not a replacement store. Its job is to render the repo-owned graph with search, topics, backlinks, related files, PR and issue provenance, stale-page status, maintainer ownership, changed-since views, and agent-ready context packs. GitHub can render a markdown file, but it cannot make an Almanac page behave like a navigable project-memory object with file references, source provenance, graph context, and drift state.

This boundary also separates Almanac from public product docs. README files, tutorials, API references, changelogs, and user documentation explain how to use a project. Almanac pages explain how the project thinks, changes, and gets maintained: architecture decisions, rejected approaches, subsystem owners, issue triage rules, compatibility constraints, review expectations, and known maintenance traps. The product promise is "reviewed in Git, browsed on Almanac, used by agents everywhere," not "replace the docs folder."

Mintlify is the closest product-pattern precedent for this storage and rendering split. Its docs describe `docs.json` as the central site configuration for a documentation project, use a GitHub App to sync documentation from a connected repository, automatically deploy when changes land on the connected branch, and create pull-request preview URLs so reviewers can inspect rendered docs before merge. Mintlify's source root is intentionally visible because it is a docs source tree: `docs.json` and MDX pages can live at the repository root, under a `docs/` directory, or in a dedicated docs repository. Almanac should copy the Git-backed source plus hosted rendering pattern, not Mintlify's public-docs content model: `.almanac/pages/*.md` and `.almanac/topics.yaml` stay the source for code repositories by default, while the hosted viewer renders project memory with graph navigation, provenance, drift status, and agent context.

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

The free OSS version should make `.almanac/` a public convention for contributors and coding agents without requiring a visible root-level docs surface. It should index public repo docs, issues, pull requests, release notes, and existing Almanac pages; post quiet cited context only when it can reduce maintainer repetition; suggest likely maintainers when ownership is known; and open reviewed maintenance PRs after decisions change project memory. It should not auto-close issues, generate a giant wiki on day one, or make hidden hosted memory canonical for public projects.

The strongest OSS social protocol is: if a contribution was AI-assisted, cite the Almanac pages it used. That turns AI disclosure into a testable context habit and connects public-agent behavior to reviewed project memory.

## Open Questions

The remaining product questions are operational, not category-level. PR-time comments need a noise budget before developers mute them. Post-merge wiki PRs need a batching rule so the system does not create doc churn. Remote Absorb jobs need a minimum evidence bundle before they can edit the repo-owned Almanac. Blocking checks should start as opt-in because false-positive wiki drift can damage trust. Org-level almanacs need a clear boundary between same-repo memory and cross-repo architecture memory.

## Related Pages

[[open-source-almanac]] explains the free public-repo product path for maintainers, contributors, and AI-assisted open-source work. [[company-brain]] places this product direction inside the broader market for agent-readable organizational memory. [[almanac-product-family]] explains why scoped Almanacs should preserve source material separately from maintained wiki synthesis. [[just-in-time-context-surfacing]] explains the local runtime version of the same surfacing principle. [[codex-supermemory]] explains why automatic hosted recall is compelling but should not become CodeAlmanac's canonical project memory.
