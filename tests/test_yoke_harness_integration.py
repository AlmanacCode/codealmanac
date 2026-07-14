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

from codealmanac.agents.catalog import agent_collection, load_agent
from codealmanac.app import create_app
from codealmanac.integrations.harnesses.yoke.adapter import (
    CLAUDE_ALLOWED_TOOLS,
    YokeHarnessAdapter,
    create_yoke_harness,
    provider_options,
)
from codealmanac.integrations.harnesses.yoke.events import YokeEventProjector
from codealmanac.integrations.harnesses.yoke.results import project_run
from codealmanac.services.harnesses.models import (
    HarnessActorRole,
    HarnessAgentKind,
    HarnessEventKind,
    HarnessKind,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest
from codealmanac.settings import AppConfig


class RecordingHarness:
    def __init__(self, run: Run):
        self.result = run
        self.calls = []

    def check_sync(self) -> Readiness:
        return Readiness(
            provider=Provider.CODEX,
            surface="codex_app_server",
            available=True,
            message="ready",
        )

    def run_sync(self, prompt, options):
        self.calls.append((prompt, options))
        return self.result


def request(kind: HarnessKind, prompt: str = "  preserve me exactly  "):
    return RunHarnessRequest(
        kind=kind,
        model="chosen-model",
        agent=HarnessAgentKind.BUILD,
        cwd=Path("/tmp/project"),
        prompt=prompt,
    )


@pytest.mark.parametrize("kind", tuple(HarnessKind))
def test_adapter_forwards_exact_prompt_and_model(kind, tmp_path):
    if kind.value not in Provider.__members__.values():
        # almanac-yoke's published release has no Provider.OPENCODE yet —
        # OpenCode support is still an open Yoke PR (AlmanacCode/Yoke#1).
        # Self-clearing: once pyproject.toml is repinned to a release that
        # ships it, Provider(kind.value) below resolves and this skip stops
        # firing on its own, no manual cleanup needed.
        pytest.skip(f"yoke has no Provider member for {kind.value!r} yet")
    harness = RecordingHarness(
        Run(provider=Provider(kind.value), output="ok")
    )
    requested = request(kind)
    result = YokeHarnessAdapter(
        kind,
        tmp_path / "harnesses",
        lambda *_: harness,
    ).run(requested)

    assert result.status is HarnessRunStatus.SUCCEEDED
    [(prompt, options)] = harness.calls
    assert prompt == requested.prompt
    assert options.model == "chosen-model"


def test_readiness_uses_state_sibling_instead_of_callers_cwd(tmp_path):
    harness = RecordingHarness(Run(provider=Provider.CODEX, output="ok"))
    calls = []

    def factory(kind, cwd, agent, runtime_root):
        calls.append((kind, cwd, agent, runtime_root))
        return harness

    runtime_root = tmp_path / "state" / "harnesses"
    readiness = YokeHarnessAdapter(
        HarnessKind.CODEX,
        runtime_root,
        factory,
    ).check()

    assert readiness.available
    assert calls == [
        (
            HarnessKind.CODEX,
            runtime_root.parent / "readiness",
            None,
            runtime_root,
        )
    ]


def test_repo_containing_runtime_state_fails_as_harness_result(tmp_path):
    repository = tmp_path / "repository"
    runtime_root = repository / ".state" / "harnesses"
    repository.mkdir()
    requested = request(HarnessKind.CODEX).model_copy(update={"cwd": repository})

    result = YokeHarnessAdapter(HarnessKind.CODEX, runtime_root).run(requested)

    assert result.status is HarnessRunStatus.FAILED
    assert result.events[-1].failure is not None
    assert "runtime_root must be outside cwd" in result.events[-1].failure.message


def test_packaged_collection_loads_the_three_yoke_agents():
    collection = agent_collection()

    assert collection.names() == ("build", "garden", "ingest")
    for kind in HarnessAgentKind:
        agent = load_agent(kind)
        assert agent.root is not None
        assert agent.root.name == kind.value
        assert agent.instructions
        assert agent.instructions.startswith("# CodeAlmanac Kernel")
        assert f"# {kind.value.title()} Operation" in agent.instructions
        assert agent.tools.read and agent.tools.write and agent.tools.shell
        assert agent.tools.agent
        assert str(agent.permissions.access) == "full"
        assert str(agent.permissions.approval) == "never"


@pytest.mark.parametrize("kind", tuple(HarnessAgentKind))
def test_yoke_harness_uses_the_requested_packaged_agent(kind, tmp_path):
    runtime_root = tmp_path / "harnesses"
    harness = create_yoke_harness(
        HarnessKind.CODEX,
        Path("/tmp/project"),
        kind,
        runtime_root,
    )

    assert harness.agent.root is not None
    assert harness.agent.root.name == kind.value
    assert harness.agent.instructions == load_agent(kind).instructions
    assert harness.runtime_root == runtime_root.resolve(strict=False)


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


def test_composition_root_gives_both_harnesses_local_state_runtime(tmp_path):
    database_path = tmp_path / "state" / "codealmanac.db"
    app = create_app(config=AppConfig(database_path=database_path))
    expected = database_path.parent / "harnesses"

    for kind in HarnessKind:
        adapter = app.harnesses.adapter_for(kind)
        assert isinstance(adapter, YokeHarnessAdapter)
        assert adapter.runtime_root == expected


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


def test_callback_receives_nonterminal_events_and_terminal_exactly_once(tmp_path):
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
        HarnessKind.CODEX,
        tmp_path / "harnesses",
        lambda *_: harness,
    ).run(request(HarnessKind.CODEX), observed.append)

    assert observed == list(result.events)
    assert observed[-1].kind is HarnessEventKind.DONE
    assert sum(event.kind is HarnessEventKind.DONE for event in observed) == 1
