#!/bin/bash
# codealmanac SessionEnd hook
#
# Claude, Codex, and Cursor invoke this on session end/stop with JSON on stdin.
# Common payload fields:
#   { "session_id": "...", "transcript_path": "...", "cwd": "..." }
# Cursor may omit cwd and provide workspace_roots instead.
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
CWD=$(echo "$INPUT" | jq -r '.cwd // .workspace_roots[0] // empty')
FINAL_STATUS=$(echo "$INPUT" | jq -r '.final_status // .reason // empty')
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')

# Without a transcript or cwd there's nothing for capture to do. Don't
# error — Claude Code doesn't care, and the user doesn't want a scary log.
[ -z "$TRANSCRIPT" ] && exit 0
[ -z "$CWD" ] && exit 0

# Cursor passes final_status; skip aborted/failed sessions. Claude/Codex
# payloads do not always include this, so empty remains allowed.
if [ -n "$FINAL_STATUS" ] && [ "$FINAL_STATUS" != "completed" ] && [ "$FINAL_STATUS" != "stop" ]; then
  exit 0
fi

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

    run_capture() {
      cd "$DIR" && \
      $CMD capture "$TRANSCRIPT" --session "$SESSION_ID" --quiet \
        > "$LOG_DIR/.capture-$SESSION_ID.log" 2>&1
    }

    # Codex Stop is turn-scoped, not session-scoped. Debounce it so an
    # interactive session that pauses between turns doesn't run capture
    # repeatedly. Each Stop refreshes a marker; only the last quiet marker
    # gets to run capture after the delay.
    if [ "$HOOK_EVENT" = "Stop" ]; then
      DELAY="${CODEALMANAC_CAPTURE_DEBOUNCE_SECONDS:-120}"
      MARKER="$LOG_DIR/.capture-$SESSION_ID.debounce"
      NOW=$(date +%s)
      echo "$NOW" > "$MARKER" || exit 0
      (
        sleep "$DELAY"
        [ -f "$MARKER" ] || exit 0
        CURRENT=$(cat "$MARKER" 2>/dev/null || true)
        [ "$CURRENT" = "$NOW" ] || exit 0
        run_capture
        rm -f "$MARKER"
      ) &
      disown $! 2>/dev/null || true
      exit 0
    fi

    # Background the capture, redirect all output to a session-scoped log.
    # `--quiet` keeps streaming off (the log still captures the raw
    # SDK transcript); `--session` lets the capture command name its
    # own log file consistently if desired.
    ( run_capture ) &
    # Detach so the shell doesn't wait on the subprocess.
    disown $! 2>/dev/null || true
    exit 0
  fi
  DIR=$(dirname "$DIR")
done

exit 0
