from pathlib import Path
from typing import Protocol

from codealmanac.services.control.models import LocalGitState


class LocalGitStateProbe(Protocol):
    def read(self, cwd: Path) -> LocalGitState:
        """Read the current repository root, branch, and head SHA."""
