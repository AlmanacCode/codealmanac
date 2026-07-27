from codealmanac.services.health.models import ValidationIssue, ValidationResult
from codealmanac.services.index.models import HealthReport


def validation_failure_message(result: ValidationResult) -> str:
    errors = result.errors or result.issues
    first = errors[0]
    location = f" ({first.path})" if first.path else ""
    if len(errors) == 1:
        return f"validation failed: {first.category}: {first.message}{location}"
    return (
        f"validation failed: {len(errors)} issues; first: "
        f"{first.category}: {first.message}{location}"
    )


def health_report_issues(report: HealthReport) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    issues.extend(
        ValidationIssue(
            category="orphans",
            message="page has no topics",
            page=item.slug,
        )
        for item in report.orphans
    )
    issues.extend(
        ValidationIssue(
            category="dead_refs",
            message="file source does not exist",
            page=item.slug,
            path=item.path,
        )
        for item in report.dead_refs
    )
    issues.extend(
        ValidationIssue(
            category="broken_links",
            message=f"Markdown page link target does not exist: {item.target_slug}",
            page=item.source_slug,
        )
        for item in report.broken_links
    )
    issues.extend(
        ValidationIssue(
            category="broken_xwiki",
            message=(
                "cross-wiki target is not registered: "
                f"{item.target_wiki}:{item.target_slug}"
            ),
            page=item.source_slug,
        )
        for item in report.broken_xwiki
    )
    issues.extend(
        ValidationIssue(
            category="empty_topics",
            message="topic has no pages",
            page=item.slug,
        )
        for item in report.empty_topics
    )
    issues.extend(
        ValidationIssue(
            category="empty_pages",
            message="page has no body content after heading text",
            page=item.slug,
        )
        for item in report.empty_pages
    )
    issues.extend(
        ValidationIssue(
            category="missing_source_citations",
            message=f"citation has no matching source: {item.source_id}",
            page=item.slug,
        )
        for item in report.missing_source_citations
    )
    issues.extend(
        ValidationIssue(
            category="unused_sources",
            message=f"source is not cited in page body: {item.source_id}",
            page=item.slug,
        )
        for item in report.unused_sources
    )
    issues.extend(
        ValidationIssue(
            category="duplicate_sources",
            message=f"source id is duplicated: {item.source_id}",
            page=item.slug,
        )
        for item in report.duplicate_sources
    )
    return issues
