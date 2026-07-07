from codealmanac.cli.render.common import print_json_model
from codealmanac.workflows.sync.models import SyncMode, SyncSummary


def render_sync_status(summary: SyncSummary, json_output: bool) -> None:
    if json_output:
        print_json_model(summary)
        return
    status_mode = summary.mode == SyncMode.STATUS
    print("sync status:" if status_mode else "sync:")
    print(f"  since: {summary.since.isoformat()}")
    print(f"  scanned: {summary.scanned}")
    print(f"  eligible: {summary.eligible}")
    if status_mode:
        print(f"  ready: {len(summary.ready)}")
    else:
        print(f"  started: {len(summary.started)}")
    print(f"  skipped: {len(summary.skipped)}")
    for ready in summary.ready:
        print(
            f"  - ready {ready.repository_name}: "
            f"{ready.transcript_count} transcript(s)"
        )
    for started in summary.started:
        print(
            f"  - started {started.repository_name}: "
            f"{started.run_id} ({started.transcript_count} transcript(s))"
        )
