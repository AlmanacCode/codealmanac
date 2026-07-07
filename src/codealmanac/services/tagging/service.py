from codealmanac.services.pages.requests import ShowPageRequest
from codealmanac.services.pages.service import PagesService
from codealmanac.services.tagging.models import TaggingResult
from codealmanac.services.tagging.requests import TagPageRequest, UntagPageRequest
from codealmanac.services.wiki.frontmatter_rewrite import rewrite_page_topics


class TaggingService:
    def __init__(self, pages: PagesService):
        self.pages = pages

    def tag(self, request: TagPageRequest) -> TaggingResult:
        page = self.pages.show(
            ShowPageRequest(
                cwd=request.cwd,
                repository_name=request.repository_name,
                slug=request.slug,
            )
        )
        before = page.topics
        after = tuple(dict.fromkeys((*before, *request.topics)))
        rewrite_page_topics(page.file_path, after)
        changed = tuple(topic for topic in after if topic not in before)
        return TaggingResult(
            slug=page.slug,
            requested_topics=request.topics,
            topics_before=before,
            topics_after=after,
            changed_topics=changed,
        )

    def untag(self, request: UntagPageRequest) -> TaggingResult:
        page = self.pages.show(
            ShowPageRequest(
                cwd=request.cwd,
                repository_name=request.repository_name,
                slug=request.slug,
            )
        )
        before = page.topics
        remove = set(request.topics)
        after = tuple(topic for topic in before if topic not in remove)
        rewrite_page_topics(page.file_path, after)
        changed = tuple(topic for topic in before if topic not in after)
        return TaggingResult(
            slug=page.slug,
            requested_topics=request.topics,
            topics_before=before,
            topics_after=after,
            changed_topics=changed,
        )
