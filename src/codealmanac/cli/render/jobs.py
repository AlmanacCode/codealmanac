import sys

from codealmanac.cli.render.common import print_json_model, print_json_rows
from codealmanac.cli.render.style import (
    EM_DASH,
    humanize_elapsed,
    style,
    table,
)
from codealmanac.services.runs.models import (
    PageChangeSet,
    RunCancelResult,
    RunRecord,
    RunStatus,
)


def status_label(status: RunStatus) -> str:
    if status == RunStatus.DONE:
        color = style.GREEN
    elif status == RunStatus.FAILED:
        color = style.RED
    elif status == RunStatus.CANCELLED:
        color = style.YELLOW
    elif status == RunStatus.RUNNING:
        color = style.BLUE
    else:
        color = style.DIM
    return f"{color}{status.value}{style.RST}"


def elapsed_label(record: RunRecord) -> str:
    if record.status == RunStatus.QUEUED:
        return EM_DASH
    start = record.started_at or record.created_at
    return humanize_elapsed(start, record.finished_at)


def render_runs(records: tuple[RunRecord, ...], json_output: bool) -> None:
    if json_output:
        print_json_rows(records)
        return
    if len(records) == 0:
        print("# 0 jobs", file=sys.stderr)
        return
    lines = table(
        ("ID", "KIND", "STATUS", "ELAPSED", "TITLE"),
        [
            (
                f"{style.BLUE}{record.run_id}{style.RST}",
                record.kind.value,
                status_label(record.status),
                elapsed_label(record),
                record.title or "",
            )
            for record in records
        ],
    )
    for line in lines:
        print(line)


def render_run(record: RunRecord, json_output: bool) -> None:
    if json_output:
        print_json_model(record)
        return
    dim = style.DIM
    rst = style.RST
    print(f"{dim}job:{rst}        {style.BLUE}{record.run_id}{rst}")
    print(f"{dim}kind:{rst}       {record.kind.value}")
    print(f"{dim}status:{rst}     {status_label(record.status)}")
    print(f"{dim}elapsed:{rst}    {elapsed_label(record)}")
    if record.title is not None:
        print(f"{dim}title:{rst}      {record.title}")
    if record.summary is not None:
        print(f"{dim}summary:{rst}    {record.summary}")
    for line in page_change_lines(record.page_changes):
        print(line)
    if record.harness_transcript is not None:
        transcript = record.harness_transcript
        print(
            f"{dim}session:{rst}    "
            f"{transcript.kind.value} {transcript.session_id}"
        )
        if transcript.transcript_path is not None:
            print(f"{dim}transcript:{rst} {transcript.transcript_path}")
    print(f"{dim}logs:{rst}       codealmanac jobs logs {record.run_id}")
    print(f"{dim}created:{rst}    {record.created_at.isoformat()}")
    print(f"{dim}updated:{rst}    {record.updated_at.isoformat()}")
    if record.error is not None:
        print(f"{dim}error:{rst}      {style.RED}{record.error}{rst}")


def page_change_lines(changes: PageChangeSet | None) -> list[str]:
    if changes is None:
        return []
    dim = style.DIM
    rst = style.RST
    total = len(changes.created) + len(changes.updated) + len(changes.deleted)
    if total == 0:
        return [f"{dim}changes:{rst}    none"]
    lines = [
        f"{dim}changes:{rst}    "
        f"{len(changes.created)} created, {len(changes.updated)} updated, "
        f"{len(changes.deleted)} deleted"
    ]
    for label, slugs in (
        ("created", changes.created),
        ("updated", changes.updated),
        ("deleted", changes.deleted),
    ):
        if slugs:
            styled = ", ".join(f"{style.BLUE}{slug}{rst}" for slug in slugs)
            lines.append(f"{dim}{label}:{rst}    {styled}")
    return lines


def render_run_cancel(result: RunCancelResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    if result.changed:
        print(f"cancelled {result.record.run_id}")
        return
    print(f"job already {result.record.status.value}: {result.record.run_id}")
