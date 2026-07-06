---
title: Naming
summary: Clear, simple, product-oriented names; honest modules; naming is architecture.
topics: [style]
sources:
  - id: manual
    type: file
    path: MANUAL.md
    note: Naming-is-architecture and honest-names rules.
  - id: claude-md
    type: file
    path: CLAUDE.md
    note: Engineering taste on honest modules.
---

# Naming

Names are clear, simple, and product-oriented — words a user of the product would recognize, not developer jargon. One word is the ideal; two is acceptable; a compound noun that needs a comment to explain is a smell. A command "ingests material", it does not "execute an absorption pipeline".

Names must be honest. A file named `auth.py` must not secretly mean "Claude auth"; a central module must not know provider-specific details; a docstring that over-claims generality is a bug [@manual] [@claude-md]. If the honest name for a thing is awkward, the thing is probably shaped wrong — treat the naming difficulty as design feedback.

Naming is architecture: the moment a thing's general role can be named, it earns a first-class home at that name [@manual]. The reverse also holds — code that cannot be given a clear name has not found its boundary yet.

Private helpers are not a substitute for names. A small `_helper()` is fine for
local mechanics, but a cluster of internal functions that owns a policy,
workflow step, or reusable concept is a boundary trying to exist. Give that
concept an honest module, method, or type instead of hiding the architecture
behind underscores.
