from datetime import datetime

from codealmanac.core.errors import error_summary
from codealmanac.core.models import CodeAlmanacModel
from codealmanac.workflows.ingest.requests import IngestRequest
from codealmanac.workflows.run_queue.service import RunQueue
from codealmanac.workflows.sync.guidance import sync_ingest_guidance
from codealmanac.workflows.sync.models import (
    SyncEvaluation,
    SyncSkipped,
    SyncStarted,
    SyncWorkItem,
)
from codealmanac.workflows.sync.requests import RunSyncRequest
from codealmanac.workflows.sync.store import SyncStateStore
from codealmanac.workflows.sync.summary import (
    skipped_transcript,
    started_repository,
)


class SyncRunExecutor:
    def __init__(
        self,
        queue: RunQueue,
        state_store: SyncStateStore,
    ):
        self.queue = queue
        self.state_store = state_store

    def run(
        self,
        request: RunSyncRequest,
        evaluation: SyncEvaluation,
        now: datetime,
    ) -> "SyncRunExecutionResult":
        started: list[SyncStarted] = []
        skipped = list(evaluation.summary.skipped)
        worker_cwd = None
        queued_items: list[SyncWorkItem] = []
        for item in evaluation.work_items:
            try:
                run = self.queue.queue_ingest(sync_ingest_request(request, item))
            except Exception as error:
                skipped.extend(
                    skipped_transcript(
                        candidate,
                        f"queue-failed: {error_summary(error)}",
                    )
                    for candidate in item.transcripts
                )
                continue
            started.append(started_repository(item, run.run_id))
            worker_cwd = worker_cwd or item.repository.root_path
            queued_items.append(item)
        if worker_cwd is not None:
            try:
                self.queue.spawn_worker(worker_cwd)
            except Exception as error:
                skipped.extend(
                    skipped_transcript(
                        candidate,
                        f"worker-spawn-failed: {error_summary(error)}",
                    )
                    for item in queued_items
                    for candidate in item.transcripts
                )
        self.state_store.record_completed(now)
        return SyncRunExecutionResult(
            started=tuple(started),
            skipped=tuple(skipped),
        )


class SyncRunExecutionResult(CodeAlmanacModel):
    started: tuple[SyncStarted, ...]
    skipped: tuple[SyncSkipped, ...]


def sync_ingest_request(
    request: RunSyncRequest,
    item: SyncWorkItem,
) -> IngestRequest:
    return IngestRequest(
        cwd=item.repository.root_path,
        inputs=tuple(
            f"transcript:{candidate.transcript_path}"
            for candidate in item.transcripts
        ),
        harness=request.harness,
        repository_name=item.repository.name,
        title=sync_ingest_title(item),
        guidance=sync_ingest_guidance(item),
        auto_commit=request.auto_commit,
    )


def sync_ingest_title(item: SyncWorkItem) -> str:
    if len(item.transcripts) == 1:
        candidate = item.transcripts[0]
        return f"Sync {candidate.app.value} transcript {candidate.session_id}"
    return f"Sync {len(item.transcripts)} transcripts"
