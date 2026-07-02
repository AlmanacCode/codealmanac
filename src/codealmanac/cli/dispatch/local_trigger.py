import argparse
import json
from pathlib import Path

from codealmanac.app import CodeAlmanac
from codealmanac.services.control.models import TriggerEventKind
from codealmanac.services.control.requests import RecordCurrentGitTriggerRequest
from codealmanac.workflows.local_worker.requests import SpawnLocalWorkerRequest


def dispatch_record_local_trigger(args: argparse.Namespace, app: CodeAlmanac) -> int:
    result = app.control.record_current_git_trigger(
        RecordCurrentGitTriggerRequest(
            cwd=Path(args.cwd),
            kind=TriggerEventKind(args.kind),
            previous_head_sha=args.previous_head,
            payload_ref=args.payload_ref,
        )
    )
    worker = None
    if args.spawn_worker and result.event is not None:
        worker = app.local_worker_spawner.spawn(
            SpawnLocalWorkerRequest(
                cwd=Path(args.cwd),
                repository_id=result.event.repository_id,
                branch_id=result.event.branch_id,
            )
        )
    if args.json:
        payload = result.model_dump(mode="json")
        if worker is not None:
            payload["worker"] = worker.model_dump(mode="json")
        print(json.dumps(payload))
    return 0
