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


class TopicMutationResult(CodeAlmanacModel):
    action: TopicMutationAction
    slug: str
    parents: tuple[str, ...] = ()
    description: str | None = None


class TopicEdgeMutationResult(CodeAlmanacModel):
    action: TopicMutationAction
    child: str
    parent: str
