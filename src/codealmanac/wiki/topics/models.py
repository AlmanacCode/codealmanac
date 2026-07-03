from enum import StrEnum

from codealmanac.core.models import CodeAlmanacModel


class TopicMutationAction(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    DESCRIBED = "described"
    LINKED = "linked"
    ALREADY_LINKED = "already_linked"
    UNLINKED = "unlinked"
    NO_EDGE = "no_edge"
    RENAMED = "renamed"
    UNCHANGED = "unchanged"
    DELETED = "deleted"


class TopicMutationResult(CodeAlmanacModel):
    action: TopicMutationAction
    slug: str
    parents: tuple[str, ...] = ()
    description: str | None = None


class TopicEdgeMutationResult(CodeAlmanacModel):
    action: TopicMutationAction
    child: str
    parent: str


class TopicRewriteMutationResult(CodeAlmanacModel):
    action: TopicMutationAction
    slug: str
    new_slug: str | None = None
    pages_updated: int = 0
