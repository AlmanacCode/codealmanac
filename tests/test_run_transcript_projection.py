from datetime import UTC, datetime

import pytest

from codealmanac.services.harnesses.models import (
    HarnessActorConfidence,
    HarnessActorRole,
    HarnessAgentTrace,
    HarnessEvent,
    HarnessEventKind,
    HarnessFailure,
    HarnessKind,
    HarnessRunActor,
    HarnessRunStatus,
    HarnessToolDisplay,
    HarnessToolDisplayKind,
    HarnessToolStatus,
)
from codealmanac.services.runs.models import RunEventKind, RunLogEvent
from codealmanac.services.runs.transcript import (
    RunStepKind,
    join_text,
    project_run_steps,
    status_title,
    tool_kind_label,
    value_preview,
)


def log_event(
    sequence: int,
    *,
    kind: RunEventKind = RunEventKind.TOOL,
    message: str = "event",
    harness_event: HarnessEvent | None = None,
) -> RunLogEvent:
    return RunLogEvent(
        run_id="run-1",
        sequence=sequence,
        timestamp=datetime(2026, 7, 7, 12, 0, tzinfo=UTC),
        kind=kind,
        message=message,
        harness_event=harness_event,
    )


def actor(label: str) -> HarnessRunActor:
    return HarnessRunActor(
        thread_id="thread-1",
        role=HarnessActorRole.ROOT,
        label=label,
        confidence=HarnessActorConfidence.PROVIDER,
    )


def test_run_events_without_harness_payload_become_status_and_error_steps():
    steps = project_run_steps(
        (
            log_event(1, kind=RunEventKind.STATUS, message="worker_started"),
            log_event(2, kind=RunEventKind.ERROR, message="boom"),
        )
    )

    assert [step.kind for step in steps] == [RunStepKind.STATUS, RunStepKind.ERROR]
    assert steps[0].title == "Worker Started"
    assert steps[0].error is False
    assert steps[1].title == "Error"
    assert steps[1].body == "boom"
    assert steps[1].error is True


def test_consecutive_text_from_same_actor_merges_into_one_assistant_step():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TEXT,
                    message="first",
                    actor=actor("writer"),
                ),
            ),
            log_event(
                2,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TEXT_DELTA,
                    message="second",
                    actor=actor("writer"),
                ),
            ),
        )
    )

    assert len(steps) == 1
    assert steps[0].kind == RunStepKind.ASSISTANT
    assert steps[0].actor == "writer"
    assert steps[0].body == "first\nsecond"


def test_text_from_a_different_actor_starts_a_new_assistant_step():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TEXT,
                    message="from writer",
                    actor=actor("writer"),
                ),
            ),
            log_event(
                2,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TEXT,
                    message="from reviewer",
                    actor=actor("reviewer"),
                ),
            ),
        )
    )

    assert [step.actor for step in steps] == ["writer", "reviewer"]
    assert steps[1].title == "reviewer"


def test_text_without_actor_titles_the_step_assistant():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TEXT,
                    message="hello",
                ),
            ),
        )
    )

    assert steps[0].title == "Assistant"
    assert steps[0].actor is None


def test_tool_result_updates_the_matching_started_tool_step():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TOOL_USE,
                    message="reading file",
                    tool_id="tool-1",
                    tool_name="Read",
                    tool_input='{"path": "a.py"}',
                    tool_display=HarnessToolDisplay(
                        kind=HarnessToolDisplayKind.READ,
                        title="Read a.py",
                        path="src/a.py",
                        status=HarnessToolStatus.STARTED,
                    ),
                ),
            ),
            log_event(
                2,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TOOL_RESULT,
                    message="done",
                    tool_id="tool-1",
                    tool_result="file body",
                    tool_display=HarnessToolDisplay(
                        kind=HarnessToolDisplayKind.READ,
                        path="src/a.py",
                        status=HarnessToolStatus.COMPLETED,
                        duration_ms=12,
                        summary="read 40 lines",
                    ),
                ),
            ),
        )
    )

    assert len(steps) == 1
    step = steps[0]
    assert step.sequence == 2
    assert step.status == "completed"
    assert step.body == "read 40 lines"
    assert step.detail == "src/a.py · 12ms"
    assert step.output == "file body"
    assert step.tool == "read"
    assert step.target == "src/a.py"
    assert step.input == '{"path": "a.py"}'
    assert step.error is False


def test_orphan_tool_result_creates_its_own_completed_step():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TOOL_SUMMARY,
                    message="ran a command",
                    tool_name="Shell",
                    tool_result="exit 0",
                    tool_is_error=False,
                ),
            ),
        )
    )

    assert len(steps) == 1
    assert steps[0].kind == RunStepKind.TOOL
    assert steps[0].title == "Shell"
    assert steps[0].status == "completed"
    assert steps[0].output == "exit 0"


def test_failed_tool_result_marks_the_step_as_errored():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TOOL_USE,
                    message="running",
                    tool_id="tool-1",
                    tool_name="Shell",
                ),
            ),
            log_event(
                2,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TOOL_RESULT,
                    message="failed",
                    tool_id="tool-1",
                    tool_is_error=True,
                ),
            ),
        )
    )

    assert steps[0].status == "failed"
    assert steps[0].error is True


@pytest.mark.parametrize(
    ("kind", "title", "status"),
    [
        (HarnessEventKind.AGENT_SPAWNED, "Agent started", "started"),
        (HarnessEventKind.AGENT_WAIT_STARTED, "Waiting for agent", "waiting"),
        (HarnessEventKind.AGENT_COMPLETED, "Agent finished", "completed"),
    ],
)
def test_agent_events_project_titles_and_statuses(kind, title, status):
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=kind,
                    message="agent event",
                    agent_trace=HarnessAgentTrace(prompt="review", result="looks good"),
                ),
            ),
        )
    )

    assert steps[0].kind == RunStepKind.AGENT
    assert steps[0].title == title
    assert steps[0].status == status
    assert steps[0].body == "looks good"
    assert steps[0].detail == "review"


def test_agent_event_without_trace_uses_the_event_message():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.AGENT_SPAWNED,
                    message="spawned reviewer",
                ),
            ),
        )
    )

    assert steps[0].body == "spawned reviewer"
    assert steps[0].detail is None


def test_error_event_carries_failure_message_and_fix():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.ERROR,
                    message="provider error",
                    status=HarnessRunStatus.FAILED,
                    failure=HarnessFailure(
                        provider=HarnessKind.CLAUDE,
                        message="rate limited",
                        fix="wait and retry",
                    ),
                ),
            ),
        )
    )

    assert steps[0].kind == RunStepKind.ERROR
    assert steps[0].body == "rate limited"
    assert steps[0].detail == "wait and retry"
    assert steps[0].status == HarnessRunStatus.FAILED.value
    assert steps[0].error is True


def test_done_event_with_failure_projects_an_error_step():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.DONE,
                    message="finished",
                    failure=HarnessFailure(
                        provider=HarnessKind.CLAUDE,
                        message="agent aborted",
                    ),
                ),
            ),
        )
    )

    assert steps[0].kind == RunStepKind.ERROR
    assert steps[0].body == "agent aborted"


def test_warning_done_and_session_events_project_status_steps():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.WARNING,
                    message="slow provider",
                ),
            ),
            log_event(
                2,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.DONE,
                    message="all done",
                ),
            ),
            log_event(
                3,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.PROVIDER_SESSION,
                    message="session",
                    provider_session_id="session-1",
                ),
            ),
        )
    )

    assert [(step.title, step.body) for step in steps] == [
        ("Warning", "slow provider"),
        ("Done", "all done"),
        ("Session", "session-1"),
    ]


def test_noise_events_are_dropped_from_the_transcript():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.CONTEXT_USAGE,
                    message="12000 tokens",
                ),
            ),
            log_event(
                2,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.PROVIDER_SESSION,
                    message="session",
                ),
            ),
            log_event(
                3,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.HOOK,
                    message="hook fired",
                ),
            ),
        )
    )

    assert steps == ()


def test_tool_result_summary_falls_back_to_truncated_result_preview():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TOOL_RESULT,
                    message="done",
                    tool_name="Read",
                    tool_result="x" * 400,
                ),
            ),
        )
    )

    assert steps[0].body == "x" * 277 + "..."


def test_tool_without_display_or_name_is_titled_tool():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TOOL_USE,
                    message="doing something",
                ),
            ),
        )
    )

    assert steps[0].title == "Tool"
    assert steps[0].tool is None
    assert steps[0].target is None
    assert steps[0].status == "started"


def test_tool_target_prefers_path_then_command_then_thread():
    steps = project_run_steps(
        (
            log_event(
                1,
                harness_event=HarnessEvent(
                    kind=HarnessEventKind.TOOL_USE,
                    message="shell",
                    tool_display=HarnessToolDisplay(
                        kind=HarnessToolDisplayKind.SHELL,
                        command="ls -la",
                        exit_code=0,
                    ),
                ),
            ),
        )
    )

    assert steps[0].target == "ls -la"
    assert steps[0].detail == "ls -la · exit 0"


@pytest.mark.parametrize(
    ("first", "second", "expected"),
    [
        (None, "a", "a"),
        ("a", "b", "a\nb"),
        ("a\n", "b", "a\nb"),
        ("a", "\nb", "a\nb"),
    ],
)
def test_join_text(first, second, expected):
    assert join_text(first, second) == expected


def test_status_title_normalizes_separators():
    assert status_title("worker-started_now") == "Worker Started Now"


def test_tool_kind_label_reads_as_prose():
    assert tool_kind_label(HarnessToolDisplayKind.WEB) == "web"


def test_value_preview_stringifies_non_text_values():
    assert value_preview({"ok": True}) == "{'ok': True}"
