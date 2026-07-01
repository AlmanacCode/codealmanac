from codealmanac.core.errors import NotFoundError
from codealmanac.core.slug import to_kebab_case
from codealmanac.services.index.models import TopicDetail, TopicSummary
from codealmanac.services.index.service import IndexService
from codealmanac.services.topics.models import (
    TopicEdgeMutationResult,
    TopicMutationResult,
    TopicRewriteMutationResult,
)
from codealmanac.services.topics.mutations import TopicMutationExecutor
from codealmanac.services.topics.requests import (
    CreateTopicRequest,
    DeleteTopicRequest,
    DescribeTopicRequest,
    LinkTopicRequest,
    ListTopicsRequest,
    RenameTopicRequest,
    ShowTopicRequest,
    UnlinkTopicRequest,
)
from codealmanac.services.topics.workspace import resolve_topic_workspace
from codealmanac.services.workspaces.service import WorkspacesService


class TopicsService:
    def __init__(self, workspaces: WorkspacesService, index: IndexService):
        self.workspaces = workspaces
        self.index = index
        self.mutations = TopicMutationExecutor(workspaces, index)

    def list(self, request: ListTopicsRequest) -> tuple[TopicSummary, ...]:
        workspace = resolve_topic_workspace(
            self.workspaces,
            request.cwd,
            request.wiki,
        )
        return self.index.list_topics(workspace.workspace_id)

    def show(self, request: ShowTopicRequest) -> TopicDetail:
        workspace = resolve_topic_workspace(
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

    def create(self, request: CreateTopicRequest) -> TopicMutationResult:
        return self.mutations.create(request)

    def describe(self, request: DescribeTopicRequest) -> TopicMutationResult:
        return self.mutations.describe(request)

    def link(self, request: LinkTopicRequest) -> TopicEdgeMutationResult:
        return self.mutations.link(request)

    def unlink(self, request: UnlinkTopicRequest) -> TopicEdgeMutationResult:
        return self.mutations.unlink(request)

    def rename(self, request: RenameTopicRequest) -> TopicRewriteMutationResult:
        return self.mutations.rename(request)

    def delete(self, request: DeleteTopicRequest) -> TopicRewriteMutationResult:
        return self.mutations.delete(request)
