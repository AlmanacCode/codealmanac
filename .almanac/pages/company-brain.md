---
title: Company Brain
summary: The company-brain category frames CodeAlmanac as a codebase-scoped, local-first memory layer for AI agents rather than a generic search or chatbot product.
topics: [product-positioning, competitive-research]
sources:
  - /tmp/company-brain-research.md
  - /Users/rohan/.codex/sessions/2026/05/19/rollout-2026-05-19T22-39-10-019e43e5-2148-7f80-a2f3-9823dae31139.jsonl
  - /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T01-30-45-019e2a1d-a038-7633-81ea-a1dfc6cb50bd.jsonl
  - /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T02-37-42-019e2a5a-eb3c-7180-89fb-b5591b3c7d24.jsonl
  - https://www.ycombinator.com/rfs?year=2025
  - https://github.com/garrytan/gbrain
  - https://www.ycombinator.com/companies/hyper-4
  - https://www.ycombinator.com/launches/QKg-hyper-the-self-driving-company-brain
  - /Users/rohan/.codex/sessions/2026/05/27/rollout-2026-05-27T16-27-22-019e6b55-bee7-79d3-ba21-2852c5372082.jsonl
  - id: yc-market-scan
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/31/rollout-2026-05-31T23-31-46-019e8173-bc02-7503-a102-e9de99d6bb9c.jsonl
    note: Records the YC CLI and Bookface market scan that compared company-brain, codebase-context, PR-review, and agent-memory competitors, then narrowed CodeAlmanac positioning around engineering memory, context freshness, and retrieval.
  - id: dosu-experiment-session
    type: transcript
    path: /Users/kushagrachitkara/.claude/projects/-Users-kushagrachitkara-Downloads-reverie-codealmanac/767924bf-14a8-48e3-8c5c-a69523619cb9.jsonl
    note: Records the 2026-06-09 Dosu MCP experiment on an empty deployment, including missing source data, `save_topic`, and immediate `init_knowledge` read-back.
  - id: dosu-codex-setup-session
    type: transcript
    path: /Users/kushagrachitkara/.codex/sessions/2026/06/09/rollout-2026-06-09T15-28-27-019eae80-59af-7060-b6de-e0f8d96d48ca.jsonl
    note: Records the Codex-side Dosu setup experiment, including browser-auth gating, the missing pre-auth MCP config entry, and the conclusion that the deployment still needed a connected source before retrieval would work.
status: active
verified: 2026-06-09
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

The memory-daemon camp includes [[agentmemory-competitor]], [[codex-supermemory]], and [[mem0]]. These products compete for the same "agents should not need context re-explained" pain, but they use hook capture, memory databases, retrieval APIs, and context injection instead of a repo-owned wiki artifact.

The platform camp includes Hyper, Glean, Dust, Hebbia, Sana, Guru, and Notion AI. These products sell connectors, hosted ingestion, permission models, workflow surfaces, agent builders, or invisible context injection. Their advantage is breadth, deployment polish, enterprise administration, and lower day-one operational burden for teams that want to buy the system rather than maintain it.

[[dosu]] is a narrower managed-knowledge reference point inside the same camp. The 2026-06-09 tool-surface experiment showed a hosted curation model where source connection was not available through the observed MCP surface, and a successful `save_topic` write did not immediately reappear through `init_knowledge`. A second 2026-06-09 Codex setup session reinforced the same separation from the install side: `npx @dosu/cli setup --agent --tool codex` still left source attachment as a distinct step before retrieval could work. That makes Dosu useful as a contrast for review-gated or async-curated knowledge flows rather than a repo-owned memory artifact. [@dosu-experiment-session] [@dosu-codex-setup-session]

The codebase-context camp is more crowded than the broad company-brain page originally implied. The 2026-05-31 YC CLI scan identified direct or near-direct products around codebase context, self-maintaining code knowledge bases, repository graphs, code search, specs as durable agent context, horizontal agent memory, and AI PR review. The named YC-adjacent set included Driver, Sage AI, Verba, Graphify Labs, Sourcebot, OpenSpec, Mem0, Nessie, Zep, Greptile, and cubic. That validates demand for "agents should understand the codebase" while making "AI codebase docs" a weak undifferentiated pitch. [@yc-market-scan]

The same Bookface pass made broad "company brain" a dangerous default category for CodeAlmanac. Memoir, Peppr AI, and Dashworks already occupy versions of hosted company knowledge, living docs, and internal search across Slack, Notion, Drive, email, and other company systems. Datost and Platus show a stronger adjacent pattern: company context becomes easier to sell when attached to a vertical job such as data analysis or legal work. CodeAlmanac should therefore avoid a generic company-brain promise and describe the narrower job it owns: engineering memory and agent memory for codebases. [@yc-market-scan]

CodeAlmanac should not pitch as if these products do not exist. They validate the same category need. The differentiator is scope and control: CodeAlmanac is for the software-project memory that coding agents need before making changes, not for every Slack thread or CRM object in a company.

## User Problem Boundary

The memory products and CodeAlmanac overlap on the top-level pain: AI agents lack context across time. The durable positioning distinction has to name the subproblem, not only the storage artifact.

Memory products such as [[codex-supermemory]], [[mem0]], and [[agentmemory-competitor]] primarily address "my agent forgets." They preserve user, session, project, and tool context so the next prompt can receive relevant remembered facts without manual search.

CodeAlmanac addresses "my codebase forgets." The failure is not only that one agent lacks prior context; it is that architectural decisions, invariants, incident lessons, and rejected designs vanish into transcripts instead of becoming shared project memory. The buyer problem is strongest for teams, open-source repos, long-lived systems, multiple agents, PR review, onboarding, and any workflow where a remembered fact needs to be inspectable, cited, and tied to files.

The strongest short positioning from the YC market scan is: "`CLAUDE.md` is a prompt; Almanac is the repo's memory." `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, README files, and pasted prompt context are the free incumbent because they are simple, already adopted, and visible to agents. CodeAlmanac's answer is not a larger prompt file; it is a governed, cited, repo-owned memory layer that future humans and agents can inspect, edit, and review through Git. [@yc-market-scan]

The follow-up HN and YC validation pass weakened the stronger claim that developers already want an inspectable repo-owned Markdown wiki. The evidence supports context decay, repeated architecture re-explanation, stale instruction files, trust loss when docs rot, and some preference for source-controlled plain-text context; it does not yet prove demand for a full wiki, willingness to maintain another documentation surface, trust in auto-generated memory, or Git review as the primary buyer desire. The safer hypothesis is that developers want agents to remember project-specific constraints without bloating context or going stale. CodeAlmanac should test that as context freshness and retrieval first, with the wiki artifact justified by provenance and review only when it changes agent behavior. [@yc-market-scan]

The 2026-05-20 product-feedback read validated that the current language is landing with the intended audience. Respondents echoed the project vocabulary around "why" behind code, tribal knowledge, design rationales, gotchas, institutional memory, and context drift. The in-repo markdown wiki also registered as a trust feature because it is durable, reviewable, and naturally fits PR review rather than hiding project knowledge in prompts or a vector database.

This is why "repo-owned markdown" is a user-facing difference only when it changes the trust boundary. A personal or hosted memory layer can remember facts about a repo, but it is the wrong canonical source for knowledge that future contributors and agents must review, share, and preserve with the code. CodeAlmanac's wedge is institutional codebase memory: before an agent edits a file, it should see the reviewed constraints this repo already knows; after a session discovers something durable, that knowledge should become a Git-reviewable wiki diff.

## Technical Synthesis

The durable technical lesson from the category is that pure embedding RAG is not enough for organizational memory. GBrain reports graph-aware search improvements over graph-disabled and vector-only variants. Glean markets permission-aware enterprise and personal knowledge graphs. Hebbia argues that high-stakes finance and legal work need exhaustive, decomposed document reasoning rather than top-k chunk retrieval. Codebase work has the same shape: agents need to follow files, flows, decisions, backlinks, topics, and path mentions, not only semantically similar snippets.

This supports CodeAlmanac's current architecture. [[wikilink-syntax]], `files:` frontmatter, FTS, topic DAGs, backlinks, and path-aware search are not incidental implementation details. They are the repo-local version of structured retrieval for agent work.

The product implication is that CodeAlmanac should explain itself through workflows where structure changes agent behavior: a future agent searches for pages mentioning a file before editing it, reads a lifecycle page before changing an operation, or discovers a decision page that prevents reintroducing a rejected design.

## Generalization Architecture

A general company-brain product should separate raw source ingestion from durable synthesized memory. Slack messages, emails, calendar events, docs, tickets, pull requests, CRM notes, and meeting transcripts are evidence records with source ids, actors, timestamps, canonical URLs, entities, visibility, deletion state, and source-specific freshness rules. The memory layer is the curated page that an agent writes from that evidence, with citations back to the raw sources.

This distinction protects the product from becoming a broad RAG dump. The valuable artifact is not every Slack thread or CRM object; it is a page such as "Acme onboarding constraints", "refund exception policy", "enterprise SSO rollout status", or "Q2 pricing decision" that preserves the conclusion future agents need before acting.

The 2026-05-27 generalized-Almanac discussion sharpened the product model into three primitives: sources, memory, and tasks. Sources are preserved originals such as PDFs, emails, screenshots, receipts, passports, contracts, Slack exports, Google Docs, notes, and transcripts. Memory is the maintained synthesis layer that answers current questions. Tasks are unresolved conflicts, missing evidence, review needs, and stale-claim cleanup.

A generalized Almanac therefore needs first-class source objects, not only page `sources:` strings or CodeAlmanac-style `files:` references. A source object records the original path, content hash, source kind, observed time, extracted text location, detected entities, visibility scope, duplicate state, and archive or supersession status. The memory page cites the source object; it should not become the place where the raw document, OCR output, agent scratch work, and durable conclusion all collapse together.

The ideal ingestion flow starts with an inbox, fingerprints files, extracts text and metadata, classifies document kinds, resolves entities, detects duplicates and near-duplicates, compares new evidence against current memory, proposes page updates, applies low-risk changes, and sends risky changes to review. Garden-style maintenance then removes stale derived text, preserves source lineage, and keeps conflict queues visible. The system should ask what durable understanding changed before it creates a page.

The generalized form should use scoped almanacs instead of one undifferentiated company brain. Useful scopes include company-wide policy, engineering, sales, a named customer, a named project, and a specific incident. Each scope can carry its own notability rules, topics, lifecycle, and access policy. CodeAlmanac's repo-local `.almanac/` is one specialized scope with file-aware retrieval and git as the review boundary.

Scoped almanacs are especially important when personal and company documents overlap. A Reverie almanac should preserve only company-relevant facts about workers, officers, founders, contractors, advisors, legal documents, tax records, banking, compliance, ownership, and immigration dependencies. A personal almanac can preserve broader private context such as relationships, preferences, housing, finances, identity records, and open loops. A shared source vault can hold the same original document for both, but each almanac needs its own projection and charter.

Passports and identity documents show the boundary. A company almanac should reference a passport only when it supports a company process such as bank KYC, director or officer verification, E-Verify, I-9, or immigration dependency tracking. It should not absorb broad personal context merely because the source exists. The minimal company projection is that an identity document exists for a named workflow if authorized; the personal projection can carry broader life-admin context.

Permissioning is the core product problem for a multi-source company brain. A conservative first rule is that a user can see a synthesized page only when they can see all cited source evidence, unless the page has been explicitly republished to a broader scope. Redacted summaries can come later, but the initial trust model should favor source-derived access over convenience.

For team use, the original source should often stay in the system that already owns it. Google Drive can remain the system of record for shared legal documents, Gmail for email threads, Slack for conversations, DocuSign for executed agreements, Mercury for banking records, Stripe Atlas for formation artifacts, and GitHub for code and review history. The company brain then stores source references, metadata, extracted caches, and citations instead of becoming the primary file store for every original.

This creates two sharing layers. The maintained wiki page can be shared through GitHub or another reviewable page store, while the cited evidence still uses the original system's permissions. The product can later add permission-aware serving, but the first trust boundary is simple: shared pages are visible to the Almanac audience, and source links require access in the source system unless the page has been explicitly republished or redacted for a broader scope.

General company memory also needs first-class recency and contradiction states because operational knowledge changes faster than codebase architecture. Pages need statuses such as current, stale, superseded, disputed, and archived. Garden-style maintenance should detect conflicts such as a pricing page that says annual discounts are 20 percent while a newer sales note says the maximum discount is 15 percent.

The practical expansion path is not broad ingestion first. A credible intermediate product keeps the canonical artifact local and reviewable, adds [[just-in-time-context-surfacing]], then connects adjacent sources one at a time. GitHub, Slack, Google Drive, Calendar meeting notes, and Linear or Jira are enough to test whether agents can turn external evidence into governed memory without becoming an enterprise data platform.

## Positioning Implications

CodeAlmanac should use company-brain language when talking to investors or AI-agent builders because the category is becoming legible. The phrase makes the "why now" clearer: AI agents can do more work, but they need durable domain memory to do it safely.

CodeAlmanac should also keep the codebase scope explicit. A broad "company brain" claim invites comparison against hosted cross-company platforms with connectors, admin surfaces, and permission systems that CodeAlmanac does not currently build. "Codebase brain" or "project memory for coding agents" keeps the promise aligned with the product.

The owned product vocabulary should use "Almanac" rather than "brain." [[almanac-product-family]] captures the generalized naming rule: Code Almanac, Personal Almanac, Company Almanac, Project Almanac, and Research Almanac are scoped maintained knowledge layers over different source worlds. "Brain" remains market-category language, not the preferred product noun.

The strongest competitive framing is not "better search." It is "cultivated project memory." Search retrieves what already exists. CodeAlmanac's lifecycle operations turn expensive session understanding into durable pages that future agents can use before they touch code.

The product experience should still move toward [[just-in-time-context-surfacing]]. The category lesson from memory daemons is that explicit search is too easy to skip in a live coding session. CodeAlmanac's differentiated version is cited, file-aware constraint surfacing from the wiki before edits, not uncited context stuffing from a personal memory stream.

## Related Pages

[[customer-segmentation]] explains the customer groups CodeAlmanac should prioritize before broad company-brain markets. [[github-native-wiki-maintenance]] explains the remote CodeAlmanac product thesis: a GitHub App and hosted maintenance layer over repo-owned `.almanac/` pages, not a hosted canonical memory store. [[almanac-product-family]] explains the broader product vocabulary for scoped almanacs over codebases, personal contexts, companies, projects, and research corpora. [[pitch-deck-fundraising]] explains how this category should be compressed into an investor deck. [[agentmemory-competitor]] explains the strongest adjacent local-daemon coding-agent memory product found in the 2026-05-15 comparison. [[codex-supermemory]] explains the lighter Codex hook integration that makes Supermemory feel immediate after install. [[mem0]] explains an operational memory-store competitor whose extraction and retrieval model clarifies the difference between runtime recall and repo-governed project knowledge. [[just-in-time-context-surfacing]] explains the product mechanism that would make repo-owned memory automatic without becoming uncited memory injection. [[wiki-lifecycle-operations]] explains the Build, Absorb, and Garden operations that keep the wiki current. [[farzapedia]] explains an adjacent AI-maintained wiki reference whose synthesis-first writing rules shaped Almanac prompts.
