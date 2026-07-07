from dataclasses import dataclass

from codealmanac.services.setup.models import SetupTarget


@dataclass(frozen=True)
class SetupSelections:
    targets: tuple[SetupTarget, ...]
    auto_update: bool
    auto_commit: bool
    sync_off: bool
    garden_off: bool


class SetupCancelled(Exception):
    pass
