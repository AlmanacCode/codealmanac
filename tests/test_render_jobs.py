import json
from datetime import UTC, datetime

import pytest

from codealmanac.cli.render.job_logs import (
    detail_extras,
    render_run_attach,
    render_run_attach_detached,
    render_run_attach_stream,
    render_run_log,
    truncate_middle,
)
from codealmanac.cli.render.jobs import (
    render_run,
    render_run_cancel,
    render_runs,
)
from codealmanac.services.harnesses.models import (
    HarnessEvent,
    HarnessEventKind,
    HarnessFailure,
    HarnessKind,
    HarnessToolDisplay,
    HarnessToolDisplayKind,
    HarnessToolStatus,
    HarnessTranscriptRef,
)
from codealmanac.services.runs.models import (
    PageChangeSet,
    RunAttachSnapshot,
    RunAttachUpdate,
    RunCancelResult,
    RunEventKind,
    RunKind,
    RunLogEvent,
    RunRecord,
    RunStatus,
)

CREATED_AT = datetime(2026, 7, 7, 12, 0, tzinfo=UTC)


def record(
    *,
    status: RunStatus = RunStatus.DONE,
    title: str | None = "Garden the wiki",
    summary: str | None = None,
    error: str | None = None,
    page_changes: PageChangeSet | None = None,
    harness_transcript: HarnessTranscriptRef | None = None,
) -> RunRecord:
    return RunRecord(
        run_id="run-1",
        repository_id="repo-1",
        kind=RunKind.GARDEN,
        status=status,
        title=title,
        summary=summary,
        error=error,
        created_at=CREATED_AT,
        updated_at=CREATED_AT,
        started_at=CREATED_AT,
        finished_at=CREATED_AT if status == RunStatus.DONE else None,
        page_changes=page_changes,
        harness_transcript=harness_transcript,
    )


def log_event(
    sequence: int,
    *,
    kind: RunEventKind = RunEventKind.STATUS,
    message: str = "queued",
    harness_event: HarnessEvent | None = None,
) -> RunLogEvent:
    return RunLogEvent(
        run_id="run-1",
        sequence=sequence,
        timestamp=CREATED_AT,
        kind=kind,
        message=message,
        harness_event=harness_event,
    )


def tool_event(sequence: int, status: HarnessToolStatus) -> RunLogEvent:
    return log_event(
        sequence,
        kind=RunEventKind.TOOL,
        message="reading",
        harness_event=HarnessEvent(
            kind=HarnessEventKind.TOOL_USE,
            message="reading",
            tool_id="tool-1",
            tool_display=HarnessToolDisplay(
                kind=HarnessToolDisplayKind.READ,
                title="Read",
                path="src/a.py",
                status=status,
                duration_ms=12,
            ),
        ),
    )


def test_render_runs_lists_a_table_of_jobs(capsys):
    render_runs((record(),), json_output=False)

    lines = capsys.readouterr().out.splitlines()
    assert lines[0].split() == ["ID", "KIND", "STATUS", "ELAPSED", "TITLE"]
    assert lines[1].startswith("run-1  garden  done")
    assert lines[1].endswith("Garden the wiki")


def test_render_runs_reports_empty_result_on_stderr(capsys):
    render_runs((), json_output=False)

    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err.strip() == "# 0 jobs"


def test_render_runs_json_emits_rows(capsys):
    render_runs((record(),), json_output=True)

    rows = json.loads(capsys.readouterr().out)
    assert [row["run_id"] for row in rows] == ["run-1"]


def test_render_runs_shows_queued_jobs_without_elapsed_time(capsys):
    render_runs((record(status=RunStatus.QUEUED, title=None),), json_output=False)

    assert "—" in capsys.readouterr().out


def test_render_runs_labels_every_status(capsys):
    render_runs(
        tuple(record(status=status) for status in RunStatus),
        json_output=False,
    )

    rows = capsys.readouterr().out.splitlines()[1:]
    assert [row.split()[2] for row in rows] == [status.value for status in RunStatus]


def test_render_run_prints_detail_lines(capsys):
    render_run(
        record(
            summary="tidied 3 pages",
            page_changes=PageChangeSet(
                created=("alpha",),
                updated=("beta", "gamma"),
            ),
            harness_transcript=HarnessTranscriptRef(
                kind=HarnessKind.CLAUDE,
                session_id="session-1",
                transcript_path="/tmp/transcript.jsonl",
            ),
        ),
        json_output=False,
    )

    out = capsys.readouterr().out
    assert "job:        run-1" in out
    assert "kind:       garden" in out
    assert "status:     done" in out
    assert "title:      Garden the wiki" in out
    assert "summary:    tidied 3 pages" in out
    assert "changes:    1 created, 2 updated, 0 deleted" in out
    assert "created:    alpha" in out
    assert "updated:    beta, gamma" in out
    assert "deleted:" not in out
    assert "session:    claude session-1" in out
    assert "transcript: /tmp/transcript.jsonl" in out
    assert "logs:       codealmanac jobs logs run-1" in out


def test_render_run_prints_error_and_no_change_summary(capsys):
    render_run(
        record(
            status=RunStatus.FAILED,
            title=None,
            error="provider timed out",
            page_changes=PageChangeSet(),
        ),
        json_output=False,
    )

    out = capsys.readouterr().out
    assert "changes:    none" in out
    assert "error:      provider timed out" in out
    assert "title:" not in out
    assert "summary:" not in out


def test_render_run_omits_changes_for_a_job_that_reported_none(capsys):
    render_run(record(), json_output=False)

    assert "changes:" not in capsys.readouterr().out


def test_render_run_json_emits_the_record(capsys):
    render_run(record(), json_output=True)

    assert json.loads(capsys.readouterr().out)["run_id"] == "run-1"


def test_render_run_cancel_reports_changed_and_unchanged_jobs(capsys):
    render_run_cancel(
        RunCancelResult(record=record(status=RunStatus.CANCELLED), changed=True),
        json_output=False,
    )
    render_run_cancel(
        RunCancelResult(record=record(), changed=False),
        json_output=False,
    )
    render_run_cancel(
        RunCancelResult(record=record(), changed=True),
        json_output=True,
    )

    out = capsys.readouterr().out.splitlines()
    assert out[0] == "cancelled run-1"
    assert out[1] == "job already done: run-1"
    assert json.loads("\n".join(out[2:]))["changed"] is True


def test_render_run_log_prints_assistant_tool_and_note_steps(capsys):
    render_run_log(
        (
            log_event(1, message="worker_started"),
            log_event(
                2,
                kind=RunEventKind.MESSAGE,
                message="thinking",
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TEXT,
                    message="Reviewing the wiki\nfor stale pages",
                ),
            ),
            tool_event(3, HarnessToolStatus.COMPLETED),
            log_event(4, kind=RunEventKind.ERROR, message="boom"),
        ),
        json_output=False,
    )

    out = capsys.readouterr().out
    assert "▌ assistant" in out
    assert "      Reviewing the wiki" in out
    assert "      for stale pages" in out
    assert "● Read  src/a.py" in out
    assert "read · 12ms" in out
    assert "✕ Error" in out
    assert "· Worker Started" in out


def test_render_run_log_marks_pending_and_failed_tools(capsys):
    render_run_log((tool_event(1, HarnessToolStatus.STARTED),), json_output=False)
    started = capsys.readouterr().out

    render_run_log((tool_event(1, HarnessToolStatus.FAILED),), json_output=False)
    failed = capsys.readouterr().out

    assert "◐ Read" in started
    assert "✕ Read" in failed
    assert "read · failed" in failed


def test_render_run_log_prints_agent_steps_without_a_target(capsys):
    render_run_log(
        (
            log_event(
                1,
                kind=RunEventKind.TOOL,
                message="agent",
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.AGENT_COMPLETED,
                    message="reviewer finished",
                ),
            ),
        ),
        json_output=False,
    )

    assert capsys.readouterr().out.strip() == "● Agent finished"


def test_render_run_log_prints_error_fix_below_the_message(capsys):
    render_run_log(
        (
            log_event(
                1,
                kind=RunEventKind.TOOL,
                message="error",
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.ERROR,
                    message="provider error",
                    failure=HarnessFailure(
                        provider=HarnessKind.CLAUDE,
                        message="rate limited",
                        fix="wait and retry",
                    ),
                ),
            ),
        ),
        json_output=False,
    )

    out = capsys.readouterr().out
    assert "✕ Error" in out
    assert "      rate limited" in out
    assert "      wait and retry" in out


def test_render_run_log_json_emits_projected_steps(capsys):
    render_run_log((log_event(1, message="worker_started"),), json_output=True)

    steps = json.loads(capsys.readouterr().out)
    assert [step["title"] for step in steps] == ["Worker Started"]
    assert "detail" not in steps[0]


def test_render_run_attach_prints_events_then_terminal_status(capsys):
    render_run_attach(
        RunAttachSnapshot(
            record=record(summary="tidied 3 pages"),
            events=(log_event(1, message="worker_started"),),
            terminal=True,
        ),
        json_output=False,
    )

    out = capsys.readouterr().out
    assert "· Worker Started" in out
    assert "status: done" in out
    assert "summary: tidied 3 pages" in out


def test_render_run_attach_reports_an_empty_log(capsys):
    render_run_attach(
        RunAttachSnapshot(
            record=record(status=RunStatus.FAILED, error="provider timed out"),
            events=(),
            terminal=True,
        ),
        json_output=False,
    )

    out = capsys.readouterr().out
    assert "no log events" in out
    assert "status: failed" in out
    assert "error: provider timed out" in out


def test_render_run_attach_json_emits_the_snapshot(capsys):
    render_run_attach(
        RunAttachSnapshot(record=record(), events=(), terminal=True),
        json_output=True,
    )

    assert json.loads(capsys.readouterr().out)["record"]["run_id"] == "run-1"


def test_render_run_attach_stream_prints_steps_and_final_status(capsys):
    render_run_attach_stream(
        (
            RunAttachUpdate(
                record=record(status=RunStatus.RUNNING),
                events=(log_event(1, message="worker_started"),),
                terminal=False,
            ),
            RunAttachUpdate(record=record(), events=(), terminal=True),
        ),
        json_output=False,
    )

    out = capsys.readouterr().out
    assert "· Worker Started" in out
    assert "no log events" not in out
    assert out.strip().endswith("status: done")


def test_render_run_attach_stream_reports_a_run_without_events(capsys):
    render_run_attach_stream(
        (RunAttachUpdate(record=record(), events=(), terminal=True),),
        json_output=False,
    )

    assert "no log events" in capsys.readouterr().out


def test_render_run_attach_stream_json_emits_one_update_per_line(capsys):
    render_run_attach_stream(
        (
            RunAttachUpdate(record=record(), events=(), terminal=False),
            RunAttachUpdate(record=record(), events=(), terminal=True),
        ),
        json_output=True,
    )

    lines = capsys.readouterr().out.splitlines()
    assert [json.loads(line)["terminal"] for line in lines] == [False, True]


def test_render_run_attach_detached_points_at_the_cancel_command(capsys):
    render_run_attach_detached("run-1", json_output=False)

    out = capsys.readouterr().out
    assert "detached — job continues in background" in out
    assert "cancel: codealmanac jobs cancel run-1" in out


def test_render_run_attach_detached_stays_silent_for_json(capsys):
    render_run_attach_detached("run-1", json_output=True)

    assert capsys.readouterr().out == ""


@pytest.mark.parametrize(
    ("detail", "target", "expected"),
    [
        (None, "src/a.py", None),
        ("src/a.py", "src/a.py", None),
        ("src/a.py · 12ms", "src/a.py", "12ms"),
        ("exit 0 · 12ms", None, "exit 0 · 12ms"),
    ],
)
def test_detail_extras_drops_paths_and_repeated_targets(detail, target, expected):
    assert detail_extras(detail, target) == expected


def test_truncate_middle_keeps_head_and_tail():
    value = "a" * 40 + "/" + "b" * 40

    assert truncate_middle(value, 20) == "aaaaaaaaaaa…bbbbbbbb"
    assert truncate_middle("short", 20) == "short"
