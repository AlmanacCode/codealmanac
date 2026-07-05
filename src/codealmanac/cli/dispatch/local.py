import argparse
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.cli.render.common import print_json_model
from codealmanac.cli.render.local import (
    render_local_run,
    render_local_run_logs,
    render_local_run_start,
    render_local_runs,
    render_local_status,
    render_local_trigger_policies,
    render_local_trigger_policy,
)
from codealmanac.engine.harnesses.models import HarnessKind
from codealmanac.local.control.models import ControlDeliveryMode, ControlRunStatus
from codealmanac.local.policies.requests import (
    ListLocalTriggerPoliciesRequest,
    SetLocalDeliveryPolicyRequest,
    UpdateLocalTriggerPolicyRequest,
)
from codealmanac.local.runs.kinds import LocalRunKind
from codealmanac.local.runs.requests import (
    CancelLocalRunRequest,
    ListLocalRunsRequest,
    ReadLocalRunLogsRequest,
    RetryLocalRunRequest,
    ShowLocalRunRequest,
    StartLocalRunRequest,
)
from codealmanac.local.setup.requests import RunLocalSetupRequest
from codealmanac.local.status.requests import ReadLocalStatusRequest
from codealmanac.wiki.workspaces.roots import DEFAULT_ALMANAC_ROOT

LOCAL_COMMANDS = frozenset(("local",))


def is_local_command(command: str | None) -> bool:
    return command in LOCAL_COMMANDS


def dispatch_local(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.local_command == "status":
        return dispatch_local_status(args, app)
    if args.local_command == "setup":
        return dispatch_local_setup(args, app)
    if args.local_command == "triggers":
        return dispatch_local_triggers(args, app)
    if args.local_command == "delivery":
        return dispatch_local_delivery(args, app)
    if args.local_command == "runs":
        return dispatch_local_runs(args, app)
    raise AssertionError(f"unhandled local command: {args.local_command}")


def dispatch_local_status(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.workflows.local_status.status(ReadLocalStatusRequest(cwd=Path.cwd()))
    render_local_status(result, json_output=args.json)
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


def dispatch_local_runs(args: argparse.Namespace, app: CodeAlmanac) -> int:
    if args.local_runs_command == "start":
        result = app.workflows.local_runs.start(
            StartLocalRunRequest(
                cwd=Path.cwd(),
                branch_name=args.branch,
                kind=LocalRunKind(args.kind),
                harness=HarnessKind(args.using),
                title=args.title,
                guidance=args.guidance,
            )
        )
        render_local_run_start(result, json_output=args.json)
        return 0
    if args.local_runs_command == "list":
        runs = app.workflows.local_runs.list(
            ListLocalRunsRequest(
                repository_id=args.repository_id,
                branch_id=args.branch_id,
                statuses=tuple(ControlRunStatus(status) for status in args.status),
                limit=args.limit,
            )
        )
        render_local_runs(runs, json_output=args.json)
        return 0
    if args.local_runs_command == "show":
        run = app.workflows.local_runs.show(ShowLocalRunRequest(run_id=args.run_id))
        render_local_run(run, json_output=args.json)
        return 0
    if args.local_runs_command == "cancel":
        run = app.workflows.local_runs.cancel(
            CancelLocalRunRequest(run_id=args.run_id)
        )
        render_local_run(run, json_output=args.json)
        return 0
    if args.local_runs_command == "retry":
        result = app.workflows.local_runs.retry(
            RetryLocalRunRequest(run_id=args.run_id)
        )
        render_local_run_start(result, json_output=args.json)
        return 0
    if args.local_runs_command == "logs":
        result = app.workflows.local_runs.logs(
            ReadLocalRunLogsRequest(run_id=args.run_id)
        )
        render_local_run_logs(result, json_output=args.json)
        return 0
    raise AssertionError(f"unhandled local runs command: {args.local_runs_command}")


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
