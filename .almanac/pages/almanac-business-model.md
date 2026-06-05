---
title: Almanac Business Model
summary: Almanac should keep the local repo-owned memory core open while charging for hosted coordination, governance, and cross-system workflow.
topics: [product-positioning, decisions]
sources:
  - id: business-model-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/31/rollout-2026-05-31T23-31-46-019e8173-bc02-7503-a102-e9de99d6bb9c.jsonl
    note: User asked whether CodeAlmanac should become closed-source or follow hosted open-source norms, then why open source builds trust; the answer settled on open local core plus paid hosted coordination and framed open source as trust architecture rather than the value proposition.
status: active
verified: 2026-06-01
---

# Almanac Business Model

Almanac's business model should keep the local, repo-owned memory layer open and free while charging for the hosted coordination that teams do not want to operate themselves. The strategic reason is that inspectable, editable, versioned project memory is the trust advantage; closing the core would weaken the reason developers and maintainers believe the system is safe to use on their repositories. [@business-model-session]

## Open Core Boundary

The open layer is the trusted substrate. It should include the local CLI, the `.almanac/` or configured Almanac root format, local search and indexing, individual capture or absorb flows, and enough prompt behavior for developers to understand how maintained memory is produced. The local product should make clear that project memory remains inspectable markdown, reviewable through Git, and usable without a hosted canonical data plane. [@business-model-session]

The paid layer is not merely "we host your wiki." That framing fits products where the open-source code is a server a company can run for the customer, but Almanac's source of truth should remain the repository. The hosted product should sell automation and governance around repo-owned memory: auth, connectors, GitHub checks, scheduled capture, Almanac update PRs, review queues, policy controls, provenance, permissions, Slack and Linear or Jira sync, dashboards, audit logs, hosted agent context, and enterprise deployment controls. [@business-model-session]

## Product Packages

Almanac OSS should be genuinely free for public repositories because the strategic goal is making maintained project memory a normal repository convention. [[open-source-almanac]] defines that wedge as maintainer-attention infrastructure: cited context cards, `/almanac note`, and Almanac update PRs that reduce repeated maintainer explanations without making hidden hosted memory canonical.

Almanac Teams should sell the private-repository workflow. The buyer pays for private GitHub integration, connector orchestration, team review queues, permissions, org memory policies, hosted job history, and context delivery into the tools where engineers and agents already work.

Almanac Enterprise should add procurement and control features rather than a different knowledge model. The enterprise package belongs around SSO, RBAC, audit logs, retention policies, private model routing, self-hosting or VPC deployment, cross-repo confidential context, and compliance exports.

## Licensing Posture

The current product posture is to keep CodeAlmanac open-source at the local developer layer and avoid open-sourcing the hosted application before the hosted workflow is validated. Permissive licensing maximizes adoption and trust but increases clone risk. AGPL adds protection against hosted forks but can reduce adoption inside companies. Source-available licensing gives more control but weakens open-source legitimacy. The project should not over-optimize licensing before it proves that hosted coordination is the paid job. [@business-model-session]

## Trust Architecture

Open source is not the value proposition. The value proposition is less repeated context loss across code, issues, pull requests, documents, and agents. Open source matters when the user's fear is control, inspectability, portability, or lock-in: what the CLI does with a repository, whether capture invents unsupported memory, whether `.almanac/` remains usable after cancellation, whether memory is trapped in hidden RAG infrastructure, and whether agents can rely on deterministic local context instead of an opaque answer endpoint. [@business-model-session]

For CodeAlmanac, trust comes from the combination of open tooling and reviewable artifacts. Technical users can inspect local indexing, prompts, capture behavior, and file writes, while the maintained memory remains source-linked Markdown in the repository. Enterprise buyers will still need SOC2, SSO, audit logs, data controls, and reliability evidence, so open source should be described as the trust architecture rather than a substitute for product quality or hosted security. [@business-model-session]

## Positioning Rule

The short rule is: give away the thing that makes developers trust the system, charge for the thing organizations do not want to operate themselves. This keeps [[almanac-product-family|Almanac]] aligned with its trust boundary: originals and maintained memory stay inspectable, while the managed service handles cross-system freshness, review, policy, and delivery.

## Related Pages

[[almanac-product-family]] explains the local, OSS, team, enterprise, personal, company, project, and research product scopes. [[github-native-wiki-maintenance]] explains the GitHub App and Almanac update PR loop that the paid team product should extend. [[company-brain]] explains why hosted broad-memory platforms are useful market context but not the canonical trust model for repo-owned project memory.
