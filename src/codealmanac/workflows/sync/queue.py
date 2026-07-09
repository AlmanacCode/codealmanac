from datetime import datetime

from codealmanac.core.errors import error_summary
from codealmanac.services.sources.transcripts import transcript_address
from codealmanac.workflows.ingest.requests import IngestRequest
from codealmanac.workflows.run_queue.service import RunQueue
from codealmanac.workflows.sync.guidance import sync_ingest_guidance
from codealmanac.workflows.sync.models import (
    SyncEvaluation,
    SyncQueueResult,
    SyncRepositoryIngest,
    SyncStarted,
)
from codealmanac.workflows.sync.requests import SyncRequest
from codealmanac.workflows.sync.store import SyncStateStore
from codealmanac.workflows.sync.summary import (
    skipped_transcript,
    started_sync_repository,
)


class SyncIngestQueue:
    def __init__(
        self,
        queue: RunQueue,
        state_store: SyncStateStore,
    ):
        self.queue = queue
        self.state_store = state_store

    def run(
        self,
        request: SyncRequest,
        evaluation: SyncEvaluation,
        now: datetime,
    ) -> SyncQueueResult:
        started: list[SyncStarted] = []
        skipped = list(evaluation.summary.skipped)
        worker_cwd = None
        queued_ingests: list[SyncRepositoryIngest] = []
        for item in evaluation.repository_ingests:
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
            started.append(started_sync_repository(item, run.run_id))
            worker_cwd = worker_cwd or item.repository.root_path
            queued_ingests.append(item)
        if worker_cwd is not None:
            try:
                self.queue.spawn_worker(worker_cwd)
            except Exception as error:
                skipped.extend(
                    skipped_transcript(
                        candidate,
                        f"worker-spawn-failed: {error_summary(error)}",
                    )
                    for item in queued_ingests
                    for candidate in item.transcripts
                )
        self.state_store.record_completed(now)
        return SyncQueueResult(
            started=tuple(started),
            skipped=tuple(skipped),
        )


def sync_ingest_request(
    request: SyncRequest,
    item: SyncRepositoryIngest,
) -> IngestRequest:
    return IngestRequest(
        cwd=item.repository.root_path,
        inputs=tuple(
            f"transcript:{transcript_address(candidate)}"
            for candidate in item.transcripts
        ),
        harness=request.harness,
        model=request.model,
        repository_name=item.repository.name,
        title=sync_ingest_title(item),
        guidance=sync_ingest_guidance(item),
        auto_commit=request.auto_commit,
    )


def sync_ingest_title(item: SyncRepositoryIngest) -> str:
    if len(item.transcripts) == 1:
        candidate = item.transcripts[0]
        return f"Sync {candidate.app.value} transcript {candidate.session_id}"
    return f"Sync {len(item.transcripts)} transcripts"
