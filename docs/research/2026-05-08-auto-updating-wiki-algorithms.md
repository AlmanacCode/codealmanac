# Auto-Updating Wiki Algorithms

Date: 2026-05-08

## Thesis

An auto-updating codebase wiki should be maintained as a small, source-backed,
incrementally refreshed knowledge graph of human-meaningful pages, not as a
regenerated documentation corpus and not as a raw RAG index. The best model for
codealmanac is: capture events produce a bounded evidence bundle, deterministic
index queries identify the affected neighborhood, an agent directly rewrites or
creates atomic pages, and a reviewer agent audits graph fit, provenance,
contradictions, and notability. The system should treat staleness as a queue for
agent judgment, not as proof that prose should be mechanically replaced.

This preserves the codealmanac philosophy: intelligence belongs in prompts;
the CLI outside `capture` and `bootstrap` remains pure local query/indexing.

## Research Base

Primary and near-primary sources reviewed:

- Microsoft GraphRAG docs: indexing extracts entities, relationships, optional
  claims, community hierarchy, community reports, embeddings, and provenance via
  text-unit mappings; outputs include `period` fields intended for incremental
  merge workflows. Sources: [overview](https://microsoft.github.io/graphrag/index/overview/),
  [architecture](https://microsoft.github.io/graphrag/index/architecture/),
  [dataflow](https://microsoft.github.io/graphrag/index/default_dataflow/),
  [outputs](https://microsoft.github.io/graphrag/index/outputs/),
  [global search](https://microsoft.github.io/graphrag/query/global_search/),
  [local search](https://microsoft.github.io/graphrag/query/local_search/),
  [DRIFT search](https://microsoft.github.io/graphrag/query/drift_search/).
- LightRAG: graph plus vector retrieval with dual-level retrieval and an
  incremental update algorithm for new data. Source:
  [arXiv 2410.05779](https://arxiv.org/abs/2410.05779).
- DeepDive incremental knowledge base construction: KBC is iterative; new data,
  extraction rules, and supervision require incremental grounding/inference.
  Source: [arXiv 1502.00731](https://arxiv.org/abs/1502.00731),
  [PVLDB PDF](https://www.vldb.org/pvldb/vol8/p1310-shin.pdf).
- RepoDoc: repository knowledge graph, module clustering, agent generation, and
  semantic impact propagation for selective documentation regeneration. Source:
  [arXiv 2604.26523 summary](https://arxiv-troller.com/paper/3157800/).
- RepoAgent: repository-level LLM documentation generation/maintenance/update.
  Source: [arXiv 2402.16667](https://arxiv.org/abs/2402.16667).
- DocAider: PR-triggered documentation update, call/function graph, recursive
  propagation to callers/dependents, reviewer comments as update instructions.
  Sources: [project docs](https://ucl-docaider.github.io/documentation_update.html),
  [GitHub repo](https://github.com/ucl-docaider/docAider).
- Red Hat Code-to-Docs: LLM analyzes code diffs, caches documentation file
  summaries, prefers narrow direct-doc matches over noisy broad matches, and
  opens reviewed docs changes. Source:
  [Red Hat Developer blog](https://developers.redhat.com/articles/2026/04/21/ai-powered-documentation-updates-code-diff-docs-pr-one-comment).
- Documentation drift detection: stale code element references can be detected
  when referenced elements no longer exist; PR-time GitHub Actions can scan docs.
  Sources: [arXiv 2212.01479](https://arxiv.org/abs/2212.01479),
  [arXiv 2307.04291](https://arxiv.org/abs/2307.04291).
- CASCADE: converts natural-language documentation into tests, reports mismatch
  only when existing code fails but documentation-derived code passes, reducing
  false positives. Source: [arXiv 2604.19400](https://arxiv.org/abs/2604.19400).
- Wikidata quality practice: statement references, property constraints, bot
  maintained constraint violation reports, deprecated/removed/constraint-violating
  statements as quality indicators. Sources:
  [Help:Sources](https://www.wikidata.org/wiki/Help%3ASources/en),
  [property constraints](https://www.wikidata.org/wiki/Help%3AProperty_constraints_portal),
  [constraint reports](https://www.wikidata.org/wiki/Wikidata%3ADatabase_reports/Constraint_violations),
  [quality study](https://arxiv.org/abs/2107.00156).
- W3C PROV: provenance modeled as entities, activities, agents, derivation,
  usage, generation, and primary-source relationships. Source:
  [PROV overview](https://www.w3.org/TR/prov-overview/).
- RAG evaluation: evaluate retrieval and generation separately: context
  precision/recall, faithfulness, groundedness, response relevance, provenance.
  Sources: [RAGAS paper](https://arxiv.org/abs/2309.15217),
  [Ragas metrics](https://docs.ragas.io/en/v0.3.2/concepts/metrics/available_metrics/),
  [KILT benchmark](https://aclanthology.org/2021.naacl-main.200/).
- GitLab documentation practice: docs as continuously evolving single source of
  truth, concise searchable prose, comments for maintenance instructions. Source:
  [GitLab documentation style guide](https://docs.gitlab.com/development/documentation/styleguide/).

## Named Approaches

### 1. Delta Cone Update

Simple name: find the cone of pages probably affected by a change, then ask an
agent to decide what to edit.

Use deterministic index structure first:

- changed files from the coding session or git diff
- pages whose `files:` frontmatter or inline `[[path]]` refs match those files
- pages linked from or linking to those pages
- topic neighbors of those pages
- recently created/updated pages, because they often contain live migrations

Pseudocode:

```text
function affected_pages(change):
  changed_paths = normalize(change.files)
  direct = pages_with_file_refs_intersecting(changed_paths)
  linked = pages_linking_to(direct) union pages_linked_from(direct)
  topic_neighbors = pages_sharing_topics(direct, limit_per_topic=8)
  recent = pages_updated_since(now - 30 days)
  return rank(
    direct weight 5,
    linked weight 3,
    topic_neighbors weight 2,
    recent_if_path_overlap weight 1
  )
```

Tradeoffs:

- Good: cheap, local, explainable, works with codealmanac's existing SQLite
  index and flat wiki.
- Bad: misses pages with no file refs or weak links; must rely on writer
  judgment for semantic impact.
- Mitigation: capture prompt should explicitly ask "what existing pages are
  contradicted or made stale?" and give the agent search/path tools.

Applies to codealmanac: yes. This is the core maintenance selector.

Avoid: building a full repository AST/call graph as a mandatory pipeline for all
repos. RepoDoc/DocAider show value in dependency propagation, but codealmanac's
wiki documents decisions and gotchas, not API reference pages. File refs and
links are the right first graph.

### 2. Evidence-Bundle Writer

Simple name: update pages from a bounded source packet, not from memory.

Each capture run should hand the writer a compact bundle:

- session summary and original user request
- changed files and diff summary
- relevant commits/PRs/issues if available
- affected wiki neighborhood from Delta Cone Update
- exact current contents of candidate pages
- `.almanac/README.md` conventions and topic graph

Pseudocode:

```text
function capture_update(session):
  bundle = {
    evidence: collect_session_evidence(session),
    changed_paths: diff_paths(session),
    candidates: affected_pages(session),
    wiki_rules: read(".almanac/README.md"),
    graph_snapshot: index_summary(candidates)
  }
  writer = agent(prompt=writer_prompt, input=bundle)
  writer.edit_pages_directly()
  reviewer = agent(prompt=reviewer_prompt, input=git_diff + graph_snapshot)
  writer.consider(reviewer.critique)
```

Tradeoffs:

- Good: matches codealmanac's "agent writes directly" philosophy; avoids
  proposal files and schema choreography.
- Bad: harder to audit than a deterministic pipeline.
- Mitigation: require provenance in page prose or frontmatter conventions, and
  rely on git diff as the review artifact.

Applies to codealmanac: yes. This is the strongest fit.

Avoid: a propose/review/apply state machine. The research trend in agentic
maintenance often drifts toward orchestration; codealmanac should keep that
inside prompts and the git diff.

### 3. Recursive Impact Propagation

Simple name: when a thing changes, update pages about its callers, dependents,
and workflows too.

DocAider updates documentation recursively through a function relationship graph
when functions/classes change. RepoDoc similarly uses semantic impact
propagation over a repository KG.

For codealmanac, use a weaker but safer form:

```text
function propagation_frontier(seed_pages):
  frontier = seed_pages
  for depth in 1..2:
    frontier += backlinks(frontier)
    frontier += outbound_links(frontier)
    frontier += pages_sharing_files_or_folders(frontier)
    frontier += parent_child_topic_neighbors(frontier)
  return rank_and_cap(frontier, max_pages=20)
```

Tradeoffs:

- Good: catches "flow" pages when a leaf implementation change invalidates a
  higher-level invariant or gotcha.
- Bad: recursive expansion can become noisy fast.
- Mitigation: depth cap, ranking, and "prefer silence unless notable" in the
  writer prompt.

Applies to codealmanac: yes, but cap aggressively.

Avoid: unlimited recursive doc regeneration. That is appropriate for generated
API docs, not for a living wiki of durable knowledge.

### 4. Contradiction Ledger

Simple name: compare new claims against old pages and resolve conflicts in prose.

GraphRAG optional claim extraction records claim status and time bounds; Wikidata
uses references, deprecation, and constraint violations to surface questionable
statements. Codealmanac does not need a first-class fact database, but the writer
prompt can perform claim-level review over a bounded page set.

Pseudocode:

```text
function contradiction_check(new_evidence, candidate_pages):
  claims = agent_extract_claims(new_evidence)
  old_claims = agent_extract_claims(candidate_pages)
  conflicts = []
  for claim in claims:
    for old in semantically_related(old_claims, claim):
      if cannot_both_be_true(claim, old):
        conflicts.append((claim, old))
  return conflicts
```

Resolution policy:

- If old page is obsolete, update it and note what superseded the old behavior.
- If both claims are true under different conditions, split by version, branch,
  feature flag, environment, or date.
- If evidence is insufficient, do not invent a reconciliation; add a small
  "uncertain/stale" note only when the uncertainty itself is useful.

Tradeoffs:

- Good: targets one of the biggest wiki failure modes: confidently stale pages.
- Bad: LLM contradiction detection has false positives and false negatives.
- Mitigation: use only as a reviewer/writer prompt task over a small candidate
  set; never expose as a deterministic health failure without evidence.

Applies to codealmanac: yes, as prompt behavior.

Avoid: a global truth-maintenance system. It is overkill for markdown pages and
would push codealmanac away from its prompt-first design.

### 5. Provenance Stamps

Simple name: every non-obvious claim should leave a trail to why the wiki says it.

W3C PROV is too heavy as a schema, but its core idea transfers cleanly:

- source entity: commit, PR, issue, incident note, session transcript, file path
- activity: capture/bootstrap run
- generated entity: page revision
- derivation: page statement derived from source evidence

Minimal markdown convention:

```markdown
## Evidence

- 2026-05-08 capture: changed [[src/auth/session.ts]] and [[src/auth/rotate.ts]]
- PR #123: moved refresh-token rotation server-side
- Commit abc1234: removed client-side token renewal
```

Tradeoffs:

- Good: helps agents decide whether to trust/update a page; supports human
  audit through git.
- Bad: evidence sections can become noisy.
- Mitigation: evidence should cite durable source events, not every file read.

Applies to codealmanac: yes, as README/prompt convention first.

Avoid: mandatory W3C PROV serialization, RDF, or per-claim metadata in slice 1.

### 6. Community Summary Refresh

Simple name: periodically summarize clusters, but keep atomic pages authoritative.

GraphRAG's useful pattern is not "make a huge graph"; it is "cluster related
knowledge and generate summaries at multiple levels." In codealmanac terms, the
topic DAG already provides human-curated communities. A bootstrap/garden pass
can ask:

- Which topics have too many pages without a navigational overview?
- Which pages overlap enough to merge or cross-link?
- Which topic summaries are stale relative to their pages?

Pseudocode:

```text
function refresh_topic_overviews(topic):
  pages = active_pages(topic)
  if count(pages) < threshold:
    return
  summary = agent_summarize(
    pages,
    instructions="create/update overview page; link atomic pages; do not erase details"
  )
  write_or_update(topic_overview_page, summary)
```

Tradeoffs:

- Good: improves agent navigation and prevents raw search from being the only
  discovery path.
- Bad: summary pages go stale and can hide nuance.
- Mitigation: mark them as overviews; require links to source pages; refresh
  only on bootstrap/garden, not every capture.

Applies to codealmanac: yes after core capture is solid.

Avoid: making generated overviews the primary source of truth.

### 7. Staleness Queue

Simple name: rank pages that deserve attention; do not auto-delete or auto-rewrite.

Signals:

- referenced file/folder deleted or renamed
- page files changed frequently but page not updated
- high backlink count plus old mtime
- page mentions old feature flag, migration, or incident without closure
- archived/superseded metadata inconsistent
- contradiction checker flags conflict with recent evidence
- no evidence section for a high-impact decision page

Pseudocode:

```text
function staleness_score(page):
  score = 0
  score += 5 * missing_file_refs(page)
  score += 3 * recent_changes_to_referenced_files(page, days=30)
  score += 2 * log1p(backlink_count(page)) if old(page)
  score += 4 if contradiction_flag(page)
  score += 2 if migration_language_without_recent_verification(page)
  score -= 3 if archived(page)
  return score
```

Tradeoffs:

- Good: surfaces maintenance work without pretending a heuristic knows the fix.
- Bad: needs tuning to avoid alert fatigue.
- Mitigation: use the score inside capture/bootstrap prompts or `health`
  warnings only when deterministic; keep LLM-only scores out of non-AI CLI.

Applies to codealmanac: partially. Deterministic stale-file-ref checks belong in
`health`; semantic staleness belongs to capture/bootstrap prompts.

Avoid: automatic archival. Registry entries are never auto-dropped; pages should
not be silently retired either.

### 8. Quality Gate by Retrieval Tasks

Simple name: test whether the wiki helps agents answer grounded questions.

RAGAS and KILT suggest evaluating retrieval/provenance separately from answer
quality. For a codebase wiki, the useful offline metrics are:

- hit rate: does search/path return the page an agent should read?
- provenance coverage: do durable claims cite source events or linked pages?
- contradiction rate: do paired pages assert incompatible current behavior?
- staleness precision: when health flags a page, is it actually stale?
- notability precision: were capture-created pages worth keeping two weeks later?
- graph utility: average backlinks/outlinks per page, orphan pages, topic
  coverage, dead refs
- agent task success: on seeded maintenance/debug tasks, does providing almanac
  context reduce wrong turns?

Pseudocode:

```text
function evaluate_wiki(golden_questions):
  for q in golden_questions:
    results = almanac_search(q.text)
    score.hit += expected_page in top_k(results, k=5)
    answer = agent_answer(q, context=results)
    score.grounded += judge_supported(answer, expected_sources)
    score.provenance += cites_expected_sources(answer)
  return aggregate(score)
```

Tradeoffs:

- Good: aligns evaluation with actual consumer: coding agents.
- Bad: goldens require maintenance; LLM judges drift.
- Mitigation: keep a small hand-curated benchmark per repo and report trends,
  not absolute truth.

Applies to codealmanac: yes, but later than core update mechanics.

Avoid: optimizing for generic RAG scores before the wiki has enough real pages.

## Cross-Source Lessons

1. Incremental maintenance beats regeneration. DeepDive, LightRAG, RepoDoc, and
   DocAider all emphasize updating only affected parts because full rebuilds are
   slower, costlier, and noisier.
2. Source links matter more than polished prose. Wikidata and KILT both treat
   provenance as a quality dimension, not decoration.
3. Graphs help select context; they should not own judgment. GraphRAG community
   summaries are useful for navigation and global questions, but codealmanac's
   topic/page/file graph is already enough for a first maintenance algorithm.
4. Staleness is often a relation, not an age. A six-month-old invariant can be
   fresh; a one-day-old migration note can be stale after a revert.
5. Automated consistency checks should be conservative. CASCADE's two-condition
   report rule is a good model: false positives destroy trust.
6. Documentation generated from code is the wrong target for codealmanac.
   Codealmanac should capture why, constraints, incidents, flows, and gotchas,
   while API/reference docs can be generated elsewhere.
7. Human-readable atomic pages are a feature. RAG-to-wiki should synthesize
   durable pages, not hide all knowledge inside embeddings or JSON artifacts.

## What Applies To Codealmanac

Use:

- local, file-backed pages as the durable knowledge layer
- deterministic index queries to select affected neighborhoods
- capture as the only routine AI update path
- bootstrap/garden as the occasional global refresh path
- reviewer subagent as critique, not state machine
- explicit links to source files, related pages, and source events
- bounded contradiction/staleness prompts over candidate pages
- archive/supersede metadata when knowledge is historically useful but no
  longer current

Adopt cautiously:

- topic/community overview pages after enough pages exist
- staleness scoring, with deterministic parts in CLI health and semantic parts
  only in AI prompts
- evaluation goldens once real usage produces repeated agent tasks
- dependency propagation from code graphs only for languages/repos where cheap
  structure already exists

Avoid:

- semantic/vector search as a prerequisite for ongoing maintenance
- hosted crawlers or central services
- global full-wiki rewrites on every session
- mandatory schema for claims/provenance before conventions prove useful
- generated API/reference documentation in `.almanac/`
- LLM calls in `search`, `show`, `path`, `info`, `list`, `health`, or `reindex`
- propose/apply JSON plans between writer and reviewer
- automatic deletion, archival, or registry cleanup

## Recommended Model For Ongoing Updates

Recommended name: **Evidence-Bounded Garden Loop**.

Algorithm:

```text
on capture(session):
  evidence = collect {
    user request, final outcome, changed files, diff summary,
    notable commands/tests, commits/PRs/issues if available
  }

  changed_paths = normalize_paths(evidence.changed_files)

  candidate_pages = rank_and_cap(
    pages referencing changed_paths,
    backlinks/outlinks of those pages,
    topic neighbors,
    recently active migration/incident/decision pages
  )

  writer_prompt receives {
    evidence,
    candidate_pages with full text,
    search/path tools,
    .almanac/README.md,
    topic graph,
    rules: capture only durable why/invariant/flow/gotcha/incidents;
           update existing pages before creating new ones;
           resolve contradictions;
           preserve history via archive/supersede when useful;
           include source links/evidence for non-obvious claims
  }

  writer edits .almanac/pages directly.

  reviewer_prompt receives {
    git diff,
    touched pages,
    nearby graph,
    wiki README
  }

  reviewer critiques for {
    notability, duplication, missing links, broken provenance,
    contradicted existing pages, over-documenting code facts,
    stale pages left behind
  }

  writer decides whether to revise.
```

Bootstrap/garden variant:

```text
on bootstrap_or_explicit_garden(repo):
  rebuild deterministic index
  compute health/staleness signals
  ask agent to inspect high-score pages and topic clusters
  update/merge/archive/cross-link pages directly
  avoid sweeping rewrites unless the current wiki is clearly low quality
```

Implementation implications for future slices:

- The first useful "algorithm" is not a new database; it is a better capture
  prompt plus a deterministic affected-page query.
- The index already has the primitives needed: pages, wikilinks, file refs,
  topics, archived state, mtimes, and FTS.
- A future `health` can add deterministic wiki-gardening checks: orphan pages,
  dead refs, missing topics, slug mismatch, archived-link policy, and stale file
  refs. Semantic contradiction should stay in AI prompts.
- A future prompt convention can require an `Evidence` section for pages whose
  claims are not self-evident from linked files.
- Topic overview generation should be a bootstrap/garden behavior, not capture's
  default job.

Bottom line: codealmanac should not try to be "GraphRAG for code." It should be
a local wiki whose capture agent performs bounded, evidence-backed wiki
gardening after each meaningful coding session. The graph exists to focus the
agent's attention; the agent owns the judgment; git owns the audit trail.
