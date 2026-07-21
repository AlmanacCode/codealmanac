from datetime import UTC, datetime

from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.runs.service import RunsService
from codealmanac.services.sources.service import SourcesService
from codealmanac.workflows.run_queue.service import RunQueue
from codealmanac.workflows.sync.evaluation import SyncEvaluator
from codealmanac.workflows.sync.models import (
    SyncEvaluation,
    SyncMode,
    SyncSummary,
)
from codealmanac.workflows.sync.queue import SyncIngestQueue
from codealmanac.workflows.sync.requests import (
    SyncRequest,
    SyncSelectionRequest,
    SyncStatusRequest,
)
from codealmanac.workflows.sync.store import SyncStateStore


class SyncWorkflow:
    def __init__(
        self,
        repositories: RepositoriesService,
        sources: SourcesService,
        runs: RunsService,
        queue: RunQueue,
        state_store: SyncStateStore,
    ):
        self.evaluator = SyncEvaluator(
            repositories=repositories,
            sources=sources,
            runs=runs,
            state_store=state_store,
        )
        self.executor = SyncIngestQueue(
            queue=queue,
            state_store=state_store,
        )

    def status(self, request: SyncStatusRequest) -> SyncSummary:
        return self.evaluate(request, SyncMode.STATUS).summary

    def run(self, request: SyncRequest) -> SyncSummary:
        now = request.now or datetime.now(UTC)
        evaluation = self.evaluate(request, SyncMode.SYNC, now=now)
        effects = self.executor.run(request, evaluation, now)
        return evaluation.summary.model_copy(
            update={
                "started": effects.started,
                "skipped": effects.skipped,
                "completed_at": now,
            }
        )

    def evaluate(
        self,
        request: SyncSelectionRequest,
        mode: SyncMode,
        now: datetime | None = None,
    ) -> SyncEvaluation:
        return self.evaluator.evaluate(request, mode, now)
