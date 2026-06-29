from codealmanac.core.models import CodeAlmanacModel


class TaggingResult(CodeAlmanacModel):
    slug: str
    requested_topics: tuple[str, ...]
    topics_before: tuple[str, ...]
    topics_after: tuple[str, ...]
    changed_topics: tuple[str, ...]
