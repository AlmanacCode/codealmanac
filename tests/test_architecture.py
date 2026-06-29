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
