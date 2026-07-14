from typing import Protocol

from codealmanac.services.runs.models import RunExecutionRef
from codealmanac.workflows.run_queue.requests import SpawnRunExecutorRequest


class RunExecutorProcess(Protocol):
    @property
    def pid(self) -> int:
        """Return the executor process id."""

    def wait(self) -> int:
        """Wait for the one-run executor and return its exit code."""


class RunExecutorSpawner(Protocol):
    def spawn(self, request: SpawnRunExecutorRequest) -> RunExecutorProcess:
        """Start one isolated executor process for a queued run."""


class RunProcessController(Protocol):
    def current_execution(self) -> RunExecutionRef:
        """Describe the current one-run executor process."""

    def terminate(self, execution: RunExecutionRef) -> None:
        """Stop the matching executor and all of its descendants."""
