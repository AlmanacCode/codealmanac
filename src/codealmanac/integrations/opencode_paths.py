from pathlib import Path

# OpenCode's local SQLite database, confirmed live during the 2026-07-08
# spike (docs/plans/2026-07-07-opencode-harness.md "Spike findings") and
# used by both integrations/sources/transcripts/opencode.py (historical
# session reading) and integrations/harnesses/opencode/progress.py (live
# run polling) — shared here so the two don't carry independent copies of
# a deployment-path assumption already flagged as unverified on Windows.
OPENCODE_DB_RELATIVE_PATH = Path(".local/share/opencode/opencode.db")
