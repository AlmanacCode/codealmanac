import json
import sys
from collections.abc import Iterable

from codealmanac.cli.render.common import print_json_model
from codealmanac.cli.render.jobs import status_label
from codealmanac.cli.render.style import style
from codealmanac.services.runs.models import (
    RunAttachSnapshot,
    RunAttachUpdate,
    RunLogEvent,
    RunRecord,
    RunStatus,
)
from codealmanac.services.runs.transcript import RunStep, RunStepKind, project_run_steps


def render_run_log(events: tuple[RunLogEvent, ...], json_output: bool) -> None:
    steps = project_run_steps(events)
    if json_output:
        data = [step.model_dump(mode="json", exclude_none=True) for step in steps]
        print(json.dumps(data, indent=2))
        return
    for step in steps:
        render_run_step(step)


def render_run_attach(snapshot: RunAttachSnapshot, json_output: bool) -> None:
    if json_output:
        print_json_model(snapshot)
        return
    render_run_log(snapshot.events, json_output=False)
    if len(snapshot.events) == 0:
        print("no log events")
    print_terminal_status(snapshot.record)


def render_run_attach_stream(
    updates: Iterable[RunAttachUpdate],
    json_output: bool,
) -> None:
    saw_event = False
    for update in updates:
        if json_output:
            print(update.model_dump_json(exclude_none=True))
            sys.stdout.flush()
            continue
        steps = project_run_steps(update.events)
        for step in steps:
            render_run_step(step)
            saw_event = True
        if update.terminal:
            if not saw_event:
                print("no log events")
            print_terminal_status(update.record)
        sys.stdout.flush()


def print_terminal_status(record: RunRecord) -> None:
    print(f"status: {status_label(record.status)}")
    if record.status == RunStatus.FAILED and record.error is not None:
        print(f"{style.RED}error:{style.RST} {record.error}")
    if record.status == RunStatus.DONE and record.summary is not None:
        print(f"summary: {record.summary}")


TOOL_VERBS = {
    "read": "Read",
    "write": "Wrote",
    "edit": "Edited",
    "search": "Searched",
    "shell": "Ran",
    "agent": "Delegated",
    "web": "Fetched",
    "mcp": "Called",
    "image": "Viewed",
}


def render_run_step(step: RunStep) -> None:
    if step.kind == RunStepKind.ASSISTANT:
        render_assistant_step(step)
    elif step.kind in {RunStepKind.TOOL, RunStepKind.AGENT}:
        render_tool_step(step)
    else:
        render_note_step(step)


def render_assistant_step(step: RunStep) -> None:
    actor = step.actor or "assistant"
    print(f"  {style.BLUE}▌{style.RST} {style.DIM}{actor}{style.RST}")
    if step.body:
        print_indented(step.body.strip(), dim=False)


def render_tool_step(step: RunStep) -> None:
    mark = tool_mark(step)
    verb = tool_verb(step)
    line = f"  {mark} {style.BOLD}{verb}{style.RST}"
    target = tool_target(step)
    if target:
        line += f"  {target}"
    print(line)
    meta = tool_meta(step)
    if meta:
        print(f"      {style.DIM}{meta}{style.RST}")


def render_note_step(step: RunStep) -> None:
    errored = step.error or step.kind == RunStepKind.ERROR
    mark = f"{style.RED}✕{style.RST}" if errored else f"{style.DIM}·{style.RST}"
    print(f"  {mark} {step.title}")
    if step.body and step.body.strip().lower() != step.title.lower():
        print_indented(step.body.strip(), dim=True)
    if step.detail:
        print_indented(step.detail.strip(), dim=True)


def tool_mark(step: RunStep) -> str:
    status = (step.status or "").lower()
    if step.error or status == "failed":
        return f"{style.RED}✕{style.RST}"
    if status in {"completed", "done"}:
        return f"{style.GREEN}●{style.RST}"
    return f"{style.BLUE}◐{style.RST}"


def tool_verb(step: RunStep) -> str:
    if step.kind == RunStepKind.AGENT:
        return step.title
    verb = TOOL_VERBS.get((step.tool or "").lower())
    return verb or step.title


def tool_target(step: RunStep) -> str | None:
    if step.kind == RunStepKind.AGENT or step.target is None:
        return None
    return truncate_middle(step.target, 68)


def tool_meta(step: RunStep) -> str:
    parts: list[str] = []
    if step.tool:
        parts.append(step.tool)
    status = (step.status or "").lower()
    if status and status not in {"completed", "started"}:
        parts.append(status)
    extras = detail_extras(step.detail, step.target)
    if extras:
        parts.append(extras)
    return " · ".join(parts)


def detail_extras(detail: str | None, target: str | None) -> str | None:
    if not detail:
        return None
    kept = [
        token
        for token in detail.split(" · ")
        if token and token != target and "/" not in token
    ]
    return " · ".join(kept) or None


def truncate_middle(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    head = (limit - 1) * 6 // 10
    tail = max(8, limit - head - 1)
    return f"{value[:head]}…{value[-tail:]}"


def print_indented(value: str, *, dim: bool) -> None:
    prefix = style.DIM if dim else ""
    suffix = style.RST if dim else ""
    for line in value.splitlines() or [value]:
        print(f"      {prefix}{line}{suffix}")
