import contextlib
from pathlib import Path

from filelock import FileLock, Timeout


class UpdateLockLease:
    def __init__(self, lock: FileLock):
        self.lock = lock

    def release(self) -> None:
        with contextlib.suppress(OSError):
            self.lock.release()


class UpdateLockStore:
    def acquire(self, path: Path) -> UpdateLockLease | None:
        path.parent.mkdir(parents=True, exist_ok=True)
        lock = FileLock(str(path))
        try:
            lock.acquire(timeout=0)
            return UpdateLockLease(lock)
        except Timeout:
            return None
