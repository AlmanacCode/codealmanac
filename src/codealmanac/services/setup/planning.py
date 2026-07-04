from codealmanac.services.config.models import DEFAULT_HARNESS
from codealmanac.services.setup.models import SetupCommand, SetupPlan
from codealmanac.services.setup.requests import RunSetupRequest


def setup_plan(request: RunSetupRequest) -> SetupPlan:
    return SetupPlan(
        default_harness=DEFAULT_HARNESS,
        instruction_targets=request.targets,
        next_commands=next_commands(),
    )


def next_commands() -> tuple[SetupCommand, ...]:
    return (
        SetupCommand(label="Check cloud login", command=("codealmanac", "whoami")),
        SetupCommand(
            label="Check capture",
            command=("codealmanac", "capture", "status"),
        ),
        SetupCommand(
            label="Set up a repository",
            command=("codealmanac", "repo", "setup"),
        ),
        SetupCommand(label="Open cloud wiki", command=("codealmanac", "open")),
    )
