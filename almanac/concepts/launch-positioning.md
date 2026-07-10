---
title: Launch Positioning
topics: [concepts, product]
sources:
  - id: repo-readme
    type: file
    path: README.md
    note: Public product tagline, local-first product surface, and command examples.
  - id: bookface-post
    type: file
    path: docs/launch/bookface-s26/post.md
    note: YC S26 Bookface launch draft and product narrative.
  - id: launch-assets
    type: file
    path: docs/launch/bookface-s26/assets/
    note: Final launch demo video and GIF assets.
  - id: openwiki-notes
    type: file
    path: docs/research/openwiki-launch-traction/notes.md
    note: OpenWiki launch traction research notes.
  - id: openwiki-export-script
    type: file
    path: docs/research/openwiki-launch-traction/fetch-github-stargazers.mjs
    note: Script that exports GitHub stargazers with starred timestamps and public profile fields.
  - id: stargazer-combine-script
    type: file
    path: docs/research/openwiki-launch-traction/combine-stargazers.mjs
    note: Script that combines enriched stargazer exports for OpenWiki, Graphify, CodeAlmanac, and Google OKF.
  - id: openwiki-stargazers-csv
    type: file
    path: docs/research/openwiki-launch-traction/openwiki-stargazers.csv
    note: Exported OpenWiki stargazer data with 10,807 data rows plus one header row in the current checkout.
  - id: combined-stargazers-csv
    type: file
    path: docs/research/openwiki-launch-traction/combined-stargazers-deduped.csv
    note: Deduplicated enriched GitHub stargazer export across OpenWiki, Graphify, CodeAlmanac, and Google OKF.
  - id: twitter-sample-script
    type: file
    path: docs/research/openwiki-launch-traction/sample-twitter-stargazers.mjs
    note: Script that builds the launch outreach Twitter sample and owner assignments.
  - id: twitter-sample-csv
    type: file
    path: docs/research/openwiki-launch-traction/twitter-stargazers-sample-300-assigned.csv
    note: Current sampled Twitter outreach CSV with owner assignments and review_status values.
  - id: mark-twitter-dm-sent-script
    type: file
    path: docs/research/openwiki-launch-traction/mark-twitter-dm-sent.mjs
    note: Script that marks a contacted GitHub login as DM_SENT in both Twitter outreach CSVs.
  - id: rohan-dm-scan-csv
    type: file
    path: docs/research/openwiki-launch-traction/rohan-dm-availability-scan.csv
    note: Full Rohan-assigned Twitter outreach DM-availability scan.
  - id: rohan-dm-available-csv
    type: file
    path: docs/research/openwiki-launch-traction/rohan-dm-available.csv
    note: Rohan-assigned Twitter outreach rows where X exposed a visible DM icon.
  - id: rohan-dm-remaining-csv
    type: file
    path: docs/research/openwiki-launch-traction/rohan-dm-availability-remaining.csv
    note: Retry queue for Rohan-assigned Twitter outreach DM-availability scanning.
  - id: sqlite-framing-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/08/rollout-2026-07-08T20-50-32-019f44ff-a4ea-7713-8f45-c0beb43c73ee.jsonl
    note: Launch-copy discussion that framed CodeAlmanac as a compiled layer of understanding and placed SQLite index language in the How it works section.
  - id: traction-export-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/07/rollout-2026-07-07T11-48-21-019f3de8-e706-7c10-ab2d-f4cffe903abf.jsonl
    note: Stargazer export and validation run that produced the enriched and combined CSV summaries.
  - id: tagit
    type: web
    url: https://github.com/liliang-cn/tagit
    note: GitHub repository for TagIt, an agent-in-team-chat comparison point.
  - id: agentchattr
    type: web
    url: https://github.com/bcurts/agentchattr
    note: GitHub repository for agentchattr, a local Slack-like agent chat comparison point.
---

# Launch Positioning

Launch positioning is the reusable product story behind CodeAlmanac launch work. The current line is that CodeAlmanac is a living wiki for a codebase, maintained by AI coding agents, with plain Markdown in `almanac/`, local indexes, Git review, and read commands such as `codealmanac search` and `codealmanac show` [@repo-readme]. Launch material should make that concrete as agent memory: coding agents start from zero, while CodeAlmanac preserves the decisions, gotchas, invariants, and flows they would otherwise rediscover [@bookface-post].

## Core Claim

The Bookface draft frames CodeAlmanac as open source, local, and free, then contrasts it with tools that make graphs or code search surfaces but do not maintain detailed connected Markdown articles from agent conversations [@bookface-post]. The skeptical-objection section should stay specific: the durable contrast is not "better docs"; it is conversation-updated Markdown in the repository, scheduled gardening, and an agent-native CLI read surface [@bookface-post] [@repo-readme].

The precompilation framing is useful for explaining why CodeAlmanac is not just transcript search. Search retrieves what was said, while the wiki preserves the version of understanding worth carrying forward: what is true now, why it is true, what changed, and where the next agent should look [@sqlite-framing-transcript]. It can be compared loosely to a cache, but launch copy should avoid making it sound like passive storage; the important claim is that CodeAlmanac selects, compresses, updates, and organizes raw conversations into a compiled wiki layer [@sqlite-framing-transcript].

The strongest example pattern is a future agent being asked to add Okta SSO and finding a previous WorkOS decision plus a webhook replay gotcha before coding [@bookface-post]. That example works because it names a concrete task, a concrete prior decision, and a concrete failure mode instead of only restating the product category.

SQLite belongs in the "How it works" explanation, not in the opening definition. The opener should say that CodeAlmanac is a self-updating wiki that lives in the repo as Markdown; the mechanics section can then say that the agent queries the wiki through a local SQLite index with `codealmanac search` and `codealmanac show` [@repo-readme] [@sqlite-framing-transcript].

## Demo Asset

The launch demo asset is a 35-second product video under `docs/launch/bookface-s26/assets/`, with MP4 and GIF versions present in the launch folder [@launch-assets]. The GIF asset is 17 MB in the current checkout, which leaves little headroom for platforms that recompress uploads [@launch-assets].

For demo structure, use [Demo CodeAlmanac in a launch video](../guides/demo-codealmanac-in-launch-video). That guide keeps the video centered on the served wiki as proof and the terminal query as the product payoff.

## Market Comparison Notes

OpenWiki research is raw launch analysis, not a final report. The useful reusable conclusion is that OpenWiki's early growth looked like a developer-viral open-source launch: the notes record about 9k GitHub stars in roughly a week, Trendshift daily rankings, HN activity, and LinkedIn/X repost waves, while also stating that exact referral sources are not public without repository-owner traffic data [@openwiki-notes]. A later export script fetched GitHub stargazers through GraphQL in `STARRED_AT` order with public profile fields such as login, location, company, bio, follower counts, and public repository count [@openwiki-export-script]. The current `openwiki-stargazers.csv` file has 10,807 data rows plus one header row [@openwiki-stargazers-csv].

The later stargazer export broadened the comparison set to OpenWiki, Graphify, CodeAlmanac, and Google OKF. The combined export stores one row per lowercased GitHub login, boolean membership columns for the four repositories, per-repo `starred_at` fields, a `repo_count`, and a pipe-separated `repos_starred` field [@stargazer-combine-script] [@combined-stargazers-csv]. The validated combined file contains 92,576 unique GitHub accounts: 9,774 starred OpenWiki, 80,469 starred Graphify, 241 starred CodeAlmanac, and 6,513 starred Google OKF; 4,043 accounts appear in more than one of those four datasets [@traction-export-transcript]. The same validation found 8,085 Twitter usernames, 1,456 LinkedIn URLs, and zero email values in the combined file because the GitHub token used by the export could not read the `email` field [@openwiki-export-script] [@traction-export-transcript].

The Twitter outreach sample is derived from the combined stargazer export, filtered to rows with `twitter_username`, shuffled with seed `20260709`, and cut to 300 profiles assigned evenly across Rohan, Kushagra, and Divit [@twitter-sample-script]. The sampled CSV adds `sampled_for_review`, `sample_number`, `assigned_to`, `assignee_sample_number`, and `review_status` columns before the GitHub profile fields [@twitter-sample-script] [@twitter-sample-csv]. After a DM is sent, `mark-twitter-dm-sent.mjs --login <github-login>` updates `review_status` to `DM_SENT` in both `twitter-stargazers.csv` and `twitter-stargazers-sample-300-assigned.csv`; the script errors unless each file has exactly one row for that lowercased login [@mark-twitter-dm-sent-script].

The Rohan-assigned outreach pass has a separate DM-availability layer. The completed scan covers 100 Rohan rows, finds 36 rows with `dm_scan_status: DM_AVAILABLE`, 59 with `DM_UNAVAILABLE`, four missing X accounts, and one suspended X account; the available-only CSV contains exactly the 36 `DM_AVAILABLE` rows, and the retry CSV is header-only after completion [@rohan-dm-scan-csv] [@rohan-dm-available-csv] [@rohan-dm-remaining-csv] [@traction-export-transcript].

The agent-chat comparison set from the July 8 lookup has two useful anchors. TagIt positions itself as a self-hosted chat interface where a team can `@mention` coding agents, register Claude Code and Codex CLIs, and route Slack or Feishu messages to the configured agent [@tagit]. agentchattr is the Slack-like local chat comparison: its README describes `@claude`, `@codex`, and other agent mentions, shared channels, and agent-to-agent wakeups through a local chat server [@agentchattr]. These tools are not direct wiki-memory substitutes, but they are relevant when launch copy mentions teams routing work to multiple agents.
