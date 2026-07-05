from codealmanac.core.errors import ValidationFailed
from codealmanac.local.control.models import (
    ControlRunEventKind,
    ControlRunRecord,
    ControlRunStatus,
)
from codealmanac.local.control.requests import (
    AppendControlRunEventRequest,
    UpdateControlRunRequest,
)
from codealmanac.local.control.service import ControlService
from codealmanac.local.runs.kinds import LocalRunKind
from codealmanac.local.runs.models import LocalRunSummary
from codealmanac.local.runs.requests import StartLocalRunRequest

ACTIVE_LOCAL_RUN_STATUSES = frozenset(
    (
        ControlRunStatus.QUEUED,
        ControlRunStatus.RUNNING,
    )
)


def cancel_active_run(control: ControlService, run: ControlRunRecord) -> None:
    if run.status not in ACTIVE_LOCAL_RUN_STATUSES:
        return
    control.update_run(
        UpdateControlRunRequest(
            run_id=run.id,
            status=ControlRunStatus.CANCELLED,
            error="cancelled by user",
        )
    )
    control.append_run_event(
        AppendControlRunEventRequest(
            run_id=run.id,
            kind=ControlRunEventKind.STATUS,
            message="cancelled local run",
        )
    )


def retry_start_request(previous: LocalRunSummary) -> StartLocalRunRequest:
    repository_root = previous.repository.local_root_path
    if repository_root is None:
        raise ValidationFailed("local retry requires repository local_root_path")
    return StartLocalRunRequest(
        cwd=repository_root,
        branch_name=previous.branch.name,
        kind=LocalRunKind(previous.run.kind),
    )
