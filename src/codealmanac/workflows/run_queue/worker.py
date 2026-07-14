import time

from codealmanac.core.errors import error_summary
from codealmanac.services.runs.models import (
    TERMINAL_RUN_STATUSES,
    QueuedRun,
    RunEventKind,
    RunQueueDrainResult,
    RunRecord,
    RunStatus,
    RunWorkerIdleHandoffOutcome,
)
from codealmanac.services.runs.requests import (
    AcquireRunWorkerLockRequest,
    FinishRunRequest,
    RecordRunEventRequest,
    ReleaseRunWorkerIfIdleRequest,
    ShowRunRequest,
)
from codealmanac.services.runs.service import RunsService
from codealmanac.workflows.run_queue.ports import RunExecutorSpawner
from codealmanac.workflows.run_queue.requests import (
    DrainRunQueueRequest,
    SpawnRunExecutorRequest,
)

CANCELLATION_SETTLE_SECONDS = 5.0
CANCELLATION_POLL_SECONDS = 0.05


class RunQueueWorker:
    def __init__(self, runs: RunsService, executors: RunExecutorSpawner):
        self.runs = runs
        self.executors = executors

    def drain(self, request: DrainRunQueueRequest) -> RunQueueDrainResult:
        lease = self.runs.acquire_worker_lock(
            AcquireRunWorkerLockRequest(
                owner=request.owner,
                pid=request.pid,
                now=request.now,
                stale_after=request.stale_after,
            )
        )
        if lease is None:
            return RunQueueDrainResult(lock_acquired=False)
        processed: list[RunRecord] = []
        try:
            while request.max_runs is None or len(processed) < request.max_runs:
                queued = self.runs.next_queued()
                if queued is None:
                    outcome = self.runs.release_worker_if_idle(
                        ReleaseRunWorkerIfIdleRequest(owner=lease.owner)
                    )
                    if outcome == RunWorkerIdleHandoffOutcome.WORK_AVAILABLE:
                        continue
                    break
                record = self.run_queued(queued)
                processed.append(record)
                if record.status not in TERMINAL_RUN_STATUSES:
                    break
            return RunQueueDrainResult(
                lock_acquired=True,
                processed=tuple(processed),
            )
        finally:
            lease.release()

    def run_queued(self, queued: QueuedRun) -> RunRecord:
        try:
            process = self.executors.spawn(
                SpawnRunExecutorRequest(run_id=queued.record.run_id)
            )
            exit_code = process.wait()
            return self.reconcile_exit(queued.record.run_id, exit_code)
        except Exception as error:
            record = self.runs.show(ShowRunRequest(run_id=queued.record.run_id))
            if record.status in TERMINAL_RUN_STATUSES:
                return record
            return self.fail_run(record, error_summary(error))

    def reconcile_exit(self, run_id: str, exit_code: int) -> RunRecord:
        record = self.runs.show(ShowRunRequest(run_id=run_id))
        if record.status in TERMINAL_RUN_STATUSES:
            return record
        if (
            record.cancellation_requested_at is not None
            and record.execution is not None
        ):
            return self.wait_for_cancellation(run_id)
        return self.fail_run(
            record,
            f"executor exited {exit_code} without a terminal result",
        )

    def wait_for_cancellation(self, run_id: str) -> RunRecord:
        deadline = time.monotonic() + CANCELLATION_SETTLE_SECONDS
        while time.monotonic() < deadline:
            record = self.runs.show(ShowRunRequest(run_id=run_id))
            if record.status in TERMINAL_RUN_STATUSES:
                return record
            time.sleep(CANCELLATION_POLL_SECONDS)
        record = self.runs.show(ShowRunRequest(run_id=run_id))
        self.runs.record_event(
            RecordRunEventRequest(
                run_id=run_id,
                kind=RunEventKind.ERROR,
                message="executor exited but cancellation was not confirmed",
            )
        )
        return self.runs.show(ShowRunRequest(run_id=run_id))

    def fail_run(self, record: RunRecord, error: str) -> RunRecord:
        return self.runs.finish(
            FinishRunRequest(
                run_id=record.run_id,
                status=RunStatus.FAILED,
                error=error,
            )
        )
