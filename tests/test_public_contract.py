import tomllib
from pathlib import Path

import pytest

from codealmanac.cli.main import build_parser

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
    "codealmanac search",
    "codealmanac serve",
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


def test_readme_documents_python_local_public_surface():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")

    for fragment in README_REQUIRED_FRAGMENTS:
        assert fragment in readme

    for fragment in README_FORBIDDEN_FRAGMENTS:
        assert fragment not in readme


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
