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


def test_app_composition_root_stays_scannable():
    app_path = SRC_ROOT / "app.py"
    tree = ast.parse(app_path.read_text(encoding="utf-8"))
    functions = {
        node.name: node
        for node in tree.body
        if isinstance(node, ast.FunctionDef)
    }
    create_app = functions["create_app"]

    assert create_app.end_lineno is not None
    assert create_app.end_lineno - create_app.lineno + 1 <= 40
    assert {
        "create_services",
        "create_operation",
        "create_workflows",
        "assemble_app",
    } <= set(functions)
    assert {
        "create_services",
        "create_workflows",
        "assemble_app",
    } <= {
        node.func.id
        for node in ast.walk(create_app)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }


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
        SRC_ROOT / "services/index/health_graph_views.py",
        SRC_ROOT / "services/index/health_source_views.py",
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
        "health_graph_views.py",
        "health_source_views.py",
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
    health_facade = (index_root / "health_views.py").read_text(encoding="utf-8")
    health_graph = (index_root / "health_graph_views.py").read_text(encoding="utf-8")
    health_sources = (index_root / "health_source_views.py").read_text(
        encoding="utf-8"
    )
    assert len(health_facade.splitlines()) <= 60
    assert "HealthReport(" in health_facade
    assert "connection.execute" not in health_facade
    assert "re.findall" not in health_facade
    assert "DeadFileReference" in health_graph
    assert "MissingSourceCitation" in health_sources


def test_index_store_keeps_write_side_responsibilities_split():
    index_root = SRC_ROOT / "services/index"
    store = (index_root / "store.py").read_text(encoding="utf-8")
    schema = (index_root / "schema.py").read_text(encoding="utf-8")
    sources = (index_root / "sources.py").read_text(encoding="utf-8")
    projection = (index_root / "projection.py").read_text(encoding="utf-8")

    assert len(store.splitlines()) <= 160
    assert "SCHEMA_DDL" not in store
    assert "SQLiteMigration" not in store
    assert "load_page_document" not in store
    assert "INSERT INTO pages" not in store
    assert "DELETE FROM fts_pages" not in store

    assert "SCHEMA_DDL" in schema
    assert "INDEX_MIGRATIONS" in schema
    assert "def connect_index" in schema
    assert "load_page_document" not in schema
    assert "INSERT INTO pages" not in schema

    assert "class LoadedIndexSources" in sources
    assert "def load_index_sources" in sources
    assert "load_page_document" in sources
    assert "load_topics_yaml" in sources
    assert "IndexSourceSignature(" in sources
    assert "INSERT INTO pages" not in sources

    assert "SOURCE_SIGNATURE_KEY" in projection
    assert "def stored_signature" in projection
    assert "def replace_documents" in projection
    assert "INSERT INTO pages" in projection
    assert "DELETE FROM fts_pages" in projection
    assert "load_page_document" not in projection
    assert "SCHEMA_DDL" not in projection


def test_active_python_model_has_no_page_archive_lineage():
    forbidden_fragments = (
        "archived_at",
        "superseded_by",
        "supersedes",
        "include_archive",
        '"--include-archive"',
        '"--archived"',
    )
    offenders = []
    for path in SRC_ROOT.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        found = [fragment for fragment in forbidden_fragments if fragment in text]
        if found:
            offenders.append(f"{path.relative_to(PROJECT_ROOT)}:{', '.join(found)}")

    assert offenders == []


def test_auto_commit_stays_prompt_policy_not_git_committer():
    forbidden_filenames = {
        "committer.py",
        "git_committer.py",
        "staging.py",
        "commit_service.py",
    }
    forbidden_commands = (
        '"git", "add"',
        "'git', 'add'",
        '"git", "commit"',
        "'git', 'commit'",
    )
    filename_offenders = []
    command_offenders = []
    for path in SRC_ROOT.rglob("*.py"):
        relative = path.relative_to(PROJECT_ROOT)
        if path.name in forbidden_filenames:
            filename_offenders.append(str(relative))
        text = path.read_text(encoding="utf-8")
        if any(fragment in text for fragment in forbidden_commands):
            command_offenders.append(str(relative))

    assert filename_offenders == []
    assert command_offenders == []


def test_serve_css_does_not_scale_type_with_viewport_width():
    css = (SRC_ROOT / "server/assets/app.css").read_text(encoding="utf-8")

    assert "clamp(" not in css
    assert "vw" not in css


def test_viewer_service_keeps_scope_and_projection_boundaries():
    viewer_root = SRC_ROOT / "services/viewer"
    service_text = (viewer_root / "service.py").read_text(encoding="utf-8")
    scope_text = (viewer_root / "repository_scope.py").read_text(encoding="utf-8")
    projections_text = (viewer_root / "projections.py").read_text(encoding="utf-8")

    assert {
        "projections.py",
        "repository_scope.py",
    } <= {path.name for path in viewer_root.glob("*.py")}
    assert len(service_text.splitlines()) <= 230
    assert "ViewerRepositoryScope(repositories)" in service_text
    assert [
        fragment
        for fragment in (
            "RepositoryStatus",
            "SelectRepositoryRequest",
            "def select_repository(",
            "def select_default_repository(",
            "def available_registered_repositories(",
            "ViewerRepository(",
            "ViewerTopicSummary(",
            "ViewerPageSource(",
            "SearchPageResult",
        )
        if fragment in service_text
    ] == []

    assert "RepositoryStatus.AVAILABLE" in scope_text
    assert "SelectRepositoryRequest(" in scope_text
    assert "def navigation(" in scope_text
    assert "def viewer_page_sources(" in projections_text
    assert "def page_summary_from_search(" in projections_text
    assert "def page_summary_from_view(" in projections_text


def test_repository_service_keeps_identity_selection_and_status_boundaries():
    repository_root = SRC_ROOT / "services/repositories"
    service_text = (repository_root / "service.py").read_text(encoding="utf-8")
    identity_text = (repository_root / "identity.py").read_text(encoding="utf-8")
    selection_text = (repository_root / "selection.py").read_text(encoding="utf-8")
    status_text = (repository_root / "status.py").read_text(encoding="utf-8")
    store_text = (repository_root / "store.py").read_text(encoding="utf-8")

    assert {
        "identity.py",
        "selection.py",
        "status.py",
    } <= {path.name for path in repository_root.glob("*.py")}
    assert len(service_text.splitlines()) <= 200
    assert [
        fragment
        for fragment in (
            "sha256",
            "to_kebab_case",
            "ConflictError",
            "RepositoryRecord",
            "RepositoryStatus",
            "is_initialized_almanac_root",
            "def entry_by_",
            "def select_database_entry(",
            "def explicit_selector_path(",
            "def is_path_selector(",
            "def containing_repository(",
            "def contains_path(",
            "def same_path(",
            "def repository_database_status(",
        )
        if fragment in service_text
    ] == []

    assert "def repository_name_for(" in identity_text
    assert "def repository_id_for(" in identity_text
    assert "sha256" in identity_text
    assert "def select_repository_record(" in selection_text
    assert "def containing_repository(" in selection_text
    assert "ConflictError" in selection_text
    assert "def repository_database_status(" in status_text
    assert "def available_database_entries(" in status_text
    assert "RepositoryStatus.AVAILABLE" in status_text
    assert "from codealmanac.services.repositories.service import" not in store_text


def test_topics_service_keeps_graph_and_repository_boundaries():
    topics_root = SRC_ROOT / "services/topics"
    service_text = (topics_root / "service.py").read_text(encoding="utf-8")
    mutations_text = (topics_root / "mutations.py").read_text(encoding="utf-8")
    graph_text = (topics_root / "graph.py").read_text(encoding="utf-8")
    read_model_text = (topics_root / "read_model.py").read_text(encoding="utf-8")
    repository_text = (topics_root / "repository.py").read_text(encoding="utf-8")
    forbidden_service_fragments = (
        "ConflictError",
        "ValidationFailed",
        "TopicMutationAction",
        "TopicDefinition",
        "SelectRepositoryRequest",
        "def existing_topic_slugs(",
        "def validate_parents_exist(",
        "def require_topics(",
        "def validate_not_self_parent(",
        "def reject_cycle(",
        "def ancestors_of(",
        "def resolve_repository(",
        "def resolve_topic_repository(",
        "existing_topic_slugs(",
        "validate_parents_exist(",
        "require_topics(",
        "validate_not_self_parent(",
        "reject_cycle(",
        "load_topics_file(",
        "title_for_slug(",
        "plan_page_topic_rewrites(",
        "apply_page_topic_rewrites(",
        "frontmatter_rewrite",
        "codealmanac.services.wiki.topics",
    )

    assert {"graph.py", "mutations.py", "read_model.py", "repository.py"} <= {
        path.name for path in topics_root.glob("*.py")
    }
    assert len(service_text.splitlines()) <= 90
    assert len(mutations_text.splitlines()) <= 260
    assert "TopicMutationExecutor(" in service_text
    assert "class TopicMutationExecutor" in mutations_text
    assert "load_topics_file(" in mutations_text
    assert "plan_page_topic_rewrites(" in mutations_text
    assert "apply_page_topic_rewrites(" in mutations_text
    assert "reject_cycle(" in mutations_text
    assert "existing_topic_slugs(" in mutations_text
    assert [
        fragment
        for fragment in forbidden_service_fragments
        if fragment in service_text
    ] == []
    assert "def reject_cycle(" in graph_text
    assert "def ancestors_of(" in graph_text
    assert "depth < 32" in graph_text
    assert "codealmanac.services.index" not in graph_text
    assert "codealmanac.services.repositories" not in graph_text
    assert "def existing_topic_slugs(" in read_model_text
    assert "IndexService" in read_model_text
    assert "def resolve_topic_repository(" in repository_text
    assert "SelectRepositoryRequest(" in repository_text
    assert "codealmanac.services.index" not in repository_text


def test_wiki_topics_yaml_stays_split_by_read_and_mutation():
    wiki_root = SRC_ROOT / "services/wiki"
    facade_text = (wiki_root / "topics.py").read_text(encoding="utf-8")
    models_text = (wiki_root / "topic_models.py").read_text(encoding="utf-8")
    read_text = (wiki_root / "topic_read.py").read_text(encoding="utf-8")
    file_text = (wiki_root / "topic_file.py").read_text(encoding="utf-8")
    forbidden_facade_fragments = (
        "class TopicDefinition",
        "class TopicsYamlFile",
        "def load_topics_yaml",
        "def load_topics_file",
        "CommentedMap",
        "YAML(",
        "safe_load",
    )

    assert {
        "topic_file.py",
        "topic_models.py",
        "topic_read.py",
    } <= {path.name for path in wiki_root.glob("*.py")}
    assert len(facade_text.splitlines()) <= 30
    assert len(models_text.splitlines()) <= 80
    assert len(read_text.splitlines()) <= 60
    assert len(file_text.splitlines()) <= 220
    assert [
        fragment for fragment in forbidden_facade_fragments if fragment in facade_text
    ] == []

    assert "class TopicDefinition" in models_text
    assert "class TopicsYaml" in models_text
    assert "def title_for_slug(" in models_text
    assert "safe_load" not in models_text
    assert "CommentedMap" not in models_text

    assert "pyyaml.safe_load" in read_text
    assert "TopicsYaml.model_validate" in read_text
    assert "CommentedMap" not in read_text

    assert "class TopicsYamlFile" in file_text
    assert "def load_topics_file(" in file_text
    assert "YAML(typ=\"rt\")" in file_text
    assert "CommentedMap" in file_text
    assert "pyyaml.safe_load" not in file_text


def test_harness_contract_models_stay_split_by_meaning():
    harness_root = SRC_ROOT / "services/harnesses"
    models_text = (harness_root / "models.py").read_text(encoding="utf-8")
    kinds_text = (harness_root / "kinds.py").read_text(encoding="utf-8")
    actors_text = (harness_root / "actors.py").read_text(encoding="utf-8")
    events_text = (harness_root / "events.py").read_text(encoding="utf-8")
    results_text = (harness_root / "results.py").read_text(encoding="utf-8")

    assert {
        "actors.py",
        "events.py",
        "kinds.py",
        "models.py",
        "results.py",
    } <= {path.name for path in harness_root.glob("*.py")}
    assert len(models_text.splitlines()) <= 50
    assert len(actors_text.splitlines()) <= 80
    assert len(events_text.splitlines()) <= 220
    assert len(results_text.splitlines()) <= 100
    assert "class " not in models_text
    assert "def " not in models_text
    assert "field_validator" not in models_text
    assert "JsonValue" not in models_text

    assert "class HarnessKind" in kinds_text
    assert "class HarnessRunStatus" in kinds_text
    assert "class HarnessRunActor" in actors_text
    assert "class HarnessActorRole" in actors_text
    assert "class HarnessEvent" in events_text
    assert "class HarnessUsage" in events_text
    assert "class HarnessFailure" in events_text
    assert "class HarnessRunResult" in results_text
    assert "def terminal_harness_event(" in results_text


def test_diagnostics_service_stays_facade():
    diagnostics_root = SRC_ROOT / "services/diagnostics"
    service_text = (diagnostics_root / "service.py").read_text(encoding="utf-8")
    install_text = (diagnostics_root / "install.py").read_text(encoding="utf-8")
    wiki_text = (diagnostics_root / "wiki.py").read_text(encoding="utf-8")
    messages_text = (diagnostics_root / "messages.py").read_text(encoding="utf-8")

    assert {
        "install.py",
        "messages.py",
        "service.py",
        "wiki.py",
    } <= {path.name for path in diagnostics_root.glob("*.py")}
    assert len(service_text.splitlines()) <= 80
    assert "install_checks(" in service_text
    assert "wiki_checks(" in service_text
    assert [
        fragment
        for fragment in (
            "CodeAlmanacError",
            "NotFoundError",
            "RepositoryStatus",
            "SelectRepositoryRequest",
            "HealthReport",
            "IndexSummary",
            "def _install",
            "def _wiki",
            "def _manual",
            "def _select",
            "def _index",
            "def _health",
            "def registered_check(",
            "def health_problem_count(",
            "def index_message(",
            "def first_line(",
        )
        if fragment in service_text
    ] == []

    assert "def install_checks(" in install_text
    assert "manual.inventory()" in install_text
    assert "repository_status(" not in install_text
    assert "def wiki_checks(" in wiki_text
    assert "repository_status(" not in wiki_text
    assert "health_report(" in wiki_text
    assert "manual.inventory()" not in wiki_text
    assert "def index_message(" in messages_text
    assert "def health_problem_count(" in messages_text


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
        "automation.py",
        "config.py",
        "diagnostics.py",
        "jobs.py",
        "lifecycle.py",
        "root.py",
        "setup.py",
        "updates.py",
        "wiki.py",
    }
    assert len(root.splitlines()) <= 80
    assert "add_lifecycle_commands(subcommands)" in root
    assert "add_wiki_commands(subcommands)" in root
    assert "add_admin_commands(subcommands)" in root
    assert "add_parser(" not in root


def test_cli_admin_parser_stays_split_by_command_family():
    parser_root = SRC_ROOT / "cli/parser"
    admin = (parser_root / "admin.py").read_text(encoding="utf-8")
    module_expectations = {
        "automation.py": ("AutomationTask", "def add_automation_commands("),
        "config.py": ('add_parser("config"', "def add_config_commands("),
        "diagnostics.py": ('add_parser("doctor"', "def add_diagnostics_commands("),
        "jobs.py": ('add_parser("jobs"', "def add_jobs_commands("),
        "setup.py": ('add_parser("setup"', "def add_setup_commands("),
        "updates.py": ('add_parser("update"', "def add_update_commands("),
    }
    forbidden_admin_fragments = (
        "AutomationTask",
        "add_argument",
        "choices=",
        'dest="jobs_command"',
        'dest="automation_command"',
        "--target",
        "--check",
        "--install-automation",
        "--keep-automation",
        "--keep-instructions",
    )
    oversized = []

    for module_name, fragments in module_expectations.items():
        text = (parser_root / module_name).read_text(encoding="utf-8")
        assert all(fragment in text for fragment in fragments)
        line_count = len(text.splitlines())
        if line_count > 100:
            oversized.append(f"{module_name}:{line_count}")

    assert len(admin.splitlines()) <= 80
    assert [
        fragment for fragment in forbidden_admin_fragments if fragment in admin
    ] == []
    assert "add_setup_commands(subcommands)" in admin
    assert "add_config_commands(subcommands)" in admin
    assert "add_diagnostics_commands(subcommands)" in admin
    assert "add_update_commands(subcommands)" in admin
    assert "add_jobs_commands(subcommands)" in admin
    assert "add_automation_commands(subcommands)" in admin
    assert oversized == []


def test_cli_has_separate_parser_dispatch_and_render_packages():
    cli_root = SRC_ROOT / "cli"

    assert (cli_root / "parser/root.py").is_file()
    assert (cli_root / "parser/automation.py").is_file()
    assert (cli_root / "parser/config.py").is_file()
    assert (cli_root / "parser/diagnostics.py").is_file()
    assert (cli_root / "parser/jobs.py").is_file()
    assert (cli_root / "parser/setup.py").is_file()
    assert (cli_root / "parser/updates.py").is_file()
    assert (cli_root / "dispatch/root.py").is_file()
    assert (cli_root / "dispatch/admin.py").is_file()
    assert (cli_root / "dispatch/automation.py").is_file()
    assert (cli_root / "dispatch/build.py").is_file()
    assert (cli_root / "dispatch/config.py").is_file()
    assert (cli_root / "dispatch/config_command.py").is_file()
    assert (cli_root / "dispatch/diagnostics.py").is_file()
    assert (cli_root / "dispatch/jobs.py").is_file()
    assert (cli_root / "dispatch/lifecycle.py").is_file()
    assert (cli_root / "dispatch/serve.py").is_file()
    assert (cli_root / "dispatch/setup.py").is_file()
    assert (cli_root / "dispatch/sync.py").is_file()
    assert (cli_root / "dispatch/topics.py").is_file()
    assert (cli_root / "dispatch/updates.py").is_file()
    assert (cli_root / "dispatch/wiki.py").is_file()
    assert (cli_root / "dispatch/worker.py").is_file()
    assert (cli_root / "dispatch/repositories.py").is_file()
    assert (cli_root / "render/root.py").is_file()
    assert (cli_root / "render/automation.py").is_file()
    assert (cli_root / "render/common.py").is_file()
    assert (cli_root / "render/config.py").is_file()
    assert (cli_root / "render/diagnostics.py").is_file()
    assert (cli_root / "render/health.py").is_file()
    assert (cli_root / "render/jobs.py").is_file()
    assert (cli_root / "render/lifecycle.py").is_file()
    assert (cli_root / "render/pages.py").is_file()
    assert (cli_root / "render/search.py").is_file()
    assert (cli_root / "render/tagging.py").is_file()
    assert (cli_root / "render/topics.py").is_file()
    assert (cli_root / "render/updates.py").is_file()
    assert (cli_root / "render/wiki.py").is_file()
    assert (cli_root / "render/repositories.py").is_file()
    assert (cli_root / "render/admin.py").is_file()


def test_cli_render_root_stays_facade():
    render_root = SRC_ROOT / "cli/render"
    root = (render_root / "root.py").read_text(encoding="utf-8")
    module_names = {path.name for path in render_root.glob("*.py")}
    forbidden_root_fragments = (
        "def render_",
        "def print_",
        "json.dumps",
        "sys.stderr",
        "argparse",
        "HealthReport",
        "IndexRefreshResult",
        "PageView",
        "SyncSummary",
        "RepositoryListResult",
    )

    assert {
        "admin.py",
        "automation.py",
        "common.py",
        "diagnostics.py",
        "lifecycle.py",
        "root.py",
        "health.py",
        "jobs.py",
        "pages.py",
        "search.py",
        "setup.py",
        "tagging.py",
        "topics.py",
        "updates.py",
        "wiki.py",
        "repositories.py",
    } <= module_names
    assert len(root.splitlines()) <= 80
    assert [
        fragment for fragment in forbidden_root_fragments if fragment in root
    ] == []
    assert "render_sync_status" in (render_root / "lifecycle.py").read_text(
        encoding="utf-8"
    )
    assert "render_page" in (render_root / "pages.py").read_text(encoding="utf-8")
    assert "render_repository_list" in (
        render_root / "repositories.py"
    ).read_text(encoding="utf-8")


def test_cli_admin_render_stays_split_by_output_family():
    render_path = SRC_ROOT / "cli/render"
    admin = (render_path / "admin.py").read_text(encoding="utf-8")
    module_expectations = {
        "automation.py": ("AutomationInstallResult", "def render_automation_install("),
        "brand.py": ("SETUP_BANNER", "def print_banner("),
        "config.py": ("ConfigSetResult", "def render_config_set("),
        "diagnostics.py": ("DoctorReport", "def render_doctor("),
        "jobs.py": ("RunRecord", "def render_runs("),
        "setup.py": ("SetupResult", "def render_setup_result("),
        "setup_panels.py": ("UninstallResult", "def render_uninstall_text("),
        "setup_screens.py": ("SetupChoiceScreen", "def render_setup_choice_screen("),
        "terminal.py": ("def visible_length(", "def wrap_with_prefixes("),
        "updates.py": ("UpdatePlan", "def render_update_plan("),
    }
    forbidden_admin_fragments = (
        "def render_",
        "json.dumps",
        "AutomationInstallResult",
        "DoctorReport",
        "RunRecord",
        "SetupResult",
        "UpdatePlan",
        "print(",
    )
    oversized = []

    for module_name, fragments in module_expectations.items():
        text = (render_path / module_name).read_text(encoding="utf-8")
        assert all(fragment in text for fragment in fragments)
        line_count = len(text.splitlines())
        if module_name == "setup.py":
            if line_count > 260:
                oversized.append(f"{module_name}:{line_count}")
        elif module_name == "setup_screens.py":
            if line_count > 200:
                oversized.append(f"{module_name}:{line_count}")
        elif line_count > 180:
            oversized.append(f"{module_name}:{line_count}")

    assert len(admin.splitlines()) <= 80
    assert [
        fragment for fragment in forbidden_admin_fragments if fragment in admin
    ] == []
    assert "from codealmanac.cli.render.automation import" in admin
    assert "from codealmanac.cli.render.config import render_config_set" in admin
    assert "from codealmanac.cli.render.jobs import" in admin
    assert oversized == []


def test_cli_wiki_render_stays_split_by_output_family():
    render_path = SRC_ROOT / "cli/render"
    wiki = (render_path / "wiki.py").read_text(encoding="utf-8")
    module_expectations = {
        "health.py": ("HealthReport", "def render_health("),
        "pages.py": ("PageView", "def render_page("),
        "search.py": ("SearchPageResult", "def render_search("),
        "tagging.py": ("TaggingResult", "def render_tagging("),
        "topics.py": ("TopicDetail", "def render_topics("),
    }
    forbidden_wiki_fragments = (
        "def render_",
        "argparse",
        "sys.stderr",
        "HealthReport",
        "IndexRefreshResult",
        "PageView",
        "SearchPageResult",
        "TaggingResult",
        "TopicDetail",
        "TopicMutationResult",
        "print(",
    )
    oversized = []

    for module_name, fragments in module_expectations.items():
        text = (render_path / module_name).read_text(encoding="utf-8")
        assert all(fragment in text for fragment in fragments)
        line_count = len(text.splitlines())
        if line_count > 140:
            oversized.append(f"{module_name}:{line_count}")

    assert len(wiki.splitlines()) <= 80
    assert [
        fragment for fragment in forbidden_wiki_fragments if fragment in wiki
    ] == []
    assert "from codealmanac.cli.render.health import render_health" in wiki
    assert "from codealmanac.cli.render.pages import render_page" in wiki
    assert oversized == []


def test_cli_dispatch_edge_is_split_by_command_domain():
    dispatch_path = SRC_ROOT / "cli/dispatch"
    dispatch_root = (dispatch_path / "root.py").read_text(encoding="utf-8")
    dispatch_wiki = (dispatch_path / "wiki.py").read_text(encoding="utf-8")
    dispatch_topics = (dispatch_path / "topics.py").read_text(encoding="utf-8")
    dispatch_repositories = (dispatch_path / "repositories.py").read_text(
        encoding="utf-8"
    )
    dispatch_serve = (dispatch_path / "serve.py").read_text(encoding="utf-8")
    render_root = (SRC_ROOT / "cli/render/root.py").read_text(encoding="utf-8")
    forbidden_wiki_fragments = (
        "CreateTopicRequest",
        "DeleteTopicRequest",
        "DescribeTopicRequest",
        "LinkTopicRequest",
        "ListTopicsRequest",
        "RenameTopicRequest",
        "ShowTopicRequest",
        "UnlinkTopicRequest",
        "DropRepositoryRequest",
        "uvicorn",
        "create_server_app",
    )

    assert len(dispatch_root.splitlines()) <= 80
    assert len(dispatch_wiki.splitlines()) <= 130
    assert "dispatch_lifecycle(args, app)" in dispatch_root
    assert "dispatch_wiki(args, app)" in dispatch_root
    assert "dispatch_admin(args, app)" in dispatch_root
    assert "IngestRequest" not in dispatch_root
    assert "SearchPagesRequest" not in dispatch_root
    assert "AutomationStatusRequest" not in dispatch_root
    assert "DoctorRequest" not in dispatch_root
    assert "UpdateStatus" not in dispatch_root
    assert "RunUpdateRequest" not in dispatch_root
    assert "DoctorReport" not in render_root
    assert "UpdatePlan" not in render_root
    assert "RunRecord" not in render_root
    assert [
        fragment for fragment in forbidden_wiki_fragments if fragment in dispatch_wiki
    ] == []
    assert "dispatch_topics(args, app)" in dispatch_wiki
    assert "dispatch_repositories(args, app)" in dispatch_wiki
    assert "run_serve(app, args)" in dispatch_wiki
    assert "CreateTopicRequest" in dispatch_topics
    assert "ListTopicsRequest" in dispatch_topics
    assert "DropRepositoryRequest" in dispatch_repositories
    assert "create_server_app" in dispatch_serve


def test_cli_admin_dispatch_stays_split_by_command_family():
    dispatch_path = SRC_ROOT / "cli/dispatch"
    admin = (dispatch_path / "admin.py").read_text(encoding="utf-8")
    module_expectations = {
        "automation.py": ("InstallAutomationRequest", "def dispatch_automation("),
        "config_command.py": ("SetConfigValueRequest", "def dispatch_config("),
        "diagnostics.py": ("DoctorRequest", "def dispatch_doctor("),
        "jobs.py": ("ShowRunRequest", "def dispatch_jobs("),
        "setup.py": ("RunSetupRequest", "def dispatch_setup("),
        "updates.py": ("RunUpdateRequest", "def dispatch_update("),
    }
    forbidden_admin_fragments = (
        "RunSetupRequest",
        "RunUninstallRequest",
        "DoctorRequest",
        "CheckUpdateRequest",
        "RunUpdateRequest",
        "ShowRunRequest",
        "InstallAutomationRequest",
        "parse_optional_duration",
        "load_cli_config",
        "parse_setup_targets",
        "parse_automation_tasks",
        "render_",
    )
    oversized = []

    for module_name, fragments in module_expectations.items():
        text = (dispatch_path / module_name).read_text(encoding="utf-8")
        assert all(fragment in text for fragment in fragments)
        line_count = len(text.splitlines())
        if line_count > 140:
            oversized.append(f"{module_name}:{line_count}")

    assert len(admin.splitlines()) <= 80
    assert [
        fragment for fragment in forbidden_admin_fragments if fragment in admin
    ] == []
    assert "dispatch_setup(args, app)" in admin
    assert "dispatch_uninstall(args, app)" in admin
    assert "dispatch_config(args, app)" in admin
    assert "dispatch_jobs(args, app)" in admin
    assert "dispatch_automation(args, app)" in admin
    assert oversized == []


def test_setup_instruction_adapter_stays_split_by_target_family():
    setup_root = SRC_ROOT / "integrations/setup"
    instructions = (setup_root / "instructions.py").read_text(encoding="utf-8")
    codex = (setup_root / "codex.py").read_text(encoding="utf-8")
    claude = (setup_root / "claude.py").read_text(encoding="utf-8")
    managed_blocks = (setup_root / "managed_blocks.py").read_text(encoding="utf-8")
    guide = (setup_root / "guide.py").read_text(encoding="utf-8")

    assert {
        "instructions.py",
        "codex.py",
        "claude.py",
        "managed_blocks.py",
        "guide.py",
        "text_files.py",
    } <= {path.name for path in setup_root.glob("*.py")}
    assert len(instructions.splitlines()) <= 80
    assert "class FileInstructionInstaller" in instructions
    assert "install_codex_instructions" in instructions
    assert "install_claude_instructions" in instructions
    assert "resources.files" not in instructions
    assert "write_text" not in instructions
    assert "read_text" not in instructions
    assert "unlink(" not in instructions
    assert "contents.find" not in instructions

    assert "resolve_codex_agents_path" in codex
    assert "AGENTS.override.md" in codex
    assert "CLAUDE.md" not in codex
    assert "CLAUDE_IMPORT_LINE" in claude
    assert "codealmanac.md" in claude
    assert "AGENTS.override.md" not in claude
    assert "CODEALMANAC_START" in managed_blocks
    assert "def upsert_managed_block" in managed_blocks
    assert "resources.files" in guide


def test_setup_service_stays_split_from_planning_and_automation_policy():
    setup_root = SRC_ROOT / "services/setup"
    service = (setup_root / "service.py").read_text(encoding="utf-8")
    planning = (setup_root / "planning.py").read_text(encoding="utf-8")
    automation = (setup_root / "automation.py").read_text(encoding="utf-8")

    assert {
        "service.py",
        "planning.py",
        "automation.py",
    } <= {path.name for path in setup_root.glob("*.py")}
    assert len(service.splitlines()) <= 110
    assert "class SetupService" in service
    assert "setup_plan(request)" in service
    assert "install_automation_request(request)" in service
    assert "duration_text" not in service
    assert "DEFAULT_SYNC_INTERVAL" not in service
    assert "SetupAutomationRecommendation" not in service
    assert "def automation_recommendations" not in service
    assert "def should_install_automation" not in service
    assert "def install_automation_request" not in service

    assert "def setup_plan" in planning
    assert "def automation_recommendations" in planning
    assert "def next_commands" in planning
    assert "SetupAutomationRecommendation" in planning
    assert "UninstallAutomationRequest" not in planning
    assert "def should_install_automation" in automation
    assert "def install_automation_request" in automation
    assert "InstallAutomationRequest" in automation


def test_cli_lifecycle_dispatch_stays_split_by_command_family():
    dispatch_path = SRC_ROOT / "cli/dispatch"
    lifecycle = (dispatch_path / "lifecycle.py").read_text(encoding="utf-8")
    module_expectations = {
        "build.py": ("InitializeRepositoryRequest", "def dispatch_build("),
        "operations.py": ("IngestRequest", "def dispatch_ingest("),
        "sync.py": ("SyncRequest", "def dispatch_sync("),
        "worker.py": ("DrainRunQueueRequest", "def dispatch_run_worker("),
    }
    forbidden_lifecycle_fragments = (
        "InitializeRepositoryRequest",
        "IngestRequest",
        "RunGardenRequest",
        "SyncRequest",
        "SyncStatusRequest",
        "DrainRunQueueRequest",
        "TranscriptApp",
        "ValidationFailed",
        "load_cli_config",
        "resolve_harness",
        "parse_sync_apps",
        "sync_queue",
        "render_",
    )
    oversized = []

    for module_name, fragments in module_expectations.items():
        text = (dispatch_path / module_name).read_text(encoding="utf-8")
        assert all(fragment in text for fragment in fragments)
        line_count = len(text.splitlines())
        if line_count > 140:
            oversized.append(f"{module_name}:{line_count}")

    assert len(lifecycle.splitlines()) <= 80
    assert [
        fragment
        for fragment in forbidden_lifecycle_fragments
        if fragment in lifecycle
    ] == []
    assert "dispatch_init(args, app)" in lifecycle
    assert "dispatch_ingest(args, app)" in lifecycle
    assert "dispatch_garden(args, app)" in lifecycle
    assert "dispatch_sync(args, app)" in lifecycle
    assert "dispatch_run_worker(args, app)" in lifecycle
    assert oversized == []


def test_cli_dispatch_files_stay_small():
    oversized = []
    for path in (SRC_ROOT / "cli/dispatch").glob("*.py"):
        line_count = len(path.read_text(encoding="utf-8").splitlines())
        if line_count > 250:
            oversized.append(f"{path.name}:{line_count}")

    assert oversized == []


def test_operation_runner_owns_shared_lifecycle_execution():
    operation_service = SRC_ROOT / "workflows/operations/service.py"
    lifecycle = SRC_ROOT / "workflows/lifecycle.py"
    lifecycle_harness = SRC_ROOT / "workflows/lifecycle_harness.py"
    lifecycle_mutation = SRC_ROOT / "workflows/lifecycle_mutation.py"
    operation_text = operation_service.read_text(encoding="utf-8")
    lifecycle_text = lifecycle.read_text(encoding="utf-8")
    lifecycle_harness_text = lifecycle_harness.read_text(encoding="utf-8")
    lifecycle_mutation_text = lifecycle_mutation.read_text(encoding="utf-8")

    assert operation_service.is_file()
    assert lifecycle_harness.is_file()
    assert lifecycle_mutation.is_file()
    assert "RunHarnessRequest" in operation_text
    assert "RecordRunHarnessTranscriptRequest" in operation_text
    assert "validate_harness_result" in operation_text
    assert len(lifecycle_text.splitlines()) <= 40
    assert "from codealmanac.workflows.lifecycle_harness import" in lifecycle_text
    assert "from codealmanac.workflows.lifecycle_mutation import" in lifecycle_text
    assert "class LifecycleMutationPolicy" not in lifecycle_text
    assert "def validate_harness_result(" not in lifecycle_text
    assert "def changed_paths(" not in lifecycle_text
    assert "class LifecycleMutationPolicy" in lifecycle_mutation_text
    assert "def changed_paths(" in lifecycle_mutation_text
    assert "def validate_reported_changes(" in lifecycle_mutation_text
    assert "def validate_harness_result(" in lifecycle_harness_text
    assert "def harness_run_event_kind(" in lifecycle_harness_text

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
        SRC_ROOT / "workflows/operations/service.py",
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
        "notification_events.py",
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
            "HarnessEventKind",
            "HarnessToolStatus",
            "failure_from_error_record",
            "helper_label",
            "parse_codex_app_server_usage",
            "record_failure",
        )
        if fragment in event_dispatch
    ]

    assert expected_modules <= module_names
    assert oversized == []
    assert dispatch_leaks == []


def test_codex_app_server_client_stays_transport_focused():
    codex_root = SRC_ROOT / "integrations/harnesses/codex"
    app_server = codex_root / "app_server.py"
    app_server_text = app_server.read_text(encoding="utf-8")
    expected_modules = {
        "responses.py",
        "sandbox.py",
        "turn_completion.py",
        "run_result.py",
        "timeouts.py",
    }
    forbidden_fragments = (
        "class ServerResponse",
        "def noninteractive_response(",
        "def sandbox_policy(",
        "def root_turn_completion(",
        "def result_from_state(",
        "def failed_result(",
        "def env_milliseconds(",
        "CODEX_APP_SERVER_SANDBOX_MODE_ENV",
    )

    assert expected_modules <= {path.name for path in codex_root.glob("*.py")}
    assert len(app_server_text.splitlines()) <= 260
    assert [
        fragment for fragment in forbidden_fragments if fragment in app_server_text
    ] == []


def test_filesystem_source_runtime_stays_split_by_responsibility():
    filesystem_root = SRC_ROOT / "integrations/sources/filesystem"
    adapter = filesystem_root / "adapter.py"
    adapter_text = adapter.read_text(encoding="utf-8")
    listing_text = (filesystem_root / "listing.py").read_text(encoding="utf-8")
    git_text = (filesystem_root / "git.py").read_text(encoding="utf-8")
    ignore_text = (filesystem_root / "ignore.py").read_text(encoding="utf-8")
    walk_text = (filesystem_root / "walk.py").read_text(encoding="utf-8")
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
        "git.py",
        "ignore.py",
        "listing.py",
        "paths.py",
        "rendering.py",
        "selection.py",
        "walk.py",
    } <= module_names
    assert len(adapter_text.splitlines()) <= 220
    assert [
        fragment
        for fragment in forbidden_adapter_fragments
        if fragment in adapter_text
    ] == []
    assert len(listing_text.splitlines()) <= 110
    assert [
        fragment
        for fragment in (
            "GitIgnoreSpec",
            "subprocess",
            "def walk_files(",
            "def parse_git_status_z(",
            "DEFAULT_IGNORE_PATTERNS",
            "def git_repo_root(",
        )
        if fragment in listing_text
    ] == []
    assert "def parse_git_status_z(" in git_text
    assert "def git_directory_candidates(" in git_text
    assert "DEFAULT_IGNORE_PATTERNS" in ignore_text
    assert "def ignore_spec_for(" in ignore_text
    assert "def walk_files(" in walk_text


def test_github_source_runtime_stays_split_by_responsibility():
    github_root = SRC_ROOT / "integrations/sources/github"
    adapter = github_root / "adapter.py"
    adapter_text = adapter.read_text(encoding="utf-8")
    module_names = {path.name for path in github_root.glob("*.py")}
    forbidden_adapter_fragments = (
        "BaseModel",
        "ConfigDict",
        "Field(",
        "SubprocessCommandRunner",
        "surface_process_error",
        "def github_target_args(",
        "def render_pull_request_metadata(",
        "def render_comments(",
        "PULL_REQUEST_FIELDS",
        "ISSUE_FIELDS",
    )

    assert {
        "adapter.py",
        "client.py",
        "errors.py",
        "models.py",
        "rendering.py",
        "targets.py",
    } <= module_names
    assert len(adapter_text.splitlines()) <= 120
    assert [
        fragment for fragment in forbidden_adapter_fragments if fragment in adapter_text
    ] == []
    assert "class GitHubPullRequestPayload" in (github_root / "models.py").read_text(
        encoding="utf-8"
    )
    assert "class GitHubClient" in (github_root / "client.py").read_text(
        encoding="utf-8"
    )
    assert "def github_target_args(" in (github_root / "targets.py").read_text(
        encoding="utf-8"
    )
    assert "def render_pull_request_runtime(" in (
        github_root / "rendering.py"
    ).read_text(encoding="utf-8")


def test_web_source_runtime_stays_split_by_responsibility():
    web_root = SRC_ROOT / "integrations/sources/web"
    adapter = web_root / "adapter.py"
    adapter_text = adapter.read_text(encoding="utf-8")
    module_names = {path.name for path in web_root.glob("*.py")}
    forbidden_adapter_fragments = (
        "BeautifulSoup",
        "CodeAlmanacModel",
        "field_validator",
        "def fetch_with_client(",
        "def read_bounded_response(",
        "def parse_web_response(",
        "def parse_html_document(",
        "def normalized_text(",
        "def render_metadata(",
        "source_runtime_section",
    )

    assert {
        "adapter.py",
        "client.py",
        "documents.py",
        "errors.py",
        "models.py",
        "rendering.py",
    } <= module_names
    assert len(adapter_text.splitlines()) <= 120
    assert [
        fragment for fragment in forbidden_adapter_fragments if fragment in adapter_text
    ] == []
    assert "class FetchedWebResponse" in (web_root / "models.py").read_text(
        encoding="utf-8"
    )
    assert "def fetch_with_client(" in (web_root / "client.py").read_text(
        encoding="utf-8"
    )
    assert "BeautifulSoup" in (web_root / "documents.py").read_text(encoding="utf-8")
    assert "def render_web_runtime(" in (web_root / "rendering.py").read_text(
        encoding="utf-8"
    )
    assert "def unavailable_runtime(" in (web_root / "errors.py").read_text(
        encoding="utf-8"
    )


def test_transcript_source_runtime_stays_split_by_responsibility():
    transcripts_root = SRC_ROOT / "integrations/sources/transcripts"
    runtime = transcripts_root / "runtime.py"
    runtime_text = runtime.read_text(encoding="utf-8")
    module_names = {path.name for path in transcripts_root.glob("*.py")}
    forbidden_runtime_fragments = (
        "JsonValue",
        "ValidationError",
        "jsonlines",
        "Field(",
        "field_validator",
        "TranscriptJsonLine",
        "def read_jsonl_object(",
        "def transcript_entry(",
        "def entry_from_payload(",
        "def render_json_text(",
        "def bounded_tail_text(",
    )

    assert {
        "entries.py",
        "errors.py",
        "models.py",
        "paths.py",
        "reader.py",
        "rendering.py",
        "runtime.py",
    } <= module_names
    assert len(runtime_text.splitlines()) <= 100
    assert [
        fragment
        for fragment in forbidden_runtime_fragments
        if fragment in runtime_text
    ] == []
    assert "class TranscriptJsonLine" in (
        transcripts_root / "models.py"
    ).read_text(encoding="utf-8")
    assert "def transcript_entry(" in (
        transcripts_root / "entries.py"
    ).read_text(encoding="utf-8")
    assert "def read_transcript_entries(" in (
        transcripts_root / "reader.py"
    ).read_text(encoding="utf-8")
    assert "def render_transcript_runtime(" in (
        transcripts_root / "rendering.py"
    ).read_text(encoding="utf-8")


def test_sources_service_stays_orchestration_only():
    sources_root = SRC_ROOT / "services/sources"
    service_text = (sources_root / "service.py").read_text(encoding="utf-8")
    address_text = (sources_root / "address_resolution.py").read_text(
        encoding="utf-8"
    )
    module_names = {path.name for path in sources_root.glob("*.py")}
    forbidden_service_fragments = (
        "urlsplit",
        "AnyHttpUrl",
        "sha256",
        "HTTP_URL_ADAPTER",
        "def resolve_github_shorthand(",
        "def resolve_git_range(",
        "def resolve_url(",
        "def resolve_path(",
        "def file_fingerprint(",
        "PULL_REQUEST_PROMPT_HINT",
    )
    forbidden_address_facade_fragments = (
        "AnyHttpUrl",
        "sha256",
        "HTTP_URL_ADAPTER",
        "PULL_REQUEST_PROMPT_HINT",
        "def resolve_github_shorthand(",
        "def parse_github_url(",
        "def resolve_git_range(",
        "def resolve_url(",
        "def resolve_path(",
        "def file_fingerprint(",
        "def parse_positive_int(",
    )
    forbidden_address_runtime_fragments = (
        "SourceRuntimeAdapter",
        "TranscriptDiscoveryAdapter",
        "DiscoverTranscriptsRequest",
        "InspectSourceRuntimeRequest",
        "SourceRuntimeStatus",
    )

    assert {
        "address_git.py",
        "address_github.py",
        "address_hints.py",
        "address_numbers.py",
        "address_path.py",
        "address_transcript.py",
        "address_web.py",
    } <= module_names
    assert len(service_text.splitlines()) <= 90
    assert len(address_text.splitlines()) <= 45
    assert (sources_root / "address_resolution.py").is_file()
    assert (sources_root / "transcripts.py").is_file()
    assert [
        fragment
        for fragment in forbidden_service_fragments
        if fragment in service_text
    ] == []
    assert [
        fragment
        for fragment in (
            *forbidden_address_facade_fragments,
            *forbidden_address_runtime_fragments,
        )
        if fragment in address_text
    ] == []
    assert "def resolve_address(" in address_text
    assert "def resolve_github_shorthand(" in (
        sources_root / "address_github.py"
    ).read_text(encoding="utf-8")
    assert "def resolve_git_range(" in (sources_root / "address_git.py").read_text(
        encoding="utf-8"
    )
    assert "AnyHttpUrl" in (sources_root / "address_web.py").read_text(
        encoding="utf-8"
    )
    assert "sha256" in (sources_root / "address_path.py").read_text(
        encoding="utf-8"
    )
    assert "TRANSCRIPT_PROMPT_HINT" in (
        sources_root / "address_transcript.py"
    ).read_text(encoding="utf-8")
    assert "def transcript_sort_key(" in (
        sources_root / "transcripts.py"
    ).read_text(encoding="utf-8")


def test_automation_service_keeps_selection_and_job_construction_boundaries():
    automation_root = SRC_ROOT / "services/automation"
    service_text = (automation_root / "service.py").read_text(encoding="utf-8")
    definitions_text = (automation_root / "definitions.py").read_text(
        encoding="utf-8"
    )
    jobs_text = (automation_root / "jobs.py").read_text(encoding="utf-8")
    selection_text = (automation_root / "selection.py").read_text(encoding="utf-8")
    forbidden_service_fragments = (
        "AutomationTaskDefinition",
        "DEFAULT_SYNC_INTERVAL",
        "DEFAULT_GARDEN_INTERVAL",
        "LAUNCHD_FALLBACK_PATHS",
        "AUTOMATION_SYNC_CLAIM_OWNER",
        "duration_text(",
        "ValidationFailed",
        "EnvironmentVariable(",
        "program_arguments_for(",
        "plist_path_for(",
        "launch_path(",
        "interval_for(",
        "selected_tasks(",
        "task_definition(",
        "state_dir_for(",
        "sys.executable",
        "os.environ",
        "def _job_for_task(",
    )

    assert {"definitions.py", "jobs.py", "selection.py"} <= {
        path.name for path in automation_root.glob("*.py")
    }
    assert len(service_text.splitlines()) <= 110
    assert [
        fragment
        for fragment in forbidden_service_fragments
        if fragment in service_text
    ] == []
    assert "class AutomationTaskDefinition" in definitions_text
    assert "def task_definition(" in definitions_text
    assert "class AutomationJobFactory" in jobs_text
    assert "def program_arguments_for(" in jobs_text
    assert "def launch_path(" in jobs_text
    assert "logs_dir_for(" in jobs_text
    assert "class InstallTaskSelection" in selection_text
    assert "def install_task_selection(" in selection_text
    assert "ValidationFailed" in selection_text


def test_run_queue_stays_operation_dispatch_only():
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
    sync_root = SRC_ROOT / "workflows/sync"
    evaluation = sync_root / "evaluation.py"
    policy = sync_root / "policy.py"
    policy_modules = tuple(
        path
        for path in (
            policy,
            sync_root / "guidance.py",
            sync_root / "reporting.py",
        )
        if path.is_file()
    )
    service_text = service.read_text(encoding="utf-8")
    evaluation_text = evaluation.read_text(encoding="utf-8")
    policy_text = policy.read_text(encoding="utf-8")
    combined_policy_text = "\n".join(
        path.read_text(encoding="utf-8") for path in policy_modules
    )

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
    forbidden_service_evaluation_fragments = (
        "DiscoverTranscriptsRequest",
        "ListRunsRequest",
        "SelectRepositoryRequest",
        "SyncReady(",
        "SyncWorkItem(",
        "read_transcript(",
        "quiet_window_skip(",
        "evaluate_pending_run(",
    )
    forbidden_policy_imports = (
        "codealmanac.integrations",
        "codealmanac.workflows.ingest",
        "codealmanac.workflows.run_queue",
        "codealmanac.services.sources.service",
        "codealmanac.services.runs.service",
        "codealmanac.services.repositories.service",
    )

    assert evaluation.is_file()
    assert all(path.is_file() for path in policy_modules)
    assert len(service_text.splitlines()) <= 120
    assert "SyncEvaluator(" in service_text
    assert "class SyncEvaluator" in evaluation_text
    assert "DiscoverTranscriptsRequest" in evaluation_text
    assert "ListRunsRequest" in evaluation_text
    assert "SelectRepositoryRequest" in evaluation_text
    assert [
        fragment
        for fragment in forbidden_service_evaluation_fragments
        if fragment in service_text
    ] == []
    assert len(policy_text.splitlines()) <= 80
    assert [
        fragment
        for fragment in forbidden_service_fragments
        if fragment in service_text
    ] == []
    assert [
        fragment
        for fragment in forbidden_policy_imports
        if fragment in combined_policy_text
    ] == []
    assert "from codealmanac.workflows.sync.decisions import" in policy_text
    assert "from codealmanac.workflows.sync.entries import" in policy_text
    assert "from codealmanac.workflows.sync.guidance import" in policy_text
    assert "from codealmanac.workflows.sync.identity import" in policy_text
    assert "from codealmanac.workflows.sync.reporting import" in policy_text
    assert "from codealmanac.workflows.sync.snapshots import" in policy_text
    assert "def evaluate_cursor(" in (
        sync_root / "decisions.py"
    ).read_text(encoding="utf-8")
    assert "def pending_entry(" in (sync_root / "entries.py").read_text(
        encoding="utf-8"
    )
    assert "def ledger_key(" in (sync_root / "identity.py").read_text(
        encoding="utf-8"
    )
    assert "def read_transcript(" in (sync_root / "snapshots.py").read_text(
        encoding="utf-8"
    )
    assert "def sync_ingest_guidance(" in (sync_root / "guidance.py").read_text(
        encoding="utf-8"
    )
    assert "def sync_started(" in (sync_root / "reporting.py").read_text(
        encoding="utf-8"
    )


def test_sync_queue_effects_stay_out_of_service_orchestration():
    sync_root = SRC_ROOT / "workflows/sync"
    service_text = (sync_root / "service.py").read_text(encoding="utf-8")
    evaluation_text = (sync_root / "evaluation.py").read_text(encoding="utf-8")
    queue_text = (sync_root / "queue.py").read_text(encoding="utf-8")
    forbidden_service_fragments = (
        "IngestRequest",
        "StartedIngestRequest",
        "FinishRunRequest",
        "RunStatus.FAILED",
        "pending_entry(item",
        "failed_entry(",
        "absorbed_entry(",
        "sync_ingest_guidance(",
        "sync_ingest_title(",
        "queue_ingest(",
        "spawn_worker(",
        "run_started(",
    )
    forbidden_evaluation_fragments = (
        "IngestRequest",
        "StartedIngestRequest",
        "FinishRunRequest",
        "RunStatus.FAILED",
        "queue_ingest(",
        "spawn_worker(",
        "run_started(",
    )

    assert (sync_root / "queue.py").is_file()
    assert len(service_text.splitlines()) <= 120
    assert [
        fragment
        for fragment in forbidden_service_fragments
        if fragment in service_text
    ] == []
    assert [
        fragment
        for fragment in forbidden_evaluation_fragments
        if fragment in evaluation_text
    ] == []
    assert "class SyncIngestQueue" in queue_text
    assert "IngestRequest" in queue_text
    assert "queue_ingest(" in queue_text
    assert "spawn_worker(" in queue_text
    assert "record_completed(" in queue_text


def test_viewer_jobs_surface_stays_read_only():
    paths = (
        SRC_ROOT / "services/viewer/service.py",
        SRC_ROOT / "services/viewer/jobs.py",
        SRC_ROOT / "server/app.py",
        SRC_ROOT / "server/api_routes.py",
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


def test_server_app_stays_composition_root():
    server_root = SRC_ROOT / "server"
    app_text = (server_root / "app.py").read_text(encoding="utf-8")
    api_text = (server_root / "api_routes.py").read_text(encoding="utf-8")
    static_routes_text = (server_root / "static_routes.py").read_text(
        encoding="utf-8"
    )
    static_assets_text = (server_root / "static_assets.py").read_text(
        encoding="utf-8"
    )
    errors_text = (server_root / "errors.py").read_text(encoding="utf-8")
    forbidden_app_fragments = (
        "@server.get",
        "resources.files",
        "HTTPException",
        "JSONResponse",
        "ValidationError",
        "CodeAlmanacError",
        "ViewerOverviewRequest",
        "StaticAssetRequest",
        "read_asset_text",
    )

    assert len(app_text.splitlines()) <= 40
    assert [
        fragment for fragment in forbidden_app_fragments if fragment in app_text
    ] == []
    assert "register_error_handlers(server)" in app_text
    assert "register_api_routes(" in app_text
    assert "register_static_routes(server)" in app_text

    assert "@server.get(\"/api/overview\"" in api_text
    assert "ViewerOverviewRequest(" in api_text
    assert "context.codealmanac.viewer" in api_text
    assert "resources.files" not in api_text
    assert "CodeAlmanacError" not in api_text

    assert "@server.get(\"/assets/{asset_path:path}\"" in static_routes_text
    assert "asset_response(asset_path)" in static_routes_text
    assert "ViewerOverviewRequest" not in static_routes_text

    assert "class StaticAssetRequest" in static_assets_text
    assert "resources.files(\"codealmanac.server.assets\")" in static_assets_text
    assert "ViewerOverviewRequest" not in static_assets_text

    assert "CodeAlmanacError" in errors_text
    assert "ValidationError" in errors_text
    assert "ViewerOverviewRequest" not in errors_text


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
    factory_text = (runs_root / "factory.py").read_text(encoding="utf-8")
    io_text = (runs_root / "io.py").read_text(encoding="utf-8")
    locks_text = (runs_root / "locks.py").read_text(encoding="utf-8")
    queries_text = (runs_root / "queries.py").read_text(encoding="utf-8")
    service_text = (runs_root / "service.py").read_text(encoding="utf-8")
    streaming_text = (runs_root / "streaming.py").read_text(encoding="utf-8")
    transitions_text = (runs_root / "transitions.py").read_text(encoding="utf-8")
    forbidden_store_fragments = (
        "write_json_atomically",
        "model_validate_json",
        "worker_lock_owner_path",
        "os.kill",
        "time.sleep",
        'open("a"',
        ".open(\"a\"",
        "RUN_ID_ADAPTER",
        "uuid4",
        "strftime",
        "run_log_reference_path",
        "key=lambda record",
        "ledger.iter_records",
    )

    assert {
        "factory.py",
        "io.py",
        "locks.py",
        "paths.py",
        "queries.py",
        "streaming.py",
        "transitions.py",
    } <= module_names
    assert len(store_text.splitlines()) <= 240
    assert [
        fragment for fragment in forbidden_store_fragments if fragment in store_text
    ] == []
    assert "def new_run_record(" in factory_text
    assert "uuid4" in factory_text
    assert "run_log_reference_path" in factory_text
    assert "write_json_atomically" in io_text
    assert "model_validate_json" in io_text
    assert "RunWorkerLease" in locks_text
    assert "process_is_alive" in locks_text
    assert "def list_run_records(" in queries_text
    assert "def next_spec_backed_queued_run(" in queries_text
    assert "ledger.iter_records" in queries_text
    assert "def stream_attach(" in service_text
    assert "class RunAttachStreamer" in streaming_text
    assert "time.sleep" in streaming_text
    assert "store.attach" in streaming_text
    assert "write_record_with_event" in transitions_text


def test_repo_almanac_root_is_repository_owned():
    from codealmanac.services.repositories.roots import DEFAULT_ALMANAC_ROOT

    core_paths = (SRC_ROOT / "core/paths.py").read_text(encoding="utf-8")

    assert Path("almanac") == DEFAULT_ALMANAC_ROOT
    assert (SRC_ROOT / "services/repositories/roots.py").is_file()
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
