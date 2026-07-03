from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.runs.models import RunId, RunRecord
from codealmanac.wiki.index.models import IndexRefreshResult
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.workflows.lifecycle import (
    LifecycleMutationPreflight,
    LifecycleMutationReport,
)


class PageRunContext(CodeAlmanacModel):
    cwd: Path
    run_id: RunId
    workspace: Workspace
    wiki: str | None = None
    preflight: LifecycleMutationPreflight | None = None


class PageRunResult(CodeAlmanacModel):
    run: RunRecord
    harness: HarnessRunResult
    safety: LifecycleMutationReport
    index: IndexRefreshResult
