from pathlib import Path

from codealmanac.core.models import CodeAlmanacModel, NonNegativeLimit
from codealmanac.services.repositories.models import RepositoryName


class SearchPagesRequest(CodeAlmanacModel):
    cwd: Path
    repository_name: RepositoryName | None = None
    query: str | None = None
    topics: tuple[str, ...] = ()
    mentions: str | None = None
    limit: NonNegativeLimit = None
