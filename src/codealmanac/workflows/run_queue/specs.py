from codealmanac.services.runs.models import RunKind, RunSpec
from codealmanac.workflows.build.requests import BuildRequest
from codealmanac.workflows.garden.requests import GardenRequest
from codealmanac.workflows.ingest.requests import IngestRequest


def build_run_title(request: BuildRequest) -> str:
    return request.title or "Build wiki"


def build_run_spec(request: BuildRequest) -> RunSpec:
    return RunSpec(
        kind=RunKind.BUILD,
        harness=request.harness,
        model=request.model,
        title=request.title,
        guidance=request.guidance,
        auto_commit=request.auto_commit,
    )


def ingest_run_title(request: IngestRequest) -> str:
    if request.title is not None:
        return request.title
    if len(request.inputs) == 1:
        return f"Ingest {request.inputs[0]}"
    return f"Ingest {len(request.inputs)} sources"


def ingest_run_spec(request: IngestRequest) -> RunSpec:
    return RunSpec(
        kind=RunKind.INGEST,
        harness=request.harness,
        model=request.model,
        inputs=request.inputs,
        title=request.title,
        guidance=request.guidance,
        auto_commit=request.auto_commit,
    )


def garden_run_title(request: GardenRequest) -> str:
    return request.title or "Garden wiki"


def garden_run_spec(request: GardenRequest) -> RunSpec:
    return RunSpec(
        kind=RunKind.GARDEN,
        harness=request.harness,
        model=request.model,
        title=request.title,
        guidance=request.guidance,
        auto_commit=request.auto_commit,
    )
