from hashlib import sha256
from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.core.paths import normalize_path
from codealmanac.core.slug import to_kebab_case
from codealmanac.services.repositories.models import RepositoryName


def repository_name_for(
    root_path: Path,
    requested_name: RepositoryName | None,
) -> str:
    name = to_kebab_case(requested_name or root_path.name)
    if not name:
        raise ValidationFailed("could not derive a repository name; pass --name")
    return name


def repository_id_for(root_path: Path) -> str:
    digest = sha256(str(normalize_path(root_path)).encode("utf-8")).hexdigest()[:16]
    return f"repo_{digest}"


def project_id_for(name: str) -> str:
    digest = sha256(name.casefold().encode("utf-8")).hexdigest()[:16]
    return f"proj_{digest}"


def workspace_id_for(root_path: Path) -> str:
    digest = sha256(str(normalize_path(root_path)).encode("utf-8")).hexdigest()[:16]
    return f"ws_{digest}"