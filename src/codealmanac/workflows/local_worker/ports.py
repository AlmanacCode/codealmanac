from typing import Protocol

from codealmanac.services.runs.models import RunWorkerSpawnResult
from codealmanac.workflows.local_worker.requests import SpawnLocalWorkerRequest


class LocalWorkerSpawner(Protocol):
    def spawn(self, request: SpawnLocalWorkerRequest) -> RunWorkerSpawnResult:
        """Start one detached local worker process for a repo/branch trigger."""
