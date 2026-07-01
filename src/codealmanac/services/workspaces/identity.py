from hashlib import sha256
from pathlib import Path

from codealmanac.core.errors import ValidationFailed
from codealmanac.core.slug import to_kebab_case


def workspace_name_for(root_path: Path, requested_name: str | None) -> str:
    name = to_kebab_case(requested_name or root_path.name)
    if not name:
        raise ValidationFailed("could not derive a workspace name; pass --name")
    return name


def workspace_id_for(root_path: Path) -> str:
    digest = sha256(str(root_path).encode("utf-8")).hexdigest()[:16]
    return f"w_{digest}"
