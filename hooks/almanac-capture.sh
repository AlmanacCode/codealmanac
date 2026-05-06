#!/bin/bash
# codealmanac SessionEnd hook
#
# Claude Code invokes this on session end with a JSON payload on stdin:
#   { "session_id": "...", "transcript_path": "...", "cwd": "..." }
#
# We walk upward from cwd looking for a `.almanac/` directory. If found, we
# background `almanac capture` (so session end never waits on us) and
# redirect output to a sidecar log. If not found, we silently exit 0.
#
# Exit code is ALWAYS 0 — capture failures must never break Claude Code's
# session-end path.

set -u

# CodeAlmanac's own bootstrap/capture agents run Claude Code internally.
# Their SessionEnd events must not trigger another capture, or one capture
# can become an unbounded capture chain.
if [ "${CODEALMANAC_INTERNAL_SESSION:-}" = "1" ]; then
  exit 0
fi

# Be forgiving: if jq is missing, we can't parse the payload, so no-op.
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Without a transcript or cwd there's nothing for capture to do. Don't
# error — Claude Code doesn't care, and the user doesn't want a scary log.
[ -z "$TRANSCRIPT" ] && exit 0
[ -z "$CWD" ] && exit 0

# Walk up from cwd looking for a wiki. Bound the loop at the filesystem
# root ('/') so we can't infinite-loop if cwd is weird.
DIR="$CWD"
while [ "$DIR" != "/" ] && [ -n "$DIR" ]; do
  if [ -d "$DIR/.almanac" ]; then
    LOG_DIR="$DIR/.almanac/logs"
    mkdir -p "$LOG_DIR" || exit 0
    # Prefer `almanac` on PATH; fall back to `npx codealmanac` if the
    # binary isn't linked (happens with non-global installs).
    if command -v almanac >/dev/null 2>&1; then
      CMD="almanac"
    elif command -v npx >/dev/null 2>&1; then
      CMD="npx --no-install codealmanac"
    else
      # No way to invoke capture; silently give up.
      exit 0
    fi

    # Background the capture, redirect all output to a session-scoped log.
    # `--quiet` keeps streaming off (the log still captures the raw
    # SDK transcript); `--session` lets the capture command name its
    # own log file consistently if desired.
    (
      cd "$DIR" && \
      $CMD capture "$TRANSCRIPT" --session "$SESSION_ID" --quiet \
        > "$LOG_DIR/.capture-$SESSION_ID.log" 2>&1
    ) &
    # Detach so the shell doesn't wait on the subprocess.
    disown $! 2>/dev/null || true
    exit 0
  fi
  DIR=$(dirname "$DIR")
done

exit 0
