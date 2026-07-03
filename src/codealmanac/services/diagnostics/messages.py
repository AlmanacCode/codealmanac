from codealmanac.wiki.index.models import HealthReport, IndexSummary


def first_line(value: str) -> str:
    return value.splitlines()[0] if value.splitlines() else value


def index_message(summary: IndexSummary) -> str:
    skip_suffix = (
        f", {summary.files_skipped} skipped" if summary.files_skipped > 0 else ""
    )
    return (
        f"index: {summary.pages} {page_word(summary.pages)}, "
        f"{summary.topics} {topic_word(summary.topics)} "
        f"({summary.files_seen} files seen{skip_suffix})"
    )


def health_problem_count(report: HealthReport) -> int:
    return (
        len(report.orphans)
        + len(report.dead_refs)
        + len(report.broken_links)
        + len(report.broken_xwiki)
        + len(report.empty_topics)
        + len(report.empty_pages)
    )


def page_word(count: int) -> str:
    return "page" if count == 1 else "pages"


def topic_word(count: int) -> str:
    return "topic" if count == 1 else "topics"


def problem_word(count: int) -> str:
    return "problem" if count == 1 else "problems"
