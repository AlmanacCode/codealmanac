from dataclasses import dataclass

from codealmanac.services.harnesses.models import HarnessKind
from codealmanac.services.setup.models import SetupTarget


@dataclass(frozen=True)
class SetupSelections:
    targets: tuple[SetupTarget, ...]
    harness: HarnessKind
    model: str
    auto_update: bool
    auto_commit: bool
    sync_off: bool
    garden_off: bool


class SetupCancelled(Exception):
    pass
