import tomllib
from pathlib import Path

import pytest
from ruamel.yaml import YAML

from codealmanac.app import create_app
from codealmanac.cli.main import build_parser
from codealmanac.services.repositories.roots import (
    DEFAULT_ALMANAC_ROOT,
    require_default_almanac_root,
)
from codealmanac.services.runs.models import RunKind
from codealmanac.services.sources.models import SourceKind
from codealmanac.services.sources.requests import ResolveSourcesRequest
from codealmanac.settings import AppConfig

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
    "Repo wiki root: `almanac/` only",
    "Alternate repo wiki roots: none",
    "User state root: `~/.codealmanac/`",
    "Python 3.12+",
    "uv tool install codealmanac",
    "codealmanac setup --yes",
    "codealmanac setup --yes --no-auto-update",
    "codealmanac setup --yes --sync-every 5h",
    "codealmanac setup --yes --sync-off",
    "codealmanac init",
    'codealmanac search "getting"',
    "codealmanac serve",
    "codealmanac ingest README.md --using codex",
    "codealmanac ingest github:pr:123 --using claude",
    "## What Gets Created By Init",
    "a repository counts as a CodeAlmanac wiki when",
    "`almanac/topics.yaml` and `almanac/README.md`",
    "Derived local state lives under `~/.codealmanac/`:",
    "codealmanac uninstall --yes",
    "No hosted login/connect/upload commands.",
)

README_FORBIDDEN_FRAGMENTS = (
    "npx codealmanac",
    "npm install",
    "Node 20",
    "`almanac ",
    "`alm`",
    "~/.almanac",
    "Common alternate repo wiki root",
    "Custom repo wiki roots",
    "--root",
    "docs/almanac",
    ".almanac",
    "|   |-- pages/",
    "--install-automation",
    "--keep-automation",
    "--keep-instructions",
    "uninstall --target",
    "almanac/index.db",
    "almanac/jobs/",
    "codealmanac.com/dashboard",
    "usealmanac.com",
    "does not install scheduled automation",
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

GITHUB_REQUIRED_FRAGMENTS = (
    "uv sync --locked",
    "uv run pytest",
    "uv run ruff check .",
    "git diff --check",
    "uv build --out-dir dist",
    "uvx twine check dist/*",
    "CodeAlmanac version",
    "Python version",
    "Describe what you expected CodeAlmanac to do.",
    "Install method: `uv tool`, `pip`, local checkout, or other",
)

GITHUB_FORBIDDEN_FRAGMENTS = (
    "npm ci",
    "npm test",
    "npm run build",
    "npm pack",
    "NPM_TOKEN",
    "npx",
    "Node version",
    "expected Almanac to do",
    "actions/setup-node",
    "package-lock",
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
    assert (
        "License :: OSI Approved :: Apache Software License"
        not in project["classifiers"]
    )
    assert "Operating System :: OS Independent" in project["classifiers"]
    assert "Topic :: Software Development :: Documentation" in project["classifiers"]


def test_default_user_state_paths_are_product_specific(isolated_home: Path):
    config = AppConfig()

    assert config.database_path == isolated_home / ".codealmanac/codealmanac.db"
    assert config.config_path == isolated_home / ".codealmanac/config.toml"


def test_readme_documents_python_local_public_surface():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")

    for fragment in README_REQUIRED_FRAGMENTS:
        assert fragment in readme

    for fragment in README_FORBIDDEN_FRAGMENTS:
        assert fragment not in readme


def test_almanac_root_is_not_configurable():
    assert Path("almanac") == DEFAULT_ALMANAC_ROOT
    assert require_default_almanac_root(None) == Path("almanac")

    with pytest.raises(ValueError, match="fixed at almanac"):
        require_default_almanac_root(Path("docs/almanac"))

    with pytest.raises(ValueError, match="fixed at almanac"):
        require_default_almanac_root(Path(".almanac"))


def test_init_does_not_accept_root_flag(capsys):
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(("init", "--root", "docs/almanac"))

    output = capsys.readouterr()
    assert "unrecognized arguments: --root" in output.err


def test_build_is_not_a_public_command(capsys):
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(("build",))

    output = capsys.readouterr()
    assert "invalid choice: 'build'" in output.err


def test_internal_run_kinds_are_only_build_ingest_and_garden():
    assert tuple(kind.value for kind in RunKind) == (
        "build",
        "ingest",
        "garden",
    )


def test_user_facing_docs_do_not_advertise_node_or_old_state_paths():
    docs = {
        "CONTRIBUTING.md": (PROJECT_ROOT / "CONTRIBUTING.md").read_text(
            encoding="utf-8"
        ),
        "docs/concepts.md": (PROJECT_ROOT / "docs/concepts.md").read_text(
            encoding="utf-8"
        ),
    }

    assert "uv sync" in docs["CONTRIBUTING.md"]
    assert "uv run pytest" in docs["CONTRIBUTING.md"]
    assert "There are no alternate roots." in docs["docs/concepts.md"]
    assert "codealmanac setup --yes" in docs["docs/concepts.md"]
    assert "codealmanac uninstall" in docs["docs/concepts.md"]
    for body in docs.values():
        assert "npm install" not in body
        assert "npm test" not in body
        assert "Vitest" not in body
        assert "~/.almanac" not in body
        assert "docs/almanac" not in body
        assert ".almanac" not in body
        assert "--root" not in body
        assert "[[" not in body
        assert "files:" not in body
        assert "almanac capture" not in body


def test_readme_keeps_init_scaffold_separate_from_runtime_state():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")

    init_section = readme_section(readme, "## What Gets Created By Init")

    assert "|   |-- README.md" in init_section
    assert "|   |-- topics.yaml" in init_section
    assert "|   |-- architecture/" in init_section
    assert "|   |-- decisions/" in init_section
    assert "|   `-- guides/" in init_section
    assert "|   |-- pages/" not in init_section
    assert "|   |-- manual/" not in init_section
    assert "almanac/index.db" not in init_section
    assert "almanac/jobs/" not in init_section
    assert "config.toml" not in init_section


def test_readme_quickstart_uses_search_that_works_after_init():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")

    quickstart = readme_section(readme, "## Quickstart")

    assert 'codealmanac search "getting"' in quickstart
    assert "codealmanac show getting-started" in quickstart
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


def test_public_beta_gate_audit_covers_release_gate_areas():
    readiness = (
        PROJECT_ROOT / "docs/python-port/public-release-readiness.md"
    ).read_text(encoding="utf-8")
    audit = (PROJECT_ROOT / "docs/python-port/public-beta-gate-audit.md").read_text(
        encoding="utf-8"
    )

    gate_areas = markdown_table_first_column(readiness, "## Public Beta Gate")
    audit_areas = markdown_table_first_column(audit, "## Gate Audit")

    assert audit_areas == gate_areas


def test_public_beta_gate_audit_records_current_package_rehearsal():
    audit = (PROJECT_ROOT / "docs/python-port/public-beta-gate-audit.md").read_text(
        encoding="utf-8"
    )
    table = markdown_section(audit, "## Gate Audit")

    assert "| Fresh install | Ready | Slice 71" in table
    assert "| Package metadata | Ready | Slice 71" in table
    assert "Needs final rerun" not in table


def test_release_guide_documents_python_package_release_surface():
    release_guide = (PROJECT_ROOT / "RELEASE.md").read_text(encoding="utf-8")

    for fragment in RELEASE_REQUIRED_FRAGMENTS:
        assert fragment in release_guide

    for fragment in RELEASE_FORBIDDEN_FRAGMENTS:
        assert fragment not in release_guide


def test_github_automation_and_templates_use_python_public_surface():
    github_files = {
        path.relative_to(PROJECT_ROOT).as_posix(): path.read_text(encoding="utf-8")
        for path in (PROJECT_ROOT / ".github").rglob("*")
        if path.is_file()
    }
    github_text = "\n".join(github_files.values())

    for fragment in GITHUB_REQUIRED_FRAGMENTS:
        assert fragment in github_text

    for fragment in GITHUB_FORBIDDEN_FRAGMENTS:
        assert fragment not in github_text

    assert "uv build --out-dir dist" in github_files[
        ".github/workflows/pack-check.yml"
    ]
    assert "Local publish follows RELEASE.md with uv build and twine." in github_files[
        ".github/workflows/publish.yml"
    ]


def test_github_workflows_are_parseable_python_workflows():
    yaml = YAML(typ="safe")
    workflow_files = {
        path.name: yaml.load(path.read_text(encoding="utf-8"))
        for path in sorted((PROJECT_ROOT / ".github/workflows").glob("*.yml"))
    }

    assert sorted(workflow_files) == ["ci.yml", "pack-check.yml", "publish.yml"]

    for workflow in workflow_files.values():
        assert isinstance(workflow["name"], str)
        assert "on" in workflow
        assert isinstance(workflow["jobs"], dict)

    ci_commands = workflow_run_commands(workflow_files["ci.yml"])
    assert "uv sync --locked" in ci_commands
    assert "uv run ruff check ." in ci_commands
    assert "uv run pytest" in ci_commands
    assert "uv run codealmanac --help" in ci_commands
    assert "git diff --check" in ci_commands

    package_commands = workflow_run_commands(workflow_files["pack-check.yml"])
    assert "uv sync --locked" in package_commands
    assert "uv build --out-dir dist" in package_commands
    assert "uvx twine check dist/*" in package_commands


def test_package_build_artifacts_are_ignored():
    gitignore = (PROJECT_ROOT / ".gitignore").read_text(encoding="utf-8")

    assert "\n/dist/\n" in gitignore
    assert "\n/build/\n" in gitignore


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


def markdown_table_first_column(markdown: str, heading: str) -> tuple[str, ...]:
    section = markdown_section(markdown, heading)
    rows = []
    for line in section.splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 2:
            continue
        first = cells[0]
        if first in {"Area", "---"} or set(first) == {"-"}:
            continue
        rows.append(first)
    return tuple(rows)


def workflow_run_commands(workflow: dict[str, object]) -> tuple[str, ...]:
    commands: list[str] = []
    jobs = workflow["jobs"]
    assert isinstance(jobs, dict)
    for job in jobs.values():
        assert isinstance(job, dict)
        steps = job["steps"]
        assert isinstance(steps, list)
        for step in steps:
            assert isinstance(step, dict)
            command = step.get("run")
            if isinstance(command, str):
                commands.append(command)
    return tuple(commands)
