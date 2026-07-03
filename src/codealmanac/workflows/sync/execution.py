from datetime import datetime
from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.jobs.ledger.models import JobStatus
from codealmanac.jobs.ledger.requests import FinishJobRequest
from codealmanac.jobs.ledger.service import JobLedgerService
from codealmanac.jobs.queue.service import JobQueueWorkflow
from codealmanac.workflows.ingest.requests import (
    RunIngestRequest,
    RunIngestWithJobRequest,
)
from codealmanac.workflows.ingest.service import IngestWorkflow
from codealmanac.workflows.sync.models import (
    SyncEvaluation,
    SyncExecution,
    SyncLedger,
    SyncSkipped,
    SyncStarted,
    SyncWorkItem,
)
from codealmanac.workflows.sync.policy import (
    absorbed_entry,
    failed_entry,
    first_error_line,
    pending_entry,
    skip,
    sync_ingest_guidance,
    sync_ingest_title,
    sync_started,
)
from codealmanac.workflows.sync.requests import RunSyncRequest
from codealmanac.workflows.sync.store import SyncLedgerStore


class SyncJobExecutor:
    def __init__(
        self,
        jobs: JobLedgerService,
        ingest: IngestWorkflow,
        queue: JobQueueWorkflow,
        ledger_store: SyncLedgerStore,
    ):
        self.jobs = jobs
        self.ingest = ingest
        self.queue = queue
        self.ledger_store = ledger_store

    def run(
        self,
        request: RunSyncRequest,
        evaluation: SyncEvaluation,
        now: datetime,
        claim_owner: str,
    ) -> "SyncExecutionResult":
        started: list[SyncStarted] = []
        needs_attention = list(evaluation.summary.needs_attention)
        ledgers = dict(evaluation.ledgers)
        for item in evaluation.work_items:
            if request.execution == SyncExecution.BACKGROUND:
                result = self.run_background_item(
                    request,
                    item,
                    ledgers,
                    now,
                    claim_owner,
                )
            else:
                result = self.run_foreground_item(
                    request,
                    item,
                    ledgers,
                    now,
                    claim_owner,
                )
            ledgers = result.ledgers
            started.extend(result.started)
            needs_attention.extend(result.needs_attention)
        return SyncExecutionResult(
            started=tuple(started),
            needs_attention=tuple(needs_attention),
            ledgers=ledgers,
        )

    def run_background_item(
        self,
        request: RunSyncRequest,
        item: SyncWorkItem,
        ledgers: dict[Path, SyncLedger],
        now: datetime,
        claim_owner: str,
    ) -> "SyncItemExecutionResult":
        ingest_request = sync_ingest_request(request, item)
        job = self.queue.queue_ingest(ingest_request)
        ledger = ledgers[item.candidate.repo_root]
        pending = pending_entry(item.entry, item, now, claim_owner, job.job_id)
        ledger.sessions[item.ledger_key] = pending
        ledger = self.ledger_store.save(
            item.candidate.repo_root,
            item.candidate.almanac_path,
            ledger,
            now,
        )
        ledgers[item.candidate.repo_root] = ledger
        try:
            self.queue.spawn_worker(item.candidate.repo_root, request.wiki)
        except Exception as error:
            self.jobs.finish(
                FinishJobRequest(
                    cwd=item.candidate.repo_root,
                    wiki=request.wiki,
                    job_id=job.job_id,
                    status=JobStatus.FAILED,
                    error=first_error_line(error),
                )
            )
            ledger.sessions[item.ledger_key] = failed_entry(pending, error, job.job_id)
            ledger = self.ledger_store.save(
                item.candidate.repo_root,
                item.candidate.almanac_path,
                ledger,
                now,
            )
            ledgers[item.candidate.repo_root] = ledger
            return SyncItemExecutionResult(
                ledgers=ledgers,
                needs_attention=(skip(item.candidate, "worker-spawn-failed"),),
            )
        return SyncItemExecutionResult(
            ledgers=ledgers,
            started=(sync_started(item, job.job_id),),
        )

    def run_foreground_item(
        self,
        request: RunSyncRequest,
        item: SyncWorkItem,
        ledgers: dict[Path, SyncLedger],
        now: datetime,
        claim_owner: str,
    ) -> "SyncItemExecutionResult":
        ingest_request = sync_ingest_request(request, item)
        job = self.ingest.start(ingest_request)
        ledger = ledgers[item.candidate.repo_root]
        pending = pending_entry(item.entry, item, now, claim_owner, job.job_id)
        ledger.sessions[item.ledger_key] = pending
        ledger = self.ledger_store.save(
            item.candidate.repo_root,
            item.candidate.almanac_path,
            ledger,
            now,
        )
        ledgers[item.candidate.repo_root] = ledger
        item = item.model_copy(update={"entry": pending})
        try:
            result = self.ingest.run_with_job(
                RunIngestWithJobRequest(
                    cwd=ingest_request.cwd,
                    inputs=ingest_request.inputs,
                    harness=ingest_request.harness,
                    wiki=ingest_request.wiki,
                    title=ingest_request.title,
                    guidance=ingest_request.guidance,
                    job_id=job.job_id,
                )
            )
        except Exception as error:
            ledger.sessions[item.ledger_key] = failed_entry(
                item.entry,
                error,
                job.job_id,
            )
            ledger = self.ledger_store.save(
                item.candidate.repo_root,
                item.candidate.almanac_path,
                ledger,
                now,
            )
            ledgers[item.candidate.repo_root] = ledger
            return SyncItemExecutionResult(
                ledgers=ledgers,
                needs_attention=(skip(item.candidate, "ingest-failed"),),
            )
        ledger.sessions[item.ledger_key] = absorbed_entry(
            item.entry,
            item.snapshot,
            result.job.job_id,
            now,
        )
        ledgers[item.candidate.repo_root] = self.ledger_store.save(
            item.candidate.repo_root,
            item.candidate.almanac_path,
            ledger,
            now,
        )
        return SyncItemExecutionResult(
            ledgers=ledgers,
            started=(sync_started(item, result.job.job_id),),
        )


class SyncExecutionResult(CodeAlmanacModel):
    started: tuple[SyncStarted, ...]
    needs_attention: tuple[SyncSkipped, ...]
    ledgers: dict[Path, SyncLedger]


class SyncItemExecutionResult(CodeAlmanacModel):
    ledgers: dict[Path, SyncLedger]
    started: tuple[SyncStarted, ...] = ()
    needs_attention: tuple[SyncSkipped, ...] = ()


def sync_ingest_request(
    request: RunSyncRequest,
    item: SyncWorkItem,
) -> RunIngestRequest:
    return RunIngestRequest(
        cwd=item.candidate.repo_root,
        inputs=(f"transcript:{item.candidate.transcript_path}",),
        harness=request.harness,
        wiki=request.wiki,
        title=sync_ingest_title(item.candidate),
        guidance=sync_ingest_guidance(item),
    )
