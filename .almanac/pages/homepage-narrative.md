---
title: Homepage Narrative
summary: The public Almanac homepage should separate source-ingestion proof from the animated wiki demo, then establish local ownership and trust before pricing.
topics: [product-positioning]
sources:
  - id: homepage-narrative-session
    type: conversation
    path: /Users/kushagrachitkara/.codex/sessions/2026/06/05/rollout-2026-06-05T03-25-48-019e94a2-a821-7a71-a251-306a5f99f31a.jsonl
    note: Records the June 4-5, 2026 homepage critique that compared Almanac mockups with Composio's section stack and settled on separate source-ingestion, demo, ownership, and pricing jobs.
  - id: legacy-code-landing
    type: file
    path: /Users/kushagrachitkara/Downloads/reverie/usealmanac/src/components/CodeLanding.tsx
    note: Preserves the older landing page's install walkthrough, source examples, and setup-confidence sections that the session kept as useful reference material.
status: active
verified: 2026-06-09
---

# Homepage Narrative

The June 4-5, 2026 homepage critique settled a specific narrative job for Almanac's public site: the page should prove where the wiki comes from, show the wiki updating, show the difference it makes to an agent, then establish trust and ownership before asking for price attention. [@homepage-narrative-session]

The strongest recommended order from that session was `Hero -> How we make it -> Demo -> Agent comparison -> Ownership / local-first -> Pricing`, with FAQ or install detail added only if the page still feels too magical or too thin on operational confidence. [@homepage-narrative-session]

## Two Separate Proof Moves

The session split the middle of the page into two distinct jobs. The demo section should stay visual and experiential: sources arrive, provenance sticks, and the wiki page rewrites itself. The "how we make it" section should be calmer and more explicit: Almanac accumulates durable memory from agent sessions, code, commits, pull requests, issues, docs, chat, and incident material instead of animating one isolated transcript. [@homepage-narrative-session]

That distinction matters because the living-wiki animation already proves that the system can transform source material into a page, but viewers can still misread the Slack, Notion, Linear, or commit cards as decorative demo props. A separate source-ecosystem section makes those inputs legible as the actual ingestion model. [@homepage-narrative-session]

The recommended copy direction was not "integrations" in the broad Composio sense. The page should say that Almanac builds memory from the places where decisions already leak out, not that it is a horizontal tool-calling platform with a giant app taxonomy. [@homepage-narrative-session]

## What The Source Section Should Show

The proposed source-ecosystem band was grounded in the project's real evidence trail:

- agent sessions such as Claude Code, Codex, and Cursor
- repo context such as source files, commits, pull requests, and diffs
- team tools such as Slack, Linear, and Notion
- existing docs such as README, `AGENTS.md`, and architecture notes
- incident or support signals such as Sentry, PostHog, and customer tickets
- future or manual inputs such as CLI notes, imported docs, and pinned decisions

The older `CodeLanding.tsx` already contains a simpler version of this idea through its `unstructuredDocs` examples and setup walkthrough. The session treated that older page as useful reference material for confidence-building detail even though the newer mockups had a stronger visual arc. [@legacy-code-landing] [@homepage-narrative-session]

## Trust Before Pricing

The session also made the pre-pricing trust requirement explicit. Pricing should not carry the whole burden of explaining locality, ownership, and reviewability. The page needs a dedicated ownership section that calmly states the trust architecture: `.almanac/pages`, markdown files in the repo, Git history, a local SQLite index, review like any other change, and open-source local tooling. [@homepage-narrative-session]

This aligns the public story with [[almanac-business-model]], which keeps the trusted local memory layer open while charging for hosted coordination, and with [[open-source-almanac]], which treats reviewed repo memory as the public artifact rather than a hidden hosted database. It also keeps the landing page consistent with [[company-brain]], which positions Almanac as a narrower, codebase-scoped memory layer rather than a generic company-wide ingestion platform.

## What Not To Copy From Composio

Composio's homepage was useful in the session as a structural reference because it stacked demo, rationale, technical capabilities, trust, proof, and CTA in a way that made the product feel real before the close. The session kept that lesson and rejected the rest. Almanac should not borrow Composio's broad product taxonomy, giant use-case segmentation, or integrations-marketplace feel because Almanac's pitch is narrower: durable project memory for codebases, not an all-purpose agent execution layer. [@homepage-narrative-session]

## Optional Confidence Sections

The session left two optional additions on the table when the page needs more buyer confidence without turning into a generic feature buffet.

One is a compact FAQ or operational-notes block covering questions such as private-code handling, supported agents, reviewability of wiki changes, recovery when the wiki is wrong, and the hosted-versus-local boundary. [@homepage-narrative-session]

The other is a small install walkthrough. The older `CodeLanding.tsx` already demonstrates the useful shape: `npx codealmanac`, choose an agent, install auto-capture and instructions, then show the first `almanac init` and `almanac search` steps. That material can be pulled forward when the visual homepage needs a little more procedural credibility. [@legacy-code-landing] [@homepage-narrative-session]

## Related Pages

[[company-brain]] explains the broader memory category that the homepage should borrow language from without overclaiming scope. [[just-in-time-context-surfacing]] explains the product behavior behind the "agent comparison" section. [[almanac-business-model]] explains why local ownership and hosted coordination belong in separate trust layers. [[open-source-almanac]] explains the public-repo version of the same trust and review story.
