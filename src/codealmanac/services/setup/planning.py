from codealmanac.services.automation.defaults import (
    DEFAULT_GARDEN_INTERVAL,
    DEFAULT_SYNC_INTERVAL,
    duration_text,
)
from codealmanac.services.automation.models import AutomationTask
from codealmanac.services.config.models import DEFAULT_HARNESS, DEFAULT_SYNC_QUIET
from codealmanac.services.setup.automation import (
    recommendation_tasks,
    should_install_automation,
)
from codealmanac.services.setup.models import (
    SetupAutomationMode,
    SetupAutomationRecommendation,
    SetupCommand,
    SetupPlan,
)
from codealmanac.services.setup.requests import RunSetupRequest


def setup_plan(request: RunSetupRequest) -> SetupPlan:
    automation = automation_recommendations(request)
    mode = (
        SetupAutomationMode.INSTALL
        if should_install_automation(request)
        else SetupAutomationMode.RECOMMEND
    )
    return SetupPlan(
        default_harness=DEFAULT_HARNESS,
        instruction_targets=request.targets,
        automation_mode=mode,
        automation=automation,
        next_commands=next_commands(automation, mode),
    )


def automation_recommendations(
    request: RunSetupRequest,
) -> tuple[SetupAutomationRecommendation, ...]:
    sync_every = duration_text(
        request.sync_every if request.sync_every is not None else DEFAULT_SYNC_INTERVAL
    )
    sync_quiet = duration_text(
        request.sync_quiet if request.sync_quiet is not None else DEFAULT_SYNC_QUIET
    )
    garden_every = duration_text(
        request.garden_every
        if request.garden_every is not None
        else DEFAULT_GARDEN_INTERVAL
    )
    recommendations: list[SetupAutomationRecommendation] = []
    for task in recommendation_tasks(request):
        if task == AutomationTask.SYNC:
            recommendations.append(sync_recommendation(sync_every, sync_quiet))
        else:
            recommendations.append(garden_recommendation(garden_every))
    return tuple(recommendations)


def sync_recommendation(
    sync_every: str,
    sync_quiet: str,
) -> SetupAutomationRecommendation:
    return SetupAutomationRecommendation(
        task=AutomationTask.SYNC,
        description="scan quiet local agent transcripts and ingest durable changes",
        command=(
            "codealmanac",
            "automation",
            "install",
            "sync",
            "--every",
            sync_every,
            "--quiet",
            sync_quiet,
        ),
    )


def garden_recommendation(garden_every: str) -> SetupAutomationRecommendation:
    return SetupAutomationRecommendation(
        task=AutomationTask.GARDEN,
        description="periodically improve wiki structure and graph hygiene",
        command=(
            "codealmanac",
            "automation",
            "install",
            "garden",
            "--every",
            garden_every,
        ),
    )


def next_commands(
    automation: tuple[SetupAutomationRecommendation, ...],
    mode: SetupAutomationMode,
) -> tuple[SetupCommand, ...]:
    automation_command = (
        SetupCommand(
            label="Check scheduled automation",
            command=("codealmanac", "automation", "status"),
        )
        if mode == SetupAutomationMode.INSTALL
        else SetupCommand(
            label="Install scheduled transcript sync",
            command=automation[0].command,
        )
    )
    return (
        SetupCommand(label="Initialize this repo", command=("codealmanac", "init")),
        SetupCommand(
            label="Read the starter page",
            command=("codealmanac", "search", "getting"),
        ),
        automation_command,
    )
