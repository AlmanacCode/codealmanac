from codealmanac.services.repositories.models import Repository, RepositoryState
from codealmanac.services.repositories.roots import is_initialized_almanac_root


def repository_state(repository: Repository) -> RepositoryState:
    if not repository.root_path.is_dir():
        return RepositoryState.MISSING_REPO
    if not is_initialized_almanac_root(repository.almanac_path):
        return RepositoryState.MISSING_ALMANAC
    return RepositoryState.AVAILABLE
