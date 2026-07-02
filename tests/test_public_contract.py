import tomllib
from pathlib import Path

import pytest
from ruamel.yaml import YAML

from codealmanac.cli.main import build_parser
from codealmanac.core.models import AppConfig

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_ROOT = PROJECT_ROOT / "src/codealmanac"

FORBIDDEN_TOP_LEVEL_COMMANDS = (
    "absorb",
    "connect",
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
    "Custom repo wiki roots: any safe repo-relative directory via `--root`",
    "User state root: `~/.codealmanac/`",
    "Python 3.12+",
    "uv tool install codealmanac",
    "codealmanac setup --yes",
    "codealmanac login",
    "codealmanac whoami",
    "codealmanac capture status",
    "codealmanac capture enable --target codex",
    "codealmanac setup --yes --install-automation",
    "codealmanac setup --yes --sync-every 5h --sync-quiet 45m",
    "codealmanac init",
    'codealmanac search "getting"',
    "codealmanac serve",
    "codealmanac local setup --branch main",
    "codealmanac local update --using codex",
    "codealmanac local triggers enable dev --delivery commit",
    "codealmanac local jobs list",
    "## What Gets Created By Init",
    "a folder counts as a CodeAlmanac wiki only when it has both",
    "`topics.yaml` and `pages/`",
    "Derived local state appears when commands need it:",
    "codealmanac uninstall --yes",
    "codealmanac uninstall --yes --keep-automation",
    "Cloud commands: `setup`, `login`, `whoami`, `logout`, `capture`.",
)

README_FORBIDDEN_FRAGMENTS = (
    "npx codealmanac",
    "npm install",
    "Node 20",
    "`almanac ",
    "`alm`",
    "~/.almanac",
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

    assert config.registry_path == isolated_home / ".codealmanac/registry.json"
    assert config.config_path == isolated_home / ".codealmanac/config.toml"
    assert config.auth_path == isolated_home / ".codealmanac/auth.json"
    assert config.capture_path == isolated_home / ".codealmanac/capture.json"
    assert config.capture_events_path == (
        isolated_home / ".codealmanac/capture-events"
    )


def test_readme_documents_python_local_public_surface():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")

    for fragment in README_REQUIRED_FRAGMENTS:
        assert fragment in readme

    for fragment in README_FORBIDDEN_FRAGMENTS:
        assert fragment not in readme


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
    assert "codealmanac init --root <path>" in docs["docs/concepts.md"]
    assert "codealmanac setup --install-automation" in docs["docs/concepts.md"]
    assert "codealmanac uninstall --keep-automation" in docs["docs/concepts.md"]
    for body in docs.values():
        assert "npm install" not in body
        assert "npm test" not in body
        assert "Vitest" not in body
        assert "~/.almanac" not in body
        assert "almanac capture" not in body


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
    assert "codealmanac show getting-started" in quickstart
    assert 'codealmanac search "auth"' not in quickstart


def test_readme_lifecycle_examples_parse_public_local_commands():
    readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")
    updating = readme_section(readme, "## Updating The Wiki")
    parser = build_parser()

    parser.parse_args(("local", "setup", "--branch", "main"))
    parser.parse_args(("local", "update", "--using", "codex"))
    parser.parse_args(
        (
            "local",
            "triggers",
            "enable",
            "dev",
            "--delivery",
            "commit",
        )
    )
    parser.parse_args(("local", "jobs", "list"))

    assert "docs/adr.md" not in updating
    assert "codealmanac ingest" not in updating
    assert "codealmanac garden" not in updating


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

    assert "\ndist/\n" in gitignore
    assert "\nbuild/\n" in gitignore


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
