---
title: Customer Segmentation
summary: Customer segmentation defines the first CodeAlmanac customer groups by their project-memory pain, source locations, query moments, and product fit.
topics: [product-positioning]
sources:
  - id: segmentation-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/31/rollout-2026-05-31T23-31-46-019e8173-bc02-7503-a102-e9de99d6bb9c.jsonl
    note: Records the customer segmentation discussion that ranked AI-forward tiny teams, OSS maintainers, and AI-heavy startup engineering teams as the best initial customer groups.
status: active
verified: 2026-06-01
---

# Customer Segmentation

CodeAlmanac's first customer is not "companies with docs." The strongest customer definition is teams whose code changes faster than their shared understanding, especially when AI agents are producing, reviewing, or explaining more code. The durable product problem is just-in-time project understanding, not storage. [@segmentation-session]

The segmentation ranks three groups ahead of broader enterprise knowledge markets: AI-forward tiny teams, OSS maintainers, and AI-heavy startup engineering teams. Each has recurring project-memory pain, a clear repository-adjacent source trail, and an action moment where a small cited memory packet can change work before it becomes expensive. [@segmentation-session]

## Best Initial Customers

**AI-forward tiny teams** are usually one to ten engineers, often founder-led, using Codex, Claude Code, Cursor, or similar agents heavily. Their problem is context loss: decisions, setup details, architectural constraints, current conventions, and failed approaches vanish into AI chats, Git history, PRs, Slack, texts, issues, and founder memory. They need the memory at agent task start, during PR review, when resuming yesterday's work, when onboarding a contractor or early hire, and when debugging something previously solved. This is the strongest repo-owned agent-memory fit because adoption can start locally and the pain is immediate. [@segmentation-session]

**OSS maintainers** own public repositories with recurring contributor questions. Their problem is repetition: contributors and agents miss architecture boundaries, contribution rules, maintainer preferences, roadmap exclusions, release rules, accepted patterns, and known traps. The evidence lives in issues, pull requests, discussions, README and CONTRIBUTING files, release notes, maintainer comments, code comments, and commit history. The product wedge is [[open-source-almanac|Almanac OSS]]: PR and issue Context Cards, `/almanac note`, and Almanac update PRs that preserve a maintainer explanation after it appears. [@segmentation-session]

**AI-heavy startup engineering teams** are roughly 10 to 50 engineers, especially fast-growing teams that are scaling past oral tradition. Their problem is fragmentation: architecture rationale, ownership, team conventions, cross-service workflows, production gotchas, incident lessons, deployment context, and recent decisions split across GitHub, Linear or Jira, Slack, Notion or Google Docs, incident docs, AI transcripts, and senior engineer memory. They need memory during PR review, agent kickoff, onboarding, incidents, planning, cross-team feature work, and unfamiliar-system debugging. This is the best paid path through [[github-native-wiki-maintenance|Almanac Teams]], but it requires connectors and governance sooner than the tiny-team path. [@segmentation-session]

## Later Segments

**Platform, infra, and internal-tools teams** have strong hidden-context pain because their systems affect many product teams. Their information needs include runbooks, internal API behavior, migration rules, service boundaries, operational constraints, security constraints, known failure modes, and incident history. They care more about provenance, correctness, and workflow fit than novelty, so they are a strong later segment after the repo-memory loop proves useful. [@segmentation-session]

**Agencies, consultants, and fractional engineers** repeatedly enter unfamiliar client codebases and pay for ramp time. They need setup, architecture maps, deployment flow, decisions, brittle areas, conventions, and prior work history. The fit is plausible for "generate project memory from repo plus PR history," but many agencies do not own the repo long enough to maintain the wiki as a durable project artifact. [@segmentation-session]

**Large engineering organizations** and **regulated engineering teams** have real value potential but are poor first markets. Large organizations need permissions, governance, provenance, cross-team dependencies, approved patterns, and auditability more than a local wiki. Regulated teams need approved decisions, security constraints, compliance rationale, change approvals, audit evidence, incident remediation, and risk exceptions. Those needs support Almanac Enterprise later, but they pull the product toward SSO, RBAC, audit logs, retention controls, self-hosting, and data governance before the core loop is validated. [@segmentation-session]

## Product Implication

The MVP should optimize for surfacing the right memory at the point of work rather than for browsing a beautiful wiki. The highest-value query moments are agent session start, PR open or review, issue triage, onboarding, incident debugging, and planning or refactor work. [[just-in-time-context-surfacing]] is therefore the activation mechanism, while [[almanac-product-family]] and [[github-native-wiki-maintenance]] define how the local, OSS, team, and enterprise products package the same project-memory primitive.
