from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.runs.models import RunRecord
from codealmanac.services.sources.models import SourceBrief, SourceRuntime
from codealmanac.wiki.index.models import IndexRefreshResult
from codealmanac.workflows.lifecycle import LifecycleMutationReport


class IngestPromptPayload(CodeAlmanacModel):
    workspace_name: str
    workspace_root: Path
    almanac_root: Path
    sources: tuple[SourceBrief, ...]
    source_runtime: tuple[SourceRuntime, ...]
    guidance: str | None = None


class IngestResult(CodeAlmanacModel):
    run: RunRecord
    sources: tuple[SourceBrief, ...]
    source_runtime: tuple[SourceRuntime, ...]
    harness: HarnessRunResult
    safety: LifecycleMutationReport
    index: IndexRefreshResult
