from codealmanac.core.errors import ConflictError, NotFoundError, ValidationFailed
from codealmanac.core.slug import to_kebab_case
from codealmanac.services.index.service import IndexService
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.topics.graph import (
    reject_cycle,
    require_topics,
    validate_not_self_parent,
    validate_parents_exist,
)
from codealmanac.services.topics.models import (
    TopicEdgeMutationResult,
    TopicMutationAction,
    TopicMutationResult,
    TopicRewriteMutationResult,
)
from codealmanac.services.topics.read_model import existing_topic_slugs
from codealmanac.services.topics.repository import resolve_topic_repository
from codealmanac.services.topics.requests import (
    CreateTopicRequest,
    DeleteTopicRequest,
    DescribeTopicRequest,
    LinkTopicRequest,
    RenameTopicRequest,
    UnlinkTopicRequest,
)
from codealmanac.services.wiki.frontmatter_rewrite import (
    apply_page_topic_rewrites,
    plan_page_topic_rewrites,
)
from codealmanac.services.wiki.topics import (
    load_topics_file,
    title_for_slug,
)


class TopicMutationExecutor:
    def __init__(self, repositories: RepositoriesService, index: IndexService):
        self.repositories = repositories
        self.index = index

    def create(self, request: CreateTopicRequest) -> TopicMutationResult:
        repository = resolve_topic_repository(
            self.repositories,
            request.cwd,
            request.repository_name,
        )
        slug = to_kebab_case(request.name)
        if not slug:
            raise ValidationFailed("topic name must contain slug-able characters")
        existing = existing_topic_slugs(self.index, repository.repository_id)
        topic_file = load_topics_file(repository.almanac_path)
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
        self.index.ensure_fresh(repository.repository_id)
        action = (
            TopicMutationAction.UPDATED
            if existed_before
            else TopicMutationAction.CREATED
        )
        topic = self.index.get_topic(repository.repository_id, slug, False)
        return TopicMutationResult(
            action=action,
            slug=slug,
            parents=topic.parents if topic is not None else request.parents,
            description=topic.description if topic is not None else None,
        )

    def describe(self, request: DescribeTopicRequest) -> TopicMutationResult:
        repository = resolve_topic_repository(
            self.repositories,
            request.cwd,
            request.repository_name,
        )
        existing = existing_topic_slugs(self.index, repository.repository_id)
        if request.slug not in existing:
            raise NotFoundError("topic", request.slug)
        topic_file = load_topics_file(repository.almanac_path)
        topic_file.ensure_topic(request.slug, title_for_slug(request.slug))
        description = request.description or None
        topic_file.set_description(request.slug, description)
        topic_file.write()
        self.index.ensure_fresh(repository.repository_id)
        topic = self.index.get_topic(repository.repository_id, request.slug, False)
        return TopicMutationResult(
            action=TopicMutationAction.DESCRIBED,
            slug=request.slug,
            parents=topic.parents if topic is not None else (),
            description=description,
        )

    def link(self, request: LinkTopicRequest) -> TopicEdgeMutationResult:
        repository = resolve_topic_repository(
            self.repositories,
            request.cwd,
            request.repository_name,
        )
        validate_not_self_parent(request.child, request.parent)
        existing = existing_topic_slugs(self.index, repository.repository_id)
        require_topics(existing, request.child, request.parent)
        topic_file = load_topics_file(repository.almanac_path)
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
        self.index.ensure_fresh(repository.repository_id)
        return TopicEdgeMutationResult(
            action=TopicMutationAction.LINKED,
            child=request.child,
            parent=request.parent,
        )

    def unlink(self, request: UnlinkTopicRequest) -> TopicEdgeMutationResult:
        repository = resolve_topic_repository(
            self.repositories,
            request.cwd,
            request.repository_name,
        )
        topic_file = load_topics_file(repository.almanac_path)
        if not topic_file.remove_parent(request.child, request.parent):
            return TopicEdgeMutationResult(
                action=TopicMutationAction.NO_EDGE,
                child=request.child,
                parent=request.parent,
            )
        topic_file.write()
        self.index.ensure_fresh(repository.repository_id)
        return TopicEdgeMutationResult(
            action=TopicMutationAction.UNLINKED,
            child=request.child,
            parent=request.parent,
        )

    def rename(self, request: RenameTopicRequest) -> TopicRewriteMutationResult:
        repository = resolve_topic_repository(
            self.repositories,
            request.cwd,
            request.repository_name,
        )
        if request.old_slug == request.new_slug:
            return TopicRewriteMutationResult(
                action=TopicMutationAction.UNCHANGED,
                slug=request.old_slug,
                new_slug=request.new_slug,
            )
        existing = existing_topic_slugs(self.index, repository.repository_id)
        if request.old_slug not in existing:
            raise NotFoundError("topic", request.old_slug)
        if request.new_slug in existing:
            raise ConflictError(
                f'topic "{request.new_slug}" already exists; delete it first '
                "if you intend to merge"
            )

        rewrites = plan_page_topic_rewrites(
            repository.almanac_path,
            lambda topics: tuple(
                request.new_slug if topic == request.old_slug else topic
                for topic in topics
            ),
        )
        topic_file = load_topics_file(repository.almanac_path)
        topic_file.rename_topic(request.old_slug, request.new_slug)
        _ = topic_file.definitions
        topic_file.write()
        pages_updated = apply_page_topic_rewrites(rewrites)
        self.index.ensure_fresh(repository.repository_id)
        return TopicRewriteMutationResult(
            action=TopicMutationAction.RENAMED,
            slug=request.old_slug,
            new_slug=request.new_slug,
            pages_updated=pages_updated,
        )

    def delete(self, request: DeleteTopicRequest) -> TopicRewriteMutationResult:
        repository = resolve_topic_repository(
            self.repositories,
            request.cwd,
            request.repository_name,
        )
        existing = existing_topic_slugs(self.index, repository.repository_id)
        if request.slug not in existing:
            raise NotFoundError("topic", request.slug)

        rewrites = plan_page_topic_rewrites(
            repository.almanac_path,
            lambda topics: tuple(topic for topic in topics if topic != request.slug),
        )
        topic_file = load_topics_file(repository.almanac_path)
        topic_file.delete_topic(request.slug)
        _ = topic_file.definitions
        topic_file.write()
        pages_updated = apply_page_topic_rewrites(rewrites)
        self.index.ensure_fresh(repository.repository_id)
        return TopicRewriteMutationResult(
            action=TopicMutationAction.DELETED,
            slug=request.slug,
            pages_updated=pages_updated,
        )
