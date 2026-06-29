from pathlib import Path

from codealmanac.services.runs.models import RunLogEvent, RunRecord
from codealmanac.services.runs.requests import (
    FinishRunRequest,
    ListRunsRequest,
    ReadRunLogRequest,
    RecordRunEventRequest,
    ShowRunRequest,
    StartRunRequest,
)
from codealmanac.services.runs.store import RunStore
from codealmanac.services.workspaces.models import Workspace
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService


class RunsService:
    def __init__(self, workspaces: WorkspacesService, store: RunStore):
        self.workspaces = workspaces
        self.store = store

    def start(self, request: StartRunRequest) -> RunRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.store.create(
            workspace.almanac_path,
            workspace.workspace_id,
            request.operation,
            request.title,
        )

    def list(self, request: ListRunsRequest) -> tuple[RunRecord, ...]:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.store.list(workspace.almanac_path, request.limit)

    def show(self, request: ShowRunRequest) -> RunRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.store.read(workspace.almanac_path, request.run_id)

    def log(self, request: ReadRunLogRequest) -> tuple[RunLogEvent, ...]:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.store.log(workspace.almanac_path, request.run_id)

    def record_event(self, request: RecordRunEventRequest) -> RunLogEvent:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.store.append(
            workspace.almanac_path,
            request.run_id,
            request.kind,
            request.message,
        )

    def finish(self, request: FinishRunRequest) -> RunRecord:
        workspace = self.resolve_workspace(request.cwd, request.wiki)
        return self.store.finish(
            workspace.almanac_path,
            request.run_id,
            request.status,
            request.summary,
            request.error,
        )

    def resolve_workspace(self, cwd: Path, wiki: str | None) -> Workspace:
        if wiki is None:
            return self.workspaces.resolve(cwd)
        return self.workspaces.select(
            SelectWorkspaceRequest(selector=wiki, base_path=cwd)
        )
