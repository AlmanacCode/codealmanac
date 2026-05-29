---
title: Open-Source Almanac
summary: Open-source Almanac is the free public-repo product direction where CodeAlmanac reduces maintainer attention cost by giving contributors and AI agents reviewed project memory before they open issues or pull requests.
topics: [product-positioning, competitive-research, wiki-design]
sources:
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-24-15-019e70e7-1dc0-7e30-a996-f47b766b4ee6.jsonl
  - docs/strategy/2026-05-29-open-source-almanac-concept.md
  - docs/strategy/2026-05-28-remote-codealmanac-product-concept.md
  - docs/research/2026-05-28-open-source-codebase-wiki-and-review-tools.md
  - https://4008838.fs1.hubspotusercontent-na1.net/hubfs/4008838/2024-tidelift-state-of-the-open-source-maintainer-report.pdf
  - https://github.blog/news-insights/octoverse/octoverse-2024/
  - https://www.linuxfoundation.org/blog/understanding-the-state-of-open-source-funding-in-2024
  - https://github.com/ossf/scorecard
  - https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
  - https://github.com/ossf/wg-vulnerability-disclosures/issues/178
status: active
verified: 2026-05-29
---

# Open-Source Almanac

Open-source Almanac is the free public-repository version of CodeAlmanac. It should help maintainers preserve project knowledge once, cite it repeatedly, and keep it current through GitHub review instead of asking volunteers to answer the same contributor and AI-agent questions in every issue or pull request.

The 2026-05-29 open-source research pass changed the product framing from "free wiki hosting for OSS" to "maintainer-attention infrastructure for public repos." Open-source maintainers already maintain README files, contribution docs, security policies, issue templates, CI, labels, and release notes. The missing layer is the reviewed project memory that explains architecture, invariants, rejected approaches, review expectations, compatibility rules, triage answers, and maintainer preferences before someone opens work that a maintainer must review.

## Maintainer Problem

The core open-source pain is attention scarcity. The Tidelift 2024 maintainer report says 60 percent of surveyed maintainers had quit or considered quitting, and it names compensation, feeling underappreciated, time balance, support burden, entitlement, and project politics as recurring causes. Linux Foundation and GitHub funding research shows large ecosystem investment, but most investment arrives as contributor labor rather than direct maintainer funding, so tools that make contributors arrive better prepared can reduce the burden more directly than another documentation surface.

AI raises the cost of bad contributions. GitHub Octoverse 2024 reported broad AI-tool adoption among open-source respondents, and OpenSSF vulnerability-disclosure discussions identify low-quality AI-generated reports and contributions as a current maintainer burden. Almanac's OSS wedge should therefore be "better AI-assisted contributions," not "AI maintains your project."

## Product Shape

Free OSS Almanac should keep project memory public, Git-backed, and reviewable while staying quiet in the repository layout. The 2026-05-28 follow-up rejected a required `ALMANAC.md` entry point and a visible top-level `almanac/` directory because those make adoption feel more invasive and compete with existing README, docs, examples, package files, and framework conventions.

The later directory discussion separated the wiki-root choice from the local-state boundary. `.almanac/` remains the least invasive all-in-one default for public repositories because it behaves like repo infrastructure. `docs/almanac/` is a plausible docs-friendly wiki-root profile because it gives humans a visible path without adding a top-level brand directory, but it can conflict with projects whose `docs/` tree is a curated user-facing documentation site. When the wiki root is `docs/almanac/`, `.almanac/` should remain the local control and state directory for indexes, runs, extracts, caches, and root configuration such as `wiki_root: docs/almanac`.

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

The free GitHub App should be quiet by default. It should post at most one context comment on an issue or pull request, cite specific Almanac pages, avoid blocking by default, and open wiki-maintenance PRs after maintainers make durable decisions.

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

## Free Boundary

The public-repo product should be genuinely free because the strategic value is making `.almanac/` a normal repository convention. Public repo indexing, local CLI use, hosted read-only rendering, limited context comments, post-merge wiki PRs, maintainer routing suggestions, and badges such as "Almanac maintained" or "AI contribution guide available" belong in the free tier.

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

[[github-native-wiki-maintenance]] explains the remote GitHub App loop that OSS Almanac should reuse. [[company-brain]] explains the broader market category of agent-readable operational memory. [[just-in-time-context-surfacing]] explains why context should appear before action rather than live only in a separate wiki browser. [[almanac-product-family]] explains why "Almanac" should be the product noun across scoped knowledge products.
