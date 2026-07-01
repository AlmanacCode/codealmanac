from datetime import datetime

from codealmanac.services.runs.models import (
    PageChangeSet,
    RunLogEvent,
    RunRecord,
)
from codealmanac.services.viewer.models import (
    ViewerJobEvent,
    ViewerJobPageChanges,
    ViewerJobRun,
    ViewerJobTranscript,
)


def viewer_job_run(record: RunRecord) -> ViewerJobRun:
    return ViewerJobRun(
        run_id=record.run_id,
        operation=record.operation.value,
        status=record.status.value,
        title=record.title,
        summary=record.summary,
        error=record.error,
        created_at=timestamp(record.created_at),
        updated_at=timestamp(record.updated_at),
        started_at=optional_timestamp(record.started_at),
        finished_at=optional_timestamp(record.finished_at),
        log_path=record.log_path,
        page_changes=viewer_page_changes(record.page_changes),
        harness_transcript=viewer_harness_transcript(record),
    )


def viewer_job_event(event: RunLogEvent) -> ViewerJobEvent:
    return ViewerJobEvent(
        sequence=event.sequence,
        timestamp=timestamp(event.timestamp),
        kind=event.kind.value,
        message=event.message,
        harness_event=event.harness_event,
    )


def viewer_page_changes(changes: PageChangeSet | None) -> ViewerJobPageChanges | None:
    if changes is None:
        return None
    return ViewerJobPageChanges(
        created=changes.created,
        updated=changes.updated,
        archived=changes.archived,
        deleted=changes.deleted,
    )


def viewer_harness_transcript(record: RunRecord) -> ViewerJobTranscript | None:
    transcript = record.harness_transcript
    if transcript is None:
        return None
    return ViewerJobTranscript(
        kind=transcript.kind.value,
        session_id=transcript.session_id,
        transcript_path=transcript.transcript_path,
    )


def optional_timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    return timestamp(value)


def timestamp(value: datetime) -> str:
    return value.isoformat()
