import json

from codealmanac.integrations.harnesses.opencode.adapter import (
    OpenCodeHarnessAdapter,
    OpenCodeProcessResult,
    stage_lifecycle_agent,
)
from codealmanac.services.harnesses.models import (
    HarnessAgentKind,
    HarnessEventKind,
    HarnessKind,
    HarnessRunStatus,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest


def test_check_missing_binary(tmp_path):
    readiness = OpenCodeHarnessAdapter(
        tmp_path,
        which=lambda _: None,
    ).check()
    assert readiness.available is False
    assert "not found" in readiness.message


def test_check_reports_version(tmp_path, monkeypatch):
    def fake_run(*args, **kwargs):
        class Result:
            returncode = 0
            stdout = "1.2.3\n"
            stderr = ""

        return Result()

    monkeypatch.setattr(
        "codealmanac.integrations.harnesses.opencode.adapter.subprocess.run",
        fake_run,
    )
    readiness = OpenCodeHarnessAdapter(
        tmp_path,
        which=lambda _: "/usr/local/bin/opencode",
    ).check()
    assert readiness.available is True
    assert readiness.message == "1.2.3"


def test_run_streams_json_events_uses_stdin_and_project_agent(tmp_path):
    calls = []
    live = []

    def runner(command, cwd, timeout_seconds, stdin, env, on_line):
        calls.append((command, cwd, timeout_seconds, stdin, env))
        payloads = (
            {
                "type": "text",
                "sessionID": "ses_1",
                "part": {"text": "hello wiki"},
            },
            {
                "type": "tool_use",
                "sessionID": "ses_1",
                "part": {
                    "id": "call_1",
                    "tool": "read",
                    "state": {"status": "completed", "title": "README.md"},
                },
            },
        )
        lines = []
        for payload in payloads:
            line = json.dumps(payload)
            lines.append(line)
            if on_line is not None:
                on_line(line)
        return OpenCodeProcessResult(returncode=0, lines=tuple(lines))

    result = OpenCodeHarnessAdapter(tmp_path, runner=runner).run(
        RunHarnessRequest(
            kind=HarnessKind.OPENCODE,
            model="opencode/big-pickle",
            agent=HarnessAgentKind.BUILD,
            cwd=tmp_path,
            prompt="Runtime context:\n{}",
        ),
        on_event=live.append,
    )

    assert result.status is HarnessRunStatus.SUCCEEDED
    assert result.output_text == "hello wiki"
    assert result.transcript is not None
    assert result.transcript.session_id == "ses_1"
    live_kinds = [
        event.kind for event in live if event.kind is not HarnessEventKind.DONE
    ]
    assert live_kinds == [
        HarnessEventKind.TEXT,
        HarnessEventKind.TOOL_USE,
    ]
    command, cwd, timeout_seconds, stdin, env = calls[0]
    assert command[0] == "opencode"
    assert "--agent" in command
    assert command[command.index("--agent") + 1] == "codealmanac-build"
    assert "CodeAlmanac Kernel" not in " ".join(command)
    assert stdin == "Runtime context:\n{}"
    assert cwd == tmp_path
    assert env is None
    agent_path = tmp_path / ".opencode" / "agents" / "codealmanac-build.md"
    assert agent_path.is_file()
    body = agent_path.read_text(encoding="utf-8")
    assert "mode: primary" in body
    assert "CodeAlmanac Kernel" in body


def test_stage_lifecycle_agent_writes_project_agent(tmp_path):
    name = stage_lifecycle_agent(tmp_path, HarnessAgentKind.GARDEN)
    assert name == "codealmanac-garden"
    path = tmp_path / ".opencode" / "agents" / f"{name}.md"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "mode: primary" in text
    assert "# Garden Operation" in text
