from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.engine.harnesses.models import HarnessRunResult
from codealmanac.engine.lifecycle import LifecycleMutationReport
from codealmanac.engine.sources.models import SourceBrief, SourceRuntime
from codealmanac.jobs.ledger.models import JobRecord
from codealmanac.wiki.index.models import IndexRefreshResult


class IngestPromptPayload(CodeAlmanacModel):
    workspace_name: str
    workspace_root: Path
    almanac_root: Path
    sources: tuple[SourceBrief, ...]
    source_runtime: tuple[SourceRuntime, ...]
    guidance: str | None = None


class IngestResult(CodeAlmanacModel):
    job: JobRecord
    sources: tuple[SourceBrief, ...]
    source_runtime: tuple[SourceRuntime, ...]
    harness: HarnessRunResult
    safety: LifecycleMutationReport
    index: IndexRefreshResult
