from codealmanac.core.errors import ConflictError, NotFoundError, ValidationFailed
from codealmanac.core.slug import to_kebab_case
from codealmanac.services.index.models import TopicDetail, TopicSummary
from codealmanac.services.index.service import IndexService
from codealmanac.services.topics.models import (
    TopicEdgeMutationResult,
    TopicMutationAction,
    TopicMutationResult,
)
from codealmanac.services.topics.requests import (
    CreateTopicRequest,
    DescribeTopicRequest,
    LinkTopicRequest,
    ListTopicsRequest,
    ShowTopicRequest,
    UnlinkTopicRequest,
)
from codealmanac.services.wiki.topics import (
    TopicDefinition,
    load_topics_file,
    title_for_slug,
)
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

    def create(self, request: CreateTopicRequest) -> TopicMutationResult:
        workspace = resolve_workspace(
            self.workspaces,
            request.cwd,
            request.wiki,
        )
        slug = to_kebab_case(request.name)
        if not slug:
            raise ValidationFailed("topic name must contain slug-able characters")
        existing = existing_topic_slugs(self.index, workspace.workspace_id)
        topic_file = load_topics_file(workspace.almanac_path)
        validate_parents_exist(slug, request.parents, existing)
        for parent in request.parents:
            topic_file.ensure_topic(parent, title_for_slug(parent))

        existed_before = slug in existing or topic_file.has_entry(slug)
        topic_file.ensure_topic(slug, request.name.strip())
        topic_file.maybe_update_default_title(slug, request.name.strip())

        for parent in request.parents:
            if topic_file.add_parent(slug, parent):
                reject_cycle(topic_file.definitions, slug, parent)

        topic_file.write()
        self.index.ensure_fresh(workspace.workspace_id)
        action = (
            TopicMutationAction.UPDATED
            if existed_before
            else TopicMutationAction.CREATED
        )
        topic = self.index.get_topic(workspace.workspace_id, slug, False)
        return TopicMutationResult(
            action=action,
            slug=slug,
            parents=topic.parents if topic is not None else request.parents,
            description=topic.description if topic is not None else None,
        )

    def describe(self, request: DescribeTopicRequest) -> TopicMutationResult:
        workspace = resolve_workspace(
            self.workspaces,
            request.cwd,
            request.wiki,
        )
        existing = existing_topic_slugs(self.index, workspace.workspace_id)
        if request.slug not in existing:
            raise NotFoundError("topic", request.slug)
        topic_file = load_topics_file(workspace.almanac_path)
        topic_file.ensure_topic(request.slug, title_for_slug(request.slug))
        description = request.description or None
        topic_file.set_description(request.slug, description)
        topic_file.write()
        self.index.ensure_fresh(workspace.workspace_id)
        topic = self.index.get_topic(workspace.workspace_id, request.slug, False)
        return TopicMutationResult(
            action=TopicMutationAction.DESCRIBED,
            slug=request.slug,
            parents=topic.parents if topic is not None else (),
            description=description,
        )

    def link(self, request: LinkTopicRequest) -> TopicEdgeMutationResult:
        workspace = resolve_workspace(
            self.workspaces,
            request.cwd,
            request.wiki,
        )
        validate_not_self_parent(request.child, request.parent)
        existing = existing_topic_slugs(self.index, workspace.workspace_id)
        require_topics(existing, request.child, request.parent)
        topic_file = load_topics_file(workspace.almanac_path)
        topic_file.ensure_topic(request.child, title_for_slug(request.child))
        topic_file.ensure_topic(request.parent, title_for_slug(request.parent))
        if not topic_file.add_parent(request.child, request.parent):
            return TopicEdgeMutationResult(
                action=TopicMutationAction.ALREADY_LINKED,
                child=request.child,
                parent=request.parent,
            )
        reject_cycle(topic_file.definitions, request.child, request.parent)
        topic_file.write()
        self.index.ensure_fresh(workspace.workspace_id)
        return TopicEdgeMutationResult(
            action=TopicMutationAction.LINKED,
            child=request.child,
            parent=request.parent,
        )

    def unlink(self, request: UnlinkTopicRequest) -> TopicEdgeMutationResult:
        workspace = resolve_workspace(
            self.workspaces,
            request.cwd,
            request.wiki,
        )
        topic_file = load_topics_file(workspace.almanac_path)
        if not topic_file.remove_parent(request.child, request.parent):
            return TopicEdgeMutationResult(
                action=TopicMutationAction.NO_EDGE,
                child=request.child,
                parent=request.parent,
            )
        topic_file.write()
        self.index.ensure_fresh(workspace.workspace_id)
        return TopicEdgeMutationResult(
            action=TopicMutationAction.UNLINKED,
            child=request.child,
            parent=request.parent,
        )


def resolve_workspace(workspaces: WorkspacesService, cwd, wiki):
    if wiki is None:
        return workspaces.resolve(cwd)
    return workspaces.select(SelectWorkspaceRequest(selector=wiki, base_path=cwd))


def existing_topic_slugs(index: IndexService, workspace_id: str) -> set[str]:
    return {topic.slug for topic in index.list_topics(workspace_id)}


def validate_parents_exist(
    child: str,
    parents: tuple[str, ...],
    existing: set[str],
) -> None:
    for parent in parents:
        validate_not_self_parent(child, parent)
        if parent not in existing:
            raise NotFoundError("topic", parent)


def require_topics(existing: set[str], *slugs: str) -> None:
    for slug in slugs:
        if slug not in existing:
            raise NotFoundError("topic", slug)


def validate_not_self_parent(child: str, parent: str) -> None:
    if child == parent:
        raise ValidationFailed("topic cannot be its own parent")


def reject_cycle(
    definitions: tuple[TopicDefinition, ...],
    child: str,
    parent: str,
) -> None:
    if child in ancestors_of(definitions, parent):
        raise ConflictError(
            f"adding {parent} as parent of {child} would create a cycle"
        )


def ancestors_of(definitions: tuple[TopicDefinition, ...], slug: str) -> set[str]:
    parents_by_child = {
        definition.slug: set(definition.parents) for definition in definitions
    }
    ancestors: set[str] = set()
    frontier = list(parents_by_child.get(slug, set()))
    depth = 0
    while frontier and depth < 32:
        depth += 1
        parent = frontier.pop()
        if parent in ancestors:
            continue
        ancestors.add(parent)
        frontier.extend(parents_by_child.get(parent, set()))
    return ancestors
