from codealmanac.core.errors import ExecutionFailed, error_summary
from codealmanac.services.runs.models import RunFailureCategory, RunStatus
from codealmanac.services.runs.requests import FinishRunRequest
from codealmanac.services.runs.service import RunsService


def finish_failed_run(
    runs: RunsService,
    run_id: str,
    message: str,
    category: RunFailureCategory,
) -> None:
    try:
        runs.finish(
            FinishRunRequest(
                run_id=run_id,
                status=RunStatus.FAILED,
                error=message,
                failure_category=category,
            )
        )
    except Exception as error:
        raise ExecutionFailed(
            f"run {run_id} failed ({message}) and could not be marked failed: "
            f"{error_summary(error)}"
        ) from error
