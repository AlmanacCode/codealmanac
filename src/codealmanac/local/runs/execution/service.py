from contextlib import suppress

from codealmanac.engine.harnesses.requests import RunHarnessRequest
from codealmanac.engine.harnesses.service import HarnessesService
from codealmanac.engine.lifecycle import first_line, validate_harness_result
from codealmanac.engine.runs.models import EngineRunStatus
from codealmanac.engine.runs.requests import (
    ReadEngineRunRequest,
    WriteEngineRunResultRequest,
)
from codealmanac.engine.runs.service import EngineRunsService
from codealmanac.local.control.models import ControlRunStatus
from codealmanac.local.control.requests import (
    GetControlRunRequest,
    UpdateControlRunRequest,
)
from codealmanac.local.control.service import ControlService
from codealmanac.local.runs.execution.events import (
    append_error,
    append_status,
    record_harness_events,
)
from codealmanac.local.runs.execution.models import LocalEngineRunResult
from codealmanac.local.runs.execution.prompt import render_update_prompt
from codealmanac.local.runs.execution.requests import ExecuteLocalEngineRunRequest
from codealmanac.local.runs.execution.result import (
    commit_subject_from_summary,
    engine_changed_files,
)
from codealmanac.local.runs.preparation.refs import path_ref
from codealmanac.prompts import PromptRenderer
from codealmanac.wiki.validation.service import ValidationService


class LocalEngineWorkflow:
    def __init__(
        self,
        control: ControlService,
        engine_runs: EngineRunsService,
        harnesses: HarnessesService,
        prompts: PromptRenderer,
        validation: ValidationService,
    ):
        self.control = control
        self.engine_runs = engine_runs
        self.harnesses = harnesses
        self.prompts = prompts
        self.validation = validation

    def execute(self, request: ExecuteLocalEngineRunRequest) -> LocalEngineRunResult:
        run = self.control.get_run(GetControlRunRequest(run_id=request.run_id))
        try:
            engine_request = self.engine_runs.read_request(
                ReadEngineRunRequest(run_id=run.id)
            )
            self.control.update_run(
                UpdateControlRunRequest(
                    run_id=run.id,
                    status=ControlRunStatus.RUNNING,
                )
            )
            append_status(self.control, run.id, "started local engine worker")
            harness = self.harnesses.run(
                RunHarnessRequest(
                    kind=request.harness,
                    cwd=engine_request.repo_path,
                    prompt=render_update_prompt(
                        self.prompts,
                        engine_request,
                        request.guidance,
                    ),
                    title=request.title,
                )
            )
            record_harness_events(self.control, run.id, harness)
            self.validation.require_valid_root(
                engine_request.repo_path,
                engine_request.repo_path / engine_request.almanac_root,
            )
            validate_harness_result(harness)
            engine_result = self.engine_runs.write_result(
                WriteEngineRunResultRequest(
                    run_id=run.id,
                    status=EngineRunStatus.SUCCEEDED,
                    summary=harness.summary,
                    commit_subject=commit_subject_from_summary(harness.summary),
                    commit_body=harness.summary,
                    changed_files=engine_changed_files(
                        engine_request.repo_path,
                        harness,
                    ),
                )
            )
            result_ref = path_ref(self.engine_runs.paths(run.id).result_path)
            updated = self.control.update_run(
                UpdateControlRunRequest(
                    run_id=run.id,
                    result_ref=result_ref,
                    summary=engine_result.summary,
                    commit_subject=engine_result.commit_subject,
                    commit_body=engine_result.commit_body,
                )
            )
            append_status(
                self.control,
                run.id,
                "completed local engine worker; delivery pending",
                result_ref,
            )
            return LocalEngineRunResult(
                executed=True,
                run=updated,
                engine=engine_result,
                harness=harness,
            )
        except Exception as error:
            return self.fail(run.id, error)

    def fail(self, run_id: str, error: Exception) -> LocalEngineRunResult:
        message = first_line(str(error)) or error.__class__.__name__
        engine_result = None
        result_ref = None
        with suppress(Exception):
            engine_result = self.engine_runs.write_result(
                WriteEngineRunResultRequest(
                    run_id=run_id,
                    status=EngineRunStatus.FAILED,
                    error=message,
                )
            )
            result_ref = path_ref(self.engine_runs.paths(run_id).result_path)
        updated = self.control.update_run(
            UpdateControlRunRequest(
                run_id=run_id,
                status=ControlRunStatus.FAILED,
                result_ref=result_ref,
                error=message,
            )
        )
        append_error(self.control, run_id, message, result_ref)
        return LocalEngineRunResult(
            executed=False,
            reason="engine_failed",
            run=updated,
            engine=engine_result,
        )
