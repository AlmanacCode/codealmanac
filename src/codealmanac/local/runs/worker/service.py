from codealmanac.local.control.models import ControlRunStatus
from codealmanac.local.delivery.execution.requests import DeliverLocalRunRequest
from codealmanac.local.delivery.execution.service import LocalDeliveryWorkflow
from codealmanac.local.runs.execution.requests import ExecuteLocalEngineRunRequest
from codealmanac.local.runs.execution.service import LocalEngineWorkflow
from codealmanac.local.runs.preparation.requests import PrepareNextLocalRunRequest
from codealmanac.local.runs.preparation.service import LocalRunPreparationWorkflow
from codealmanac.local.runs.worker.models import LocalWorkerRunResult
from codealmanac.local.runs.worker.requests import RunNextLocalWorkerRequest


class LocalWorkerWorkflow:
    def __init__(
        self,
        local_runs: LocalRunPreparationWorkflow,
        local_engine: LocalEngineWorkflow,
        local_delivery: LocalDeliveryWorkflow,
    ):
        self.local_runs = local_runs
        self.local_engine = local_engine
        self.local_delivery = local_delivery

    def run_next(
        self,
        request: RunNextLocalWorkerRequest | None = None,
    ) -> LocalWorkerRunResult:
        resolved = request or RunNextLocalWorkerRequest()
        preparation = self.local_runs.prepare_next(
            PrepareNextLocalRunRequest(
                repository_id=resolved.repository_id,
                branch_id=resolved.branch_id,
                operation=resolved.operation,
            )
        )
        if not preparation.prepared or preparation.run is None:
            return LocalWorkerRunResult(
                processed=preparation.run is not None,
                reason=preparation.reason,
                run=preparation.run,
                preparation=preparation,
            )
        engine = self.local_engine.execute(
            ExecuteLocalEngineRunRequest(
                run_id=preparation.run.id,
                harness=resolved.harness,
                title=resolved.title,
                guidance=resolved.guidance,
            )
        )
        if not engine.executed:
            return LocalWorkerRunResult(
                processed=True,
                reason=engine.reason,
                run=engine.run,
                preparation=preparation,
                engine=engine,
            )
        if engine.run.status is not ControlRunStatus.RUNNING:
            return LocalWorkerRunResult(
                processed=True,
                reason=f"run_{engine.run.status.value}",
                run=engine.run,
                preparation=preparation,
                engine=engine,
            )
        delivery = self.local_delivery.deliver(
            DeliverLocalRunRequest(run_id=preparation.run.id)
        )
        return LocalWorkerRunResult(
            processed=True,
            reason=delivery.reason,
            run=delivery.run,
            preparation=preparation,
            engine=engine,
            delivery=delivery,
        )
