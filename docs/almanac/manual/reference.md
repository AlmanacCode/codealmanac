---
title: Reference
topics: [manual]
---

# Reference

Use this manual when writing a page under `pages/reference/`. A reference page
is exact lookup material for the machinery of this repository.

Reference pages are information-oriented. The reader comes to them for truth,
certainty, and quick lookup, not for a story, tutorial, or argument.

The lead should define the scope of the reference and what the reader can look
up there.

Describe and only describe. State facts about commands, flags, schemas,
frontmatter, config keys, states, models, file layouts, event shapes, stable
behavior, limitations, errors, and other exact contracts.

Organize the page by the structure of the thing being described. A command
reference should follow the command surface. A schema reference should follow
the schema. A state reference should follow the states and transitions. Use
consistent lists or tables when they make facts easier to compare.

Examples are allowed when they clarify exact usage, but they should stay short.
Do not let examples turn into step-by-step guides.

Warnings are allowed when the contract requires them. Say what must happen,
what must not happen, what is optional, what is unsupported, and what errors
mean.

Split reference pages by lookup need. A command surface, schema, state enum,
frontmatter format, file layout, and event format are usually separate
references because readers look them up at different moments.

Do not turn a reference page into a tutorial, guide, architecture explanation,
motivation essay, or conceptual overview.
