# Almanac For Open-Source Maintenance

Date: 2026-05-29

## Research Base

This note combines current open-source maintainer research with the existing CodeAlmanac direction: repo-owned `.almanac/` pages remain canonical, while remote infrastructure can watch GitHub and propose reviewed maintenance updates.

Primary sources reviewed:

- [2024 Tidelift State of the Open Source Maintainer Report](https://4008838.fs1.hubspotusercontent-na1.net/hubfs/4008838/2024-tidelift-state-of-the-open-source-maintainer-report.pdf)
- [GitHub Octoverse 2024](https://github.blog/news-insights/octoverse/octoverse-2024/)
- [Linux Foundation and GitHub open-source funding summary](https://www.linuxfoundation.org/blog/understanding-the-state-of-open-source-funding-in-2024)
- [Linux Foundation 2024 Open Source Software Developer Report](https://www.linuxfoundation.org/hubfs/LF%20Research/OSS_Developer_Report_2024.pdf?hsLang=en)
- [OpenSSF Scorecard](https://github.com/ossf/scorecard)
- [GitHub community health files](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file)
- [OpenSSF AI-slop best-practices discussion](https://github.com/ossf/wg-vulnerability-disclosures/issues/178)
- [2026 reporting on AI-generated security and PR spam against open-source maintainers](https://www.itpro.com/software/open-source/big-tech-is-clamping-down-on-open-source-ai-slop-reports)
- [GitHub Sponsors docs](https://docs.github.com/en/enterprise-cloud%40latest/sponsors/receiving-sponsorships-through-github-sponsors/about-github-sponsors-for-open-source-contributors)

## What Open-Source Maintainers Struggle With

Open-source maintainers are not mainly missing tooling for writing prose. They are missing time, trusted context, review bandwidth, contributor alignment, and sustainable operating structure.

The 2024 Tidelift maintainer survey reports that more than half of maintainers have either quit or considered quitting; the 2024 number was 60%. The same report identifies lack of financial compensation, feeling underappreciated, time and work-life balance, user entitlement, support burden, and project politics as recurring pain. One maintainer described the work as piling up because nobody else was doing it, leaving no time to recruit co-maintainers.

GitHub's Octoverse 2024 shows that AI tools are already part of open source: 73% of open-source survey respondents reported using AI tools for coding or documentation. That increases potential contribution volume, but it also makes maintainer review more expensive when contributors submit plausible-looking code or reports they do not understand.

The AI-slop problem is now an explicit maintainer burden. OpenSSF's vulnerability-disclosure working group opened a best-practices issue for low-quality AI-generated vulnerability reports and contributions, noting that validation consumes volunteer time. 2026 reporting around OpenSSF and Alpha-Omega funding describes maintainers receiving waves of low-quality AI-generated security reports and PRs.

The Linux Foundation and GitHub funding work shows a second mismatch: organizations invest heavily in open source, but most value arrives as employee labor rather than direct maintainer funding. Their 2024 summary estimates $7.7B annual ecosystem investment, with 86% in contribution labor and 14% as direct financial contributions. That matters because tooling that helps corporate contributors be better prepared may reduce maintainer burden more directly than a donation prompt.

GitHub's community-health files and OpenSSF Scorecard show what good projects are expected to maintain: contribution instructions, issue templates, security policies, license metadata, branch protection, CI, vulnerability reporting, and other process docs. These are necessary, but each becomes another surface that goes stale.

## The Open-Source Almanac Concept

An open-source Almanac is a maintainer-owned project memory layer for public repositories. It explains what a contributor, maintainer, or AI agent needs to know before changing the project:

- architecture and subsystem maps,
- contribution norms and review expectations,
- invariants that PRs must preserve,
- release and compatibility rules,
- accepted and rejected design approaches,
- common issue triage answers,
- known project constraints,
- documentation areas that drift after code changes,
- maintainer preferences that should not be rediscovered in every PR.

It should not replace README, docs, CONTRIBUTING, SECURITY, or issue templates. Those files are public-facing contracts. The Almanac is the maintainers' living operating memory behind those contracts.

The concept should be free for open-source repositories because the strategic value is adoption and trust. If many OSS repos expose `.almanac/`, AI coding agents learn to check it as a normal part of contribution, just as they check `CONTRIBUTING.md`, tests, and CI.

## Free Product Shape

The free OSS product should have three promises:

1. Make it easier for maintainers to preserve project knowledge.
2. Make it easier for contributors and AI agents to find that knowledge before opening noise.
3. Avoid creating another bot that maintainers must review constantly.

The default open-source flow:

1. Maintainer installs Almanac locally or enables the free GitHub App.
2. Almanac creates `.almanac/` with an OSS-specific charter.
3. It indexes README, docs, CONTRIBUTING, SECURITY, issue templates, labels, closed issues, merged PRs, release notes, and code references.
4. It drafts a small set of high-signal pages: architecture overview, contribution workflow, review expectations, compatibility policy, triage guide, maintainer gotchas, release process.
5. On new issues and PRs, it posts context only when it can cite a relevant page or template.
6. After accepted maintainer decisions, it proposes `.almanac/` updates as normal PRs.

The free version should be generous for public repositories:

- public repo indexing,
- local CLI,
- hosted read-only rendered Almanac,
- PR/issue context comments with a strict noise budget,
- post-merge wiki maintenance PRs,
- public project health page for stale `.almanac` coverage,
- badges such as "Almanac maintained" or "AI contribution guide available."

The free version should not include private repos, org-wide private memory, enterprise retention controls, SSO, private model routing, or cross-repo confidential context. Those are paid team features.

## The Wedge: Better AI Contributions

The strongest open-source wedge is not "better docs." It is "reduce bad AI-assisted contributions."

An Almanac-enabled repository can tell agents and contributors:

- read these project facts before editing,
- do not open a PR without referencing the relevant Almanac page,
- check compatibility and release policy first,
- include evidence that the code was run,
- avoid rejected approaches listed here,
- ask a design question before large changes.

This can become a lightweight social protocol:

> If your PR was AI-assisted, cite the Almanac pages you used.

That is much more useful than asking contributors to disclose AI use in the abstract. It shifts the question from "was a model involved?" to "did the contributor load and obey project-specific context?"

## GitHub Features For OSS

Free open-source Almanac should add GitHub-native maintenance features:

- **Issue context replies**: link duplicate explanations, triage rules, known limitations, and troubleshooting steps from `.almanac/`.
- **PR readiness check**: non-blocking check that asks whether the PR touched documented invariants, tests, compatibility policy, and contribution rules.
- **AI-slop friction**: if a report looks generic, uncited, or inconsistent with the repo's facts, ask for reproduction, version, affected file, and relevant Almanac page before a maintainer spends time.
- **Contributor onboarding packs**: generated from maintained pages for "first PR", "bug fix", "docs change", "new feature", and "security report".
- **Good-first-issue context**: attach the small map a contributor needs so maintainers do not restate the architecture every time.
- **Decision capture**: after maintainers close a design discussion or reject an approach, propose a page update so the same debate does not repeat.
- **Stale docs drift**: when code changes affect README/docs/CONTRIBUTING/SECURITY claims, open a small maintenance PR.

The app should stay quiet by default. Open-source maintainers are already overloaded; noisy automation is hostile.

## What To Avoid

Do not pitch open-source maintainers on "AI maintaining your project." That sounds like more review burden and attracts low-quality automation.

Do not auto-close issues aggressively. Closing legitimate user reports because a model classified them wrong damages trust.

Do not generate a giant wiki on day one. Most maintainers do not want a new stale surface. Start with pages that reduce repeated maintainer explanations.

Do not make the free OSS product a growth hack that hides core value behind a paywall. The public ecosystem value only appears if contributors and agents can rely on `.almanac/` being present and useful across many repos.

Do not store hidden canonical memory for public projects. Public repos should get public, reviewable project memory.

## Product Positioning

The open-source framing:

> Almanac helps maintainers teach contributors and AI agents how this project works before they open an issue or PR.

The maintainer-facing promise:

> Write it once, cite it forever, keep it current through PRs.

The contributor-facing promise:

> Before you contribute, Almanac gives you the project map maintainers wish every contributor had read.

The ecosystem-facing promise:

> Public AI agents should read public project memory before generating public project work.

## Why Free OSS Helps The Paid Product

Free OSS creates the norm. If `.almanac/` becomes a known repository convention, paid teams benefit because agents already know how to consume it.

Public repositories also generate hard product feedback:

- which PR comments are too noisy,
- which pages contributors actually click,
- which maintainer decisions repeat,
- which issue templates fail,
- which drift checks create useful PRs,
- which project types need different charters.

The paid product then sells private-repo automation, org-level Almanacs, SSO, security controls, private model routing, cross-repo context, and retained job history. The free product sells the concept by being genuinely useful to maintainers who cannot pay.

## Recommended OSS MVP

Build an open-source-specific starter mode:

```bash
almanac init --profile open-source
```

It should create an OSS charter and starter pages:

- `project-map.md`
- `contributing-context.md`
- `triage-guide.md`
- `review-expectations.md`
- `compatibility-policy.md`
- `release-process.md`
- `known-gotchas.md`
- `ai-contribution-policy.md`

Then build the free GitHub App mode:

- read public repo docs, issues, PRs, and `.almanac/`,
- post at most one context comment per issue or PR,
- never block by default,
- propose `.almanac/` updates as PRs,
- expose a public viewer at a stable URL,
- provide a badge and agent-readable endpoint.

The first "wow" moment should be a maintainer seeing a new PR get a short, cited context note that says: "This touches the compatibility policy and a rejected design approach; here are the two pages to read before review." The second should be Almanac opening a small PR after a design decision, preserving the answer so the maintainer does not repeat it next month.

## Open Questions

- Should the public viewer be hosted by Almanac or generated into GitHub Pages?
- Should issue comments require maintainer opt-in labels such as `almanac:context` at first?
- What is the right public AI contribution policy template?
- How should Almanac distinguish beginner mistakes from low-effort AI slop without being hostile?
- Can a project declare "maintainer attention budget" so the bot learns when to stay silent?
- Should free OSS include limited LLM usage paid by Almanac, require maintainer API keys, or run only deterministic retrieval unless sponsored?

## Decision

Almanac for open source should be free, public, GitHub-native, and maintainer-attention-first. It should not try to automate maintainers away. It should preserve the hard-won project knowledge that lets contributors and AI agents arrive prepared.
