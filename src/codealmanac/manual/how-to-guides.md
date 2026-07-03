---
title: How-To Guides
topics: [manual]
---

# How-To Guides

Use this manual when writing a page under `pages/guides/`. The goal is to help
a future maintainer complete one specific task in this repository without
turning the page into a tutorial, reference table, or architecture explanation.

## Start From The Task

Name the work the maintainer is trying to finish. Frame the guide around that
goal, not around the command, file, or service involved.

Good guide subjects look like:

- debug a failed sync run
- add a CLI command
- verify the viewer
- release the package
- add a new adapter

Commands, files, and services should appear only because they help the reader
complete the task.

## Write The Lead

Start with the situation, the task, and the successful outcome. After the lead,
the reader should know when to use the guide and what they should have achieved
by the end.

## Keep The Body Action-Focused

Include the explanation needed to make the action safe, correct, or
understandable. Link to concept, architecture, decision, or reference pages for
background.

Do not teach basic tooling. Do not include related material for completeness.

## Order The Work

Order the guide around how the maintainer will actually work. Reduce
context-switching. If the task branches, state the condition and what to do in
each case.

## Choose Headings For This Task

Use headings that fit the work. Preconditions, steps, decision points,
verification, and recovery notes are useful, but they are not required sections.

Do not collapse a guide into only a list of steps when the task can fail or be
verified. Most debugging, release, adapter, command, and workflow-change guides
should explain how the maintainer knows the task succeeded.

Use verification and recovery material when it helps the task. Verification
answers "how do I know this worked?" Recovery answers "what should I check or
undo if this fails?"

You may notice that this manual is itself written in the format of a how-to
guide. That is intentional: use its shape as a model, not as a rigid template.
