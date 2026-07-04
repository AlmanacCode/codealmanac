from rich.console import Console

from codealmanac.cli.render.common import print_json_model
from codealmanac.cloud.capture.models import (
    CaptureDisableResult,
    CaptureEnableResult,
    CaptureHookEvent,
    CaptureInspectResult,
    CaptureStatus,
)


def render_capture_status(result: CaptureStatus, *, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    console = Console(highlight=False)
    console.print(f"Cloud: {result.api_url}")
    console.print("Signed in: yes" if result.signed_in else "Signed in: no")
    console.print(
        "Capture credential: installed"
        if result.credential_present
        else "Capture credential: missing"
    )
    if len(result.providers) == 0:
        console.print("Providers: none")
    else:
        console.print(f"Providers: {', '.join(result.providers)}")
    for hook in result.hooks:
        marker = "installed" if hook.installed else "missing"
        console.print(f"{hook.provider}: {marker} ({hook.path})")
        if hook.message:
            console.print(f"  {hook.message}")
    if len(result.cloud_credentials) > 0:
        console.print(f"Cloud credentials: {len(result.cloud_credentials)} active")


def render_capture_enable(result: CaptureEnableResult, *, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    console = Console(highlight=False)
    console.print("Capture enabled")
    console.print(f"Cloud: {result.api_url}")
    console.print(f"Providers: {', '.join(result.providers)}")
    for hook in result.hooks:
        console.print(hook.message)


def render_capture_disable(result: CaptureDisableResult, *, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    console = Console(highlight=False)
    console.print("Capture disabled")
    console.print(f"Cloud: {result.api_url}")
    console.print(
        "Credential removed: yes"
        if result.credential_removed
        else "Credential removed: no"
    )
    for hook in result.hooks:
        console.print(hook.message)


def render_capture_hook_event(event: CaptureHookEvent) -> None:
    print_json_model(event)


def render_capture_inspect(
    result: CaptureInspectResult,
    *,
    json_output: bool,
) -> None:
    if json_output:
        print_json_model(result)
        return
    console = Console(highlight=False)
    if len(result.events) == 0:
        console.print("No capture events")
        return
    for event in result.events:
        session = event.session_id or "-"
        status = event.upload_status
        provider = event.provider
        console.print(f"{provider}\t{status}\t{session}")
