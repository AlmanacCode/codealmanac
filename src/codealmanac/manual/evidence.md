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

Citations should be close to the claims they support. Do not put all citations
only in the lead or only at the end of the page.

Use precise file sources when source code supports the claim. The source entry
should point to the file, directory, commit, PR, issue, transcript, manual page,
or web page that would help a maintainer verify the claim.

When evidence conflicts, state the conflict plainly or defer the claim. Do not
turn a transcript, diff, or note into source of truth for behavior the code
contradicts.

Do not cite obvious prose such as section transitions, navigation sentences, or
simple summaries that are already directly supported by nearby cited claims.
