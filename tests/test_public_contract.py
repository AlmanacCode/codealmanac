import tomllib
from pathlib import Path

import pytest

from codealmanac.app import create_app
from codealmanac.cli.main import build_parser
from codealmanac.services.sources.models import SourceKind
from codealmanac.services.sources.requests import ResolveSourcesRequest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_ROOT = PROJECT_ROOT / "src/codealmanac"

FORBIDDEN_TOP_LEVEL_COMMANDS = (
    "absorb",
    "capture",
    "connect",
    "login",
    "mcp",
    "sdk",
    "source",
    "sources",
    "upload",
    "use",
)

README_REQUIRED_FRAGMENTS = (
    "Public command: `codealmanac`",
    "Default repo wiki root: `almanac/`",
    "Python 3.12+",
    "uv tool install codealmanac",
    "codealmanac init",
    'codealmanac search "getting"',
    "codealmanac serve",
    "codealmanac ingest README.md --using codex",
    "codealmanac ingest github:pr:123 --using claude",
    "## What Gets Created By Init",
    "Derived local state appears when commands need it:",
    "No hosted login/connect/upload commands.",
)

README_FORBIDDEN_FRAGMENTS = (
    "npx codealmanac",
    "npm install",
    "Node 20",
    "`almanac ",
    "`alm`",
    "codealmanac.com/dashboard",
    "usealmanac.com",
    "ingest is an alias",
    "absorb",
)

RELEASE_REQUIRED_FRAGMENTS = (
    "Python package release flow",
    "uv build --out-dir dist",
    "uvx twine check dist/*",
    "uvx twine upload dist/*",
    "codealmanac",
    "must not introduce",
)

RELEASE_FORBIDDEN_FRAGMENTS = (
    "npm publish",
    "npm test",
    "npm run build",
    "npm pack",
    "NPM_TOKEN",
    "npx",
)


def test_public_entry_point_is_codealmanac_only():
    pyproject = tomllib.loads((PROJECT_ROOT / "pyproject.toml").read_text())

    scripts = pyproject["project"]["scripts"]

    assert scripts == {"codealmanac": "codealmanac.cli.main:main"}


def test_python_package_metadata_declares_readme_and_license():
    pyproject = tomllib.loads((PROJECT_ROOT / "pyproject.toml").read_text())

    project = pyproject["project"]

    assert project["readme"] == "README.md"
    assert project["license"] == "Apache-2.0"
    assert project["license-files"] == ["LICENSE.md"]
    assert project["authors"] == [{"name": "Almanac"}]
    assert project["urls"] == {
        "Repository": "https://github.com/AlmanacCode/codealmanac",
        "Issues": "https://github.com/AlmanacCode/codealmanac/issues",
    }
    assert "Development Status :: 3 - Alpha" in project["classifiers"]
    assert "License :: OSI Approved :: Apache Software License" not in project[
        "classifiers"
    ]
    assert "Operating System :: OS Independent" in project["classifiers"]
    assert "Topic :: Software Development :: Documentation" in project["classifiers"]


def test_readme_documents_python_local_public_surface():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")

    for fragment in README_REQUIRED_FRAGMENTS:
        assert fragment in readme

    for fragment in README_FORBIDDEN_FRAGMENTS:
        assert fragment not in readme


def test_readme_keeps_init_scaffold_separate_from_runtime_state():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")

    init_section = readme_section(readme, "## What Gets Created By Init")

    assert "|   |-- README.md" in init_section
    assert "|   |-- topics.yaml" in init_section
    assert "|   |-- pages/" in init_section
    assert "|   |-- manual/" in init_section
    assert "almanac/index.db" not in init_section
    assert "almanac/jobs/" not in init_section
    assert "config.toml" not in init_section


def test_readme_quickstart_uses_search_that_works_after_init():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")

    quickstart = readme_section(readme, "## Quickstart")

    assert 'codealmanac search "getting"' in quickstart
    assert 'codealmanac show getting-started' in quickstart
    assert 'codealmanac search "auth"' not in quickstart


def test_readme_lifecycle_examples_parse_and_resolve_public_sources():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")
    updating = readme_section(readme, "## Updating The Wiki")
    parser = build_parser()

    parser.parse_args(("ingest", "README.md", "--using", "codex"))
    parser.parse_args(("ingest", "github:pr:123", "--using", "claude"))
    parser.parse_args(("garden", "--using", "codex"))

    assert "docs/adr.md" not in updating

    file_brief, pr_brief = create_app().sources.resolve(
        ResolveSourcesRequest(
            cwd=PROJECT_ROOT,
            inputs=("README.md", "github:pr:123"),
        )
    )
    assert file_brief.ref.kind == SourceKind.PATH_FILE
    assert file_brief.ref.exists is True
    assert pr_brief.ref.kind == SourceKind.GITHUB_PULL_REQUEST
    assert pr_brief.ref.number == 123


def test_next_agent_brief_tracks_latest_python_port_slice():
    latest_slice = latest_python_port_slice_number()
    brief = (PROJECT_ROOT / "docs/python-port/next-agent-brief.md").read_text(
        encoding="utf-8"
    )
    current_state = markdown_section(brief, "## Current State")

    assert f"Latest implementation slice: slice {latest_slice}" in current_state


def test_release_guide_documents_python_package_release_surface():
    release_guide = (PROJECT_ROOT / "RELEASE.md").read_text(encoding="utf-8")

    for fragment in RELEASE_REQUIRED_FRAGMENTS:
        assert fragment in release_guide

    for fragment in RELEASE_FORBIDDEN_FRAGMENTS:
        assert fragment not in release_guide


@pytest.mark.parametrize("command", FORBIDDEN_TOP_LEVEL_COMMANDS)
def test_local_cli_rejects_hosted_and_alias_commands(
    command: str,
    capsys,
):
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args((command,))

    output = capsys.readouterr()
    assert "invalid choice" in output.err


def test_local_cli_help_does_not_advertise_hosted_or_alias_commands():
    help_text = build_parser().format_help()

    for command in FORBIDDEN_TOP_LEVEL_COMMANDS:
        assert f" {command}" not in help_text


def test_python_package_does_not_expose_sdk_or_mcp_modules():
    module_paths = {
        path.relative_to(PACKAGE_ROOT)
        for path in PACKAGE_ROOT.rglob("*.py")
        if "__pycache__" not in path.parts
    }

    assert no_path_component(module_paths, "sdk")
    assert no_path_component(module_paths, "mcp")


def no_path_component(paths: set[Path], component: str) -> bool:
    return all(component not in path.parts and path.stem != component for path in paths)


def readme_section(readme: str, heading: str) -> str:
    return markdown_section(readme, heading)


def markdown_section(markdown: str, heading: str) -> str:
    start = markdown.index(heading)
    next_heading = markdown.find("\n## ", start + len(heading))
    if next_heading == -1:
        return markdown[start:]
    return markdown[start:next_heading]


def latest_python_port_slice_number() -> int:
    numbers = []
    for path in (PROJECT_ROOT / "docs/python-port").glob("slice-*.md"):
        parts = path.stem.split("-", 2)
        if len(parts) >= 2 and parts[1].isdigit():
            numbers.append(int(parts[1]))
    return max(numbers)
