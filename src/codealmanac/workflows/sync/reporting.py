from codealmanac.engine.sources.models import TranscriptCandidate
from codealmanac.workflows.sync.models import SyncSkipped, SyncStarted, SyncWorkItem


def skip(candidate: TranscriptCandidate, reason: str) -> SyncSkipped:
    return SyncSkipped(
        app=candidate.app,
        session_id=candidate.session_id,
        transcript_path=candidate.transcript_path,
        repo_root=candidate.repo_root,
        reason=reason,
    )


def sync_started(item: SyncWorkItem, job_id: str) -> SyncStarted:
    return SyncStarted(
        app=item.candidate.app,
        session_id=item.candidate.session_id,
        transcript_path=item.candidate.transcript_path,
        repo_root=item.candidate.repo_root,
        job_id=job_id,
        from_line=item.from_line,
        to_line=item.to_line,
    )
