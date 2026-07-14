from codealmanac.services.automation.defaults import (
    duration_text,
)
from codealmanac.services.automation.models import AutomationTask
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
        default_harness=request.harness,
        harness_model=request.model,
        instruction_targets=request.targets,
        auto_commit=request.auto_commit,
        automation_mode=mode,
        automation=automation,
        next_commands=next_commands(),
    )


def automation_recommendations(
    request: RunSetupRequest,
) -> tuple[SetupAutomationRecommendation, ...]:
    sync_every = duration_text(request.sync_every)
    garden_every = duration_text(request.garden_every)
    update_every = duration_text(request.update_every)
    recommendations: list[SetupAutomationRecommendation] = []
    for task in recommendation_tasks(request):
        if task == AutomationTask.SYNC:
            recommendations.append(sync_recommendation(sync_every))
        elif task == AutomationTask.UPDATE:
            recommendations.append(update_recommendation(update_every))
        else:
            recommendations.append(garden_recommendation(garden_every))
    return tuple(recommendations)


def sync_recommendation(
    sync_every: str,
) -> SetupAutomationRecommendation:
    return SetupAutomationRecommendation(
        task=AutomationTask.SYNC,
        description="scan recently active local agent transcripts",
        command=("codealmanac", "config", "set", "automation.sync.every", sync_every),
    )


def garden_recommendation(garden_every: str) -> SetupAutomationRecommendation:
    return SetupAutomationRecommendation(
        task=AutomationTask.GARDEN,
        description="periodically improve wiki structure and graph hygiene",
        command=(
            "codealmanac",
            "config",
            "set",
            "automation.garden.every",
            garden_every,
        ),
    )


def update_recommendation(update_every: str) -> SetupAutomationRecommendation:
    return SetupAutomationRecommendation(
        task=AutomationTask.UPDATE,
        description="keep the local CodeAlmanac CLI package updated",
        command=(
            "codealmanac",
            "config",
            "set",
            "automation.update.every",
            update_every,
        ),
    )


def next_commands() -> tuple[SetupCommand, ...]:
    return (
        SetupCommand(
            label="Navigate to your repo of choice",
            command=("cd", "/path/to/your/repo"),
        ),
        SetupCommand(label="Initialize the repo wiki", command=("codealmanac", "init")),
    )
