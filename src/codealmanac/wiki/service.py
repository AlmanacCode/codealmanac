from pathlib import Path

from codealmanac.manual import ManualLibrary
from codealmanac.wiki.templates import (
    gitignore_runtime_block,
    starter_page,
    starter_readme,
    starter_topics_yaml,
)
from codealmanac.wiki.workspaces.service import WorkspacesService


class WikiService:
    def __init__(self, workspaces: WorkspacesService, manual: ManualLibrary):
        self.workspaces = workspaces
        self.manual = manual

    def initialize(self, workspace_id: str) -> None:
        workspace = self.workspaces.get(workspace_id)
        almanac_path = workspace.almanac_path
        pages_path = almanac_path / "pages"
        manual_path = almanac_path / "manual"
        almanac_path.mkdir(parents=True, exist_ok=True)
        pages_path.mkdir(parents=True, exist_ok=True)
        manual_path.mkdir(parents=True, exist_ok=True)
        write_if_missing(almanac_path / "README.md", starter_readme())
        write_if_missing(almanac_path / "topics.yaml", starter_topics_yaml())
        write_if_missing(pages_path / "getting-started.md", starter_page())
        self.manual.install_missing(manual_path)
        ensure_root_gitignore(workspace.root_path, workspace.almanac_root)


def write_if_missing(path: Path, body: str) -> None:
    if path.exists():
        return
    path.write_text(body, encoding="utf-8")


def ensure_root_gitignore(root_path: Path, almanac_root: Path) -> None:
    path = root_path / ".gitignore"
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    lines = {line.strip() for line in existing.splitlines()}
    missing = [
        line for line in gitignore_runtime_block(almanac_root) if line not in lines
    ]
    if len(missing) == 0:
        return
    header = "# codealmanac"
    block_lines = []
    if header not in lines:
        block_lines.append(header)
    block_lines.extend(missing)
    block = "\n".join(block_lines) + "\n"
    separator = "" if existing == "" else "\n" if existing.endswith("\n") else "\n\n"
    path.write_text(f"{existing}{separator}{block}", encoding="utf-8")
