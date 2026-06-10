---
title: Almanac Brand Direction
summary: "June 2026 brand work left Almanac with two active logo lanes: a celestial instrument symbol tied to the product name and a faceted negative-space letterform tied to the dev-tool lane."
topics: [product-positioning, decisions]
sources:
  - id: celestial-mark-session
    type: conversation
    path: /Users/kushagrachitkara/.codex/sessions/2026/06/04/rollout-2026-06-04T21-40-03-019e9366-1b93-7be3-bf26-f15c447068bd.jsonl
    note: Records the June 4, 2026 exploration that moved away from a centered `A` seal and refined a moon-and-axis celestial mark.
  - id: faceted-letterform-session
    type: conversation
    path: /Users/kushagrachitkara/.codex/sessions/2026/06/05/rollout-2026-06-05T03-42-27-019e94b1-e64b-7203-be97-9a00ec44e59a.jsonl
    note: Records the later June 4, 2026 exploration that tested abstract and faceted `A` directions, then narrowed the negative-space middle treatment to folded-notch and inner-facet variants.
  - id: almanac-serve-page
    type: file
    path: .almanac/pages/almanac-serve.md
    note: Records the currently implemented local viewer identity, which still uses the older usealmanac open-book mark and green paper visual system.
  - id: viewer-shell
    type: file
    path: viewer/index.html
    note: Renders the current `almanac-logo.png` asset in the local viewer chrome.
  - id: viewer-theme
    type: file
    path: viewer/app.css
    note: Encodes the current viewer theme and labels it as usealmanac DNA.
status: active
verified: 2026-06-09
---

# Almanac Brand Direction

June 2026 brand work did not converge on one shipped mark. It produced two credible directions that answer different jobs: a celestial symbol that makes "almanac" literal, and a faceted letterform that behaves more like a modern dev-tool icon. Neither direction has been applied to the repo's current open-book viewer identity. [@celestial-mark-session] [@faceted-letterform-session] [@viewer-shell]

## Celestial Lane

The earlier June 4 exploration moved away from a centered `A` monogram and toward a celestial-instrument mark. Its durable rationale was semantic: Almanac should signal orientation, navigation, calendars, stars, and accumulated knowledge more directly than a seal whose center is only an initial. [@celestial-mark-session]

The strongest version in that run was a black circular field, a white crescent or moon cut, and a white x/y instrument axis contained inside the disk. The later refinements were also stable: the axis should feel embedded rather than pasted on, its weight should thicken toward the center, the tapered ends should be blunt rather than spear-like, the center dot should shrink or disappear, and the black rim on the crescent side should stay very thin so the moon reads as the object rather than as a white cut trapped behind a border. [@celestial-mark-session]

This lane is strongest when the product wants to lean into the literal meaning of "almanac" and distinguish itself from generic software monograms. It is weaker when the product wants to read immediately as a contemporary dev tool icon rather than as a symbolic instrument. [@celestial-mark-session]

## Faceted Letterform Lane

The later June 4 exploration reopened the letterform question from the opposite direction. The first durable decision in that run was that a dev-tool mark does not need to explain wiki, memory, or agents. It only needs to be recognizable, reproducible at small sizes, and plausible beside other serious developer tools. [@faceted-letterform-session]

That session temporarily locked a flat abstract `A` with a central aperture or keyhole, then treated it as one lane rather than the final answer. The stronger later work moved to faux-3D faceted geometry: a mark built from angled planes and folds instead of a front-facing letter. The durable criterion was that the object-language should read first and the letter should arrive second through silhouette or negative space. Front-facing or over-literal versions were treated as regressions. [@faceted-letterform-session]

The most promising sub-lane inside this direction was a negative-space lowercase `a` carved out of a faceted object. The central problem there was the middle treatment. A normal circular counter felt like a chart bubble or punched UI dot rather than part of the same object. The session generated six replacements and narrowed the field to two: a folded notch, which felt the most natural and least inserted, and an inner folded facet, which was the most interesting conceptually but still needed cleanup. [@faceted-letterform-session]

The rejected middle treatments established useful anti-patterns for future work in this lane. The slanted capsule kept the bubble problem, the diamond aperture read too much like a logo system or crypto mark, the triangular bite read like a play button, and the split seam drifted toward magnifying-glass or speech-bubble territory. The stable acceptance test was whether the middle belonged to the same folded object rather than feeling like a separate symbol dropped into the center. [@faceted-letterform-session]

## Current Repo State

Neither June 2026 direction is the currently shipped repo identity. The local viewer still renders `almanac-logo.png` in its chrome, and the current viewer design page documents the older usealmanac open-book mark, warm paper surfaces, and green accent system. [@viewer-shell] [@almanac-serve-page] [@viewer-theme]

Future visual work should treat the repo as having three states rather than one. The shipped state is the older open-book viewer identity. The celestial lane is the strongest semantic direction for the product name. The faceted letterform lane is the strongest dev-tool lettermark direction, with folded-notch and inner-facet counters as the promising middle treatments. Asset swaps, landing-page copy, and viewer chrome should move together when one lane actually wins. [@celestial-mark-session] [@faceted-letterform-session] [@almanac-serve-page]

## Related Pages

[[almanac-serve]] records the current local viewer identity and where it is implemented. [[almanac-product-family]] explains the broader product positioning this identity should support. [[open-source-almanac]] records the public-repo product framing the identity will eventually need to match.
