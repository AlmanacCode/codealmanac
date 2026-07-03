import json
import sys
from collections.abc import Iterable

from codealmanac.cli.render.common import print_json_model, print_json_rows
from codealmanac.jobs.ledger.models import (
    JobAttachSnapshot,
    JobAttachUpdate,
    JobCancelResult,
    JobLogEvent,
    JobRecord,
)


def render_jobs(records: tuple[JobRecord, ...], json_output: bool) -> None:
    if json_output:
        print_json_rows(records)
        return
    if len(records) == 0:
        print("# 0 jobs", file=sys.stderr)
        return
    for record in records:
        title = record.title or ""
        print(
            f"{record.job_id}\t{record.status.value}\t"
            f"{record.operation.value}\t{title}"
        )


def render_job(record: JobRecord, json_output: bool) -> None:
    if json_output:
        print_json_model(record)
        return
    print(f"id: {record.job_id}")
    print(f"operation: {record.operation.value}")
    print(f"status: {record.status.value}")
    if record.title is not None:
        print(f"title: {record.title}")
    if record.summary is not None:
        print(f"summary: {record.summary}")
    if record.error is not None:
        print(f"error: {record.error}")
    if record.harness_transcript is not None:
        print(
            "harness_transcript: "
            f"{record.harness_transcript.kind.value} "
            f"{record.harness_transcript.session_id}"
        )
        if record.harness_transcript.transcript_path is not None:
            print(
                "harness_transcript_path: "
                f"{record.harness_transcript.transcript_path}"
            )
    print(f"created_at: {record.created_at.isoformat()}")
    print(f"updated_at: {record.updated_at.isoformat()}")


def render_job_log(events: tuple[JobLogEvent, ...], json_output: bool) -> None:
    if json_output:
        data = [event.model_dump(mode="json", exclude_none=True) for event in events]
        print(json.dumps(data, indent=2))
        return
    for event in events:
        render_job_log_event(event)


def render_job_attach(snapshot: JobAttachSnapshot, json_output: bool) -> None:
    if json_output:
        print_json_model(snapshot)
        return
    render_job_log(snapshot.events, json_output=False)
    if len(snapshot.events) == 0:
        print("no log events")
    print(f"status: {snapshot.record.status.value}")


def render_job_attach_stream(
    updates: Iterable[JobAttachUpdate],
    json_output: bool,
) -> None:
    saw_event = False
    for update in updates:
        if json_output:
            print(update.model_dump_json(exclude_none=True))
            sys.stdout.flush()
            continue
        for event in update.events:
            render_job_log_event(event)
            saw_event = True
        if update.terminal:
            if not saw_event:
                print("no log events")
            print(f"status: {update.record.status.value}")
        sys.stdout.flush()


def render_job_log_event(event: JobLogEvent) -> None:
    print(f"{event.sequence}\t{event.kind.value}\t{event.message}")


def render_job_cancel(result: JobCancelResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    if result.changed:
        print(f"cancelled {result.record.job_id}")
        return
    print(f"job already {result.record.status.value}: {result.record.job_id}")
