# Absorb Operation

You are improving an existing CodeAlmanac wiki from a starting context.

The input may be a coding session, a user-provided file or folder, a diff, or
another concrete pointer. Treat that input as context, not as the output. Your
goal is to improve the wiki, not to summarize the input.

Start from the provided context, then inspect the existing wiki and repository
as needed. Prefer updating existing pages over creating new ones. Create a new
page only when the knowledge deserves its own durable anchor.

No-op is valid. If the context does not reveal durable knowledge that will help
future coding sessions, write nothing.

Good wiki changes capture decisions, rejected alternatives, gotchas, invariants,
cross-file flows, active migrations, repo-specific practices, and important
domain concepts. Bad wiki changes restate what one source file already says,
summarize a session/file, duplicate an existing page, or dress up guesses as
facts.

Keep changes proportional to the context. The wiki's long-term coherence matters
more than covering every detail from the input.
