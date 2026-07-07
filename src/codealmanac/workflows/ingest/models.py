from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.manual import ManualDocument
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.index.models import IndexRefreshResult
from codealmanac.services.runs.models import RunRecord
from codealmanac.services.sources.models import SourceBrief, SourceRuntime
from codealmanac.workflows.operations.commit import OperationCommitPolicy
from codealmanac.workflows.operations.mutation import OperationMutationReport


class IngestPromptPayload(CodeAlmanacModel):
    repository_name: str
    repository_root: Path
    almanac_root: Path
    sources: tuple[SourceBrief, ...]
    source_runtime: tuple[SourceRuntime, ...]
    manual_documents: tuple[ManualDocument, ...]
    source_control: OperationCommitPolicy
    guidance: str | None = None


class IngestResult(CodeAlmanacModel):
    run: RunRecord
    sources: tuple[SourceBrief, ...]
    source_runtime: tuple[SourceRuntime, ...]
    harness: HarnessRunResult
    safety: OperationMutationReport
    index: IndexRefreshResult
