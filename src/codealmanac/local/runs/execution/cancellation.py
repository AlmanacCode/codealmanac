from codealmanac.engine.harnesses.models import HarnessRunResult
from codealmanac.engine.runs.models import EngineRunStatus
from codealmanac.engine.runs.requests import WriteEngineRunResultRequest
from codealmanac.engine.runs.service import EngineRunsService
from codealmanac.local.control.models import ControlRunRecord, ControlRunStatus
from codealmanac.local.control.requests import (
    GetControlRunRequest,
    UpdateControlRunRequest,
)
from codealmanac.local.control.service import ControlService
from codealmanac.local.runs.execution.events import append_status
from codealmanac.local.runs.execution.models import LocalEngineRunResult
from codealmanac.local.runs.preparation.refs import path_ref


def cancelled_engine_result(
    control: ControlService,
    engine_runs: EngineRunsService,
    run: ControlRunRecord,
    *,
    harness: HarnessRunResult,
) -> LocalEngineRunResult | None:
    current = control.get_run(GetControlRunRequest(run_id=run.id))
    if current.status is not ControlRunStatus.CANCELLED:
        return None
    engine_result = engine_runs.write_result(
        WriteEngineRunResultRequest(
            run_id=run.id,
            status=EngineRunStatus.CANCELLED,
            error=current.error or "cancelled by user",
        )
    )
    result_ref = path_ref(engine_runs.paths(run.id).result_path)
    updated = control.update_run(
        UpdateControlRunRequest(
            run_id=run.id,
            result_ref=result_ref,
            error=engine_result.error,
        )
    )
    append_status(
        control,
        run.id,
        "cancelled local engine worker; delivery skipped",
        result_ref,
    )
    return LocalEngineRunResult(
        executed=True,
        run=updated,
        engine=engine_result,
        harness=harness,
    )
