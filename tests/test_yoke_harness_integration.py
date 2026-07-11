import json
from pathlib import Path

import pytest
from yoke import (
    AgentCall,
    Event,
    EventKind,
    Failure,
    Provider,
    Readiness,
    Run,
    RunStatus,
)

from codealmanac.integrations.harnesses.yoke.adapter import (
    CLAUDE_ALLOWED_TOOLS,
    YokeHarnessAdapter,
    lifecycle_agent,
    provider_options,
)
from codealmanac.integrations.harnesses.yoke.events import YokeEventProjector
from codealmanac.integrations.harnesses.yoke.results import project_run
from codealmanac.services.harnesses.models import (
    HarnessActorRole,
    HarnessEventKind,
    HarnessKind,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest


class RecordingHarness:
    def __init__(self, run: Run):
        self.result = run
        self.calls = []

    def check_sync(self) -> Readiness:
        return Readiness(available=True, message="ready")

    def run_sync(self, prompt, options):
        self.calls.append((prompt, options))
        return self.result


def request(kind: HarnessKind, prompt: str = "  preserve me exactly  "):
    return RunHarnessRequest(
        kind=kind,
        model="chosen-model",
        cwd=Path("/tmp/project"),
        prompt=prompt,
    )


@pytest.mark.parametrize("kind", tuple(HarnessKind))
def test_adapter_forwards_exact_prompt_and_model(kind):
    harness = RecordingHarness(
        Run(provider=Provider(kind.value), output="ok")
    )
    requested = request(kind)
    result = YokeHarnessAdapter(kind, lambda *_: harness).run(requested)

    assert result.status is HarnessRunStatus.SUCCEEDED
    [(prompt, options)] = harness.calls
    assert prompt == requested.prompt
    assert options.model == "chosen-model"


def test_lifecycle_agent_has_description_but_no_prompt_instructions():
    agent = lifecycle_agent()

    assert agent.description == "CodeAlmanac lifecycle agent"
    assert agent.instructions is None
    assert agent.tools.read and agent.tools.write and agent.tools.shell


def test_provider_options_are_explicit_and_provider_specific():
    claude = provider_options(HarnessKind.CLAUDE).claude
    assert claude is not None
    assert claude.tools == CLAUDE_ALLOWED_TOOLS
    assert claude.allowed_tools == CLAUDE_ALLOWED_TOOLS
    assert claude.permission_mode == "dontAsk"
    assert claude.setting_sources == ()
    assert claude.raw == {"mcp_servers": {}, "strict_mcp_config": True}

    codex = provider_options(HarnessKind.CODEX).codex
    assert codex is not None
    assert str(codex.sandbox) == "danger-full-access"
    assert str(codex.approval) == "never"
    assert codex.network is False
    assert codex.app_server.ephemeral is True


@pytest.mark.parametrize("kind", tuple(HarnessKind))
@pytest.mark.parametrize("event_kind", tuple(EventKind))
def test_every_yoke_event_kind_projects_and_serializes(kind, event_kind):
    [projected, *extra] = YokeEventProjector(kind).project(
        Event(
            kind=event_kind,
            message=f"event {event_kind}",
            tool_result={
                "nested": [1, True, {"value": "safe"}],
                9: "numeric key",
                "infinity": float("inf"),
                "opaque": object(),
            },
        )
    )

    assert projected.kind is HarnessEventKind(str(event_kind))
    payload = json.loads(projected.model_dump_json())
    assert payload["tool_result"]["9"] == "numeric key"
    assert payload["tool_result"]["infinity"] is None
    assert payload["tool_result"]["opaque"] is None
    assert extra == []


def test_unknown_yoke_event_projects_to_unknown_and_is_json_safe():
    [projected] = YokeEventProjector(HarnessKind.CODEX).project(
        Event(kind="provider_future_event", tool_result=(Path("x"), b"bytes"))
    )

    assert projected.kind is HarnessEventKind.UNKNOWN
    json.loads(projected.model_dump_json())
    assert projected.tool_result == [None, None]


def test_codex_agent_lifecycle_is_correlated_and_emitted_once():
    projector = YokeEventProjector(HarnessKind.CODEX)
    projector.project(
        Event(kind=EventKind.PROVIDER_SESSION, provider_session_id="root")
    )
    spawn = Event(
        kind=EventKind.TOOL_USE,
        source_thread_id="root",
        agent=AgentCall(
            action="spawned",
            sender_thread_id="root",
            new_thread_id="helper-1",
            prompt="review it",
            model="review-model",
        ),
    )

    first = projector.project(spawn)
    repeated = projector.project(spawn)
    completed = projector.project(
        Event(
            kind=EventKind.TOOL_RESULT,
            message="looks correct",
            source_thread_id="root",
            agent=AgentCall(
                action="completed",
                sender_thread_id="root",
                receiver_thread_ids=("helper-1",),
            ),
        )
    )
    repeated_completion = projector.project(
        Event(
            kind=EventKind.TOOL_RESULT,
            message="duplicate final",
            source_thread_id="root",
            agent=AgentCall(
                action="completed",
                sender_thread_id="root",
                receiver_thread_ids=("helper-1",),
            ),
        )
    )

    assert [item.kind for item in first] == [
        HarnessEventKind.TOOL_USE,
        HarnessEventKind.AGENT_SPAWNED,
    ]
    assert len(repeated) == 1
    lifecycle = completed[-1]
    assert lifecycle.kind is HarnessEventKind.AGENT_COMPLETED
    assert lifecycle.actor.role is HarnessActorRole.HELPER
    assert lifecycle.actor.parent_thread_id == "root"
    assert lifecycle.agent_trace.child_thread_id == "helper-1"
    assert len(repeated_completion) == 1


def test_codex_spawn_uses_child_thread_instead_of_tool_call_id():
    projector = YokeEventProjector(HarnessKind.CODEX)
    projector.project(
        Event(kind=EventKind.PROVIDER_SESSION, provider_session_id="root")
    )

    projected = projector.project(
        Event(
            kind=EventKind.TOOL_RESULT,
            tool_id="call-1",
            source_thread_id="root",
            agent=AgentCall(
                action="spawnAgent",
                sender_thread_id="root",
                receiver_thread_ids=("helper-1",),
            ),
        )
    )

    spawned = [
        item
        for item in projected
        if item.kind is HarnessEventKind.AGENT_SPAWNED
    ]
    assert len(spawned) == 1
    assert spawned[0].agent_trace.child_thread_id == "helper-1"


@pytest.mark.parametrize(
    ("status", "failure", "expected"),
    [
        (RunStatus.FAILED, Failure(message="provider broke"), "provider broke"),
        (RunStatus.CANCELLED, None, "codex cancelled"),
    ],
)
def test_failure_and_cancel_always_end_with_one_terminal(status, failure, expected):
    result = project_run(
        Run(
            provider=Provider.CODEX,
            status=status,
            failure=failure,
            events=(
                Event(kind=EventKind.DONE, message="early done"),
                Event(kind=EventKind.WARNING, message="late detail"),
                Event(kind=EventKind.DONE, message="duplicate done"),
            ),
        ),
        HarnessKind.CODEX,
        YokeEventProjector(HarnessKind.CODEX),
    )

    assert result.output_text == expected
    assert result.events[-1].kind is HarnessEventKind.DONE
    assert result.events[-1].status is HarnessRunStatus(str(status))
    assert sum(e.kind is HarnessEventKind.DONE for e in result.events) == 1
    if failure is not None:
        assert result.events[-1].failure.message == "provider broke"


def test_callback_receives_nonterminal_events_and_terminal_exactly_once():
    harness = RecordingHarness(
        Run(
            provider=Provider.CODEX,
            output="done",
            events=(
                Event(kind=EventKind.TEXT, message="working"),
                Event(kind=EventKind.DONE, message="provider done"),
            ),
        )
    )
    observed = []

    result = YokeHarnessAdapter(
        HarnessKind.CODEX, lambda *_: harness
    ).run(request(HarnessKind.CODEX), observed.append)

    assert observed == list(result.events)
    assert observed[-1].kind is HarnessEventKind.DONE
    assert sum(event.kind is HarnessEventKind.DONE for event in observed) == 1
