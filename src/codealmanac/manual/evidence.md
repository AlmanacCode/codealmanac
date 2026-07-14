---
title: Evidence
topics: [manual]
---

# Evidence

Use this manual when grounding factual claims in wiki pages. Evidence is what
lets a future maintainer trust the page without redoing the whole
investigation.

Every durable claim should be supported by a named source. Use frontmatter
`sources:` entries for the materials that support the page, then cite
non-obvious claims inline with `[@source-id]`.

The `sources:` entries in frontmatter are the materials actually used and cited
in the article. They are not inspiration, research notes, or a list of files
that helped you understand the subject. If a source is not cited in the article
with `[@source-id]`, it does not belong in `sources:`.

Before finishing a page, compare every `sources:` id against the body. If an id
is not cited with `[@source-id]`, either cite it next to the claim it supports
or remove it.

A page with factual code, architecture, product, workflow, or decision claims
but no inline citations is suspect. Navigation pages and manual pages can be
lighter when they do not make those claims.

Choose the source that is authoritative for the claim:

- code is authoritative for runtime behavior
- tests are authoritative for enforced contracts
- docs are authoritative for stated intent
- transcripts are authoritative for what was discussed
- PRs and commits are authoritative for review, merge, and change context
- the wiki is maintained synthesis, not proof when code or docs disagree

Ordinary repository documentation may be outdated. When using it to create or
change Almanac knowledge, distinguish stated intent from current behavior and
verify present-tense claims against code and tests.

Citations should be close to the claims they support. Do not put all citations
only in the lead or only at the end of the page.

Use precise file sources when source code supports the claim. The source entry
should point to the file, directory, commit, PR, issue, transcript, manual page,
or web page that would help a maintainer verify the claim.

Directory source paths must end with `/`, for example `src/api/v1/`. Without the
trailing slash, the validator treats the path as a file.

When evidence conflicts, state the conflict plainly or defer the claim. Do not
turn a transcript, diff, or note into source of truth for behavior the code
contradicts.

Do not cite obvious prose such as section transitions, navigation sentences, or
simple summaries that are already directly supported by nearby cited claims.
