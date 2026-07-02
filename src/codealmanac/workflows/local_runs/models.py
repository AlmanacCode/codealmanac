from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.control.models import (
    BranchRecord,
    ControlRunRecord,
    RepositoryRecord,
    TriggerEventRecord,
)
from codealmanac.services.engine_runs.models import PreparedEngineRun
from codealmanac.services.source_bundles.models import MaterializedSourceBundle
from codealmanac.services.worker_workspaces.models import PreparedWorkerWorkspace


class LocalRunPreparationResult(CodeAlmanacModel):
    prepared: bool
    reason: str | None = None
    repository: RepositoryRecord | None = None
    branch: BranchRecord | None = None
    trigger: TriggerEventRecord | None = None
    run: ControlRunRecord | None = None
    worker_workspace: PreparedWorkerWorkspace | None = None
    source_bundle: MaterializedSourceBundle | None = None
    engine_run: PreparedEngineRun | None = None
