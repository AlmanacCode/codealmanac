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
    install_automation = should_install_automation(request)
    automation = automation_recommendations(request) if install_automation else ()
    mode = (
        SetupAutomationMode.INSTALL
        if install_automation
        else SetupAutomationMode.NONE
    )
    return SetupPlan(
        default_harness=DEFAULT_HARNESS,
        instruction_targets=request.targets,
        automation_mode=mode,
        automation=automation,
        next_commands=next_commands(mode),
    )


def automation_recommendations(
    request: RunSetupRequest,
) -> tuple[SetupAutomationRecommendation, ...]:
    sync_every_value = (
        request.sync_every
        if request.sync_every is not None
        else DEFAULT_SYNC_INTERVAL
    )
    sync_quiet_value = (
        request.sync_quiet if request.sync_quiet is not None else DEFAULT_SYNC_QUIET
    )
    garden_every_value = (
        request.garden_every
        if request.garden_every is not None
        else DEFAULT_GARDEN_INTERVAL
    )
    sync_every = duration_text(sync_every_value)
    sync_quiet = duration_text(sync_quiet_value)
    garden_every = duration_text(garden_every_value)
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


def next_commands(mode: SetupAutomationMode) -> tuple[SetupCommand, ...]:
    if mode == SetupAutomationMode.INSTALL:
        return (
            SetupCommand(label="Check cloud login", command=("codealmanac", "whoami")),
            SetupCommand(
                label="Check scheduled automation",
                command=("codealmanac", "automation", "status"),
            ),
        )
    return (
        SetupCommand(label="Check cloud login", command=("codealmanac", "whoami")),
        SetupCommand(
            label="Enable capture",
            command=("codealmanac", "capture", "enable"),
        ),
        SetupCommand(
            label="Set up a repository",
            command=("codealmanac", "repo", "setup"),
        ),
        SetupCommand(label="Open cloud wiki", command=("codealmanac", "open")),
    )
