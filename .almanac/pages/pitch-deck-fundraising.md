---
title: Pitch Deck Fundraising
summary: "Investor decks for CodeAlmanac should use a 10-15 slide narrative spine that earns a meeting, not a comprehensive product explanation."
topics: [fundraising, product-positioning]
sources:
  - /tmp/pitch-deck-research.md
  - https://guykawasaki.com/the-only-10-slides-you-need-in-your-pitch/
  - https://www.sequoiacap.com/article/writing-a-business-plan/
  - https://www.ycombinator.com/library/4T-how-to-build-your-seed-round-pitch-deck
  - https://www.ycombinator.com/library/6Z-how-to-build-a-great-series-a-pitch-and-deck
  - https://news.crunchbase.com/venture/7-deadly-pitch-deck-sins-according-to-a-vc/
  - https://www.docsend.com/
status: active
verified: 2026-05-14
---

# Pitch Deck Fundraising

The CodeAlmanac fundraising deck should be built as a short investor narrative, not as a full explanation of the wiki system. The research input converged on one operating constraint: investors often make an initial deck decision in a few minutes, so the deck's job is to earn the next meeting. That constraint matters for CodeAlmanac because the product has a deep technical story, but the pitch must first make the memory problem, market timing, proof, and ambition legible to a generalist investor.

## Core Deck Shape

The reusable structure across Guy Kawasaki, Sequoia, Y Combinator, and the Airbnb seed deck is a 10-15 slide core deck. Kawasaki's 10/20/30 rule, Sequoia's business-plan spine, YC's seed and Series A outlines, and Airbnb's 2008 deck all favor a compact sequence over comprehensive exposition.

For CodeAlmanac, the default seed-stage spine should be:

1. Title with a concrete one-line description of CodeAlmanac.
2. Problem from the working agent's and software team's point of view.
3. Solution showing how cultivated project memory changes the workflow.
4. Product flow with screenshots or a short demo path, not architecture diagrams first.
5. Traction or proof, using the strongest current usage, retention, workflow, or revenue signal.
6. Insight or "why now", connecting AI coding agents, long-running software work, and repeated reorientation cost.
7. Market, with assumptions that can be tested instead of a large unsupported category number.
8. Business model, including price level and the sales motion implied by that price.
9. Competition and alternatives, including docs, chats, READMEs, vector search, coding-agent memory features, and internal knowledge bases.
10. Team, framed around why this team understands agentic software work and developer trust.
11. Ask and use of funds, tied to the next financing or product milestone.

This is a spine, not a required slide count. YC's seed guidance allows several slides per section when needed, but the core deck should still read as one point per slide.

## Stage Emphasis

At seed, the deck should lean on team, insight, narrative, product clarity, and early proof. YC's seed guidance treats most early-stage details as thin by nature, so pretending that CodeAlmanac has mature enterprise metrics before it does would weaken the story.

At Series A, the deck must shift toward traction. YC's Series A structure puts a traction teaser early and makes the in-depth traction section the heart of the deck. For CodeAlmanac, that means the proof section would need revenue, expansion, retention, active repo usage, workflow frequency, or similarly durable metrics over at least several months.

## Slide-Level Constraints

The problem slide should describe a specific solvable pain, not "AI memory is broken" as an abstract category. A stronger CodeAlmanac problem statement would show the concrete cost of repeated agent reorientation, missing project context, stale docs, and lost session learnings in real software work.

The solution slide should explain the workflow change: project memory lives beside the repo, future agents search it before touching related code, and capture turns expensive session understanding into reusable wiki pages. It should avoid feature lists unless each feature is tied to a customer-visible workflow improvement.

The product slide should show the actual experience. For CodeAlmanac that likely means a repo with `.almanac/`, a page with grounded frontmatter and wikilinks, a search or serve view, and a capture/ingest path. A generalist investor should understand the product before seeing provider architecture, SQLite indexing, topic DAGs, or prompt internals.

The market slide should make assumptions explicit. The research note emphasized that market sizing is always approximate; credibility comes from the view and the assumptions. CodeAlmanac should avoid unsupported top-down "developer tools market" numbers unless they connect to a serviceable segment and a plausible adoption path.

The business-model slide must state price level because price determines go-to-market. A high annual contract implies enterprise trust, onboarding, security review, and sales motion; a low monthly price implies self-serve distribution and product-led conversion. The deck should not claim a go-to-market motion that the pricing cannot support.

The competition slide should acknowledge substitutes. Claiming no competition would signal that there is no market. The comparison should explain why CodeAlmanac's repo-local cultivated wiki is different from ordinary docs, chat history, agent memory, semantic code search, company-brain products, and knowledge-base products, and why that difference matters for repeated coding-agent work.

The ask slide should say how much is being raised and what milestone the money buys. For a seed deck, the milestone should plausibly make the company Series-A ready. For a Series A deck, the use of funds should show that money is the bottleneck to scaling a working business, not a substitute for product-market fit.

## Design And Delivery Rules

The core deck should stay readable in async review. The research note cites DocSend-style investor behavior where decks are often skimmed rather than presented, so each slide needs a title that states the point and a body that proves only that point.

Design should remove friction rather than signal ornament. YC's examples are intentionally plain, while Ada Ventures flags clutter, inconsistent fonts, and weak visual care as credibility problems. CodeAlmanac's deck should therefore use product screenshots, simple diagrams, and clear evidence hierarchy before visual decoration.

The appendix is the right place for detail. For CodeAlmanac that can include architecture, security posture, data locality, pricing sensitivity, cohort metrics, detailed financials, customer notes, or source research. Those details should not crowd the 10-15 slide core.

## Failure Modes To Avoid

CodeAlmanac's likely pitch-deck failure modes are predictable from the research:

- Explaining internals before the investor understands the problem and workflow.
- Using generic AI-market claims instead of a specific project-memory pain.
- Hiding the product behind prose instead of showing the repo/wiki/search/capture experience.
- Claiming no competition because the exact repo-local wiki shape is unusual.
- Using cumulative or vanity metrics when monthly or quarterly trend data is available.
- Treating the pitch deck as documentation instead of a narrative that earns a meeting.

## Related Pages

The current wiki has implementation pages for [[ingest-operation]], [[capture-flow]], [[wiki-lifecycle-operations]], and [[almanac-serve]]. [[company-brain]] explains the broader market category and why CodeAlmanac should usually position itself as a codebase brain rather than a general company brain. This page explains how the product should be compressed into an investor-facing fundraising story.
