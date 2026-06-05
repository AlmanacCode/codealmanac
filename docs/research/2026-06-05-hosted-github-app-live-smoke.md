# Hosted GitHub App live smoke

This note records a live smoke test for the hosted Almanac GitHub App flow.

The expected behavior is that a same-repository pull request receives one Almanac check, the maintainer approves the update, the hosted worker runs CodeAlmanac against the PR context, and the backend commits only repo-owned Almanac files back to the PR branch.

The smoke test intentionally keeps delivery narrow: fork follow-up PR delivery is not part of v1, and the hosted backend remains the only component allowed to write GitHub commits.

The second smoke commit retriggers the pull request after the hosted backend check-action copy was shortened to satisfy GitHub's Check Runs API limits.
