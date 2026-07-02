# Open Questions

Status: active.

## Product / UX

- Should `codealmanac repo delivery set` exist, or should delivery be changed
  only through `repo triggers ...` commands and the browser?
- Should `codealmanac capture enable` be allowed without rerunning browser
  onboarding, or should it always open the capture consent page?
- What exact cloud route should bare `codealmanac` open first:
  `/wiki/github/<owner>/<repo>` or a dashboard resolver route?

## Local

- Should local capture be enabled during `local setup`, or only through
  `local capture enable`?

## Implementation

- Which Python CLI auto-update library should be used?
- Which compatibility commands remain hidden aliases during the CLI migration?
- Which shared rate-limit backend should cloud use?
- Which WorkOS primitive should back capture hooks?
