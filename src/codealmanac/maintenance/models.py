from codealmanac.core.models import CodeAlmanacModel
from codealmanac.engine.harnesses.models import HarnessRunStatus
from codealmanac.jobs.ledger.models import JobId, JobStatus
from codealmanac.maintenance.requests import MaintenanceOperation


class MaintenanceJobResult(CodeAlmanacModel):
    operation: MaintenanceOperation
    job_id: JobId
    job_status: JobStatus
    harness_status: HarnessRunStatus
    summary: str | None
    output_text: str
