from pathlib import Path

from codealmanac.manual import ManualLibrary
from codealmanac.services.repositories.service import RepositoriesService
from codealmanac.services.wiki.templates import (
    starter_readme,
    starter_topics_yaml,
)


class WikiService:
    def __init__(self, repositories: RepositoriesService, manual: ManualLibrary):
        self.repositories = repositories
        self.manual = manual

    def initialize(self, repository_id: str) -> None:
        repository = self.repositories.get(repository_id)
        almanac_path = repository.almanac_path
        almanac_path.mkdir(parents=True, exist_ok=True)
        write_if_missing(almanac_path / "README.md", starter_readme())
        write_if_missing(almanac_path / "topics.yaml", starter_topics_yaml())
        self.manual.install_missing(almanac_path / "manual")


def write_if_missing(path: Path, body: str) -> None:
    if path.exists():
        return
    path.write_text(body, encoding="utf-8")
