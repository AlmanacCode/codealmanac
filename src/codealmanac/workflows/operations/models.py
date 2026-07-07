from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.index.models import IndexRefreshResult
from codealmanac.services.repositories.models import Repository
from codealmanac.services.runs.models import RunId, RunRecord
from codealmanac.workflows.operations.mutation import (
    OperationMutationPreflight,
    OperationMutationReport,
)


class OperationContext(CodeAlmanacModel):
    run_id: RunId
    repository: Repository
    preflight: OperationMutationPreflight | None = None


class OperationResult(CodeAlmanacModel):
    run: RunRecord
    harness: HarnessRunResult
    safety: OperationMutationReport
    index: IndexRefreshResult
