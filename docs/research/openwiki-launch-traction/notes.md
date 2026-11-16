# OpenWiki Launch Traction Notes

Status: live research notes, not a final report.

Research question: where did `langchain-ai/openwiki` get its early attention, which public posts carried the launch, and whether the GitHub star pattern looks viral.

## Source Log

- GitHub repository metadata: https://api.github.com/repos/langchain-ai/openwiki
- GitHub repository page: https://github.com/langchain-ai/openwiki
- GitHub GraphQL `repository.stargazers(orderBy: STARRED_AT)` query, run on 2026-07-07, fetched 9,002 timestamped stars for the time curve. A second profile aggregation moments later fetched 9,004 stars because the repo was still gaining stars live.
- Local clone inspected at `/Users/rohan/Desktop/Projects/openwiki`, fast-forwarded to `cfe6e22` (`0.0.2`) on 2026-07-07.
- npm package timestamps from `npm view openwiki time version dist-tags --json`, run on 2026-07-07.
- LangChain launch blog: https://www.langchain.com/blog/introducing-openwiki-an-open-source-agent-for-repo-documentation
- Hacker News item API: https://hacker-news.firebaseio.com/v0/item/48752949.json
- HN Algolia item API: https://hn.algolia.com/api/v1/items/48752949
- Trendshift repo page: https://trendshift.io/repositories/70339
- YouMind X-tracking mirror for Brace Sproul launch post: https://youmind.com/landing/x-viral-articles/openwiki-automated-repo-documentation-agent
- LinkedIn LangChain launch post: https://www.linkedin.com/posts/langchain_openwiki-can-generate-repo-docs-automatically-activity-7478159637293318144-5QZ3
- LinkedIn LangChain follow-up post: https://www.linkedin.com/posts/langchain_setup-openwiki-once-then-forget-about-it-activity-7478511578061910017-QJUG
- LinkedIn Eduardo Ordax post: https://www.linkedin.com/posts/eordax_ai-activity-7479458802291965952-ZgPf
- Digg summary page: https://digg.com/tech/v8f77n4c
- Times of AI article quoting Min Choi X post: https://www.timesofai.com/news/what-is-openwiki-explained/

## Timeline Facts

- The GitHub repository was created on 2026-06-22T23:48:26Z, according to GitHub repository metadata.
- The local git history starts with commit `ce3c570` at 2026-06-22T16:48:48-07:00 with subject `init commit`.
- The first npm publish was `0.0.0` at 2026-06-26T17:19:51Z.
- npm `0.0.1` was published at 2026-07-01T17:33:56Z.
- The LangChain launch blog is dated July 1, 2026 and says "Today we're releasing OpenWiki".
- The HN item `48752949` was created at 2026-07-01T20:51:52Z and currently shows 96 points and 31 descendants through the Firebase API.
- GitHub Releases are later than the public launch: tag `0.0.1` was published on 2026-07-05T22:30:03Z and `0.0.2` on 2026-07-07T18:04:59Z.

## Star Curve

GitHub GraphQL stargazer data fetched 9,002 timestamped stars on 2026-07-07.

Daily stars:

| UTC day | New stars | Cumulative |
|---|---:|---:|
| 2026-06-30 | 2 | 2 |
| 2026-07-01 | 164 | 166 |
| 2026-07-02 | 924 | 1,090 |
| 2026-07-03 | 684 | 1,774 |
| 2026-07-04 | 1,308 | 3,082 |
| 2026-07-05 | 2,036 | 5,118 |
| 2026-07-06 | 2,383 | 7,501 |
| 2026-07-07 | 1,501 | 9,002 |

Launch-day checkpoints from the first 400 stargazers:

| UTC time | Event | Cumulative stars |
|---|---|---:|
| 2026-07-01T17:33:56Z | npm `0.0.1` publish | 2 |
| 2026-07-01T20:51:52Z | HN post created | 61 |
| 2026-07-02T00:00:00Z | End of July 1 UTC | 166 |

Peak one-hour star windows:

| UTC hour | New stars |
|---|---:|
| 2026-07-06T06:00Z | 150 |
| 2026-07-06T13:00Z | 139 |
| 2026-07-06T07:00Z | 137 |
| 2026-07-06T08:00Z | 130 |
| 2026-07-06T14:00Z | 130 |
| 2026-07-05T14:00Z | 124 |

Working interpretation: the initial launch created a real but modest first-day base. The largest acceleration came later, especially July 4-6, after GitHub trending visibility and broader social reposts.

## Public Distribution Evidence

- LangChain blog launched the core story on July 1, 2026.
- HN contributed early developer discovery: 96 points and 31 comments for the GitHub repo link.
- Trendshift says OpenWiki first hit `#1 TypeScript Repository Of The Day` on July 2, 2026 and `#2 Repository Of The Day` across all languages on July 4, 2026.
- The YouMind mirror of Brace Sproul's X launch article/post reports 183K views, 329 likes, 51 reposts, 16 comments, and 794 bookmarks.
- LinkedIn had several visible launch/second-wave posts:
  - LangChain launch post: 271 reactions and 5 comments.
  - LangChain follow-up "Setup OpenWiki once" post: 156 reactions and 7 comments; embedded Brace Sproul post: 73 reactions and 8 comments.
  - Brace Sproul release post shown under that page: 458 reactions and 15 comments.
  - Eduardo Ordax post: 1,604 reactions and 104 comments, and text claims OpenWiki was already at 2.9k stars.
- Digg captured a July 3-ish/July 4-ish milestone as "1.7K GitHub Stars in Two Days" and notes a visible X-reaction sample, 93.3% positive from 16 accounts.
- Times of AI published on July 5 and quoted Min Choi's July 3 X post saying OpenWiki was "actually useful".

## Stargazer Profile Skew

GitHub profile aggregation fetched 9,004 stargazers. Public profile fields are user-entered and noisy; this is directional, not a clean geography/company dataset.

- 3,922 of 9,004 stargazers had a non-empty `location`.
- 2,255 of 9,004 stargazers had a non-empty `company`.
- Top raw location strings included India (66), Germany (48), China (47), Brazil (41), Spain (39), Singapore (33), France (29), Beijing (29), Indonesia (27), London (25), Bangalore (24), Barcelona (23), Vietnam (23), Colombia (22), and Madrid (22).
- Top raw company strings were fragmented and low-count: Freelancer (9), Freelance (8), Microsoft (7), Tencent (7), ByteDance (7), microsoft (5), Alibaba (5), SAP (4), Student (4), University of Science and Technology of China (4).
- Follower buckets: 5,418 stargazers had 0-9 followers, 3,027 had 10-99, 524 had 100-999, and 35 had 1,000-9,999. No stargazer in this crawl had 10k+ followers by the bucket logic.

Working interpretation: the star wave was broad and mostly long-tail developer attention, not a small set of very high-follower GitHub users starring it.

## Current Inference

OpenWiki did go viral in the GitHub/open-source-developer sense: it reached about 9k stars in roughly a week, hit Trendshift's daily TypeScript and all-language rankings, and generated multiple independent LinkedIn/X/HN/repost waves.

The exact referral source for each star is not public. GitHub traffic/referrer data would be available only to repository owners. Public evidence supports this likely funnel:

1. LangChain-owned launch surfaces created initial credibility: blog, GitHub repo, X/LinkedIn/video.
2. Hacker News produced early developer attention on July 1.
3. GitHub trending/Trendshift visibility likely amplified discovery starting July 2.
4. Broader LinkedIn/X creator posts created the larger July 4-6 acceleration.

## Attribution Assessment

Confidence levels:

- High confidence: OpenWiki was publicly launched by LangChain on July 1 through the blog, npm package/repo, video, X/LinkedIn posts, and README install path. The star curve begins immediately after this launch window.
- High confidence: HN was an early developer channel. It started when OpenWiki had about 61 stars and likely contributed to the first-night jump to 166 and the July 2 rise to 1,090 cumulative stars.
- High confidence: GitHub/Trendshift trending mattered. Trendshift records `#1 TypeScript Repository Of The Day` on July 2 and `#2 Repository Of The Day` across all languages on July 4. Stars rose from 1,090 cumulative on July 2 to 3,082 by July 4 and 7,501 by July 6.
- Medium confidence: LinkedIn was a major second-wave channel. Several visible posts have counts in the hundreds to thousands of reactions, including Eduardo Ordax's post with 1,604 reactions and 104 comments. Its text says OpenWiki was already at 2.9k stars, matching the July 4 cumulative range.
- Medium confidence: X was important, but exact official-account metrics are hard to verify without logged-in/API access. YouMind reports Brace Sproul's X-linked post/article at 183K views, 329 likes, 51 reposts, 16 comments, and 794 bookmarks. Times of AI later quoted Min Choi's July 3 X post, indicating influencer spread beyond LangChain-owned accounts.
- Low confidence: Reddit and AI-news rewrite sites drove meaningful stars. Reddit pages were found, but visible count data was unavailable through the unauthenticated page/JSON attempts. Secondary writeups prove awareness, not necessarily conversion.

Bottom line: the early stars likely came from first-party LangChain launch surfaces plus HN; the larger acceleration likely came from GitHub trending plus X/LinkedIn second-wave amplification.

## Open Questions

- Need verify whether X metrics for the official LangChain account are separately available; current reliable X count source is YouMind for the Brace Sproul post.
- Need decide how much weight to give secondary AI-news rewrite sites, because several appear low-quality but may still represent distribution.
