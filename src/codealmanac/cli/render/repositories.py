import json

from codealmanac.cli.render.style import EM_DASH, pad_visible, style
from codealmanac.services.repositories.models import RegisteredRepositories


def render_repository_list(result: RegisteredRepositories, json_output: bool) -> None:
    if json_output:
        print(json.dumps(repository_rows(result), indent=2))
        return
    if len(result.repositories) == 0:
        print(
            f"{style.DIM}no wikis registered. "
            f"run `codealmanac init` in a repo to create one.{style.RST}"
        )
        return
    name_width = min(
        30,
        max(len(item.repository.name) for item in result.repositories),
    )
    for item in result.repositories:
        repository = item.repository
        name = pad_visible(repository.name, name_width)
        description = repository.description or EM_DASH
        print(f"{style.BLUE}{style.BOLD}{name}{style.RST}  {description}")
        print(f"{' ' * name_width}  {style.DIM}{repository.root_path}{style.RST}")


def repository_rows(result: RegisteredRepositories) -> tuple[dict[str, object], ...]:
    return tuple(
        {
            "repository": item.repository.model_dump(mode="json"),
            "status": item.state.value,
        }
        for item in result.repositories
    )
