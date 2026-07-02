import argparse
import json
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.services.control.models import TriggerEventKind
from codealmanac.services.control.requests import RecordCurrentGitTriggerRequest


def dispatch_record_local_trigger(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.control.record_current_git_trigger(
        RecordCurrentGitTriggerRequest(
            cwd=Path(args.cwd),
            kind=TriggerEventKind(args.kind),
            previous_head_sha=args.previous_head,
            payload_ref=args.payload_ref,
        )
    )
    if args.json:
        print(json.dumps(result.model_dump(mode="json")))
    return 0
