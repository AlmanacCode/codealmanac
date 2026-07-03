from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.engine.harnesses.models import HarnessRunResult
from codealmanac.engine.lifecycle import (
    LifecycleMutationPreflight,
    LifecycleMutationReport,
)
from codealmanac.jobs.ledger.models import JobId, JobRecord
from codealmanac.wiki.index.models import IndexRefreshResult
from codealmanac.wiki.workspaces.models import Workspace


class PageRunContext(CodeAlmanacModel):
    cwd: Path
    job_id: JobId
    workspace: Workspace
    wiki: str | None = None
    preflight: LifecycleMutationPreflight | None = None


class PageRunResult(CodeAlmanacModel):
    job: JobRecord
    harness: HarnessRunResult
    safety: LifecycleMutationReport
    index: IndexRefreshResult
