---
title: Sources
topics: [manual]
---

# Sources

Sources are raw material CodeAlmanac can learn from. They are not automatically
source of truth for every claim.

Selected material may include files, directories, diffs, commit ranges, PRs,
issues, web pages, notes, and local agent transcripts. The source runtime
normalizes that material before a lifecycle run.

Adding or discovering material does not imply a wiki update. The lifecycle run
decides whether the material changes durable wiki knowledge.

Keep page shape organized by subject, not by how material arrived.

When a page uses source material as evidence, list it in frontmatter
`sources:`. File and folder evidence uses `type: file`:

```yaml
sources:
  - id: index-service
    type: file
    path: src/codealmanac/services/index/service.py
```

Use short stable source ids. Cite non-obvious claims with `[@index-service]`.
Validation reports missing citations, unused sources, duplicate ids, and dead
file paths.

Do not use the retired file-list frontmatter field. Do not put repo files into
inline page links. Sources are the retrieval and evidence channel for files.
