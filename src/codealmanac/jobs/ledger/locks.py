import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from pydantic import ValidationError

from codealmanac.jobs.ledger.models import JobWorkerLockOwner
from codealmanac.jobs.ledger.paths import worker_lock_owner_path, worker_lock_path


class JobWorkerLease:
    def __init__(self, lock_path: Path, owner: JobWorkerLockOwner):
        self.lock_path = lock_path
        self.owner = owner

    def release(self) -> None:
        current = read_worker_lock_owner(self.lock_path)
        if current != self.owner:
            return
        shutil.rmtree(self.lock_path, ignore_errors=True)


def acquire_worker_lock(
    job_dir: Path,
    owner: str,
    pid: int,
    now: datetime,
    stale_after: timedelta,
) -> JobWorkerLease | None:
    path = worker_lock_path(job_dir)
    lock_owner = JobWorkerLockOwner(owner=owner, pid=pid, acquired_at=now)
    path.parent.mkdir(parents=True, exist_ok=True)
    for _ in range(2):
        try:
            path.mkdir()
        except FileExistsError:
            current = read_worker_lock_owner(path)
            if current is not None and not worker_lock_is_stale(
                current,
                now,
                stale_after,
            ):
                return None
            shutil.rmtree(path, ignore_errors=True)
            continue
        write_worker_lock_owner(path, lock_owner)
        return JobWorkerLease(path, lock_owner)
    return None


def write_worker_lock_owner(
    lock_path: Path,
    owner: JobWorkerLockOwner,
) -> None:
    worker_lock_owner_path(lock_path).write_text(
        owner.model_dump_json(indent=2),
        encoding="utf-8",
    )


def read_worker_lock_owner(lock_path: Path) -> JobWorkerLockOwner | None:
    path = worker_lock_owner_path(lock_path)
    if not path.is_file():
        return None
    try:
        return JobWorkerLockOwner.model_validate_json(path.read_text(encoding="utf-8"))
    except (OSError, ValidationError, ValueError):
        return None


def worker_lock_is_stale(
    owner: JobWorkerLockOwner,
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
