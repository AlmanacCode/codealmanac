from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.manual import ManualDocument
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.index.models import IndexRefreshResult
from codealmanac.services.repositories.models import Repository
from codealmanac.services.runs.models import RunRecord
from codealmanac.workflows.operations.commit import OperationCommitPolicy
from codealmanac.workflows.operations.mutation import OperationMutationReport


class BuildPromptPayload(CodeAlmanacModel):
    repository_name: str
    repository_root: Path
    almanac_root: Path
    wiki_source_root: Path
    topics_file: Path
    manual_documents: tuple[ManualDocument, ...]
    source_control: OperationCommitPolicy
    guidance: str | None = None


class BuildResult(CodeAlmanacModel):
    repository: Repository
    index: IndexRefreshResult
    run: RunRecord
    harness: HarnessRunResult
    safety: OperationMutationReport
