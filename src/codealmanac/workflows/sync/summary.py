from codealmanac.services.sources.models import TranscriptCandidate
from codealmanac.workflows.sync.models import (
    SyncReady,
    SyncSkipped,
    SyncStarted,
    SyncWorkItem,
)


def skipped_transcript(candidate: TranscriptCandidate, reason: str) -> SyncSkipped:
    return SyncSkipped(
        app=candidate.app,
        session_id=candidate.session_id,
        transcript_path=candidate.transcript_path,
        cwd=candidate.cwd,
        reason=reason,
    )


def ready_repository(item: SyncWorkItem) -> SyncReady:
    return SyncReady(
        repository_id=item.repository.repository_id,
        repository_name=item.repository.name,
        repository_root=item.repository.root_path,
        transcript_count=len(item.transcripts),
        transcript_paths=tuple(
            candidate.transcript_path for candidate in item.transcripts
        ),
    )


def started_repository(item: SyncWorkItem, run_id: str) -> SyncStarted:
    return SyncStarted(
        repository_id=item.repository.repository_id,
        repository_name=item.repository.name,
        repository_root=item.repository.root_path,
        run_id=run_id,
        transcript_count=len(item.transcripts),
        transcript_paths=tuple(
            candidate.transcript_path for candidate in item.transcripts
        ),
    )
