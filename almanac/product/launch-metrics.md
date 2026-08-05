---
title: Launch Metrics
topics: [product, launch]
sources:
  - id: launch-metrics-transcript
    type: conversation
    session_id: rollout-2026-07-13T18-52-05-019f5e53-00bd-7e53-8435-82a138f05ccd
    note: Product conversation clarifying PyPI mirror traffic and launch user-count interpretation.
  - id: team-launch-copy-transcript
    type: conversation
    session_id: rollout-2026-07-22T10-03-56-019f8ac8-b302-7230-a550-1f2d844315f7
    note: Product conversation using GitHub stars, package downloads, and YC-company usage as launch-facing traction claims.
  - id: positioning
    type: wiki
    path: product/positioning
    note: Product positioning page that routes launch and category framing.
---

# Launch Metrics

Launch metrics explain how to report public package traction without
overstating the number of actual CodeAlmanac users. This page belongs under the
[Product positioning](positioning) neighborhood because it is launch-facing
interpretation, not runtime behavior [@positioning].

PyPI download counts are distribution events, not unique users. Mirror fetches
show repository synchronization, while non-mirror fetches still include CI,
reinstalls, upgrades, bots, security scanners, development testing, and multiple
files downloaded by one installation [@launch-metrics-transcript]. A private
mirror can also serve downstream installations that PyPI never sees, so unique
users can be lower than non-mirror downloads or higher than visible direct
fetches [@launch-metrics-transcript].

Launch reporting should state PyPI fetches directly and avoid turning them into
a guessed user count. Actual user measurement would need a first-party signal
such as privacy-preserving setup events, active installation telemetry, or
opt-in installation identifiers [@launch-metrics-transcript].

When social copy combines GitHub stars, package downloads, and named customer
or cohort usage, treat those as dated traction claims from the source material,
not as proof of active installations or unique users [@team-launch-copy-transcript].
