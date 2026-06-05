---
title: Open-Source Almanac
summary: Open-source Almanac is the free public-repo product direction where CodeAlmanac reduces maintainer attention cost by giving contributors and AI agents reviewed project memory before they open issues or pull requests.
topics: [product-positioning, competitive-research, wiki-design]
sources:
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-24-15-019e70e7-1dc0-7e30-a996-f47b766b4ee6.jsonl
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-27-05-019e70e9-b7d7-7900-9fc0-da2a6f0b532d.jsonl
  - docs/strategy/2026-05-29-open-source-almanac-concept.md
  - docs/strategy/2026-05-28-remote-codealmanac-product-concept.md
  - docs/research/2026-05-28-open-source-codebase-wiki-and-review-tools.md
  - https://4008838.fs1.hubspotusercontent-na1.net/hubfs/4008838/2024-tidelift-state-of-the-open-source-maintainer-report.pdf
  - https://github.blog/news-insights/octoverse/octoverse-2024/
  - https://www.linuxfoundation.org/blog/understanding-the-state-of-open-source-funding-in-2024
  - https://github.com/ossf/scorecard
  - https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
  - https://github.com/ossf/wg-vulnerability-disclosures/issues/178
  - id: yc-market-scan
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/31/rollout-2026-05-31T23-31-46-019e8173-bc02-7503-a102-e9de99d6bb9c.jsonl
    note: Records the YC CLI market scan that identified OSS maintainers and AI-forward tiny teams as the recommended first beachhead.
  - id: oss-maintainer-research
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/31/rollout-2026-05-31T23-31-46-019e8173-bc02-7503-a102-e9de99d6bb9c.jsonl
    note: Records the Reddit-focused maintainer research that reframed the OSS pain as low-context issues, low-context pull requests, review burden, and AI-slop amplification rather than demand for a wiki.
status: active
verified: 2026-06-01
---

# Open-Source Almanac

Open-source Almanac is the free public-repository version of CodeAlmanac. It should help maintainers preserve project knowledge once, cite it repeatedly, and keep it current through GitHub review instead of asking volunteers to answer the same contributor and AI-agent questions in every issue or pull request.

The 2026-05-29 open-source research pass changed the product framing from "free wiki hosting for OSS" to "maintainer-attention infrastructure for public repos." Open-source maintainers already maintain README files, contribution docs, security policies, issue templates, CI, labels, and release notes. The missing layer is the reviewed project memory that explains architecture, invariants, rejected approaches, review expectations, compatibility rules, triage answers, and maintainer preferences before someone opens work that a maintainer must review.

The 2026-05-31 YC CLI market scan kept OSS maintainers as one of the two best first segments, alongside AI-forward tiny teams. The OSS reason is still repetition: maintainers repeatedly explain contribution rules, architecture boundaries, rejected approaches, and recurring gotchas in issues and pull requests. The tiny-team reason is context loss: founders and engineers work out decisions in Claude, Codex, Slack, texts, issues, and PRs, then lose the reasoning before the next agent or teammate needs it. [@yc-market-scan]

## Maintainer Problem

The core open-source pain is attention scarcity. The Tidelift 2024 maintainer report says 60 percent of surveyed maintainers had quit or considered quitting, and it names compensation, feeling underappreciated, time balance, support burden, entitlement, and project politics as recurring causes. Linux Foundation and GitHub funding research shows large ecosystem investment, but most investment arrives as contributor labor rather than direct maintainer funding, so tools that make contributors arrive better prepared can reduce the burden more directly than another documentation surface.

AI raises the cost of bad contributions. GitHub Octoverse 2024 reported broad AI-tool adoption among open-source respondents, and OpenSSF vulnerability-disclosure discussions identify low-quality AI-generated reports and contributions as a current maintainer burden. Almanac's OSS wedge should therefore be "better AI-assisted contributions," not "AI maintains your project."

The 2026-05-31 Reddit-focused maintainer research sharpened this from "maintainers repeat themselves" to "low-context issues and pull requests consume maintainer attention." Maintainers complained that contributors ignore guides and PR templates, submit work without enough documentation for review, and use AI to produce plausible but low-effort pull requests. The product implication is that Almanac OSS should reduce review and triage load by making existing project context hard to miss at issue and PR time; it should not ask maintainers to maintain another broad wiki surface. [@oss-maintainer-research]

## Product Shape

Free OSS Almanac should keep project memory public, Git-backed, and reviewable while staying quiet in the repository layout. The 2026-05-28 follow-up rejected a required `ALMANAC.md` entry point and a visible top-level `almanac/` directory because those make adoption feel more invasive and compete with existing README, docs, examples, package files, and framework conventions.

The later directory discussion separated the wiki-root choice from generated state. `docs/almanac/` is the preferred public/team default when a repository can carry internal project memory under `docs/`: it gives humans a visible path, avoids a top-level brand directory, and feels closer to existing architecture and maintainer documentation. `.almanac/` remains the quiet local/private profile and the fallback for projects whose `docs/` tree is a curated user-facing documentation site. In the public/team profile, the Almanac root should contain only durable project memory such as `README.md`, `pages/`, `topics.yaml`, `config.yaml`, and `issues.yaml`; generated indexes, runs, extracts, and caches should live in user cache or hosted coordination storage rather than under `docs/almanac/.state/`.

The hosted service can index, render, comment, detect high-confidence stale knowledge, and propose maintenance PRs, but it should not store hidden canonical memory for public projects. This preserves the same trust boundary described in [[github-native-wiki-maintenance]] while making public repos the adoption surface for the broader [[almanac-product-family]].

An OSS starter profile should create a small set of high-signal pages instead of a large generated wiki:

- `project-map.md`
- `contributing-context.md`
- `triage-guide.md`
- `review-expectations.md`
- `compatibility-policy.md`
- `release-process.md`
- `known-gotchas.md`
- `ai-contribution-policy.md`

Those pages should complement README, CONTRIBUTING, SECURITY, and issue templates. Public-facing project files remain the formal contracts; the Almanac is the maintainer operating memory behind those contracts.

## GitHub Workflow

The free GitHub App should be quiet by default. It should post at most one context comment on an issue or pull request, cite specific Almanac pages, avoid blocking by default, and open Almanac update PRs after maintainers make durable decisions.

The useful OSS features are narrow:

- Issue context replies that link known limitations, duplicate explanations, triage rules, or troubleshooting pages.
- PR readiness checks that ask whether the change touched documented invariants, compatibility rules, release policy, or review expectations.
- AI-slop friction that asks for reproduction, affected versions, affected files, and relevant Almanac pages when a report is generic or uncited.
- Contributor onboarding packs for first PRs, bug fixes, docs changes, new features, and security reports.
- Good-first-issue context that gives contributors the small subsystem map a maintainer would otherwise repeat.
- Maintainer routing that maps paths, labels, topics, or configured ownership to likely reviewers without requiring every maintainer to watch every subsystem.
- Decision capture that proposes a wiki update after a maintainer closes a recurring debate or rejects an approach.
- Drift checks when code changes make README, docs, CONTRIBUTING, SECURITY, or Almanac claims stale.

The social protocol is more useful than abstract AI disclosure: if a contribution was AI-assisted, cite the Almanac pages it used. That shifts maintainer review from "was a model involved?" to "did the contributor load and follow project-specific context?"

The first OSS workflow should stay narrower than a general issue bot. PR Context Cards should cite one to three relevant Almanac pages when touched files or issue labels match known project memory. `/almanac note` should let a maintainer turn a review comment or issue reply into a durable decision candidate at the moment the explanation appears. Repeated-answer detection should propose memory pages only when the same maintainer explanation pattern recurs, because broad automatic summarization would recreate the documentation burden this product is meant to reduce. [@yc-market-scan]

## Free Boundary

The public-repo product should be genuinely free because the strategic value is making an Almanac root a normal repository convention. Public repo indexing, local CLI use, hosted read-only rendering, limited context comments, post-merge Almanac update PRs, maintainer routing suggestions, and badges such as "Almanac maintained" or "AI contribution guide available" belong in the free tier.

Paid boundaries should be private repos, org-wide private memory, enterprise retention controls, SSO, private model routing, cross-repo confidential context, audit exports, and hosted job history. Free OSS should not be a funnel that withholds the core mechanism from maintainers who cannot pay.

## What To Avoid

Do not pitch maintainers on "AI maintaining your project." That framing sounds like more work for volunteers and attracts low-quality automation.

Do not auto-close issues aggressively. A wrong closure damages maintainer trust more than a missed automation opportunity.

Do not generate a giant wiki on day one. A new stale surface is hostile to maintainers who already struggle to keep project docs current.

Do not make hidden hosted memory canonical for public repositories. Public projects need public, reviewable memory that future contributors and agents can inspect.

## Positioning

The maintainer-facing sentence is: "Write it once, cite it forever, keep it current through PRs."

The contributor-facing sentence is: "Before you contribute, Almanac gives you the project map maintainers wish every contributor had read."

The ecosystem sentence is: "Public AI agents should read public project memory before generating public project work."

The first useful moment should be a pull request receiving a short cited note that names the compatibility policy and a rejected design approach before a maintainer spends review time. The second useful moment should be Almanac opening a small PR after a maintainer decision so the same answer does not have to be repeated next month.

## Related Pages

[[customer-segmentation]] explains why OSS maintainers are one of the first customer groups instead of a later enterprise segment. [[github-native-wiki-maintenance]] explains the remote GitHub App loop that OSS Almanac should reuse. [[company-brain]] explains the broader market category of agent-readable operational memory. [[just-in-time-context-surfacing]] explains why context should appear before action rather than live only in a separate wiki browser. [[almanac-product-family]] explains why "Almanac" should be the product noun across scoped knowledge products.
