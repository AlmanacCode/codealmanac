---
page_id: wiki-writing-standard
title: Writing Standard
topics: [concepts]
sources:
  - id: prompt-syntax
    type: file
    path: prompts/base/syntax.md
    note: Defines page syntax, source, citation, link, and writing rules.
  - id: general-manual
    type: manual
    note: General Almanac manual discussion in ../almanac establishes the article-quality direction for Almanac pages.
  - id: summary-style
    type: manual
    note: The ../almanac Wikipedia summary-style notes provide source material behind leads, summaries, splits, and self-contained articles.
---

# Writing Standard

Write pages as articles for a capable reader who has forgotten all context. The
lead should explain what the subject is, why it matters to this repo, and what
the page helps the reader understand. [@prompt-syntax]

Every non-obvious claim needs evidence. Put evidence in `sources:` and cite it
with `[@source-id]` near the claim it supports. Do not cite a source that was not
read. [@prompt-syntax]

## Prose

Use direct, factual prose. Avoid generic AI documentation language, marketing
phrases, unsupported rationale, and file-by-file narration.

Good writing says what is true here:

```markdown
The provider harness keeps runtime metadata inside provider modules so lifecycle
commands do not import Claude-specific auth checks.
```

Weak writing could describe any repo:

```markdown
This module plays an important role in managing providers.
```

## Links

Link the first meaningful mention of related pages, files, and folders. The
sentence around the link should explain the relationship. A bare link list is
not a substitute for a reading path. [@prompt-syntax]

## History

Keep old knowledge when it explains the present. Use plain prose:

```markdown
The Codex SDK spike was abandoned because lifecycle jobs need managed process
control and app-server notifications; current Codex runs use the app-server path.
```

Do not hide history in metadata or leave it as a detached dated log.

## Source Limits

If the sources do not establish a claim, say what is known and what is missing.
Pages should expose conflicts and gaps rather than invent a confident answer.
