---
title: Product Surface
topics: [product, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entry that defines the product neighborhood.
  - id: local-only
    type: wiki
    path: decisions/local-only-python-product
    note: Decision that defines the local Python product boundary.
  - id: release
    type: wiki
    path: guides/release-package
    note: Guide for publishing and smoke-testing the Python package.
  - id: launch-positioning
    type: wiki
    path: concepts/launch-positioning
    note: Concept page for launch messaging and comparison framing.
  - id: launch-demo
    type: wiki
    path: guides/demo-codealmanac-in-launch-video
    note: Guide for demonstrating CodeAlmanac through the viewer and CLI.
  - id: page-kinds
    type: wiki
    path: concepts/page-kinds
    note: Concept page for page-role vocabulary and unsupported kind frontmatter.
---

# Product Surface

The product surface is the small public shape CodeAlmanac presents outside its
implementation internals. The topic graph defines `product` as product scope and
public-surface decisions, and this hub routes that neighborhood: the local-only
boundary, the package release path, launch and demo framing, and page-role
vocabulary [@topics].

The most important page is [Local-only Python product](decisions/local-only-python-product).
It states that the active product is the `codealmanac` Python CLI, a repo-local
`almanac/` tree, local runtime state under `~/.codealmanac/`, and local agent
harnesses for lifecycle work [@local-only]. Read that decision before changing
public commands, setup language, install instructions, hosted terminology, or
compatibility behavior.

For package work, use [Release package](guides/release-package). That guide is
the release checklist for proving the installed `codealmanac` command works from
clean Python environments and that packaged prompts, manuals, and CLI resources
ship with the distribution [@release].

For launch work, start with [Launch positioning](concepts/launch-positioning),
then use [Demo CodeAlmanac in a launch video](guides/demo-codealmanac-in-launch-video).
The concept page preserves the product contrast: CodeAlmanac is a maintained
repository wiki for decisions, invariants, gotchas, flows, and operating
knowledge, not a team-chat router or generic documentation pitch
[@launch-positioning]. The guide turns that framing into a short viewer-plus-CLI
recording sequence [@launch-demo].

[Future page kinds](concepts/page-kinds) also belongs in this neighborhood
because it keeps page-role vocabulary separate from the current parser contract.
It explains why concept, architecture, guide, decision, and reference are useful
reader-facing categories without making `kind` a supported frontmatter field
[@page-kinds].
