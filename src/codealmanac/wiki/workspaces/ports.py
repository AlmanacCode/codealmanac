from pathlib import Path
from typing import Protocol

from codealmanac.wiki.workspaces.models import WorkspaceChangeSnapshot


class WorkspaceChangeProbe(Protocol):
    def snapshot(self, root_path: Path) -> WorkspaceChangeSnapshot:
        """Return the current observable local change state for a workspace."""
