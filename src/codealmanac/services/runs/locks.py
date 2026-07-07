import os
from collections.abc import Callable
from datetime import datetime, timedelta

from codealmanac.services.runs.models import RunWorkerLockOwner


class RunWorkerLease:
    def __init__(
        self,
        owner: RunWorkerLockOwner,
        release_owner: Callable[[RunWorkerLockOwner], None],
    ):
        self.owner = owner
        self.release_owner = release_owner

    def release(self) -> None:
        self.release_owner(self.owner)


def worker_lock_is_stale(
    owner: RunWorkerLockOwner,
    now: datetime,
    stale_after: timedelta,
) -> bool:
    if now - owner.acquired_at >= stale_after:
        return True
    return not process_is_alive(owner.pid)


def process_is_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True
