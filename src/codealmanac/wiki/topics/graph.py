from codealmanac.core.errors import ConflictError, NotFoundError, ValidationFailed
from codealmanac.wiki.topic_models import TopicDefinition


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
