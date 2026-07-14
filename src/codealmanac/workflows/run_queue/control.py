from codealmanac.core.errors import ExecutionFailed
from codealmanac.services.runs.models import RunCancelResult, RunStatus
from codealmanac.services.runs.requests import (
    CancelRunRequest,
    FinishRunCancellationRequest,
    ShowRunRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.workflows.run_queue.ports import RunProcessController


class RunCancellation:
    def __init__(self, runs: RunsService, processes: RunProcessController):
        self.runs = runs
        self.processes = processes

    def cancel(self, request: CancelRunRequest) -> RunCancelResult:
        plan = self.runs.prepare_cancellation(request)
        if plan.execution is None:
            return RunCancelResult(record=plan.record, changed=plan.changed)
        try:
            self.processes.terminate(plan.execution)
        except ExecutionFailed:
            latest = self.runs.show(ShowRunRequest(run_id=plan.record.run_id))
            if latest.status in (RunStatus.DONE, RunStatus.FAILED, RunStatus.CANCELLED):
                return RunCancelResult(record=latest, changed=False)
            raise
        result = self.runs.finish_cancellation(
            FinishRunCancellationRequest(
                run_id=plan.record.run_id,
                execution_id=plan.execution.execution_id,
            )
        )
        if plan.changed and result.record.status == RunStatus.CANCELLED:
            return RunCancelResult(record=result.record, changed=True)
        return result
