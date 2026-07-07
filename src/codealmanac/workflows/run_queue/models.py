from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.repositories.models import Repository
from codealmanac.services.runs.models import RunRecord, RunWorkerSpawnResult


class RunQueueStartResult(CodeAlmanacModel):
    run: RunRecord
    repository: Repository
    runs_ahead: int
    worker: RunWorkerSpawnResult


class ScheduledGardenResult(CodeAlmanacModel):
    runs: tuple[RunRecord, ...]
    skipped: tuple[Repository, ...] = ()
    worker: RunWorkerSpawnResult | None = None
    worker_error: str | None = None
