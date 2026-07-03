from typing import Protocol

from codealmanac.jobs.ledger.models import JobWorkerSpawnResult
from codealmanac.jobs.ledger.requests import SpawnJobWorkerRequest


class JobWorkerSpawner(Protocol):
    def spawn(self, request: SpawnJobWorkerRequest) -> JobWorkerSpawnResult:
        """Start a detached process that drains queued jobs for one wiki."""
