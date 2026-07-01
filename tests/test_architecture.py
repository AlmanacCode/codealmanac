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


def test_rich_terminal_ui_stays_in_cli_render_edge():
    offenders = [
        path
        for path in SRC_ROOT.rglob("*.py")
        if path.relative_to(SRC_ROOT).parts[:2] != ("cli", "render")
        and imports_module(path, "rich")
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


def test_serve_css_does_not_scale_type_with_viewport_width():
    css = (SRC_ROOT / "server/assets/app.css").read_text(encoding="utf-8")

    assert "clamp(" not in css
    assert "vw" not in css


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
    assert (cli_root / "dispatch/lifecycle.py").is_file()
    assert (cli_root / "dispatch/wiki.py").is_file()
    assert (cli_root / "render/root.py").is_file()
    assert (cli_root / "render/admin.py").is_file()


def test_cli_dispatch_edge_is_split_by_command_domain():
    dispatch_root = (SRC_ROOT / "cli/dispatch/root.py").read_text(encoding="utf-8")
    render_root = (SRC_ROOT / "cli/render/root.py").read_text(encoding="utf-8")

    assert len(dispatch_root.splitlines()) <= 80
    assert "dispatch_lifecycle(args, app)" in dispatch_root
    assert "dispatch_wiki(args, app)" in dispatch_root
    assert "dispatch_admin(args, app)" in dispatch_root
    assert "RunIngestRequest" not in dispatch_root
    assert "SearchPagesRequest" not in dispatch_root
    assert "AutomationStatusRequest" not in dispatch_root
    assert "DoctorRequest" not in dispatch_root
    assert "UpdateStatus" not in dispatch_root
    assert "RunUpdateRequest" not in dispatch_root
    assert "DoctorReport" not in render_root
    assert "UpdatePlan" not in render_root
    assert "RunRecord" not in render_root


def test_cli_dispatch_files_stay_small():
    oversized = []
    for path in (SRC_ROOT / "cli/dispatch").glob("*.py"):
        line_count = len(path.read_text(encoding="utf-8").splitlines())
        if line_count > 250:
            oversized.append(f"{path.name}:{line_count}")

    assert oversized == []


def test_page_run_workflow_owns_shared_lifecycle_execution():
    page_run_service = SRC_ROOT / "workflows/page_run/service.py"
    page_run_text = page_run_service.read_text(encoding="utf-8")

    assert page_run_service.is_file()
    assert "RunHarnessRequest" in page_run_text
    assert "RecordRunHarnessTranscriptRequest" in page_run_text
    assert "validate_harness_result" in page_run_text

    operation_services = (
        SRC_ROOT / "workflows/ingest/service.py",
        SRC_ROOT / "workflows/garden/service.py",
    )
    forbidden_fragments = (
        "RunHarnessRequest",
        "RecordRunHarnessTranscriptRequest",
        "MarkRunRunningRequest",
        "FinishRunRequest",
        "validate_harness_result",
        "harness_events",
        "harness_run_event_kind",
    )
    offenders = [
        f"{path.relative_to(SRC_ROOT)}:{fragment}"
        for path in operation_services
        for fragment in forbidden_fragments
        if fragment in path.read_text(encoding="utf-8")
    ]

    assert offenders == []


def test_page_writing_workflow_services_stay_small():
    oversized = []
    for path in (
        SRC_ROOT / "workflows/ingest/service.py",
        SRC_ROOT / "workflows/garden/service.py",
        SRC_ROOT / "workflows/page_run/service.py",
        SRC_ROOT / "workflows/run_queue/service.py",
    ):
        line_count = len(path.read_text(encoding="utf-8").splitlines())
        if line_count > 250:
            oversized.append(f"{path.relative_to(SRC_ROOT)}:{line_count}")

    assert oversized == []


def test_claude_sdk_event_mapper_stays_split_by_responsibility():
    claude_root = SRC_ROOT / "integrations/harnesses/claude"
    expected_modules = {
        "actors.py",
        "events.py",
        "message_events.py",
        "raw.py",
        "result.py",
        "sdk_messages.py",
        "state.py",
        "stream.py",
        "task_events.py",
        "tool_events.py",
        "usage.py",
    }
    module_names = {path.name for path in claude_root.glob("*.py")}
    oversized = []
    for path in claude_root.glob("*.py"):
        line_count = len(path.read_text(encoding="utf-8").splitlines())
        if line_count > 220:
            oversized.append(f"{path.name}:{line_count}")
    event_dispatch = (claude_root / "events.py").read_text(encoding="utf-8")
    dispatch_leaks = [
        fragment
        for fragment in (
            "ToolUseBlock",
            "ToolResultBlock",
            "TextBlock",
            "HarnessAgentTrace",
            "done_event",
            "json_value",
            "provider_session_event",
            "result_from_state",
            "asdict",
        )
        if fragment in event_dispatch
    ]

    assert expected_modules <= module_names
    assert oversized == []
    assert dispatch_leaks == []


def test_run_queue_workflow_stays_operation_dispatch_only():
    text = (SRC_ROOT / "workflows/run_queue/service.py").read_text(encoding="utf-8")

    forbidden_fragments = (
        "RunHarnessRequest",
        "RenderPromptRequest",
        "ResolveSourcesRequest",
        "InspectSourceRuntimeRequest",
        "LifecycleMutationPolicy",
    )

    assert [fragment for fragment in forbidden_fragments if fragment in text] == []


def test_viewer_jobs_surface_stays_read_only():
    paths = (
        SRC_ROOT / "services/viewer/service.py",
        SRC_ROOT / "services/viewer/jobs.py",
        SRC_ROOT / "server/app.py",
    )
    forbidden_fragments = (
        "CancelRunRequest",
        "FinishRunRequest",
        "MarkRunRunningRequest",
        "QueueRunRequest",
        "RecordRunEventRequest",
        "StartRunRequest",
    )
    offenders = [
        f"{path.relative_to(SRC_ROOT)}:{fragment}"
        for path in paths
        for fragment in forbidden_fragments
        if fragment in path.read_text(encoding="utf-8")
    ]

    assert offenders == []


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
