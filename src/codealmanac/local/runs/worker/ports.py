from typing import Protocol

from codealmanac.local.runs.worker.models import LocalWorkerSpawnResult
from codealmanac.local.runs.worker.requests import SpawnLocalWorkerRequest


class LocalWorkerSpawner(Protocol):
    def spawn(self, request: SpawnLocalWorkerRequest) -> LocalWorkerSpawnResult:
        """Start one detached local worker process for a repo/branch trigger."""
