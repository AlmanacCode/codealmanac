from pathlib import Path

from codealmanac.integrations.runs.local_worker import local_worker_command
from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.workflows.local_worker.requests import SpawnLocalWorkerRequest


def test_local_worker_command_targets_hidden_local_worker_cli(tmp_path: Path):
    request = SpawnLocalWorkerRequest(
        cwd=tmp_path,
        repository_id="repo-1",
        branch_id="branch-1",
        harness=HarnessKind.CLAUDE,
        title="Update docs",
    )

    command = local_worker_command(request)

    assert command[1:] == [
        "-m",
        "codealmanac.cli.main",
        "__run-local-worker",
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
