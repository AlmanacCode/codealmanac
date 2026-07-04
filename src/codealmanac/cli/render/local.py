import sys

from codealmanac.cli.render.common import print_json_model, print_json_rows
from codealmanac.local.policies.models import (
    LocalTriggerPoliciesResult,
    LocalTriggerPolicyResult,
)
from codealmanac.local.runs.models import (
    LocalRunLogsResult,
    LocalRunStartResult,
    LocalRunSummary,
)
from codealmanac.local.status.models import LocalStatusResult


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
    print(f"delivery: {format_delivery_mode(result.branch.delivery_mode.value)}")


def render_local_trigger_policies(
    result: LocalTriggerPoliciesResult,
    json_output: bool,
) -> None:
    if json_output:
        print_json_model(result)
        return
    if len(result.branches) == 0:
        print("# 0 local triggers", file=sys.stderr)
        return
    for branch in result.branches:
        trigger = "enabled" if branch.trigger_enabled else "disabled"
        delivery = format_delivery_mode(branch.delivery_mode.value)
        print(f"{branch.name}\t{trigger}\t{delivery}")


def render_local_trigger_policy(
    result: LocalTriggerPolicyResult,
    json_output: bool,
) -> None:
    if json_output:
        print_json_model(result)
        return
    branch = result.branch
    trigger = "enabled" if branch.trigger_enabled else "disabled"
    delivery = format_delivery_mode(branch.delivery_mode.value)
    print(f"branch: {branch.name}")
    print(f"triggers: {trigger}")
    print(f"delivery: {delivery}")


def render_local_runs(
    runs: tuple[LocalRunSummary, ...],
    json_output: bool,
) -> None:
    if json_output:
        print_json_rows(runs)
        return
    if len(runs) == 0:
        print("# 0 local runs", file=sys.stderr)
        return
    for item in runs:
        summary = item.run.summary or item.run.error or ""
        print(
            f"{item.run.id}\t{item.run.status.value}\t{item.run.operation}\t"
            f"{item.repository.full_name}\t{item.branch.name}\t{summary}"
        )


def render_local_run(item: LocalRunSummary, json_output: bool) -> None:
    if json_output:
        print_json_model(item)
        return
    run = item.run
    print(f"id: {run.id}")
    print(f"repo: {item.repository.full_name}")
    print(f"branch: {item.branch.name}")
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


def render_local_run_logs(
    result: LocalRunLogsResult,
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


def render_local_run_start(result: LocalRunStartResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    if not result.started:
        print(f"local run: not started ({result.reason})")
        if result.active_run is not None:
            print(
                f"active_run: {result.active_run.id} {result.active_run.status.value}"
            )
        return
    assert result.worker is not None
    assert result.worker.run is not None
    print(f"local run: {result.worker.run.status.value} {result.worker.run.id}")
    if result.worker.run.summary is not None:
        print(f"summary: {result.worker.run.summary}")


def format_delivery_mode(value: str) -> str:
    return value.replace("_", "-")
