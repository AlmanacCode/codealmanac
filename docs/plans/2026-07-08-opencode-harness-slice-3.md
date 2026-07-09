# OpenCode Harness — Slice 3: Transcript Discovery + Reading (`sync`)

Slice 3 of 3 for `docs/plans/2026-07-07-opencode-harness.md` (tracks issue #9). Final slice — `codealmanac sync` picks up OpenCode sessions the same way it already does Claude/Codex ones. Builds on Slice 1 (`HarnessKind.OPENCODE` runnable) and Slice 2 (onboarding); doesn't depend on either's code, only on the SQLite schema confirmed by Slice 1's spike.

## The real design problem this slice has to solve

This is the must-fix gap the master plan flagged repeatedly and Slices 1/2 explicitly deferred: `TranscriptSourceRuntimeAdapter` (`integrations/sources/transcripts/runtime.py`) is the *only* registered `SourceRuntimeAdapter`, and it assumes **one transcript file = one session** — `SourceRef.transcript` is a plain path string, `transcript_path()` resolves it to exactly one `Path`, and `path.is_file()` gates whether the session is readable at all. Claude/Codex satisfy this by construction (one JSONL file per session). OpenCode does not: confirmed by Slice 1's spike, every session for a project lives in the *same* shared `opencode.db`, disambiguated only by a `session_id` column, not by file identity.

Traced the actual mechanics before designing around this (not assuming):

- `SourceRef.transcript` is a **plain string**, not validated against real path syntax — `services/sources/address_transcript.py::resolve_transcript()` just does `raw.removeprefix("transcript:").strip()` and stores it verbatim. It only becomes a `Path` later, in `paths.py::transcript_path()`. This means the string after `"transcript:"` doesn't have to look like a real filesystem path — it just has to round-trip through whatever this slice's own code expects.
- `SourcesService.inspect_runtime()` (`services/sources/service.py:49-60`) already dispatches to the **first** `SourceRuntimeAdapter` in a list whose `supports(ref)` returns `True` — a multi-adapter seam that already exists and is already used for other source kinds (filesystem, git, GitHub, web each have their own adapter). Transcripts only ever had one adapter because Claude and Codex happen to share a format, not because the seam only supports one.

**Resolution:** register a **second** `SourceRuntimeAdapter`, `OpencodeTranscriptSourceRuntimeAdapter`, registered *before* the existing generic `TranscriptSourceRuntimeAdapter` in `default_transcript_runtime_adapters()` (order is load-bearing — the generic one's `supports()` matches *any* `SourceKind.TRANSCRIPT` ref with no further discrimination, so it must go second or it silently swallows OpenCode refs too). Disambiguate sessions by encoding both the db path and the session id into the `transcript` string using an unambiguous separator (`::`, which can't appear in a real filesystem path on any OS this matters for), parsed via `rpartition` from the right so a `session_id` is always cleanly split off even if a path somehow contained the separator. `TranscriptCandidate.transcript_path` itself stays the *real*, honest `opencode.db` path for every OpenCode candidate (not a synthetic compound value) — the compound identifier only exists in the `"transcript:"`-prefixed address string built at the `sync_ingest_request()` boundary, which is already the one place that branches per-app (`sync_ingest_title()` right next to it already does `candidate.app.value`).

Considered and rejected: putting the compound identifier into `transcript_path` itself (a `Path` object holding `"<db>::<session_id>"`) — technically works (no Pydantic validator forbids it) but makes a field named `transcript_path` lie about what it contains, for every reader of `TranscriptCandidate` including ones that have nothing to do with the runtime-inspection problem this is solving.

## Read before coding

1. `docs/plans/2026-07-07-opencode-harness.md` — "Spike findings" (SQLite schema, confirmed query shape) and this doc's design-problem section above.
2. `src/codealmanac/services/sources/service.py` — `SourcesService.inspect_runtime()`'s ordered-dispatch loop (the seam this slice extends)
3. `src/codealmanac/integrations/sources/transcripts/runtime.py`, `reader.py`, `models.py` (`TranscriptRuntimeEntry`) — the JSONL-shaped precedent; `TranscriptRuntimeEntry.line_number` is reusable as a per-entry ordinal despite the JSONL-sounding name (already noted in the master plan)
4. `src/codealmanac/integrations/sources/transcripts/claude.py` / `codex.py` — discovery adapter precedent; note `candidate_from_meta()` (`jsonlines.py`) assumes one-file-one-candidate via `Path.stat()` and does **not** fit this slice's one-db-many-candidates shape — don't force reuse, write a direct constructor instead (see Scope)
5. `src/codealmanac/services/sources/address_transcript.py` — confirms `SourceRef.transcript` is an unvalidated plain string
6. `src/codealmanac/workflows/sync/queue.py::sync_ingest_request()` — where the `"transcript:<path>"` address string gets built; already branches per-`candidate.app` next door in `sync_ingest_title()`

## Scope

### `services/sources/models.py`

- `TranscriptApp.OPENCODE = "opencode"`

### `integrations/sources/transcripts/opencode_ref.py` (new, shared by discovery + runtime)

```python
OPENCODE_TRANSCRIPT_SEPARATOR = "::"

def format_opencode_transcript_ref(db_path: Path, session_id: str) -> str: ...
def parse_opencode_transcript_ref(value: str) -> tuple[Path, str] | None: ...
```

`parse_...` uses `rpartition(OPENCODE_TRANSCRIPT_SEPARATOR)` and returns `None` if the separator is missing or either side is empty — this `None` return is also `OpencodeTranscriptSourceRuntimeAdapter.supports()`'s discriminator (see below).

### `integrations/sources/transcripts/opencode_db.py` (new, shared by discovery + runtime)

- `open_opencode_db(path: Path) -> sqlite3.Connection` — read-only (`f"file:{path}?mode=ro"`, `uri=True`), so this never contends with a live `opencode serve` writing in WAL mode.
- `list_opencode_sessions(conn) -> list[JsonObject-ish row]` — `SELECT id, directory, time_updated FROM session`, used by discovery.
- `read_opencode_session_entries(conn, session_id) -> Iterator[TranscriptRuntimeEntry]` — the confirmed join: `message` + `part` ordered by `time_created`, decoding each `part.data` JSON blob into a `TranscriptRuntimeEntry` (reusing the existing model, not a new one). Map by part `type`: `text`/`reasoning` → `MESSAGE`, `tool` → `TOOL_CALL` (one entry) since OpenCode's tool parts already carry resolved input+output in one row, unlike Claude/Codex's separate call/result lines — no need to synthesize a second entry. `step-start`/`step-finish`/`patch` → skip or `META` at the implementer's judgment; match Slice 1's `parts.py` mapping semantically where it's the obvious analog, but don't force a shared function — the two serve different output types (`HarnessEvent` vs `TranscriptRuntimeEntry`) and forcing one function to produce both is an awkward abstraction for two call sites, not a real duplication problem.
- **Schema-drift resilience:** wrap all query execution in `try/except sqlite3.Error`, returning `()`/empty rather than raising — per the master plan's design decision, this schema isn't a documented public contract (10+ dated migrations already observed), so a future `opencode-ai` upgrade changing it should degrade `sync` to "found nothing this run," not crash it.

### `integrations/sources/transcripts/opencode.py` (new — discovery adapter)

```python
class OpencodeTranscriptDiscoveryAdapter:
    app = TranscriptApp.OPENCODE

    def __init__(self, db_path: Path | None = None): ...
    def discover(self, request: DiscoverTranscriptsRequest) -> tuple[TranscriptCandidate, ...]: ...
```

- Default `db_path`: `request.home / ".local" / "share" / "opencode" / "opencode.db"` — confirmed live on macOS during Slice 1's spike (the server's own startup log lines showed it loading config from this directory tree). **Same Windows caveat as Slices 1/2, not re-verified here:** carried forward from Slice 1's "Windows compatibility" section — inferred, not confirmed, that this resolves the same way on Windows. Missing-file degrades to zero candidates (`db_path.is_file()` check before opening), never an error.
- One `TranscriptCandidate` per `session` row: `transcript_path` = the real `db_path` (see design-problem section — kept honest, not compound), `cwd` = `normalize_path(Path(directory))`, `modified_at` = `session.time_updated` (epoch milliseconds, confirmed shape from the spike) converted via `datetime.fromtimestamp(ms / 1000, UTC)`, `size_bytes` = the whole database file's size. **Known imprecision, disclosed not hidden:** `size_bytes` reports the shared file's total size for every candidate, not that session's own share of it — the field is informational only downstream (confirm this at implementation time by checking callers), and querying a precise per-session byte count isn't worth the added complexity for a field with no behavioral consequence found.
- Does **not** call the existing `candidate_from_meta()` helper (`jsonlines.py`) — that helper's contract is "stat this one file, treat its mtime as the candidate's mtime," which is definitionally wrong when many candidates share one file. Constructs `TranscriptCandidate` directly.

### `integrations/sources/transcripts/opencode.py` (same file — runtime adapter)

```python
class OpencodeTranscriptSourceRuntimeAdapter:
    def supports(self, ref: SourceRef) -> bool:
        # True only for refs this adapter's own discovery/address-building
        # produced — parse_opencode_transcript_ref returns None for a plain
        # Claude/Codex-shaped path, so this never steals their refs.
        ...
    def inspect(self, request: InspectSourceRuntimeRequest) -> SourceRuntime: ...
```

### `integrations/sources/transcripts/__init__.py`

- `default_transcript_discovery_adapters()`: add `OpencodeTranscriptDiscoveryAdapter()`.
- `default_transcript_runtime_adapters()`: **`(OpencodeTranscriptSourceRuntimeAdapter(), TranscriptSourceRuntimeAdapter())`** — OpenCode's adapter first. Getting this order backwards is a silent, hard-to-notice bug (OpenCode transcripts would report "no readable JSONL objects found" instead of erroring loudly), so this ordering gets its own explicit test, not just incidental coverage.

### `workflows/sync/queue.py`

- `sync_ingest_request()`: branch the `"transcript:..."` address string per `candidate.app` — OpenCode gets `format_opencode_transcript_ref(candidate.transcript_path, candidate.session_id)` appended after the prefix; Claude/Codex keep today's plain `str(candidate.transcript_path)`.

### `cli/dispatch/sync.py`

- `parse_sync_apps`'s default tuple: add `TranscriptApp.OPENCODE`.

## Out of scope

- Re-verifying the `~/.local/share/opencode/opencode.db` path on Windows — same deferred verification pass as Slices 1/2.
- Sub-agent session-tree traversal in transcript rendering (a session with `parent_id` set) — consistent with Slice 1's disclosed gap; a session's own `parent_id` isn't followed to fetch its parent/children's content in this slice either.

## File changes

| File | Change |
|---|---|
| `src/codealmanac/services/sources/models.py` | add `TranscriptApp.OPENCODE` |
| `src/codealmanac/integrations/sources/transcripts/opencode_ref.py` | new — `format_opencode_transcript_ref`/`parse_opencode_transcript_ref` |
| `src/codealmanac/integrations/sources/transcripts/opencode_db.py` | new — read-only SQLite open/query helpers, schema-drift-tolerant |
| `src/codealmanac/integrations/sources/transcripts/opencode.py` | new — `OpencodeTranscriptDiscoveryAdapter` + `OpencodeTranscriptSourceRuntimeAdapter` |
| `src/codealmanac/integrations/sources/transcripts/__init__.py` | register both adapters; runtime adapter order is load-bearing |
| `src/codealmanac/workflows/sync/queue.py` | `sync_ingest_request()` branches the transcript address string per `candidate.app` |
| `src/codealmanac/cli/dispatch/sync.py` | add `TranscriptApp.OPENCODE` to `parse_sync_apps`'s default tuple |
| `tests/test_opencode_transcripts.py` (new) | discovery, runtime inspection, ref round-trip, adapter-order regression, schema-drift/missing-db graceful degrade |

## Test coverage

- `format_opencode_transcript_ref`/`parse_opencode_transcript_ref` round-trip; `parse_...` returns `None` for a plain Claude/Codex-shaped path (no `::`).
- `OpencodeTranscriptDiscoveryAdapter.discover()` against a fixture SQLite db with known `project`/`session` rows → expected `TranscriptCandidate`s; missing db file → `()`, not an exception; a `session` table with an unexpected column (simulating schema drift) → `()`, not an exception.
- `OpencodeTranscriptSourceRuntimeAdapter.inspect()` against a fixture db with known `message`/`part` rows for one session → expected `TranscriptRuntimeEntry`s, content matches the spike's confirmed shapes (text, tool with resolved input+output).
- **`default_transcript_runtime_adapters()` ordering regression:** register both adapters as the real function does, build an OpenCode-shaped `SourceRef`, assert `SourcesService.inspect_runtime()` returns real content (not "no readable JSONL objects found" from the generic adapter winning by accident).
- `sync_ingest_request()` builds an OpenCode-shaped `"transcript:<db>::<session_id>"` string for an OpenCode candidate and a plain `"transcript:<path>"` string for a Claude/Codex candidate in the same call.
- `parse_sync_apps()` default includes `TranscriptApp.OPENCODE`.

## Next steps after this slice

1. Build against this doc.
2. Review pass → `docs/plans/fixes-opencode-harness-slice-3-review.md`, own logical commit.
3. All three slices done — this closes out `docs/plans/2026-07-07-opencode-harness.md`'s scope except the explicitly-deferred Windows verification pass. Ready for the user's requested single combined commit once slice 3's review/fixes land.
