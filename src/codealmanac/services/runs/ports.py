from typing import Protocol

from codealmanac.services.runs.models import RunWorkerSpawnResult
from codealmanac.services.runs.requests import SpawnRunWorkerRequest


class RunWorkerSpawner(Protocol):
    def spawn(self, request: SpawnRunWorkerRequest) -> RunWorkerSpawnResult:
        """Start a detached process that drains the local run queue."""
