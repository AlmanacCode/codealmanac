from datetime import UTC, datetime

from codealmanac.services.runs.service import RunsService
from codealmanac.services.sources.service import SourcesService
from codealmanac.wiki.workspaces.service import WorkspacesService
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.run_queue.service import RunQueueWorkflow
from codealmanac.workflows.sync.evaluation import SyncEvaluator
from codealmanac.workflows.sync.execution import SyncRunExecutor
from codealmanac.workflows.sync.models import (
    SyncEvaluation,
    SyncMode,
    SyncSummary,
)
from codealmanac.workflows.sync.policy import sync_claim_owner
from codealmanac.workflows.sync.requests import (
    RunSyncRequest,
    RunSyncStatusRequest,
    SyncSelectionRequest,
)
from codealmanac.workflows.sync.store import SyncLedgerStore


class SyncWorkflow:
    def __init__(
        self,
        workspaces: WorkspacesService,
        sources: SourcesService,
        runs: RunsService,
        ingest: IngestWorkflow,
        queue: RunQueueWorkflow,
        ledger_store: SyncLedgerStore,
    ):
        self.workspaces = workspaces
        self.sources = sources
        self.runs = runs
        self.ledger_store = ledger_store
        self.evaluator = SyncEvaluator(
            workspaces=workspaces,
            sources=sources,
            runs=runs,
            ledger_store=ledger_store,
        )
        self.executor = SyncRunExecutor(
            runs=runs,
            ingest=ingest,
            queue=queue,
            ledger_store=ledger_store,
        )

    def status(self, request: RunSyncStatusRequest) -> SyncSummary:
        return self.evaluate(request, SyncMode.STATUS).summary

    def run(self, request: RunSyncRequest) -> SyncSummary:
        now = request.now or datetime.now(UTC)
        evaluation = self.evaluate(request, SyncMode.SYNC, now=now)
        claim_owner = request.claim_owner or sync_claim_owner(now)
        effects = self.executor.run(
            request,
            evaluation,
            now,
            claim_owner,
        )
        return evaluation.summary.model_copy(
            update={
                "started": effects.started,
                "needs_attention": effects.needs_attention,
            }
        )

    def evaluate(
        self,
        request: SyncSelectionRequest,
        mode: SyncMode,
        now: datetime | None = None,
    ) -> SyncEvaluation:
        return self.evaluator.evaluate(request, mode, now)
