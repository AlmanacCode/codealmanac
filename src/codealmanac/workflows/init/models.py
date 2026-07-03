from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.engine.harnesses.models import HarnessRunResult
from codealmanac.engine.lifecycle import LifecycleMutationReport
from codealmanac.jobs.ledger.models import JobRecord
from codealmanac.wiki.index.models import IndexRefreshResult
from codealmanac.wiki.workspaces.models import Workspace


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
    job: JobRecord
    harness: HarnessRunResult
    safety: LifecycleMutationReport
    index: IndexRefreshResult
