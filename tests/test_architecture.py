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
    view_modules = (
        views,
        SRC_ROOT / "services/index/search_views.py",
        SRC_ROOT / "services/index/summary_views.py",
        SRC_ROOT / "services/index/page_views.py",
        SRC_ROOT / "services/index/topic_views.py",
        SRC_ROOT / "services/index/health_views.py",
    )
    views_text = views.read_text(encoding="utf-8")

    assert views.is_file()
    assert "search_pages(connection, request)" in store.read_text(encoding="utf-8")
    assert len(views_text.splitlines()) <= 40
    assert "codealmanac.services.index.search_views import search_pages" in views_text
    assert "codealmanac.services.index.summary_views import index_counts" in views_text
    assert "codealmanac.services.index.page_views import get_page_view" in views_text
    assert "codealmanac.services.index.topic_views import" in views_text
    assert "codealmanac.services.index.health_views import" in views_text
    for path in view_modules:
        text = path.read_text(encoding="utf-8")
        assert "load_page_document" not in text
        assert "apply_migrations" not in text
        assert "INSERT " not in text
        assert "DELETE " not in text
        assert "CREATE " not in text
        assert "DROP " not in text


def test_index_read_views_are_split_by_query_family():
    index_root = SRC_ROOT / "services/index"
    expected = {
        "views.py",
        "search_views.py",
        "summary_views.py",
        "page_views.py",
        "topic_views.py",
        "health_views.py",
    }
    oversized = []
    for path in expected:
        line_count = len((index_root / path).read_text(encoding="utf-8").splitlines())
        if line_count > 260:
            oversized.append(f"{path}:{line_count}")

    assert expected <= {path.name for path in index_root.glob("*.py")}
    assert oversized == []
    assert "fts_pages MATCH" in (index_root / "search_views.py").read_text(
        encoding="utf-8"
    )
    assert "PageView(" in (index_root / "page_views.py").read_text(encoding="utf-8")
    assert "IndexCounts(" in (index_root / "summary_views.py").read_text(
        encoding="utf-8"
    )
    assert "WITH RECURSIVE descendants" in (
        index_root / "topic_views.py"
    ).read_text(encoding="utf-8")
    assert "MissingSourceCitation" in (index_root / "health_views.py").read_text(
        encoding="utf-8"
    )


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


def test_codex_app_server_event_mapper_stays_split_by_responsibility():
    codex_root = SRC_ROOT / "integrations/harnesses/codex"
    expected_modules = {
        "actors.py",
        "agent_events.py",
        "events.py",
        "item_events.py",
        "result.py",
        "state.py",
    }
    module_names = {path.name for path in codex_root.glob("*.py")}
    oversized = []
    for module_name in expected_modules:
        line_count = len(
            (codex_root / module_name).read_text(encoding="utf-8").splitlines()
        )
        if line_count > 220:
            oversized.append(f"{module_name}:{line_count}")
    event_dispatch = (codex_root / "events.py").read_text(encoding="utf-8")
    dispatch_leaks = [
        fragment
        for fragment in (
            "import base64",
            "import binascii",
            "class CodexRunState",
            "from dataclasses",
            "dataclass",
            "codex_item_display",
            "tool_use_event",
            "HarnessAgentTrace",
            "HarnessToolStatus",
            "helper_label",
            "parse_codex_app_server_usage",
        )
        if fragment in event_dispatch
    ]

    assert expected_modules <= module_names
    assert oversized == []
    assert dispatch_leaks == []


def test_filesystem_source_runtime_stays_split_by_responsibility():
    filesystem_root = SRC_ROOT / "integrations/sources/filesystem"
    adapter = filesystem_root / "adapter.py"
    adapter_text = adapter.read_text(encoding="utf-8")
    module_names = {path.name for path in filesystem_root.glob("*.py")}
    forbidden_adapter_fragments = (
        "charset_normalizer",
        "GitIgnoreSpec",
        "field_validator",
        "parse_git_status_z",
        "def walk_files(",
        "def render_file_metadata(",
        "class FilesystemTextDocument",
    )

    assert {
        "adapter.py",
        "documents.py",
        "listing.py",
        "paths.py",
        "rendering.py",
        "selection.py",
    } <= module_names
    assert len(adapter_text.splitlines()) <= 220
    assert [
        fragment
        for fragment in forbidden_adapter_fragments
        if fragment in adapter_text
    ] == []


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


def test_sync_workflow_policy_stays_out_of_service_orchestration():
    service = SRC_ROOT / "workflows/sync/service.py"
    policy = SRC_ROOT / "workflows/sync/policy.py"
    service_text = service.read_text(encoding="utf-8")
    policy_text = policy.read_text(encoding="utf-8")

    forbidden_service_fragments = (
        "def evaluate_cursor(",
        "def reconcile_pending_entry(",
        "def pending_entry(",
        "def absorbed_entry(",
        "def failed_entry(",
        "def ledger_key(",
        "def sync_ingest_guidance(",
        "EMPTY_SHA256",
    )
    forbidden_policy_imports = (
        "codealmanac.integrations",
        "codealmanac.workflows.ingest",
        "codealmanac.workflows.run_queue",
        "codealmanac.services.sources.service",
        "codealmanac.services.runs.service",
        "codealmanac.services.workspaces.service",
    )

    assert policy.is_file()
    assert len(service_text.splitlines()) <= 320
    assert [
        fragment
        for fragment in forbidden_service_fragments
        if fragment in service_text
    ] == []
    assert [
        fragment
        for fragment in forbidden_policy_imports
        if fragment in policy_text
    ] == []


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


def test_run_id_validation_is_owned_by_runs_models():
    runs_models = (SRC_ROOT / "services/runs/models.py").read_text(encoding="utf-8")
    runs_requests = (SRC_ROOT / "services/runs/requests.py").read_text(
        encoding="utf-8"
    )
    runs_store = (SRC_ROOT / "services/runs/store.py").read_text(encoding="utf-8")
    runs_paths = (SRC_ROOT / "services/runs/paths.py").read_text(encoding="utf-8")
    viewer_requests = (SRC_ROOT / "services/viewer/requests.py").read_text(
        encoding="utf-8"
    )

    assert "RunId = Annotated[" in runs_models
    assert "StringConstraints" in runs_models
    assert "run_id: RunId" in runs_requests
    assert "TypeAdapter(RunId)" not in runs_store
    assert "TypeAdapter(RunId)" in runs_paths
    assert "run_id: RunId" in viewer_requests
    assert "SAFE_RUN_ID" not in viewer_requests


def test_run_ledger_persistence_stays_split_by_responsibility():
    runs_root = SRC_ROOT / "services/runs"
    module_names = {path.name for path in runs_root.glob("*.py")}
    store_text = (runs_root / "store.py").read_text(encoding="utf-8")
    io_text = (runs_root / "io.py").read_text(encoding="utf-8")
    locks_text = (runs_root / "locks.py").read_text(encoding="utf-8")
    transitions_text = (runs_root / "transitions.py").read_text(encoding="utf-8")
    forbidden_store_fragments = (
        "write_json_atomically",
        "model_validate_json",
        "worker_lock_owner_path",
        "os.kill",
        'open("a"',
        ".open(\"a\"",
        "RUN_ID_ADAPTER",
    )

    assert {"paths.py", "io.py", "locks.py", "transitions.py"} <= module_names
    assert len(store_text.splitlines()) <= 280
    assert [
        fragment for fragment in forbidden_store_fragments if fragment in store_text
    ] == []
    assert "write_json_atomically" in io_text
    assert "model_validate_json" in io_text
    assert "worker_lock_owner_path" in locks_text
    assert "process_is_alive" in locks_text
    assert "write_record_with_event" in transitions_text


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
