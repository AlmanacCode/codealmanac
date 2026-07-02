import sys

from codealmanac.cli.render.common import print_json_model, print_json_rows
from codealmanac.workflows.local_jobs.models import (
    LocalJobLogsResult,
    LocalJobSummary,
)
from codealmanac.workflows.local_status.models import LocalStatusResult
from codealmanac.workflows.local_update.models import LocalUpdateResult


def render_local_status(result: LocalStatusResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    checkout = result.checkout
    if not checkout.available:
        print("checkout: unavailable")
        if checkout.unavailable_reason is not None:
            print(f"reason: {checkout.unavailable_reason}")
        return
    print(f"checkout: {checkout.full_name} {checkout.branch_name} {checkout.head_sha}")
    if result.repository is None:
        print("repository: not configured")
        return
    print(f"repository: configured {result.repository.full_name}")
    if result.branch is None:
        print("branch: not configured")
        return
    print(f"branch: configured {result.branch.name}")
    print(f"triggers: {'enabled' if result.branch.trigger_enabled else 'disabled'}")
    print(f"delivery: {result.branch.delivery_mode.value}")


def render_local_jobs(
    jobs: tuple[LocalJobSummary, ...],
    json_output: bool,
) -> None:
    if json_output:
        print_json_rows(jobs)
        return
    if len(jobs) == 0:
        print("# 0 local jobs", file=sys.stderr)
        return
    for job in jobs:
        summary = job.run.summary or job.run.error or ""
        print(
            f"{job.run.id}\t{job.run.status.value}\t{job.run.operation}\t"
            f"{job.repository.full_name}\t{job.branch.name}\t{summary}"
        )


def render_local_job(job: LocalJobSummary, json_output: bool) -> None:
    if json_output:
        print_json_model(job)
        return
    run = job.run
    print(f"id: {run.id}")
    print(f"repo: {job.repository.full_name}")
    print(f"branch: {job.branch.name}")
    print(f"operation: {run.operation}")
    print(f"status: {run.status.value}")
    if run.expected_head_sha is not None:
        print(f"expected_head_sha: {run.expected_head_sha}")
    if run.summary is not None:
        print(f"summary: {run.summary}")
    if run.error is not None:
        print(f"error: {run.error}")
    print(f"created_at: {run.created_at.isoformat()}")
    print(f"updated_at: {run.updated_at.isoformat()}")


def render_local_job_logs(
    result: LocalJobLogsResult,
    json_output: bool,
) -> None:
    if json_output:
        print_json_model(result)
        return
    if len(result.events) == 0:
        print("no log events")
        return
    for event in result.events:
        print(f"{event.sequence}\t{event.kind.value}\t{event.message}")


def render_local_update(result: LocalUpdateResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    if not result.started:
        print(f"local update: not started ({result.reason})")
        if result.active_run is not None:
            print(
                f"active_job: {result.active_run.id} "
                f"{result.active_run.status.value}"
            )
        return
    assert result.worker is not None
    assert result.worker.run is not None
    print(f"local update: {result.worker.run.status.value} {result.worker.run.id}")
    if result.worker.run.summary is not None:
        print(f"summary: {result.worker.run.summary}")
