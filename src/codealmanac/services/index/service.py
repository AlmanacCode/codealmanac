from pathlib import Path

from codealmanac.services.index.models import (
    HealthReport,
    IndexRefreshResult,
    IndexSummary,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.index.requests import ReindexRequest, SearchIndexRequest
from codealmanac.services.index.store import IndexStore
from codealmanac.services.repositories.models import Repository
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.settings import LocalStatePaths


class IndexService:
    def __init__(
        self,
        repositories: RepositoriesService,
        store: IndexStore,
        local_state: LocalStatePaths,
    ):
        self.repositories = repositories
        self.store = store
        self.local_state = local_state

    def ensure_fresh(self, repository_id: str) -> IndexRefreshResult:
        repository = self.repositories.get(repository_id)
        return self.store.refresh(
            repository.almanac_path,
            self.runtime_path(repository),
        )

    def reindex(self, request: ReindexRequest) -> IndexRefreshResult:
        repository = self.repositories.select_read_repository(
            request.cwd,
            request.repository_name,
        )
        return self.store.rebuild(
            repository.almanac_path,
            self.runtime_path(repository),
        )

    def summary(self, repository_id: str) -> IndexSummary:
        repository = self.repositories.get(repository_id)
        refresh = self.refresh(repository)
        counts = self.store.counts(
            repository.almanac_path,
            self.runtime_path(repository),
        )
        return IndexSummary(
            pages=counts.pages,
            topics=counts.topics,
            files_seen=refresh.files_seen,
            files_skipped=refresh.files_skipped,
        )

    def search(
        self,
        repository_id: str,
        request: SearchIndexRequest,
    ) -> tuple[SearchPageResult, ...]:
        repository = self.repositories.get(repository_id)
        self.refresh(repository)
        return self.store.search(
            repository.almanac_path,
            self.runtime_path(repository),
            request,
        )

    def get_page(self, repository_id: str, slug: str) -> PageView | None:
        repository = self.repositories.get(repository_id)
        self.refresh(repository)
        return self.store.get_page(
            repository.almanac_path,
            self.runtime_path(repository),
            slug,
        )

    def list_topics(self, repository_id: str) -> tuple[TopicSummary, ...]:
        repository = self.repositories.get(repository_id)
        self.refresh(repository)
        return self.store.list_topics(
            repository.almanac_path,
            self.runtime_path(repository),
        )

    def get_topic(
        self,
        repository_id: str,
        slug: str,
        include_descendants: bool,
    ) -> TopicDetail | None:
        repository = self.repositories.get(repository_id)
        self.refresh(repository)
        return self.store.get_topic(
            repository.almanac_path,
            self.runtime_path(repository),
            slug,
            include_descendants,
        )

    def health_report(self, repository_id: str) -> HealthReport:
        repository = self.repositories.get(repository_id)
        self.refresh(repository)
        registered_wikis = {repository.name for repository in self.repositories.list()}
        return self.store.health_report(
            repository.almanac_path,
            self.runtime_path(repository),
            repository.root_path,
            registered_wikis,
        )

    def refresh(self, repository: Repository) -> IndexRefreshResult:
        return self.store.refresh(
            repository.almanac_path,
            self.runtime_path(repository),
        )

    def runtime_path(self, repository: Repository) -> Path:
        return self.local_state.repository_dir(repository.repository_id)
