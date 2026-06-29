from codealmanac.core.errors import NotFoundError
from codealmanac.core.slug import to_kebab_case
from codealmanac.services.index.models import TopicDetail, TopicSummary
from codealmanac.services.index.service import IndexService
from codealmanac.services.topics.requests import ListTopicsRequest, ShowTopicRequest
from codealmanac.services.workspaces.requests import SelectWorkspaceRequest
from codealmanac.services.workspaces.service import WorkspacesService


class TopicsService:
    def __init__(self, workspaces: WorkspacesService, index: IndexService):
        self.workspaces = workspaces
        self.index = index

    def list(self, request: ListTopicsRequest) -> tuple[TopicSummary, ...]:
        workspace = resolve_workspace(
            self.workspaces,
            request.cwd,
            request.wiki,
        )
        return self.index.list_topics(workspace.workspace_id)

    def show(self, request: ShowTopicRequest) -> TopicDetail:
        workspace = resolve_workspace(
            self.workspaces,
            request.cwd,
            request.wiki,
        )
        slug = to_kebab_case(request.slug)
        topic = self.index.get_topic(
            workspace.workspace_id,
            slug,
            request.include_descendants,
        )
        if topic is None:
            raise NotFoundError("topic", request.slug)
        return topic


def resolve_workspace(workspaces: WorkspacesService, cwd, wiki):
    if wiki is None:
        return workspaces.resolve(cwd)
    return workspaces.select(SelectWorkspaceRequest(selector=wiki, base_path=cwd))
