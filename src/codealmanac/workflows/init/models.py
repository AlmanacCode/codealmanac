from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.services.harnesses.models import HarnessRunResult
from codealmanac.services.runs.models import RunRecord
from codealmanac.wiki.index.models import IndexRefreshResult
from codealmanac.wiki.workspaces.models import Workspace
from codealmanac.workflows.lifecycle import LifecycleMutationReport


class InitPreparation(CodeAlmanacModel):
    workspace: Workspace
    existing_page_count: int


class InitPromptPayload(CodeAlmanacModel):
    workspace_name: str
    workspace_root: Path
    almanac_root: Path
    pages_root: Path
    topics_file: Path
    existing_page_count: int
    force: bool
    guidance: str | None = None


class InitResult(CodeAlmanacModel):
    workspace: Workspace
    existing_page_count: int
    run: RunRecord
    harness: HarnessRunResult
    safety: LifecycleMutationReport
    index: IndexRefreshResult
