# Auto-Generating Wikis: Deep Research Note

Date: 2026-05-08
Author: research subagent
Audience: codealmanac project lead + future research/ readers
Tooling note: external fetches in this thread used the `mcp__almanac__search_web` and `mcp__almanac__read_webpage` tools (the standard `WebSearch`/`WebFetch` were not exposed to this subagent). Coverage is similar but rate limits forced sequential rather than fully parallel batches.

---

## TL;DR

The "LLM compiles a persistent wiki from raw sources" pattern that codealmanac is building is no longer fringe — between February 2024 and May 2026 it has become a small but distinct sub-field with at least two streams: (1) **academic Wikipedia-from-scratch generation** (STORM/Co-STORM, OmniThink, WikiAutoGen, WikiCrow/PaperQA2), where the metric is whether the article looks like a Wikipedia page, and (2) **product-grade auto-doc for codebases** (DeepWiki / Devin Wiki, Google Code Wiki, RepoAgent, DocAgent, CodeWiki, FSoft-AI4Code, Aider repo-map, Cline/Roo memory banks), where the metric is whether the agent reading it can ship code. codealmanac sits between the two, sharing techniques with the second cluster but committing — uniquely — to a *git-native, agent-maintained, decision-and-incident-oriented* wiki rather than an autodoc regenerated from source. The strongest external cross-checks of codealmanac's design choices are: STORM's perspective-guided question asking, GraphRAG's community summaries with `period` field for incremental merge, A-Mem's Zettelkasten-with-evolving-links architecture (Feb 2025), Letta's "sleep-time compute" framing of background memory consolidation (April 2025), and CodeWiki's hierarchical decomposition + agentic rubric eval (Oct 2025, ACL 2026). The strongest external warnings are: DeepWiki's documented hallucinations on under-documented repos (HN, Nov 2025), Wikipedia editors' field guide of LLM tells (`WP:AISIGNS`), and the "lost in the middle" / context-rot literature, which together imply that bigger context windows do not eliminate the need for a curated compiled artifact. RAG-vs-long-context is settled in production: hybrid retrieval over a curated layer beats both ends, and a wiki *is* the curated layer.

---

## What's new vs. existing internal notes

The internal `docs/research/` folder already covers:

- the Karpathy LLM-Wiki pattern (`karpathy-llm-wiki.md`, `farzapedia.md`),
- the agentic compilation framing and gardening loop (`2026-05-08-agentic-wiki-compilation.md`),
- algorithm families for incremental update (`2026-05-08-auto-updating-wiki-algorithms.md` — already cites GraphRAG, LightRAG, DeepDive, RepoDoc, RepoAgent, DocAider, CASCADE, Wikidata constraints, RAGAS),
- and initial-codebase construction (`2026-05-08-initial-codebase-wiki-construction.md`).

This note adds the following that the existing internal notes do not currently have:

1. **The Wikipedia-from-scratch stream as a peer to the autodoc stream.** Internal notes treat `codealmanac` mostly through the autodoc lens. STORM (NAACL 2024), Co-STORM (EMNLP 2024), OmniThink (Jan 2025), WikiAutoGen (ICCV 2025), and WikiCrow/PaperQA2 (FutureHouse, Sep 2024) form a coherent academic stream that the codebase-wiki literature mostly ignores but that gives codealmanac its strongest theoretical priors for *outline-then-fill* and *multi-perspective question asking*.
2. **Karpathy's actual tweet thread** (status 2039805659525644595, May 2026), not just the gist. The tweet contains specifics the gist softens: ~100 articles + ~400K words at the scale where "naive search beats fancy RAG", explicit mention of finetuning as a future step, and the framing that LLM Wiki is shifting his "token throughput from manipulating code to manipulating knowledge."
3. **Cognition's DeepWiki product details and steering JSON** (`.devin/wiki.json` with `repo_notes` and `pages`, max 30 pages / 80 enterprise) — codealmanac's `topics.yaml` is similar in spirit but optional, where DeepWiki's is a steering override.
4. **CodeWiki (FSoft-AI4Code, ACL 2026)** — open-source competitor to DeepWiki published October 2025; achieves 68.79% on its own CodeWikiBench rubric, supports 7 languages, uses recursive agent delegation. This is the most direct academic peer to codealmanac's `init` survey-then-deepen loop.
5. **A-Mem (Feb 2025, arXiv 2502.12110)** — Zettelkasten-method LLM memory with three operations: note construction, link generation, **memory evolution** (existing notes get rewritten as new ones arrive). This is exactly the "absorb means re-read and integrate, not append" rule from `farzapedia.md`, with formal eval.
6. **Sleep-time compute (Letta, April 2025, arXiv 2504.13171)** — explicit research framing of "use idle time between user turns to consolidate memory." codealmanac's session-end capture hook is a sleep-time compute system, and it's worth naming it that way.
7. **The DeepWiki accuracy debate on HN (Nov 2025, item 45884169)** — a maintainer documents hallucinations on his own repo (a VS Code extension fabricated as primary install method). Concrete cautionary tale for the autodoc-on-public-repo path that codealmanac is *not* taking.
8. **Wikipedia's `WP:AISIGNS` field guide** — an enforced editorial rejection list of LLM stylistic tells (em-dashes, peacock words, "interestingly", progressive narrative). codealmanac's writer prompt should adopt this almost verbatim; `farzapedia.md` already has a partial version.
9. **The "lost in the middle" / context-rot evidence** — Liu et al. 2024 TACL plus 2025 follow-ups. Quantifies why "just stuff it all in 1M tokens" doesn't kill RAG or wikis: production retrieval hovers at ~60% recall on multi-fact long-context, with ~45s latency at ~1,250x cost.
10. **The Cursor Rules empirical taxonomy** (Jiang & Nam, MSR 2026, arXiv 2512.18925) — 401 repos, five themes of project context: Conventions, Guidelines, Project Information, LLM Directives, Examples. codealmanac's notability bar can be calibrated against what real teams actually persist.

The rest of this note is structured A–E as the prompt requested.

---

## A. Academic foundations

### A.1 STORM and Co-STORM (Stanford OVAL)

**STORM**, "Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking," Shao, Jiang, Kanell, Xu, Khattab, Lam — arXiv:2402.14207 (v2 Apr 8 2024, NAACL 2024 main). Read in full via the abstract page and via the `stanford-oval/storm` README. The system splits article generation into two phases: a **pre-writing** phase that does perspective discovery + simulated multi-turn conversations between a "writer" persona and a "topic expert" grounded in Internet sources, ending with an outline; and a **writing** phase that fills the outline with retrieved citations. Two specific design moves are loadbearing: (a) discovering perspectives by surveying *similar existing Wikipedia articles* before asking questions, and (b) simulating a conversation rather than a flat question list, so that the model can issue follow-ups based on partial answers. The paper's evaluation introduces **FreshWiki**, a dataset of recent high-quality Wikipedia articles, and outline-quality metrics scored by experienced Wikipedia editors. Numbers worth quoting: STORM articles are rated organized by a +25% absolute increase over an outline-driven retrieval baseline, and broad in coverage by +10%. Editor feedback also surfaces two failure modes the field still hasn't fully solved: **source bias transfer** (the model adopts the bias of its retrieved sources) and **over-association of unrelated facts** (the model wikifies things that don't deserve to be linked).

**Co-STORM**, "Collaborative STORM," arXiv:2408.15232 (Aug 2024, EMNLP 2024 main). Adds a turn-managed discourse protocol with three roles: Co-STORM LLM experts (answer + raise follow-ups, grounded), a Moderator (asks questions inspired by retrieved-but-unused information — "things you didn't think to ask about"), and a human user (observes by default, can inject utterances). Critically, Co-STORM maintains a **dynamic mind map**, a hierarchical concept structure updated turn by turn, "to build a shared conceptual space between the human user and the system" and reduce the long-discourse cognitive load. Both implementations are in DSPy.

Implication for codealmanac: the Moderator role — surface what was discovered but never used — is exactly the gap that `almanac health` and capture's reviewer subagent need to fill. codealmanac currently has lint flags for `orphans`, `dead-refs`, `broken-links`, `empty-topics`, but no equivalent of "topics retrieved during a session that never made it into the wiki." That's a Moderator question. Worth considering as a future health category.

The Stanford research preview (`storm.genie.stanford.edu`) reports >70,000 unique users as of mid-2024.

### A.2 OmniThink (Jan 2025)

OmniThink, arXiv:2501.09751, *Expanding Knowledge Boundaries in Machine Writing through Thinking* — read via abstract HTML. Frames Wikipedia-style writing as a slow-thinking expansion process. Two key constructs: **Information Tree** (hierarchical research output) and **Conceptual Pool** (running synthesis). The agent iterates expand→reflect→expand. The eval metric is **knowledge density** — the paper claims OmniThink raises density without sacrificing coherence/depth. This addresses STORM's known weakness: STORM's outlines are good but the filled article often regurgitates surface facts. OmniThink's contribution is that the *post-research reflection step* is what raises factual density, not raw retrieval volume. WikiREVIEW (AAAI 2026) reports DeepSeek-R1 + multi-perspective review beating OmniThink by ~0.16 points on a 5-point scale on Chinese wiki article generation, suggesting reflection + critique stack additively.

### A.3 WikiAutoGen (ICCV 2025) and WikiCrow / PaperQA2 (FutureHouse, Sep 2024)

**WikiAutoGen**, Yang et al., arXiv:2503.19065 — multimodal Wikipedia article generation that integrates text + images. ICCV 2025. Adds the multi-modal angle that codealmanac doesn't currently address (codealmanac is markdown-only). For repository wikis this is increasingly relevant: architecture diagrams (DeepWiki, CodeWiki, Google Code Wiki all generate Mermaid/SVG) are visual artifacts the wiki must own, not just reference.

**WikiCrow / PaperQA2** (FutureHouse, Sep 11 2024) — read in full at `futurehouse.org/research-announcements/wikicrow`. The headline claim is that **PaperQA2-generated Wikipedia-style summaries of biology genes are judged more accurate, on average, than the actual existing Wikipedia articles by blinded PhD/postdoc-level biology researchers**. They generated articles for all 20,000 human genes, drawing from ~1M scientific papers. ContraCrow, a sister agent, found a mean of 2.34 statements per biology paper that contradict another paper somewhere in the literature. The PaperQA2 paper itself is arXiv:2409.13740 — "Language agents achieve superhuman synthesis of scientific knowledge."

This is the strongest existence proof to date that an auto-generated wiki can be *more* accurate than the human-curated equivalent in a narrow domain, when the source corpus is well-bounded (peer-reviewed literature) and the agent is optimized for retrieval+factuality. The flip side: in a less-bounded source corpus, the same architecture is what produces the DeepWiki hallucinations described below.

### A.4 WikiChat (Stanford, EMNLP 2023)

WikiChat, Semnani et al., aclanthology.org/2023.findings-emnlp.157 — pre-STORM. 7-stage pipeline that *post-edits* an LLM response by retaining only Wikipedia-grounded facts. Reported 97.9% factual accuracy in conversations about recent topics, vs 55.0% for raw GPT-4. Distillation of GPT-4 WikiChat into a 7B LLaMA preserved most quality. Relevant because it establishes that **grounding-after-generation** (sieve) is competitive with **grounding-before-generation** (retrieve-then-write); codealmanac currently does the latter, but the reviewer subagent is a sieve, and could be tuned more aggressively.

### A.5 GraphRAG, LazyGraphRAG, HippoRAG, A-Mem

**GraphRAG** (Microsoft, 2024, microsoft.github.io/graphrag): extracts an entity-relation graph from text, runs Leiden community detection, summarizes each community at multiple hierarchy levels, supports global (community-level) and local (entity-level) and DRIFT (hybrid) search. The `period` field on every output enables incremental merge; v0.4.0 (late 2024) shipped explicit incremental update. The internal note `2026-05-08-auto-updating-wiki-algorithms.md` already cites this in detail.

**LazyGraphRAG** (Microsoft Research blog, Nov 2024) — sets a new GraphRAG cost/quality baseline by *not* pre-computing summaries and instead deferring graph traversal to query time. Reported "4% of the query cost of GraphRAG global search" while outperforming on local and global queries. The Medium piece "GraphRAG Cost Cliff: How $33,000 Became $33 in Eighteen Months" tracks the cost trajectory. The lesson for codealmanac: pre-computed summaries are useful when the access pattern is read-many, write-few, but the cost ratio flips fast as the corpus grows. codealmanac's capture-time writes are write-side; the FTS-backed read side is already lazy.

**HippoRAG** (NeurIPS 2024, arXiv:2405.14831), Gutierrez, Shu, Gu, Yasunaga, Su — read in full. Builds a schemaless KG from a corpus, runs Personalized PageRank from query-derived entity seeds, treats KG paths as memory traces. Single-step multi-hop retrieval at 6–13× lower latency and 10–30× lower cost than IRCoT. Up to **+20% multi-hop QA over SOTA**. Frames the contrast: RAG is hippocampus-less; KG-based retrieval mimics hippocampal indexing. Importantly: the index is the entire memory, not a separate wiki. This is the **anti-codealmanac** position — that you don't need a markdown wiki at all if you have a good entity graph. Worth defending against. The defense is: HippoRAG is a retrieval substrate; it doesn't produce *human-readable explanations of why the code is shaped this way*, which is what a coding agent needs to read before touching unfamiliar subsystems. codealmanac is a compiled rationale layer over (potentially) a HippoRAG-style retrieval layer, not a replacement.

**HippoRAG 2** — `osu-nlp-group/hipporag` — adds continual integration; "From RAG to Memory" framing.

**A-Mem: Agentic Memory for LLM Agents** (Feb 2025, arXiv:2502.12110), Xu, Liang, Mei, Gao, Tan, Zhang — read in full. Three operations: (1) **Note Construction**: each new memory becomes a comprehensive note with structured attributes (contextual description, keywords, tags) plus an embedding. (2) **Link Generation**: identify shared attributes / similar contextual descriptions, establish links. (3) **Memory Evolution**: when a new memory enters, *existing* memories' contextual representations and attributes get updated. Explicitly inspired by Zettelkasten. Empirically beats Mem0, MemGPT/Letta-style baselines on six foundation models. The architectural pattern matches `farzapedia.md` *exactly*: "Re-read every article before updating it. Ask: what new dimension does this entry add?" — A-Mem's Memory Evolution step is the formal version of `farzapedia`'s "anti-thinning" rule.

Implication for codealmanac: the codebase does not currently have an explicit memory-evolution step. capture writes new pages and edits affected pages, but it doesn't propagate the way A-Mem describes. The next quality bump is probably here.

### A.6 MemGPT / Letta and sleep-time compute

**MemGPT**, arXiv:2310.08560 (Oct 2023, Packer et al.). The earliest "LLMs as operating systems" framing: hierarchical memory tiers (main context = RAM, archival = disk), LLM-driven paging via tool calls. Now subsumed under **Letta** (`letta-ai/letta`) — Letta is the platform; MemGPT was the first stateful agent on it. Letta's blog post "Stateful Agents: The Missing Link in LLM Intelligence" articulates the design space:

- read-only system prompts for core instructions,
- editable memory blocks (the human-curated context that the agent edits),
- archival memory (vector store for episodic recall).

**Sleep-time compute** (Letta, arXiv:2504.13171, April 2025, Packer & Snell). Explicit research framing: between user turns the agent has unused compute; spend it on memory consolidation, generating deeper notes, identifying patterns. Quoting Letta's blog: "Just as humans consolidate memories during sleep, agents can consolidate memory during downtime." Empirically reported as the next scaling axis after test-time compute.

This is the cleanest external articulation of what codealmanac's `SessionEnd` hook is doing. Naming it sleep-time compute rather than "post-session capture" might be worth doing in the project's own docs — it connects to a research literature, and it explains the philosophical commitment to *not* writing during the live session (which would cost interactive latency and pollute the user's flow with extra prose).

### A.7 Generative Agents and Reflexion-family self-critique

**Generative Agents** (Park et al., arXiv:2304.03442, UIST 2023). The Smallville paper. Three architectural primitives: (1) **memory stream** — chronological log of observations; (2) **retrieval** — recency × importance × relevance scoring; (3) **reflection** — periodic generation of higher-level inferences from clusters of recent observations. Reflections are themselves added to the memory stream. This is the canonical "summary-of-summaries" architecture, and importantly, the reflection step *creates* new entries rather than overwriting old ones. codealmanac's session capture is closer to "reflect" than to "observe": it reads the transcript (the observation) and writes a higher-level claim (the reflection).

**Reflexion** (Shinn et al., arXiv:2303.11366, NeurIPS 2023). Verbal reinforcement: agent attempts → fails → writes a natural-language self-critique → stores critique → tries again with critique in context. >4,600 citations as of May 2026. Establishes that **textual self-feedback loops** are competitive with parameter updates for many tasks.

**Self-Refine** and **Self-RAG** (arXiv:2310.11511, Asai et al.) — Self-RAG adds reflection tokens (`Retrieve`, `IsRel`, `IsSup`, `IsUse`) the model emits during generation, deciding when to retrieve and whether output is grounded. **CRAG** (Yan et al.) — Corrective RAG, evaluator scores retrieval, decomposes-recomposes when low confidence.

**Constitutional AI** (Bai et al., 2022, Anthropic). Self-critique against a written constitution → preferences → RLAIF. The lineage codealmanac's writer→reviewer subagent sits in: writer drafts, reviewer critiques against a written rubric (`prompts/reviewer.md`), writer decides. The empirical literature (LLM4Review, Microsoft AutoGen critic agents, the May 2026 "Reviewer Paradox" essay) all converge on the same finding: **single-shot self-critique adds quality, multi-agent debate adds 4–5× latency for diminishing returns past round 2**.

Implication for codealmanac: keeping reviewer to one round is well-supported. The interesting unexplored variant is *constitutional* — pulling the rubric explicitly from `.almanac/README.md` ("notability bar") rather than from a fixed prompt file.

### A.8 Knowledge-graph + LLM unification surveys

**Pan et al., "Unifying Large Language Models and Knowledge Graphs: A Roadmap"** — arXiv:2306.08302 (v3 Jan 2024, IEEE TKDE 2024). Three integration patterns: KG-augmented LLM (use KG at inference), LLM-augmented KG (use LLM to extract/clean), synergized LLM+KG (joint reasoning). Useful taxonomy, but the survey predates GraphRAG and is now slightly stale on implementation choices. Shows up in current work as the canonical citation for "why graphs matter."

VLDB 2024 LLM+KG workshop (vldb.org/workshops/2024/proceedings/LLM+KG/) — data management view: most failures of LLM+KG are at the *ingestion* and *update* boundaries, not at query time. Matches the codealmanac internal-note thesis.

### A.9 Knowledge editing (ROME, MEMIT, surveys)

ROME and MEMIT edit factual associations directly in the model weights. The 2024 survey "Knowledge Editing for Large Language Models" (arXiv:2310.16218) and the 2024 ACL findings paper "Can We Continually Edit Language Models?" (aclanthology.org/2024.findings-acl.323) both reach the same conclusion: **knowledge editing degrades with repeated edits** ("forgetting curve" on neighbor knowledge), is fragile to paraphrase, and does not handle relational updates well. The auto-wiki pattern is explicitly the *external* alternative — instead of rewriting weights, you maintain a markdown layer the model reads. The literature now cites "external memory / continual learning in token space" (Letta's framing) as the more practical of the two for production. codealmanac is a token-space continual-learning system.

### A.10 Repo-level documentation generation

Most of the relevant academic refs are already enumerated in `2026-05-08-auto-updating-wiki-algorithms.md` (RepoAgent EMNLP 2024 demo, RepoDoc, DocAider, Red Hat Code-to-Docs, CASCADE, drift detection arXiv:2212.01479, arXiv:2307.04291). New additions:

- **DocAgent** (Meta/UCI, arXiv:2504.08725, ACL 2025 demo) — multi-agent, **topological code processing for incremental context building**. The repo is on `facebookresearch/DocAgent`. Directly comparable to codealmanac's gardener: builds dependency graph, walks bottom-up, each function/class gets context from already-documented dependencies. Supports Python only. The "topological" insight is that documenting in dependency order means the LLM sees previously-written docs of leaf modules when documenting parents — a kind of bootstrapping that reduces context bloat.
- **CodeWiki** (FSoft-AI4Code, arXiv:2510.24428, ACL 2026 — read in full). 7 languages (Python, Java, JS, TS, C, C++, C#); v6 of the paper says 8. Three-phase pipeline: (1) static analysis with Tree-Sitter to build a `depends_on` directed graph + topological sort to identify zero-in-degree entry points; (2) hierarchical decomposition into module tree; (3) recursive agentic processing with **dynamic delegation** — when a module is too complex for one pass, the agent spawns sub-agents per submodule, recursively, bottom-up. On their own CodeWikiBench, CodeWiki scores **68.79% with proprietary models (Claude Sonnet 4)** and **64.80% with Kimi K2 Instruct**, both reportedly outperforming closed-source DeepWiki. Cross-module references are managed by a global registry to avoid duplication. CodeWikiBench introduces **hierarchical agentic rubrics derived from the project's own official documentation** — the rubric mirrors the project's architecture, with weighted requirements at multiple levels evaluated by judge agents.
- **OpenHands** (formerly OpenDevin) — large agent harness, has its own memory architecture; the CodeWiki paper actually *generates* documentation for OpenHands as one of its case studies.

Of these, **CodeWiki is the most direct academic peer to codealmanac's `init` flow**. The decomposition principles are nearly identical: discover entry points, work from leaves up. The differences are: CodeWiki is one-shot per repo (not session-driven, not capture-driven), produces architecture diagrams as a primary deliverable (codealmanac does not), and does not have the "decisions / incidents / gotchas" emphasis that codealmanac targets — CodeWikiBench rubrics are derived from existing official docs, so it cannot reward content that *isn't already in official docs*. That gap is precisely what codealmanac's notability bar is supposed to fill.

### A.11 Long-context vs. RAG / wiki

**"Lost in the Middle"** — Liu et al., TACL 2024 — established the U-shaped accuracy curve over context position. **NoLiMa** benchmark variant tests retrieval where needle and question share minimal vocabulary; models that ace vanilla NIAH fail it. The aggregate finding from 2025 production reporting (Tian Pan, Apr 2026; Databricks long-context benchmarks): Llama-3.1-405B starts degrading after 32K tokens; GPT-4 holds until ~64K; multi-fact recall in 1M-token contexts is roughly 60% even on Gemini 1.5 Pro. Latency 30–60× slower than RAG, ~1,250× cost per query. **The "RAG is dead" framing was wrong**; the production framing now is **hybrid**: a curated artifact (wiki / KG / summary index) plus targeted retrieval. codealmanac's commitment to FTS-first, vectors-only-if-needed lines up with the production consensus.

### A.12 Long-form factuality evaluation (FActScore, RAGAS, KILT)

- **FActScore** (Min et al., EMNLP 2023, arXiv:2305.14251) — decompose generation into atomic facts, verify each against retrieved Wikipedia. Standard for biography-style long-form factuality.
- **VeriScore** / **VerifastScore** (EMNLP 2025 findings) — speed-up of FActScore by joint atomic decomposition and verification.
- **RAGAS** (Es et al., arXiv:2309.15217) — context precision / recall, faithfulness, answer relevance. Library at `docs.ragas.io`. The codealmanac internal-note already cites this.
- **KILT** (Petroni et al., NAACL 2021) — Knowledge-Intensive Language Tasks benchmark; retrieval+generation with provenance.
- **CodeWikiBench** (CodeWiki paper) — first repo-level documentation rubric benchmark.
- **DeepResearch-9K** (arXiv:2603.01152, 2026) — challenging benchmark for deep-research agents writing Wikipedia-style summaries.
- **WikiREVIEW** (AAAI 2026) — multi-perspective review framework for auto-Wikipedia article evaluation.

For a wiki — as opposed to a single article — there is no clean equivalent. FActScore is per-article; RAGAS is per-query. The wiki-as-a-graph evaluation literature is sparse. This is a real gap. codealmanac's `health` command is the in-house version: orphans, stale, dead-refs, broken-links, broken-xwiki, empty-topics, empty-pages, slug-collisions. Worth comparing against Wikidata's "constraint violation reports" lineage (already in internal note).

---

## B. Industry / product implementations

### B.1 DeepWiki / Devin Wiki / DeepWiki MCP (Cognition)

**Public launch:** May 5 2025 (`cognition.ai/blog/deepwiki`, read in full). Replace `github.com` with `deepwiki.com` in any GitHub URL → auto-wiki. **>50,000 top public repos pre-indexed at launch** (MCP, LangChain, etc.). Free tier for public repos; private repos require a Devin account.

**Steering:** `.devin/wiki.json` — `repo_notes` (max 10,000 chars/note, max 100 notes total), `pages` (max 30, or 80 enterprise) with `title`, `purpose`, `parent`. If `pages` provided, the system **bypasses cluster-based default planning** and creates exactly the listed pages. This is a clean overrideable default — codealmanac's `topics.yaml` is similar but mandatory; DeepWiki's is optional. The default behavior described in docs: "auto-generated through cluster-based planning."

**DeepWiki MCP server** (May 22 2025) — exposes the generated wiki as MCP tools so other agents can read DeepWiki content as context. This is an interesting decoupling: the wiki becomes addressable infrastructure for agent context, not a UI.

**Steve Yegge's "Cheating is all you need"** (Sourcegraph, 2023) — predates DeepWiki but anticipates the playbook: "the 100k cheat sheet is how you tell the LLM about your code." The cheat-sheet metaphor maps onto codealmanac's "wiki as compiled artifact" thesis.

**Real-world reception (HN item 45884169, Nov 2025; HN 45002092, Aug 2025):** mixed. Two recurring themes from maintainers:

- **"Hallucinations confidently elevated to canonical truth."** A maintainer of `blopker/codebook` documented that DeepWiki's wiki for his repo presented an unfinished VS Code extension folder as the **primary install method**. He had to add a note in the README "explicitly to LLMs to not recommend it to users." Comment 45884955 articulates the worry: confused users → official docs no longer get user feedback → LLMs train on wrong autogenerated docs → downward spiral.
- **"It does well where there's narrative documentation already, less well where it has to invent."** Comment 45886157 from a maintainer of a 10-year-old codebase: "deepwiki does better ingesting narrative than code." The conclusion drawn is interesting and not pessimistic: stop polishing individual docs for human readability, instead "fill in gaps" with raw narrative and "lean on deepwiki to provide polish and some gap putty." This is an emergent UX pattern: **humans write structured raw notes, LLM compiles**. Same as Karpathy + Farzapedia + codealmanac.

The June 2025 r/PKMS thread (`1l29jz1`) — small but representative of the "sometimes pure gold, sometimes garbage" narrative.

### B.2 Google Code Wiki (Nov 13 2025)

`developers.googleblog.com/introducing-code-wiki-accelerating-your-code-understanding/` — launched Nov 13 2025. Free, generates interactive docs from any GitHub URL, includes architecture diagrams, lets you chat with Gemini against the indexed repo. Direct competitor to DeepWiki on the same playing field. Reception (HN 46054338, Nov 2025) is more cautious than enthusiastic: "Why after everything you've seen Google do, do you use the terms 'better' and 'trustworthy'?" Coverage at LinkedIn / Medium emphasizes interactive diagrams and chat-with-codebase as the differentiators.

### B.3 Cursor Rules + AGENTS.md

Cursor's `.cursor/rules/` (formerly `.cursorrules`) is the dominant practical incarnation of "documentation written for AI agents, not humans." The Jiang & Nam empirical study (MSR 2026, arXiv:2512.18925) coded 401 open-source repos with Cursor rules and produced a five-theme taxonomy:

1. **Project information** — what this project is, its goals, architecture overview;
2. **Conventions** — code style, naming, testing patterns;
3. **Guidelines** — recommended workflows, idioms, common gotchas;
4. **LLM Directives** — instructions like "don't add comments," "always prefer composition," "use this tool not that tool";
5. **Examples** — concrete code samples showing intended style.

Notable empirical findings (from skim — full paper has 76K chars):

- Themes co-occur heavily; rules files are usually multi-theme, not single-purpose.
- A non-trivial proportion of duplicated lines across repos (i.e. boilerplate getting copy-pasted into rules — a tooling smell that suggests rules files would benefit from a shared library).
- Composition over time: most rules grow by accretion; few are rewritten.

**AGENTS.md** is the open-standard cousin (adopted by Anthropic Claude Code, OpenAI Codex CLI, others). Same idea, vendor-neutral file name. The `firasesbai.com` "AI Coding Agents: A Practical Guide" (Feb 2026) calls AGENTS.md "an open standard."

Implication for codealmanac: codealmanac's wiki *complements* `CLAUDE.md` / `AGENTS.md` rather than replacing them. Rules files are *prescriptive* (what the agent should do); the wiki is *descriptive* (what the codebase is, why it's that way). The empirical Cursor-rules taxonomy gives a clean separation: codealmanac owns themes 1, 3 (partial), and arguably 5; rules files own 2 and 4.

### B.4 Cline Memory Bank, Roo Code Memory Bank, OpenHands memory

**Cline Memory Bank** (`docs.cline.bot/features/memory-bank`, read in full). Six core files: `projectbrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`. Hierarchical: project brief is the foundation, others build on it, `activeContext.md` updates most often. Key commands: "follow your custom instructions," "initialize memory bank," "update memory bank." The custom-instructions block frames memory poetically: *"I am Cline, an expert software engineer with a unique characteristic: my memory resets completely between sessions."*

The Cline Memory Bank pattern is **prescriptive** (tells the agent how to maintain it), where codealmanac is **descriptive** (the agent already knows the rules from `CLAUDE.md`). Cline Memory Bank's hierarchy of 6 fixed files is much shallower than codealmanac's flat-page-graph, but the *philosophical posture* is identical: external markdown is the only persistent state across sessions.

**Roo Code Memory Bank** (`GreatScottyMac/roo-code-memory-bank`) is a port. The Vectorize "Hindsight" piece (May 2026, `agent-harness-needs-memory`) is a useful comparative essay: "Cursor, Cline, Roo Code, Aider — these IDE-resident harnesses generally rely on rules files for static context and have minimal native memory."

**OpenHands** has its own memory architecture; CodeWiki's case studies include OpenHands as a generated-doc target.

### B.5 Aider repo-map, Continue @codebase

**Aider repo-map** (`aider.chat/docs/repomap.html`, read in full). Computed with Tree-Sitter ASTs, ranked by a graph-ranking algorithm over file-dependency graph, cropped to a token budget (`--map-tokens`, default 1k). Sent with every request. Shows class/method signatures, not bodies. Adaptive: expands when no files are added to the chat, contracts otherwise. The Aider blog post `aider.chat/2023/10/22/repomap.html` is the canonical write-up.

This is a **deterministic, on-the-fly index**, not a wiki. Different design point: zero persistence, zero LLM in the loop at index time. codealmanac's index.db (FTS over wiki pages) is a complement, not a replacement.

**Continue @codebase** — uses embeddings, ranks by similarity, retrieves top-k chunks (`continue-docs.mintlify.app/customize/model-roles/embeddings`). Local LanceDB store under `~/.continue`. Closer to vanilla RAG.

The synthesis: there are three layers of repo context:

1. **Map** (Aider) — symbol-level, deterministic, ephemeral.
2. **Embeddings** (Continue) — semantic, indexed, ephemeral-ish.
3. **Wiki** (codealmanac, DeepWiki, Cline Memory Bank) — narrative, agent-curated, persistent.

These can coexist. codealmanac probably should not try to replicate (1) or (2) — they belong to the editor.

### B.6 GitHub Copilot Workspace, Sourcegraph Cody

**Copilot Workspace** — Spec mode + Plan mode + Implement mode. The spec is generated by the agent and edited by the human; it lives in the issue, not the repo. The *spec is the wiki*, but it's per-task and doesn't accumulate.

**Sourcegraph Cody** — "How Cody understands your codebase" + "Toward infinite context for code" + "How Cody provides remote repository awareness." Uses Sourcegraph's existing code-graph infrastructure (precise references, cross-repo) plus embeddings plus long-context. Cody Context Filters let admins scope which repos are accessible to which users. Enterprise focus. Cody is closer to the "graph + retrieval" school than to the "compiled wiki" school.

### B.7 Notion AI Q&A, Glean, Mem.ai/Reflect, Tana

**Notion AI Q&A** — RAG across the workspace. Permissions-aware. UI-first. No claim of building a separate wiki layer; the workspace *is* the wiki.

**Glean** — enterprise search, knowledge-graph-augmented (`glean.com/blog/enterprise-ai-knowledge-graph`, `glean.com/product/enterprise-graph`), 100+ app connectors, permission-enforced. Their differentiator is the "Enterprise Graph" — a knowledge graph built from people, content, signals (clicks, edits) — not a markdown wiki. The May 2026 Reddit thread (`1t2ihou`) frames the survival question well: "Will Glean survive Claude Cowork?... Maybe Glean survives as infrastructure: a neutral, permission-aware knowledge layer that Claude/Copilot/Gemini-style agents can call into."

**Mem.ai** — still operating as of May 2026 per `help.mem.ai`. Earlier rumors of shutdown were wrong; Mem 2.0 / "Thought Partner" pivot. Personal-knowledge focus. Their experience is instructive on the **maintenance-burden ceiling**: see Reddit thread `1posk4o` "Anyone else exhausted from building their knowledge system?" — three-year arc through Notion, Obsidian, Logseq, Tana. The recurring complaint: **the tools are good, the practice is unsustainable**. Karpathy's "LLMs don't get bored" claim is the bet that this changes.

**Reflect** — backlinked notes, AI Q&A, less marketing presence than peers.

**Tana** — node-based, AI-augmented, has gained adopters specifically for AI features per `polyinnovator.space`.

### B.8 Karpathy LLM Wiki — actual tweet content

The X post (status 2039805659525644595) — read in full. Quote of substance:

> "Something I'm finding very useful recently: using LLMs to build personal knowledge bases for various topics of research interest. In this way, a large fraction of my recent token throughput is going less into manipulating code, and more into manipulating knowledge (stored as markdown and images)... once your wiki is big enough (e.g. mine on some recent research is ~100 articles and ~400K words), you can ask your LLM agent all kinds of complex questions against the wiki, and it will go off, research the answers, etc. I thought I had to reach for fancy RAG, but the LLM has been pretty good about auto-maintaining index files and brief summaries of all the documents and it reads all the important related data fairly easily at this ~small scale... As the repo grows, the natural desire is to also think about synthetic data generation + finetuning to have your LLM 'know' the data in its weights instead of just context windows."

Key facts the gist softens:

- **~100 articles / ~400K words is the working scale** at which Karpathy says "naive search beats RAG" — useful as a calibration point for codealmanac. Below this, FTS is enough. Above, may need vectors.
- He explicitly mentions **finetuning** as the next step beyond context.
- He frames this as a **token-throughput shift**: code → knowledge. This is the consumer-side market thesis.
- He coins "the LLM is the programmer; the wiki is the codebase" and "Obsidian is the IDE."

The Reddit AI_Agents thread (`1szbyh2`, "The Karpathy LLM-Wiki pattern is escaping Twitter and becoming...") tracks the pattern moving from "interesting tweet" to "open-source desktop apps that turn notes into linked knowledge bases."

### B.9 Anthropic Projects, ChatGPT Memory, Gemini Gems

These are the **mass-market versions** of the auto-knowledge construction pattern, but each takes a quite different shape:

- **Claude Projects** — a folder of attached files + a custom instruction. RAG-like in shape; no explicit wiki layer.
- **ChatGPT Memory** — auto-extracted facts from conversation, stored as natural-language bullets, surfaced into future turns. Closest to MemGPT/Letta in spirit but much simpler: no editable structure, no graph.
- **Gemini Gems** — preset personas with attached instructions; no persistent state across sessions beyond the gem definition.
- **NotebookLM** — closest to Karpathy's pattern, but the "knowledge artifact" is the conversation + audio overview, not a markdown wiki the user can edit.

None of the big-three vendors ship the **explicit compiled-markdown-wiki** layer that codealmanac and Cline Memory Bank do. This is partly product strategy (they want the data inside their UI) and partly architectural (their RAG is competitive enough at consumer scale).

### B.10 Mintlify, Swimm, AutoCodeDocs

**Mintlify** has been pivoting from "doc hosting" to "doc maintenance" — the April 2026 blog "Documentation is dead. Long live documentation." (`mintlify.com/blog/documentation-is-dead`) explicitly reframes docs as "50% for AI, 50% for humans," and proposes treating docs as critical infrastructure. Their `mintlify.com/docs/guides/maintenance` recommends: same-PR doc updates, doc check in feature launch checklist, tracking stale content via mtime scripts.

**Swimm** — code-coupled documentation with annotations that break when the underlying code changes; built around drift detection.

**AutoCodeDocs.ai** — generates README + API docs from code uploads. Skim only.

The pattern across all three: **drift detection** is now the dominant maintenance mechanism. codealmanac's `health --dead-refs` is the same idea; the academic literature on docs-as-tests (CASCADE, arXiv:2604.19400) is the rigorous version.

---

## C. Open-source repos / patterns

The directly relevant repositories, briefly:

| Repo | Stars (approx, May 2026) | What it is |
|------|------|------|
| `stanford-oval/storm` | 28.2k | STORM + Co-STORM |
| `OSU-NLP-Group/HippoRAG` | growing | HippoRAG / HippoRAG 2 |
| `Future-House/paper-qa` | growing | PaperQA2 / WikiCrow |
| `microsoft/graphrag` | very large | GraphRAG indexer + pipelines |
| `OpenBMB/RepoAgent` | active | Repo-level doc maintenance |
| `facebookresearch/DocAgent` | new | Multi-agent topological docstrings |
| `FSoft-AI4Code/CodeWiki` | new | ACL 2026 framework |
| `WujiangXu/AgenticMemory` | active | A-Mem reference impl |
| `letta-ai/letta` | very large | Stateful agent OS |
| `Aider-AI/aider` | very large | Repo-map |
| `continuedev/continue` | very large | @codebase |
| `cline/cline` + `GreatScottyMac/roo-code-memory-bank` | active | Memory Bank pattern |
| `brianpetro/obsidian-smart-connections` | 938k+ downloads | Obsidian semantic search |
| `assafelovic/gpt-researcher` | very large | Web research agent |
| `idosal/git-mcp` | ~8k | "GitMCP transforms GitHub projects into documentation hubs" via MCP |
| `joshylchen/zettelkasten` | small | AI-assisted Zettelkasten reference impl |

The **GitMCP** ecosystem is worth a beat: it's a meta-pattern where any GitHub repo gets exposed as an MCP server, with documentation as the dominant exposed resource. A natural future move for codealmanac is to expose `.almanac/` as an MCP server, which would let other agents read the wiki without the CLI. Several of the awesome-mcp-servers lists (`TensorBlock/awesome-mcp-servers`, `tolkonepiu/best-of-mcp-servers`) already include `git-mcp` and DeepWiki MCP.

---

## D. Reddit / HN / Twitter community signal

### D.1 HN signal on DeepWiki and code-wiki tooling

The Nov 2025 thread (HN 45884169, "AI documentation you can talk to, for every repo") read in full above is the highest-signal recent discussion. Key takeaways from real maintainers:

- **The polarization is real:** the same product reads as "pure gold" to one maintainer and "wrong in every section" to another. The HN thread itself acknowledges this is unusual: "I've never seen such aggressive dismissal of people's negative experiences without even knowing if their use case is significantly different." Maintainers' reactions appear to depend on whether their repo is heavily-discussed-online (LLMs have lots of training-time priors) vs. obscure.
- **The dependency on existing narrative documentation is huge.** "deepwiki does better ingesting narrative than code... I should instead spend that effort to fill in gaps, both details and to provide higher-level layers of narrative to unify the detailed documentation." The auto-wiki rewards repos that already write the *why*, which echoes the codealmanac position.
- **Hallucination → user adoption → training-corpus contamination** is a stated worry. The proposed mitigation in the thread is an HTML meta-tag for AI-generated content (whatwg/html issue 9479). codealmanac's `archive` mechanism is the closest internal analog.

The Aug 2025 HN 45002092 ("DeepWiki: Understand Any Codebase") and the Nov 2025 Codemaps post (HN 45813767) are both more positive in tone, suggesting that *for popular repos* the experience is genuinely useful. The Migrating Dillo thread (HN 46096800) mentions DeepWiki only supports GitHub.

The June 2025 r/PKMS thread (`1l29jz1`) titled "Thoughts on DevinAI Deep Wiki as a second brain or PKM tool?" — score 8 — has the line "$300k on it!" which is the running joke that DeepWiki feels expensive-to-build per output quality. Two comments only — small sample.

### D.2 Reddit ML / Cline / RooCode signal

- **Why teams ditched knowledge graphs for memory** (`r/AI_India`, `1sjki8z`): "Every other week someone drops a new memory layer for AI agents. Most of them do..." The thread tracks the pattern of teams trying GraphRAG → Mem0 → Letta → custom and frequently winding back to "structured markdown + targeted retrieval" as the simplest thing that works.
- **r/RooCode** `1m3f3ag` — community discussion of memory-bank patterns. Recurring complaint: memory banks pollute rules files, get stale, get truncated by auto-context-management.
- **r/ClaudeCode** `1s05abq` "How I got Claude Code to maintain its own documentation (and stop hallucinating)" — the user's recipe is essentially codealmanac's `CLAUDE.md` recipe: explicit instruction at end of every flow to update doc. **The whole codealmanac thesis is that this should be a separate background agent, not an in-line discipline.**
- **r/Zettelkasten** `1hbwtm6` "atomizing is the bottleneck" — from December 2024: "I've tried getting LLMs to break things into atomic notes for me, but they usually do a shit job because they make too many irrelevant ones." This is the **anti-thinning failure mode** Farzapedia and codealmanac both worry about.

### D.3 PKM exhaustion thread

`r/PKMS` `1posk4o` "Anyone else exhausted from building their knowledge system?" The arc — Notion → Obsidian → Logseq → Tana → ??? — is a specific data point against Karpathy's "LLMs don't get bored" claim *as currently realized*. The current generation of AI-assisted PKM tools still requires substantial human curation; LLMs have bridged some maintenance burden but introduced new ones (correcting hallucinations, prompting for updates, double-checking citations). codealmanac is making a specific bet that **automating the bookkeeping at session-end** is the maintenance step that actually pays off, while letting humans curate the sources.

---

## E. The hard, honest questions — answered

### E.1 Does the wiki actually beat RAG-over-raw-sources?

**Short answer:** yes, in most production settings, but for non-obvious reasons. Long answer:

Three pieces of evidence converge:

1. **The "lost in the middle" effect** (TACL 2024) means recall on multi-fact long-context drops to ~60% well before the advertised window. Compiled summaries that fit in the high-attention positions (first/last) of a much shorter context outperform raw stuffing.
2. **GraphRAG / LazyGraphRAG** vs naive RAG: GraphRAG global search outperforms naive RAG on synthesis questions; LazyGraphRAG matches GraphRAG quality at 4% of the cost by deferring summary computation. This says compiled artifacts help, but you don't always need to compile eagerly.
3. **WikiCrow / PaperQA2** is the strongest existence proof: agent-generated Wikipedia gene articles are judged *more* accurate than human Wikipedia by domain experts. The wiki is the artifact; the RAG is its read path.

The case where RAG-over-raw beats a wiki: when the *raw* sources are already well-curated and high-density (e.g. a focused paper corpus the user owns and trusts), and the questions are local, not synthesizing. There, the compilation step is overhead.

For codealmanac's use case — a codebase with mixed-quality scattered context (commits, PRs, threads, comments, design docs) — the compilation step is where most of the value is. The wiki is the compressed, contradictions-already-flagged, decisions-already-explained artifact that turns a noisy source set into a useful one.

### E.2 The maintenance problem — does "LLMs don't get bored" hold?

Partially. The pattern that holds: **LLMs do not skip steps in a defined flow** — bookkeeping, link maintenance, contradiction-flagging — that humans skip out of fatigue. Empirically (A-Mem, Letta, codealmanac internal evidence), this is real.

The pattern that fails: **LLMs introduce new failure modes humans don't.** The DeepWiki maintainer thread is a clean example: confidently wrong content is worse than missing content because users can't tell the difference. Aggregated drift over time (summary-of-summary lossiness) is a different version of the same problem — formally studied as **catastrophic forgetting in continual learning** and **error compounding in self-improving systems** (Reflexion, Self-RAG follow-ups, Constitutional AI critiques of RLAIF).

Specific failure modes in maintained KBs that aren't in the codealmanac internal notes yet:

- **Schema rot.** Topic taxonomies that made sense 6 months ago no longer fit the data; the agent keeps filing under old categories.
- **Citation laundering.** Page A cites Page B which cites Page A — the agent loses the original source.
- **Stylistic homogenization.** Over time every page reads the same; distinctive findings flatten.
- **Confidence inflation.** Hedges erode with each revision; "we suspect" → "we know" without new evidence.

The proposed mitigations across the literature: Wikidata-style constraint reports, Constitutional-AI-style explicit critique against a written rubric (codealmanac's reviewer subagent), and aggressive provenance (W3C PROV, codealmanac's `files:` and source attribution).

### E.3 Notability — what deserves a page?

Three reference frames exist, and they disagree:

- **Wikipedia (notability for human encyclopedia)** — secondary sources, widespread coverage, "presumed of lasting value." Designed for an open-write environment with vandals.
- **Fan wikis** — much lower bar; basically any named entity with cross-references in primary material gets a page. The Star Wars `Forum:CT` thread on removing notability requirements is the canonical "fan wikis don't need this" debate.
- **DeepWiki / CodeWiki** — automatic clustering decides; no explicit notability bar; the system creates whatever its architecture surfaces. CodeWiki uses dependency-graph entry points; DeepWiki uses LLM clustering. Neither asks "is this worth a page?" — they ask "is this a coherent unit?"

codealmanac's `.almanac/README.md` notability bar is closer to Wikipedia than to fan wikis: explicit decisions, multi-file flows, gotchas, external dependencies — *the things the code can't say*. This is a deliberate narrowing. The empirical Cursor-rules taxonomy (Jiang & Nam 2026) is one external calibration: across 401 real repos, the most-encoded context types are conventions, guidelines, and project info — not every entity. That suggests codealmanac's notability bar is well-calibrated.

The *learned* notability signal is an open research question. The closest thing to it in current systems is community-detection-derived notability (GraphRAG's communities are de-facto pages) and STORM's "entities that show up across multiple perspectives." Neither is the same as "a future agent will need this."

### E.4 Page granularity

Three positions in the literature:

1. **Atomic / Zettelkasten** (Andy Matuschak's evergreen notes, A-Mem, Farzapedia). One concept per note, links carry the structure. Rationale: composable, re-mixable, bears the load of structural change.
2. **Article-sized** (STORM, OmniThink, WikiCrow, Wikipedia itself). Long-form prose, sections within. Rationale: coherence, narrative flow, supports a reader who reads top-to-bottom.
3. **Hierarchical decomposition** (CodeWiki, GraphRAG community summaries, DeepWiki cluster pages). Variable granularity; leaf pages are fine-grained, parent pages aggregate. Rationale: scale.

codealmanac is currently a hybrid: pages are article-sized but linked, with `topics` as a hierarchical index. This is closest to position 2 with a position-3 index layer, which matches Wikipedia in shape. The Farzapedia "150 lines = split" rule is the empirical heuristic.

The literature does not have a clean answer on which is better for the *AI-reader* case. STORM evaluates against human reviewers; A-Mem evaluates against retrieval QA accuracy; codealmanac's optimization target is "future coding agent finds the rationale fast." A small experiment worth running: compare retrieval+answer accuracy on a fixed Q&A set across atomic vs. article-sized formulations of the same content.

### E.5 Update vs. append vs. archive

The patterns observed across systems:

- **In-place edit** (codealmanac default, A-Mem memory evolution, GitLab docs guide). git history is the record. Best when most updates are refinements.
- **Append-only with timestamps** (Generative Agents memory stream, Letta archival, log.md in Karpathy's pattern). Best when the timeline matters and the agent will reflect over it later.
- **Versioned snapshots** (Wikidata's references retain old values; Wikipedia history). Heavyweight.
- **Archive on fundamental reversal** (codealmanac's "archive mechanism"). Best when the page's *thesis* changed, not just facts.
- **Branch-and-fork** (rare; mostly proposed in malleable-software literature, Geoffrey Litt). Allows speculative revisions; integration is hard.

codealmanac has the right primitives but is light on the *append* end: the spec emphasizes in-place edit + archive, which means the *timeline of how a decision evolved* may not be readable from the wiki — only from git log. The Karpathy `log.md` pattern is the simplest fix.

### E.6 Multi-agent writer/reviewer

Has academic grounding: Self-Refine (Madaan et al., NeurIPS 2023), Reflexion, Constitutional AI's RLAIF, AutoGen's critic agents. The empirical finding across these literatures: **one round of self-critique adds quality; debate beyond round 2 has diminishing returns and 4–5× cost** (Reviewer Paradox essay, Digixr; LLM4Review). Single-shot writer→reviewer→writer is the sweet spot, which is exactly codealmanac's architecture.

The interesting refinement is **constitutional**: explicit written rubric the reviewer scores against, instead of "review this critically." codealmanac's `prompts/reviewer.md` plus `.almanac/README.md` notability bar functions as a constitution today, but the rubric is implicit. Making it explicit (pull the rubric into the reviewer prompt at runtime) is a small change with documented benefit in the constitutional literature.

### E.7 Evaluation

State of practice for auto-generated wikis (as of May 2026):

- **Article-level**: FActScore atomic claims + retrieval verification (slow but reliable); RAGAS faithfulness/precision (cheap, less granular); LLM-as-judge with rubric (CodeWikiBench's approach).
- **Wiki-level**: no standard. CodeWikiBench is the closest — hierarchical rubrics derived from existing official docs, judge agents per leaf, weighted aggregation. STORM uses expert (Wikipedia-editor) review for outline quality.
- **Downstream task**: PaperQA2's strongest argument is *not* that articles look better, it's that **researchers using PaperQA2 answers score higher on LitQA2**. This is the right metric for codealmanac too: wikis exist to make the *next* coding session faster/correct-er. Measure that, not prose quality.

codealmanac's `health` command is a structural-graph evaluator, not a content evaluator. A useful addition is **a downstream eval rig**: pick a fixed set of "tasks the next agent might do" (find the auth flow; find why X was decided; find the git ref that introduced Y), run them with and without the wiki in context, measure success rate. This is closer to the PaperQA2 / KILT methodology than to FActScore.

### E.8 Codebase-specific concerns: the stale-doc problem

Why has auto-doc historically failed? Several reasons converge:

- **Doc generation was decoupled from code change.** Doxygen / JSDoc ran on demand; nobody re-ran them.
- **Doc content was structural, not semantic.** "Function foo takes int x and returns int y" — generatable but useless.
- **No drift detection.** Stale docs were indistinguishable from fresh docs.
- **Humans hated maintaining them.** Friction accrued at the wrong layer (write-time, not read-time).

Why might LLM-maintained wikis succeed where Doxygen didn't?

- **Generation is now cheap enough to do per session-end** (codealmanac's hook).
- **Content is now narrative, not structural** — the wiki captures *why*, which is the part that ages slowly.
- **Drift detection is mechanical** — `health --dead-refs` walks file mtimes against frontmatter `files:`; the academic literature (CASCADE, drift-detection papers) shows this is solved.
- **Reading is now LLM-mediated** — even imperfect wikis are useful to an agent that can cross-check against code.

Counter-arguments:

- **"Now you have two stale things to maintain."** True if the wiki replicates the code; not true if the wiki is *complementary* (decisions, not signatures). codealmanac's notability bar is the defense.
- **"Hallucination poisoning."** DeepWiki HN thread evidence. codealmanac's mitigations: explicit notability bar, reviewer subagent, the user reviews `git diff` after capture. Not perfect, but the loop is shorter than DeepWiki's (which writes once, never gets corrected).
- **"AI-generated content gets fed back into training corpora."** Real long-term concern. The proposed mitigation (whatwg/html issue 9479 — AI-generated meta-tag) is not yet adopted.

### E.9 Wiki-as-context-window — does long context kill wikis?

No, for the reasons in §A.11 (lost-in-the-middle, cost, latency). Specifically:

- A 1M-token raw repo dump achieves ~60% multi-fact recall, costs ~$2/query, takes ~45s.
- A 5K-token wiki excerpt achieves higher recall (relevant content is dense and at the front), costs ~$0.0001/query, takes ~1s.
- The cost gap is roughly **1,250×** at the per-query level; the latency gap is **30–60×**.

The case where long context *does* beat a wiki: **implicit queries** — "what's concerning about this contract?" — where you don't know what to retrieve. Most coding-agent workflows are not implicit in this sense; they're "find X, change Y." The wiki wins.

A subtle finding: long context plus wiki beats either alone. Sourcegraph's "Toward infinite context for code" reports 3 quality metrics improve when long-context models are *fed* curated context (vs. raw repo or pure long-context). Curation is the value-add; the wiki is the curation.

### E.10 Privacy / multi-tenant

Crosses authors / projects / orgs introduces:

- **Provenance integrity.** Every claim should trace to a source. W3C PROV's entities/activities/agents model is the standard; Wikidata's "statement references" is the operational version. codealmanac's `files:` frontmatter is the lightweight version; cross-wiki `[[wiki:slug]]` references push provenance further.
- **Permission-aware retrieval.** Glean's enterprise graph is built around this; Sourcegraph Cody's Context Filters; DeepWiki's public/private split. codealmanac is single-repo by design, which sidesteps most of this.
- **Conflict resolution.** If two contributors disagree, Wikipedia's NPOV applies; in agent-maintained wikis, the reviewer subagent chooses, which is opinionated. The conflict-detection literature (NeurIPS 2024 benchmark on knowledge conflicts; arXiv:2604.16339 process-aware conflict detection) is young.
- **Citation laundering across wikis.** When `openalmanac:supabase` is referenced from `codealmanac` and the openalmanac page is itself agent-generated, the chain of provenance gets thin. This is the cross-wiki version of the DeepWiki training-corpus contamination worry.

---

## Open questions for codealmanac specifically

1. **Should `capture` adopt A-Mem's explicit memory-evolution step?** Currently capture writes new pages and edits affected pages. A-Mem's third operation (existing memories' contextual representations get updated when a new note arrives) is specifically the propagation step. Worth piloting on a few sessions and seeing whether it raises the value of older pages.
2. **Should the reviewer prompt be made constitutional — i.e., load `.almanac/README.md`'s notability bar into the rubric at runtime?** The constitutional-AI literature suggests yes; the cost is one extra read.
3. **Should codealmanac expose `.almanac/` as an MCP server?** Other agents could read the wiki without invoking the CLI. DeepWiki MCP exists as a precedent. The local-first commitment doesn't preclude this — MCP can be local.
4. **What's the right downstream eval?** A fixed task suite ("find the auth flow", "find the git ref where X was decided", "explain why Y is structured this way") with and without the wiki in context. PaperQA2-style downstream measurement, not FActScore.
5. **How does codealmanac handle schema rot in `topics.yaml`?** Topics evolve; pages get tagged under categories that no longer fit. There's a `health --orphan` flag but nothing for "topic that should split." The Farzapedia `/wiki reorganize` step is the manual version.
6. **Is the "atomic vs article" granularity decision empirical or theological?** Worth a small A/B with the same source content, measuring agent-retrieval+answer quality.
7. **How does codealmanac avoid the DeepWiki failure mode on under-documented codebases?** Currently the answer is "we only write things future agents will need," which is a notability bar. But on a very young codebase, the wiki may be sparse-to-empty, and the agent may try to fill it speculatively. Defenses: explicit "do nothing" path (codealmanac has this), reviewer rejection of low-evidence pages, possibly a minimum-evidence threshold (N source files / N session mentions before a page is allowed).
8. **What about the Letta/MemGPT hierarchy of memory tiers?** codealmanac currently treats all wiki pages as equivalent; a Letta-style "core memory" (project-level invariants, always in context) vs. "archival" (search-on-demand) split might be useful — and is already what `.almanac/README.md` *is*, informally.
9. **Should codealmanac add a `log.md` (Karpathy / Generative Agents stream)?** Append-only timeline of capture events. Cheap. Reads well. Gives the wiki a temporal axis it currently lacks.
10. **What's the cross-wiki integrity story when both ends are agent-maintained?** The `[[wiki:slug]]` cross-reference resolves to a stub that may itself be auto-generated. Provenance is shallow. May be tolerable in practice but worth a design pass.

---

## Suggested follow-up reading list (prioritized)

1. **CodeWiki paper (FSoft-AI4Code, ACL 2026)** — arXiv:2510.24428. Most direct peer; ingest CodeWikiBench rubric methodology in detail.
2. **A-Mem (Feb 2025)** — arXiv:2502.12110. Memory-evolution mechanic.
3. **STORM + Co-STORM** — arXiv:2402.14207, 2408.15232. The Moderator role and mind-map idea.
4. **OmniThink** — arXiv:2501.09751. Slow-thinking expansion + knowledge density metric.
5. **Letta sleep-time compute** — arXiv:2504.13171. The right framing for capture.
6. **HippoRAG + HippoRAG 2** — arXiv:2405.14831. The "wiki vs KG" challenge to defend against.
7. **Cursor Rules empirical study** — arXiv:2512.18925. Five-theme taxonomy as calibration.
8. **DocAgent** — arXiv:2504.08725. Topological context-building for repo-level doc.
9. **GraphRAG → LazyGraphRAG progression** — Microsoft Research blog Nov 2024. Cost trajectory.
10. **WikiCrow / PaperQA2** — arXiv:2409.13740 + futurehouse.org. Existence proof of superhuman wiki.
11. **Wikipedia `WP:AISIGNS`** — en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing. Style rejection list.
12. **Cline Memory Bank docs** — docs.cline.bot/features/memory-bank. Closest deployed analog.
13. **HN thread on DeepWiki accuracy** — news.ycombinator.com/item?id=45884169. Real-world failure modes.
14. **Aider repo-map blog** — aider.chat/2023/10/22/repomap.html. Deterministic-index baseline to compare against.
15. **Long-context vs RAG decision framework** — tianpan.co/blog/2026-04-09-long-context-vs-rag-production-decision-framework. Production economics.

---

## Source log

Every URL fetched by this subagent in producing this note, with one-line summaries:

- `arxiv.org/abs/2402.14207` — STORM paper abstract page; v2 Apr 8 2024, NAACL 2024.
- `github.com/stanford-oval/storm` — STORM/Co-STORM impl; latest news, install, API surface.
- `cognition.ai/blog/deepwiki` — DeepWiki public launch announcement, May 5 2025.
- `docs.devin.ai/work-with-devin/deepwiki` — `.devin/wiki.json` schema, steering options, validation limits.
- `arxiv.org/html/2405.14831v1` — HippoRAG full paper HTML; hippocampal indexing, Personalized PageRank.
- `arxiv.org/html/2510.24428v1` — CodeWiki paper full HTML; hierarchical decomposition + recursive agents.
- `aider.chat/docs/repomap.html` — Aider repo-map architecture; Tree-Sitter + ranking.
- `docs.cline.bot/features/memory-bank` — Cline Memory Bank canonical docs.
- `x.com/karpathy/status/2039805659525644595` — Karpathy LLM Knowledge Bases tweet, May 2026.
- `arxiv.org/html/2502.12110v1` — A-Mem agentic memory full paper; Note Construction / Link Generation / Memory Evolution.
- `www.futurehouse.org/research-announcements/wikicrow` — PaperQA2 / WikiCrow announcement; superhuman gene Wikipedia claim.
- `news.ycombinator.com/item?id=45884169` — HN DeepWiki accuracy thread; maintainer hallucination report.
- `tianpan.co/blog/2026-04-09-long-context-vs-rag-production-decision-framework` — long-context vs RAG production economics.
- `arxiv.org/html/2512.18925v2` — Beyond the Prompt empirical Cursor Rules study, MSR 2026.
- `www.reddit.com/r/PKMS/comments/1l29jz1/...` — DeepWiki as second brain; small sample but representative.
- `developers.googleblog.com/introducing-code-wiki-accelerating-your-code-understanding/` — Google Code Wiki launch (page mostly nav).
- `en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing` — Wikipedia field guide for AI writing tells.
- `arxiv.org/html/2501.09751` — OmniThink (skim); knowledge-density metric.
- `arxiv.org/html/2503.19065` — WikiAutoGen (skim); multimodal Wikipedia generation.
- `arxiv.org/abs/2504.08725` — DocAgent (skim); topological code processing.
- Searches (not single fetches) covering: STORM, Co-STORM, GraphRAG incremental, HippoRAG, MemGPT/Letta, PaperQA2, Reflexion/Self-RAG/CRAG, Self-Refine, Constitutional AI, FActScore/RAGAS, knowledge editing surveys (ROME/MEMIT), Obsidian Smart Connections, Continue @codebase, Sourcegraph Cody, Mintlify/Swimm, Glean, Notion AI, Tana, Logseq, Aider repomap, Cursor rules, Roo Code memory bank, DocAider, AutoCodeDocs, Cline memory bank, "lost in the middle"/context rot, LazyGraphRAG, NotebookLM, Copilot Workspace, Wikidata bots/provenance, fan-wiki notability, Andy Matuschak evergreen notes, Geoffrey Litt malleable software, Maggie Appleton tools-for-thought, Linus Lee thesephist, Karpathy LLM-Wiki Reddit reception, semantic conflict / contradiction detection.

End of note.
