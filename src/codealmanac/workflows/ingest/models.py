from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.index.models import IndexRefreshResult
from codealmanac.services.runs.models import RunRecord
from codealmanac.services.sources.models import SourceBrief
from codealmanac.services.workspaces.models import WorkspaceChangeSnapshot


class IngestPromptPayload(CodeAlmanacModel):
    workspace_name: str
    workspace_root: Path
    almanac_root: Path
    sources: tuple[SourceBrief, ...]
    guidance: str | None = None


class IngestResult(CodeAlmanacModel):
    run: RunRecord
    sources: tuple[SourceBrief, ...]
    harness: HarnessRunResult
    safety: "IngestMutationReport"
    index: IndexRefreshResult


class IngestMutationPreflight(CodeAlmanacModel):
    before: WorkspaceChangeSnapshot
    almanac_prefix: Path


class IngestMutationReport(CodeAlmanacModel):
    before: WorkspaceChangeSnapshot
    after: WorkspaceChangeSnapshot
    changed_files: tuple[Path, ...]
