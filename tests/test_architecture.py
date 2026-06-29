import ast
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src/codealmanac"


def test_cli_workflows_and_services_do_not_import_integrations():
    checked_roots = (
        SRC_ROOT / "cli",
        SRC_ROOT / "workflows",
        SRC_ROOT / "services",
    )

    offenders = [
        path
        for root in checked_roots
        for path in root.rglob("*.py")
        if imports_integration(path)
    ]

    assert offenders == []


def test_database_package_owns_sqlite_imports():
    offenders = [
        path
        for path in SRC_ROOT.rglob("*.py")
        if "database" not in path.relative_to(SRC_ROOT).parts
        and imports_module(path, "sqlite3")
    ]

    assert offenders == []


def test_config_service_owns_toml_imports():
    offenders = [
        path
        for path in SRC_ROOT.rglob("*.py")
        if path.relative_to(SRC_ROOT).parts[:2] != ("services", "config")
        and imports_module(path, "tomllib")
    ]

    assert offenders == []


def test_config_service_owns_pydantic_settings_imports():
    offenders = [
        path
        for path in SRC_ROOT.rglob("*.py")
        if path.relative_to(SRC_ROOT).parts[:2] != ("services", "config")
        and imports_module(path, "pydantic_settings")
    ]

    assert offenders == []


def test_index_read_views_are_separate_from_projection_writes():
    store = SRC_ROOT / "services/index/store.py"
    views = SRC_ROOT / "services/index/views.py"
    views_text = views.read_text(encoding="utf-8")

    assert views.is_file()
    assert "search_pages(connection, request)" in store.read_text(encoding="utf-8")
    assert "load_page_document" not in views_text
    assert "apply_migrations" not in views_text
    assert "INSERT " not in views_text
    assert "DELETE " not in views_text
    assert "CREATE " not in views_text
    assert "DROP " not in views_text


def test_cli_main_stays_as_thin_entrypoint():
    main = SRC_ROOT / "cli/main.py"
    text = main.read_text(encoding="utf-8")

    assert len(text.splitlines()) <= 80
    assert "def main(" in text
    assert "def build_parser(" not in text
    assert "def render_" not in text
    assert "add_parser(" not in text


def test_cli_parser_is_split_by_command_domain():
    parser_root = SRC_ROOT / "cli/parser"
    parser_files = {path.name for path in parser_root.glob("*.py")}
    root = (parser_root / "root.py").read_text(encoding="utf-8")

    assert parser_files == {
        "__init__.py",
        "admin.py",
        "lifecycle.py",
        "root.py",
        "wiki.py",
    }
    assert len(root.splitlines()) <= 80
    assert "add_lifecycle_commands(subcommands)" in root
    assert "add_wiki_commands(subcommands)" in root
    assert "add_admin_commands(subcommands)" in root
    assert "add_parser(" not in root


def test_cli_has_separate_parser_dispatch_and_render_packages():
    cli_root = SRC_ROOT / "cli"

    assert (cli_root / "parser/root.py").is_file()
    assert (cli_root / "dispatch/root.py").is_file()
    assert (cli_root / "dispatch/admin.py").is_file()
    assert (cli_root / "dispatch/config.py").is_file()
    assert (cli_root / "render/root.py").is_file()
    assert (cli_root / "render/admin.py").is_file()


def test_cli_admin_edge_is_split_by_command_domain():
    dispatch_root = (SRC_ROOT / "cli/dispatch/root.py").read_text(encoding="utf-8")
    render_root = (SRC_ROOT / "cli/render/root.py").read_text(encoding="utf-8")

    assert "dispatch_admin(args, app)" in dispatch_root
    assert "AutomationStatusRequest" not in dispatch_root
    assert "DoctorRequest" not in dispatch_root
    assert "UpdateStatus" not in dispatch_root
    assert "RunUpdateRequest" not in dispatch_root
    assert "DoctorReport" not in render_root
    assert "UpdatePlan" not in render_root
    assert "RunRecord" not in render_root


def test_repo_almanac_root_is_workspace_owned():
    from codealmanac.services.workspaces.roots import DEFAULT_ALMANAC_ROOT

    core_paths = (SRC_ROOT / "core/paths.py").read_text(encoding="utf-8")

    assert Path("almanac") == DEFAULT_ALMANAC_ROOT
    assert (SRC_ROOT / "services/workspaces/roots.py").is_file()
    assert "nearest_almanac_root" not in core_paths


def imports_integration(path: Path) -> bool:
    return imports_module(path, "codealmanac.integrations")


def imports_module(path: Path, module_name: str) -> bool:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if is_module_import(alias.name, module_name):
                    return True
        if (
            isinstance(node, ast.ImportFrom)
            and node.module is not None
            and is_module_import(node.module, module_name)
        ):
            return True
    return False


def is_module_import(module: str, module_name: str) -> bool:
    return module == module_name or module.startswith(f"{module_name}.")
