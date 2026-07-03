from codealmanac.core.models import CodeAlmanacModel
from codealmanac.jobs.ledger.models import JobRecord, JobWorkerSpawnResult


class JobQueueStartResult(CodeAlmanacModel):
    job: JobRecord
    worker: JobWorkerSpawnResult
