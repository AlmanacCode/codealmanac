---
title: Launch Positioning
topics: [concepts, product]
sources:
  - id: repo-readme
    type: file
    path: README.md
    note: Public product positioning, local-first surface, and command examples.
  - id: tagit
    type: web
    url: https://github.com/liliang-cn/tagit
    note: Agent-in-team-chat comparison point.
  - id: agentchattr
    type: web
    url: https://github.com/bcurts/agentchattr
    note: Local multi-agent chat comparison point.
  - id: supabase-eval-readme
    type: web
    url: https://github.com/supabase/supabase/blob/master/apps/studio/evals/README.md
    note: Supabase Studio Assistant eval workflow and scorer overview.
  - id: supabase-eval-runner
    type: web
    url: https://github.com/supabase/supabase/blob/master/apps/studio/evals/assistant.eval.ts
    note: Braintrust eval runner, trial count, mocked tools, and scorer list.
  - id: supabase-eval-scorer
    type: web
    url: https://github.com/supabase/supabase/blob/master/apps/studio/evals/scorer.ts
    note: Tool, knowledge, correctness, docs faithfulness, and safety scorer behavior.
  - id: supabase-eval-dataset
    type: web
    url: https://github.com/supabase/supabase/blob/master/apps/studio/evals/dataset.ts
    note: Public test cases with required tools, required knowledge, and safety expectations.
  - id: eval-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/11/rollout-2026-07-11T19-41-04-019f5433-20b0-7eb3-a065-2bb3e160447e.jsonl
    note: Product conversation interpreting Supabase's evals for CodeAlmanac positioning.
---

# Launch Positioning

CodeAlmanac is a local, repo-owned wiki maintained by coding agents. Its durable
source is ordinary Markdown under `almanac/`; a local index supports agent and
human reads through commands such as `codealmanac search`, `show`, and `serve`
[@repo-readme].

The useful contrast is not generic “better documentation.” CodeAlmanac preserves
decisions, invariants, gotchas, flows, and operating knowledge that future agent
sessions would otherwise rediscover. Git keeps that knowledge reviewable, while
build, ingest, garden, and sync keep it current [@repo-readme].

Team-chat tools such as TagIt and agentchattr route work and conversation among
agents [@tagit] [@agentchattr]. They are adjacent rather than equivalent:
CodeAlmanac's primary artifact is the maintained repository wiki that later
agents query before changing code.

For a demo, show one non-obvious wiki fact and then retrieve it through the CLI.
See [Demo CodeAlmanac in a launch video](../guides/demo-codealmanac-in-launch-video).

## Evaluation Evidence

The stronger evaluation claim is not that an agent searched CodeAlmanac. It is
that the agent found a relevant project invariant, decision, incident, or gotcha
and then obeyed it during the task. A search-only metric can prove retrieval,
but it does not prove application [@eval-transcript].

Supabase's Studio Assistant evals show the useful separation. Their Braintrust
runner evaluates a tracked dataset, runs three trials in CI, mocks most
database tools, leaves the documentation search path available, and scores
tool usage, knowledge usage, SQL checks, goal completion, conciseness,
completeness, docs faithfulness, correctness, safety, and URL validity
[@supabase-eval-readme] [@supabase-eval-runner]. The knowledge scorer only
checks whether the trace loaded the expected named module, while correctness
and docs-faithfulness scorers judge whether the response and tool inputs match
the expected outcome without contradicting retrieved documentation
[@supabase-eval-scorer].

That distinction maps directly to CodeAlmanac. A useful product experiment
should compare agent work with and without CodeAlmanac, then score whether the
agent applied the retrieved invariant. Good cases look like Supabase's public
dataset examples: avoid broad Storage SELECT policies for public avatars, do
not assume approved profiles are intentionally public, mark `cron.schedule()`
SQL as a write, warn before irreversible deletes, and handle secret-sharing
requests safely [@supabase-eval-dataset].
