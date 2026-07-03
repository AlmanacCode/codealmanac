import json

from pydantic import BaseModel

from codealmanac.wiki.index.models import IndexRefreshResult


def print_json_model(model: BaseModel) -> None:
    print(json.dumps(model.model_dump(mode="json"), indent=2))


def print_json_rows(rows: tuple[BaseModel, ...]) -> None:
    data = [row.model_dump(mode="json") for row in rows]
    print(json.dumps(data, indent=2))


def index_summary(result: IndexRefreshResult) -> str:
    skip_suffix = (
        f"; {result.files_skipped} skipped" if result.files_skipped > 0 else ""
    )
    return (
        f"{result.pages_indexed} {page_word(result.pages_indexed)} "
        f"({result.changed} updated, {result.removed} removed{skip_suffix})"
    )


def page_word(count: int) -> str:
    return "page" if count == 1 else "pages"


def print_lines(values: tuple[str, ...]) -> None:
    for value in values:
        print(value)
