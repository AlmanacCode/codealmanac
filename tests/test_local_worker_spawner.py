from pathlib import Path

from codealmanac.engine.harnesses.models import HarnessKind
from codealmanac.integrations.runs.local_worker import local_worker_command
from codealmanac.local.runs.worker.requests import SpawnLocalWorkerRequest


def test_local_worker_command_targets_private_worker_entrypoint(tmp_path: Path):
    request = SpawnLocalWorkerRequest(
        cwd=tmp_path,
        repository_id="repo-1",
        branch_id="branch-1",
        harness=HarnessKind.CLAUDE,
        title="Update docs",
    )

    command = local_worker_command(request)

    assert command == [
        "codealmanac-local-worker",
        "--repository-id",
        "repo-1",
        "--branch-id",
        "branch-1",
        "--operation",
        "update",
        "--using",
        "claude",
        "--title",
        "Update docs",
    ]
