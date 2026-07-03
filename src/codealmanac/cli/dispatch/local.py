import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.common import print_json_model
from codealmanac.cli.render.local import (
    render_local_job,
    render_local_job_logs,
    render_local_jobs,
    render_local_status,
    render_local_trigger_policies,
    render_local_trigger_policy,
    render_local_update,
)
from codealmanac.services.control.models import ControlDeliveryMode, ControlRunStatus
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.wiki.workspaces.roots import DEFAULT_ALMANAC_ROOT
from codealmanac.workflows.local_jobs.requests import (
    ListLocalJobsRequest,
    ReadLocalJobLogsRequest,
    ShowLocalJobRequest,
)
from codealmanac.workflows.local_policy.requests import (
    ListLocalTriggerPoliciesRequest,
    SetLocalDeliveryPolicyRequest,
    UpdateLocalTriggerPolicyRequest,
)
from codealmanac.workflows.local_setup.requests import RunLocalSetupRequest
from codealmanac.workflows.local_status.requests import ReadLocalStatusRequest
from codealmanac.workflows.local_update.requests import RunLocalUpdateRequest

LOCAL_COMMANDS = frozenset(("local",))


def is_local_command(command: str | None) -> bool:
    return command in LOCAL_COMMANDS


def dispatch_local(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.local_command == "status":
        return dispatch_local_status(args, app)
    if args.local_command == "update":
        return dispatch_local_update(args, app)
    if args.local_command == "setup":
        return dispatch_local_setup(args, app)
    if args.local_command == "triggers":
        return dispatch_local_triggers(args, app)
    if args.local_command == "delivery":
        return dispatch_local_delivery(args, app)
    if args.local_command == "jobs":
        return dispatch_local_jobs(args, app)
    raise AssertionError(f"unhandled local command: {args.local_command}")


def dispatch_local_status(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.workflows.local_status.status(ReadLocalStatusRequest(cwd=Path.cwd()))
    render_local_status(result, json_output=args.json)
    return 0


def dispatch_local_update(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.workflows.local_update.update(
        RunLocalUpdateRequest(
            cwd=Path.cwd(),
            harness=HarnessKind(args.using),
        )
    )
    render_local_update(result, json_output=args.json)
    return 0


def dispatch_local_setup(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.workflows.local_setup.setup(
        RunLocalSetupRequest(
            cwd=Path.cwd(),
            branch_name=args.branch,
            almanac_root=parse_almanac_root(args.root),
            delivery_mode=parse_delivery_mode(args.delivery),
            install_hooks=not args.skip_hooks,
        )
    )
    if args.json:
        print_json_model(result)
        return 0
    hooks_status = "installed" if result.hooks is not None else "skipped"
    print(
        "local setup: "
        f"{result.repository.full_name} "
        f"{result.branch.name} "
        f"{format_delivery_mode(result.branch.delivery_mode)}"
    )
    print(f"hooks: {hooks_status}")
    return 0


def dispatch_local_triggers(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.triggers_command == "list":
        result = app.workflows.local_policy.list_triggers(
            ListLocalTriggerPoliciesRequest(cwd=Path.cwd())
        )
        render_local_trigger_policies(result, json_output=args.json)
        return 0
    if args.triggers_command == "enable":
        result = app.workflows.local_policy.enable_trigger(
            UpdateLocalTriggerPolicyRequest(
                cwd=Path.cwd(),
                branch_name=args.branch,
                delivery_mode=parse_optional_delivery_mode(args.delivery),
            )
        )
        render_local_trigger_policy(result, json_output=args.json)
        return 0
    if args.triggers_command == "disable":
        result = app.workflows.local_policy.disable_trigger(
            UpdateLocalTriggerPolicyRequest(
                cwd=Path.cwd(),
                branch_name=args.branch,
            )
        )
        render_local_trigger_policy(result, json_output=args.json)
        return 0
    raise AssertionError(f"unhandled local triggers command: {args.triggers_command}")


def dispatch_local_delivery(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.delivery_command == "set":
        result = app.workflows.local_policy.set_delivery(
            SetLocalDeliveryPolicyRequest(
                cwd=Path.cwd(),
                branch_name=args.branch,
                delivery_mode=parse_delivery_mode(args.mode),
            )
        )
        render_local_trigger_policy(result, json_output=args.json)
        return 0
    raise AssertionError(f"unhandled local delivery command: {args.delivery_command}")


def dispatch_local_jobs(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.jobs_command == "list":
        jobs = app.workflows.local_jobs.list(
            ListLocalJobsRequest(
                repository_id=args.repository_id,
                branch_id=args.branch_id,
                statuses=tuple(ControlRunStatus(status) for status in args.status),
                limit=args.limit,
            )
        )
        render_local_jobs(jobs, json_output=args.json)
        return 0
    if args.jobs_command == "show":
        job = app.workflows.local_jobs.show(ShowLocalJobRequest(run_id=args.run_id))
        render_local_job(job, json_output=args.json)
        return 0
    if args.jobs_command == "logs":
        result = app.workflows.local_jobs.logs(
            ReadLocalJobLogsRequest(run_id=args.run_id)
        )
        render_local_job_logs(result, json_output=args.json)
        return 0
    raise AssertionError(f"unhandled local jobs command: {args.jobs_command}")


def parse_almanac_root(value: str | None) -> Path:
    if value is None:
        return DEFAULT_ALMANAC_ROOT
    return Path(value)


def parse_delivery_mode(value: str) -> ControlDeliveryMode:
    return ControlDeliveryMode(value.replace("-", "_"))


def parse_optional_delivery_mode(value: str | None) -> ControlDeliveryMode | None:
    if value is None:
        return None
    return parse_delivery_mode(value)


def format_delivery_mode(mode: ControlDeliveryMode) -> str:
    return mode.value.replace("_", "-")
