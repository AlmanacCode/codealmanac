import argparse
import json
import sys

from codealmanac.services.index.models import (
    HealthReport,
    IndexRefreshResult,
    PageView,
    SearchPageResult,
    TopicDetail,
    TopicSummary,
)
from codealmanac.services.tagging.models import TaggingResult
from codealmanac.services.topics.models import (
    TopicEdgeMutationResult,
    TopicMutationAction,
    TopicMutationResult,
    TopicRewriteMutationResult,
)
from codealmanac.services.workspaces.models import (
    DropWorkspaceResult,
    WorkspaceListResult,
)
from codealmanac.workflows.garden.models import GardenResult
from codealmanac.workflows.ingest.models import IngestResult
from codealmanac.workflows.sync.models import SyncMode, SyncSummary


def render_search(rows: tuple[SearchPageResult, ...], json_output: bool) -> None:
    if json_output:
        data = [row.model_dump(mode="json") for row in rows]
        print(json.dumps(data, indent=2))
        return
    if len(rows) == 0:
        print("# 0 results", file=sys.stderr)
        return
    for row in rows:
        print(row.slug)


def render_workspace_list(result: WorkspaceListResult, json_output: bool) -> None:
    if json_output:
        data = [item.model_dump(mode="json") for item in result.items]
        print(json.dumps(data, indent=2))
        return
    for item in result.items:
        workspace = item.workspace
        print(
            f"{workspace.name}\t{workspace.root_path}\t"
            f"{workspace.almanac_root.as_posix()}"
        )


def render_workspace_drop(result: DropWorkspaceResult, json_output: bool) -> None:
    if json_output:
        print(json.dumps(result.model_dump(mode="json"), indent=2))
        return
    if len(result.dropped) == 0:
        print("# 0 wikis dropped", file=sys.stderr)
        return
    for workspace in result.dropped:
        print(
            f"dropped {workspace.name}\t{workspace.root_path}\t"
            f"{workspace.almanac_root.as_posix()}"
        )


def render_build(workspace_name: str, result: IndexRefreshResult) -> None:
    print(f"built {workspace_name}: {index_summary(result)}")

def render_ingest(result: IngestResult) -> None:
    print(f"ingested {result.run.run_id}: {result.run.status.value}")
    print(f"sources: {len(result.sources)}")
    print(f"wiki_changes: {len(result.safety.changed_files)}")
    if result.run.summary is not None:
        print(f"summary: {result.run.summary}")

def render_garden(result: GardenResult) -> None:
    print(f"gardened {result.run.run_id}: {result.run.status.value}")
    print(f"wiki_changes: {len(result.safety.changed_files)}")
    print(f"health_before: {health_issue_count(result.health_before)}")
    if result.run.summary is not None:
        print(f"summary: {result.run.summary}")

def render_sync_status(summary: SyncSummary, json_output: bool) -> None:
    if json_output:
        print(json.dumps(summary.model_dump(mode="json"), indent=2))
        return
    status_mode = summary.mode == SyncMode.STATUS
    print("sync status:" if status_mode else "sync:")
    print(f"  scanned: {summary.scanned}")
    print(f"  eligible: {summary.eligible}")
    if status_mode:
        print(f"  ready: {len(summary.ready)}")
    else:
        print(f"  started: {len(summary.started)}")
    print(f"  skipped: {len(summary.skipped)}")
    print(f"  needs_attention: {len(summary.needs_attention)}")
    for ready in summary.ready:
        print(
            f"  - ready {ready.app.value} {ready.session_id}: "
            f"lines {ready.from_line}-{ready.to_line}"
        )
    for started in summary.started:
        print(
            f"  - started {started.app.value} {started.session_id}: "
            f"{started.run_id} (lines {started.from_line}-{started.to_line})"
        )
    for item in summary.needs_attention:
        print(f"  - needs attention {item.transcript_path}: {item.reason}")

def health_issue_count(report: HealthReport) -> int:
    return sum(
        len(items)
        for items in (
            report.orphans,
            report.dead_refs,
            report.broken_links,
            report.broken_xwiki,
            report.empty_topics,
            report.empty_pages,
        )
    )

def render_reindex(result: IndexRefreshResult, json_output: bool) -> None:
    if json_output:
        print(json.dumps(result.model_dump(mode="json"), indent=2))
        return
    print(f"reindexed: {index_summary(result)}")

def index_summary(result: IndexRefreshResult) -> str:
    skip_suffix = (
        f"; {result.files_skipped} skipped" if result.files_skipped > 0 else ""
    )
    return (
        f"{result.pages_indexed} {page_word(result.pages_indexed)} "
        f"({result.changed} updated, {result.removed} removed{skip_suffix})"
    )

def render_page(page: PageView, args: argparse.Namespace) -> None:
    if args.json:
        print(json.dumps(page.model_dump(mode="json"), indent=2))
        return
    if args.body:
        print(body_with_trailing_newline(page.body), end="")
        return
    if args.links:
        print_lines(page.wikilinks_out)
        return
    if args.backlinks:
        print_lines(page.wikilinks_in)
        return
    if args.files:
        print_lines(tuple(ref.path for ref in page.file_refs))
        return
    if args.topics:
        print_lines(page.topics)
        return
    if args.meta:
        print(metadata_header(page))
        return
    if args.lead:
        print(first_paragraph(page.body))
        return
    print(body_with_trailing_newline(page.body), end="")

def print_lines(values: tuple[str, ...]) -> None:
    for value in values:
        print(value)

def metadata_header(page: PageView) -> str:
    lines = [
        f"slug: {page.slug}",
        f"title: {page.title or ''}",
        f"path: {page.file_path}",
    ]
    if page.summary:
        lines.append(f"summary: {page.summary}")
    if page.topics:
        lines.append(f"topics: {', '.join(page.topics)}")
    return "\n".join(lines)

def first_paragraph(body: str) -> str:
    paragraphs = [part.strip() for part in body.split("\n\n") if part.strip()]
    return paragraphs[0] if paragraphs else ""

def body_with_trailing_newline(body: str) -> str:
    if body == "" or body.endswith("\n"):
        return body
    return f"{body}\n"

def render_topics(rows: tuple[TopicSummary, ...]) -> None:
    for row in rows:
        title = row.title or row.slug
        print(f"{row.slug}\t{row.page_count}\t{title}")

def render_topic(topic: TopicDetail) -> None:
    print(f"slug: {topic.slug}")
    print(f"title: {topic.title or ''}")
    if topic.description:
        print(f"description: {topic.description}")
    if topic.parents:
        print(f"parents: {', '.join(topic.parents)}")
    if topic.children:
        print(f"children: {', '.join(topic.children)}")
    if topic.pages:
        print("pages:")
        for slug in topic.pages:
            print(f"  {slug}")
    else:
        print("pages: none")

def render_topic_mutation(result: TopicMutationResult) -> None:
    print(f"{result.slug}: {result.action.value}")

def render_topic_edge_mutation(result: TopicEdgeMutationResult) -> None:
    if result.action == TopicMutationAction.NO_EDGE:
        print(f"no edge {result.child} -> {result.parent}")
        return
    if result.action == TopicMutationAction.ALREADY_LINKED:
        print(f"edge {result.child} -> {result.parent} already exists")
        return
    print(f"{result.action.value} {result.child} -> {result.parent}")

def render_topic_rewrite_mutation(result: TopicRewriteMutationResult) -> None:
    if result.action == TopicMutationAction.UNCHANGED:
        print(f"topic {result.slug} unchanged")
        return
    if result.action == TopicMutationAction.RENAMED:
        print(
            f"renamed {result.slug} -> {result.new_slug} "
            f"({result.pages_updated} {page_word(result.pages_updated)} updated)"
        )
        return
    if result.action == TopicMutationAction.DELETED:
        print(
            f"deleted {result.slug} "
            f"({result.pages_updated} {page_word(result.pages_updated)} untagged)"
        )
        return
    print(f"{result.slug}: {result.action.value}")

def page_word(count: int) -> str:
    return "page" if count == 1 else "pages"

def render_health(report: HealthReport, json_output: bool) -> None:
    if json_output:
        print(json.dumps(report.model_dump(mode="json"), indent=2))
        return
    render_health_section("orphans", tuple(item.slug for item in report.orphans))
    render_health_section(
        "dead_refs",
        tuple(f"{item.slug}\t{item.path}" for item in report.dead_refs),
    )
    render_health_section(
        "broken_links",
        tuple(
            f"{item.source_slug}\t{item.target_slug}" for item in report.broken_links
        ),
    )
    render_health_section(
        "broken_xwiki",
        tuple(
            f"{item.source_slug}\t{item.target_wiki}:{item.target_slug}"
            for item in report.broken_xwiki
        ),
    )
    render_health_section(
        "empty_topics",
        tuple(item.slug for item in report.empty_topics),
    )
    render_health_section(
        "empty_pages",
        tuple(item.slug for item in report.empty_pages),
    )

def render_health_section(name: str, rows: tuple[str, ...]) -> None:
    if not rows:
        print(f"{name} (0): ok")
        return
    print(f"{name} ({len(rows)}):")
    for row in rows:
        print(f"  {row}")

def render_tagging(changed_label: str, unchanged_label: str, result: TaggingResult):
    if result.changed_topics:
        print(f"{result.slug}: {changed_label} {', '.join(result.changed_topics)}")
        return
    unchanged = ", ".join(result.requested_topics)
    print(f"{result.slug}: {unchanged_label} {unchanged}")
