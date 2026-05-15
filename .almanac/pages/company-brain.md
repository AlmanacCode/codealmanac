---
title: Company Brain
summary: The company-brain category frames CodeAlmanac as a codebase-scoped, local-first memory layer for AI agents rather than a generic search or chatbot product.
topics: [product-positioning]
sources:
  - /tmp/company-brain-research.md
  - /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T02-37-42-019e2a5a-eb3c-7180-89fb-b5591b3c7d24.jsonl
  - https://www.ycombinator.com/rfs?year=2025
  - https://github.com/garrytan/gbrain
  - https://www.ycombinator.com/companies/hyper-4
  - https://www.ycombinator.com/launches/QKg-hyper-the-self-driving-company-brain
status: active
verified: 2026-05-15
---

# Company Brain

A company brain is a structured, current, agent-readable map of how an organization works. The category matters to CodeAlmanac because it names the broader market need behind repo-local project memory: AI agents fail less from weak model capability than from missing domain knowledge, stale context, and unstructured operational history.

CodeAlmanac is the codebase-brain version of this category. It keeps project memory beside the repo in `.almanac/`, stores pages as markdown, indexes them through [[sqlite-indexer]], and makes future agents read relevant pages before touching related code through [[agents-md]] and [[global-agent-instructions]]. The product claim should therefore be narrower than "company brain for everything" and stronger than "docs for agents": CodeAlmanac captures the expert understanding produced during software work and makes it reusable for later coding agents.

## Category Definition

Y Combinator's Summer 2026 RFS made "Company Brain" an explicit startup category. Tom Blomfield framed it as the missing layer between raw company data and reliable AI automation: a system that pulls fragmented knowledge from email, Slack, tickets, databases, docs, and people's heads, structures it, keeps it current, and turns it into an executable skills file for AI.

The RFS draws a boundary that is useful for CodeAlmanac positioning. A company brain is not enterprise search and not a chatbot over documents. It is a living operational map that tells agents how work is actually done: refund exceptions, pricing decisions, incident response, customer context, product taste, and other tacit rules that are costly to rediscover.

For CodeAlmanac, the analogous map is project memory: architecture decisions, invariants, gotchas, lifecycle flows, prompt contracts, and workflow rules that the code does not carry directly. The `.almanac/` wiki is valuable when it preserves synthesis that would be expensive, risky, or repetitive for future agents to reconstruct.

## GBrain As Reference Primitive

Garry Tan's GBrain is the most relevant external reference implementation because YC's RFS points to it directly. GBrain is an open-source, self-hosted agent brain built around markdown pages, a knowledge graph, hybrid search, skills, and autonomous maintenance jobs.

The overlap with CodeAlmanac is architectural and philosophical:

- Both make durable agent memory a first-class project artifact rather than transient chat history.
- Both use markdown pages as editable source material.
- Both treat links and graph structure as more useful than pure vector similarity.
- Both expect agents to read memory before acting and write back after meaningful work.
- Both preserve user control by avoiding a required hosted data plane.

The differences matter for positioning. GBrain is a general personal or organizational brain with people, companies, meetings, social posts, skills, and cron jobs. CodeAlmanac is narrower: it is a repo-local wiki for software projects, with `files:` frontmatter, path-aware search, topic DAGs, and lifecycle operations such as [[capture-flow]], [[ingest-operation]], and [[build-operation]].

## Hyper As Managed Product Contrast

Hyper is the clearest YC-backed company-brain product using the current category language. YC lists Hyper as Spring 2026, "The Self-Driving Company Brain," and its launch page says it learns from tools such as Notion, Claude Code, email, LinkedIn DMs, Cursor sessions, Slack, GitHub pull requests, calendar invites, and conversations.

Hyper's product surface is the managed SaaS version of the company-brain thesis. It ingests company sources, uses agents to synthesize and deduplicate them, and then silently feeds context back into the AI tools a team already uses. Its launch copy contrasts this with manual context dumps, obvious skills, markdown files in Git, off-the-shelf memory libraries, and GBrain.

That contrast clarifies CodeAlmanac's trust boundary. Hyper sells near-zero setup and cross-tool infusion in exchange for hosted ingestion of broad company data. CodeAlmanac sells locality, inspectability, git-native review, and codebase specificity. The tradeoff is setup and habit formation: agents must search and maintain `.almanac/` as part of their development workflow.

## Competitive Map

The broader market splits into two camps.

The primitive camp includes GBrain and CodeAlmanac. These systems are open-source or local-first, file-based, BYO-key, and agent-maintained. Their advantage is trust, inspectability, portability, and direct fit with technical teams that already review files in git.

The memory-daemon camp includes [[agentmemory-competitor]]. These products compete for the same "agents should not need context re-explained" pain, but they use hook capture, memory databases, retrieval APIs, and context injection instead of a repo-owned wiki artifact.

The platform camp includes Hyper, Glean, Dust, Hebbia, Sana, Guru, and Notion AI. These products sell connectors, hosted ingestion, permission models, workflow surfaces, agent builders, or invisible context injection. Their advantage is breadth, deployment polish, enterprise administration, and lower day-one operational burden for teams that want to buy the system rather than maintain it.

CodeAlmanac should not pitch as if these products do not exist. They validate the same category need. The differentiator is scope and control: CodeAlmanac is for the software-project memory that coding agents need before making changes, not for every Slack thread or CRM object in a company.

## Technical Synthesis

The durable technical lesson from the category is that pure embedding RAG is not enough for organizational memory. GBrain reports graph-aware search improvements over graph-disabled and vector-only variants. Glean markets permission-aware enterprise and personal knowledge graphs. Hebbia argues that high-stakes finance and legal work need exhaustive, decomposed document reasoning rather than top-k chunk retrieval. Codebase work has the same shape: agents need to follow files, flows, decisions, backlinks, topics, and path mentions, not only semantically similar snippets.

This supports CodeAlmanac's current architecture. [[wikilink-syntax]], `files:` frontmatter, FTS, topic DAGs, backlinks, and path-aware search are not incidental implementation details. They are the repo-local version of structured retrieval for agent work.

The product implication is that CodeAlmanac should explain itself through workflows where structure changes agent behavior: a future agent searches for pages mentioning a file before editing it, reads a lifecycle page before changing an operation, or discovers a decision page that prevents reintroducing a rejected design.

## Generalization Architecture

A general company-brain product should separate raw source ingestion from durable synthesized memory. Slack messages, emails, calendar events, docs, tickets, pull requests, CRM notes, and meeting transcripts are evidence records with source ids, actors, timestamps, canonical URLs, entities, visibility, deletion state, and source-specific freshness rules. The memory layer is the curated page that an agent writes from that evidence, with citations back to the raw sources.

This distinction protects the product from becoming a broad RAG dump. The valuable artifact is not every Slack thread or CRM object; it is a page such as "Acme onboarding constraints", "refund exception policy", "enterprise SSO rollout status", or "Q2 pricing decision" that preserves the conclusion future agents need before acting.

The generalized form should use scoped brains instead of one undifferentiated company brain. Useful scopes include company-wide policy, engineering, sales, a named customer, a named project, and a specific incident. Each scope can carry its own notability rules, topics, lifecycle, and access policy. CodeAlmanac's repo-local `.almanac/` is one specialized scope with file-aware retrieval and git as the review boundary.

Permissioning is the core product problem for a multi-source company brain. A conservative first rule is that a user can see a synthesized page only when they can see all cited source evidence, unless the page has been explicitly republished to a broader scope. Redacted summaries can come later, but the initial trust model should favor source-derived access over convenience.

General company memory also needs first-class recency and contradiction states because operational knowledge changes faster than codebase architecture. Pages need statuses such as current, stale, superseded, disputed, and archived. Garden-style maintenance should detect conflicts such as a pricing page that says annual discounts are 20 percent while a newer sales note says the maximum discount is 15 percent.

The practical expansion path is not broad ingestion first. A credible intermediate product keeps the canonical artifact local and reviewable, adds [[just-in-time-context-surfacing]], then connects adjacent sources one at a time. GitHub, Slack, Google Drive, Calendar meeting notes, and Linear or Jira are enough to test whether agents can turn external evidence into governed memory without becoming an enterprise data platform.

## Positioning Implications

CodeAlmanac should use company-brain language when talking to investors or AI-agent builders because the category is becoming legible. The phrase makes the "why now" clearer: AI agents can do more work, but they need durable domain memory to do it safely.

CodeAlmanac should also keep the codebase scope explicit. A broad "company brain" claim invites comparison against hosted cross-company platforms with connectors, admin surfaces, and permission systems that CodeAlmanac does not currently build. "Codebase brain" or "project memory for coding agents" keeps the promise aligned with the product.

The strongest competitive framing is not "better search." It is "cultivated project memory." Search retrieves what already exists. CodeAlmanac's lifecycle operations turn expensive session understanding into durable pages that future agents can use before they touch code.

The product experience should still move toward [[just-in-time-context-surfacing]]. The category lesson from memory daemons is that explicit search is too easy to skip in a live coding session. CodeAlmanac's differentiated version is cited, file-aware constraint surfacing from the wiki before edits, not uncited context stuffing from a personal memory stream.

## Related Pages

[[pitch-deck-fundraising]] explains how this category should be compressed into an investor deck. [[agentmemory-competitor]] explains the strongest adjacent coding-agent memory product found in the 2026-05-15 comparison. [[just-in-time-context-surfacing]] explains the product mechanism that would make repo-owned memory automatic without becoming uncited memory injection. [[wiki-lifecycle-operations]] explains the Build, Absorb, and Garden operations that keep the wiki current. [[farzapedia]] explains an adjacent AI-maintained wiki reference whose synthesis-first writing rules shaped Almanac prompts.
