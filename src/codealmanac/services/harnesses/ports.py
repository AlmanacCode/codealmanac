from typing import Protocol

from codealmanac.services.harnesses.models import (
    HarnessKind,
    HarnessReadiness,
    HarnessRunResult,
)
from codealmanac.services.harnesses.requests import RunHarnessRequest


class HarnessAdapter(Protocol):
    kind: HarnessKind

    def check(self) -> HarnessReadiness:
        """Return local readiness without starting an agent run."""

    def run(self, request: RunHarnessRequest) -> HarnessRunResult:
        """Run one normalized agent task."""
