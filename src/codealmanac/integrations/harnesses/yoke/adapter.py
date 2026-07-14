from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Protocol

from pydantic import ValidationError
from yoke import (
    ClaudeOptions,
    CodexApproval,
    CodexAppServerOptions,
    CodexOptions,
    CodexSandbox,
    Event,
    Harness,
    ProviderOptions,
    Readiness,
    Run,
    RunOptions,
    YokeError,
)

from codealmanac.agents.catalog import load_agent
from codealmanac.integrations.harnesses.yoke.events import YokeEventProjector
from codealmanac.integrations.harnesses.yoke.results import project_run
from codealmanac.services.harnesses.models import (
    HarnessAgentKind,
    HarnessEvent,
    HarnessEventKind,
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
)
from codealmanac.services.harnesses.ports import HarnessEventSink
from codealmanac.services.harnesses.requests import RunHarnessRequest

CLAUDE_ALLOWED_TOOLS = (
    "Read",
    "Write",
    "Edit",
    "MultiEdit",
    "Glob",
    "Grep",
    "LS",
    "Bash",
    "Agent",
)
CLAUDE_MAX_TURNS = 100
CLAUDE_RUN_TIMEOUT_SECONDS = 90 * 60
CODEX_RUN_TIMEOUT_SECONDS = 30 * 60


class YokeHarness(Protocol):
    def check_sync(self) -> Readiness:
        """Check provider readiness."""

    def run_sync(self, prompt: str, options: RunOptions) -> Run:
        """Run one provider task."""


HarnessFactory = Callable[
    [HarnessKind, Path, HarnessAgentKind | None, Path],
    YokeHarness,
]


class YokeHarnessAdapter:
    """Execute one CodeAlmanac harness kind through the public Yoke SDK."""

    def __init__(
        self,
        kind: HarnessKind,
        runtime_root: Path,
        factory: HarnessFactory | None = None,
    ):
        self.kind = kind
        self.runtime_root = runtime_root
        self.factory = factory or create_yoke_harness

    def check(self) -> HarnessReadiness:
        try:
            readiness_cwd = self.runtime_root.parent / "readiness"
            readiness_cwd.mkdir(parents=True, exist_ok=True)
            return project_readiness(
                self.factory(
                    self.kind,
                    readiness_cwd,
                    None,
                    self.runtime_root,
                ).check_sync(),
                self.kind,
            )
        except (FileNotFoundError, TimeoutError, ValidationError, YokeError) as error:
            return HarnessReadiness(
                kind=self.kind,
                available=False,
                message=str(error),
            )

    def run(
        self,
        request: RunHarnessRequest,
        on_event: HarnessEventSink | None = None,
    ) -> HarnessRunResult:
        projector = YokeEventProjector(self.kind)
        projected: list[HarnessEvent] = []
        observed = 0

        def project_live(event) -> None:
            nonlocal observed
            observed += 1
            for item in projector.project(event):
                projected.append(item)
                if on_event is not None and item.kind is not HarnessEventKind.DONE:
                    on_event(item)

        try:
            run = self.factory(
                self.kind,
                request.cwd,
                request.agent,
                self.runtime_root,
            ).run_sync(
                request.prompt,
                run_options(request, project_live),
            )
        except (FileNotFoundError, TimeoutError, ValidationError, YokeError) as error:
            run = failed_yoke_run(self.kind, str(error))
        for event in run.events[observed:]:
            for item in projector.project(event):
                projected.append(item)
                if on_event is not None and item.kind is not HarnessEventKind.DONE:
                    on_event(item)
        result = project_run(run, self.kind, projector, tuple(projected))
        if on_event is not None and result.events:
            on_event(result.events[-1])
        return result


def create_yoke_harness(
    kind: HarnessKind,
    cwd: Path,
    agent_name: HarnessAgentKind | None = None,
    runtime_root: Path | None = None,
) -> Harness:
    agent_kind = agent_name or HarnessAgentKind.BUILD
    return Harness(
        provider=kind.value,
        surface="codex_app_server" if kind is HarnessKind.CODEX else None,
        agent=load_agent(agent_kind),
        cwd=cwd,
        runtime_root=runtime_root,
    )


def run_options(
    request: RunHarnessRequest,
    on_event: Callable[[Event], None],
) -> RunOptions:
    return RunOptions(
        model=request.model,
        max_turns=CLAUDE_MAX_TURNS,
        timeout_seconds=(
            CLAUDE_RUN_TIMEOUT_SECONDS
            if request.kind is HarnessKind.CLAUDE
            else CODEX_RUN_TIMEOUT_SECONDS
        ),
        provider=provider_options(request.kind),
        on_event=on_event,
    )


def provider_options(kind: HarnessKind) -> ProviderOptions:
    if kind is HarnessKind.CLAUDE:
        return ProviderOptions(
            claude=ClaudeOptions(
                tools=CLAUDE_ALLOWED_TOOLS,
                allowed_tools=CLAUDE_ALLOWED_TOOLS,
                permission_mode="dontAsk",
                include_partial_messages=True,
                setting_sources=(),
                raw={"mcp_servers": {}, "strict_mcp_config": True},
            )
        )
    return ProviderOptions(
        codex=CodexOptions(
            sandbox=CodexSandbox.DANGER_FULL_ACCESS,
            approval=CodexApproval.NEVER,
            network=False,
            app_server=CodexAppServerOptions(ephemeral=True),
        )
    )


def project_readiness(
    readiness: Readiness,
    kind: HarnessKind,
) -> HarnessReadiness:
    return HarnessReadiness(
        kind=kind,
        available=readiness.available,
        message=readiness.message,
        repair=readiness.fix,
    )


def failed_yoke_run(kind: HarnessKind, message: str) -> Run:
    from yoke import Failure, Provider, RunStatus

    return Run(
        provider=Provider(kind.value),
        status=RunStatus.FAILED,
        output=message,
        failure=Failure(message=message),
    )
