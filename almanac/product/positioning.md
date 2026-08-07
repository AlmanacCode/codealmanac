---
title: Product Positioning
topics: [product, launch, evaluation]
sources:
  - id: repo-readme
    type: file
    path: README.md
    note: Public product positioning, local-first surface, and command examples.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active Python v1 agreement that fixes the public product name and local-only scope.
  - id: tagit
    type: web
    url: https://github.com/liliang-cn/tagit
    note: Agent-in-team-chat comparison point.
  - id: agentchattr
    type: web
    url: https://github.com/bcurts/agentchattr
    note: Local multi-agent chat comparison point.
  - id: openwiki-transcript
    type: conversation
    session_id: rollout-2026-07-11T23-25-01-019f5500-2662-72d2-941a-8a29f021e78f
    note: Product conversation comparing OpenWiki-style generated documentation with CodeAlmanac's repo-owned memory model.
  - id: ai-wiki-standard-transcript
    type: conversation
    session_id: rollout-2026-07-14T22-51-58-019f6454-fa56-7ff0-b1b2-fe8a42abaf55
    note: Product conversation framing CodeAlmanac as an AI wiki category, potential open standard, and simpler alternative to GBrain-style agent-memory machinery.
  - id: personal-launch-copy-transcript
    type: conversation
    session_id: rollout-2026-07-16T21-49-54-019f6e68-df3d-7621-8fe7-37ddb66d49f0
    note: Product conversation refining personal social-launch copy around Claude forgetting sessions, MEMORY.md, and CodeAlmanac.
  - id: team-launch-copy-transcript
    type: conversation
    session_id: rollout-2026-07-22T10-03-56-019f8ac8-b302-7230-a550-1f2d844315f7
    note: Product conversation refining YC launch copy around team-level agent context, shared memory, and dated traction claims.
  - id: deepwiki
    type: web
    url: https://deepwiki.org/
    note: Generated repository wiki comparison point.
  - id: gitbook-agent
    type: web
    url: https://gitbook.com/docs/gitbook-agent/what-is-gitbook-agent
    note: Conventional documentation platform adding agent-assisted documentation workflows.
  - id: openapi-about
    type: web
    url: https://www.openapis.org/about
    note: Standardization comparison point for a vendor-neutral specification and commercial ecosystem.
  - id: mcp-governance
    type: web
    url: https://modelcontextprotocol.io/community/governance
    note: Governance comparison point for a protocol after ecosystem adoption.
  - id: evaluation
    type: wiki
    path: product/evaluation-benchmarks
    note: Product page for benchmark and evaluation strategy.
  - id: launch-metrics
    type: wiki
    path: product/launch-metrics
    note: Product page for launch metric interpretation.
---

# Product Positioning

CodeAlmanac is a local, repo-owned wiki maintained by coding agents. Its durable
source is ordinary Markdown under `almanac/`; a local index supports agent and
human reads through commands such as `codealmanac search`, `show`, and `serve`
[@repo-readme]. The active Python v1 product is still the local `codealmanac`
CLI, with no hosted login, cloud upload, SDK, MCP, or compatibility alias
surface [@live-agreement].

The useful contrast is not generic "better documentation." CodeAlmanac
preserves decisions, invariants, gotchas, flows, and operating knowledge that
future agent sessions would otherwise rediscover. Git keeps that knowledge
reviewable, while build, ingest, garden, and sync keep it current
[@repo-readme].

Team-chat tools such as TagIt and agentchattr route work and conversation among
agents [@tagit] [@agentchattr]. They are adjacent rather than equivalent:
CodeAlmanac's primary artifact is the maintained repository wiki that later
agents query before changing code.

OpenWiki-style generated documentation is another adjacent category. A
generated docs site asks what public documentation a reader should see for a
repository, while CodeAlmanac asks what decisions, invariants, incidents, and
gotchas the next coding agent should not have to rediscover
[@openwiki-transcript]. Existing docs are source material for judgment, not a
blueprint to rewrite into a shadow documentation site.

## Launch Copy

Short launch posts should lead with the personal pain before naming the
product: Claude forgets earlier shared understanding, a single `MEMORY.md` or
`CLAUDE.md` turns into a long manual dumping ground, and CodeAlmanac replaces
that with small connected Markdown pages the agent can search when needed
[@personal-launch-copy-transcript]. That story is stronger than a broad feature
list because it makes the product promise concrete: a new agent session should
feel like continuing the same work, not starting the codebase explanation again
[@personal-launch-copy-transcript].

For social copy, keep the call to action simple. The transcript converged on a
compact post with a link and a feedback request, while preserving the
frustration to file-based memory to CodeAlmanac arc [@personal-launch-copy-transcript].

Team launch copy should spend more time on the costly consequence before
introducing the product. The strong arc is that coding agents can produce more
code, but each new session starts from zero, reopens old investigations, and
works from a different fragment of team context; CodeAlmanac then becomes the
shared knowledge layer that lets agents search the same requirements,
decisions, implementation history, and incidents before making changes
[@team-launch-copy-transcript]. The founder-origin version of that story is
that the missing product was not another coding agent, but shared durable memory
between agents [@team-launch-copy-transcript].

## AI Wiki Category

The stronger category claim is that CodeAlmanac can define an AI wiki: a living,
cited knowledge base maintained and consumed by agents and humans
[@ai-wiki-standard-transcript]. That frame does not change the current public
product name or v1 scope [@live-agreement]. In that frame, CodeAlmanac is not
raw conversation memory, static documentation, generic vector search, or an
automatically generated code summary; it is durable, inspectable project memory
that agents can share across sessions [@ai-wiki-standard-transcript].

This category is close to, but separate from, generated repository wiki tools
and conventional documentation products with agent features. DeepWiki presents
an indexed, conversational documentation experience for repositories, while
GitBook Agent works inside GitBook to write, review, translate, and update
documentation [@deepwiki] [@gitbook-agent]. CodeAlmanac's launch claim should
stay focused on portable agent memory: citations, stable pages, source material,
links, topics, search and retrieval, agent-authored updates, import and export,
and change history [@ai-wiki-standard-transcript].

GBrain is the useful cautionary comparison for this category. The transcript's
durable conclusion is that CodeAlmanac has the clearer product shape, while
GBrain currently has broader agent-memory machinery: continuous capture,
synthesis and gap analysis, graph retrieval, an agent-memory loop, background
maintenance, and production history [@ai-wiki-standard-transcript].
CodeAlmanac should add only the capabilities that matter for a maintained wiki,
especially continuous capture,
strong retrieval, and reliable maintenance, without turning the product into an
operator dashboard or agent operating system [@ai-wiki-standard-transcript].

If a future AI-wiki standardization effort grows out of CodeAlmanac, it should
separate the open contract from any hosted product. The durable conclusion is
not to invent a CodeAlmanac-specific format first; the research direction is to
target an existing open-knowledge-file-style contract while staying useful as
plain Markdown [@ai-wiki-standard-transcript]. If CodeAlmanac later proves that
shape, it can publish stable schemas, conformance tests, and a local or self-hosted
reference implementation before treating governance as the main problem
[@ai-wiki-standard-transcript]. OpenAPI is the useful analogy because it became
a vendor-neutral API description format after originating from Swagger, while
MCP is the useful caution because its formal governance follows an already
useful protocol and community [@openapi-about] [@mcp-governance].

Use [Evaluation benchmarks](evaluation-benchmarks) when turning this positioning
claim into an experiment, and [Launch metrics](launch-metrics) when reporting
public package traction without inventing user counts [@evaluation]
[@launch-metrics].
