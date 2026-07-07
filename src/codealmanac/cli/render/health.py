from codealmanac.cli.render.common import print_json_model
from codealmanac.cli.render.style import style
from codealmanac.services.health.models import ValidationIssue, ValidationResult
from codealmanac.services.index.models import HealthReport


def render_health(report: HealthReport, json_output: bool) -> None:
    if json_output:
        print_json_model(report)
        return
    blue = style.BLUE
    dim = style.DIM
    rst = style.RST
    sections = [
        ("orphans", tuple(f"{blue}{item.slug}{rst}" for item in report.orphans)),
        (
            "dead-refs",
            tuple(
                f"{blue}{item.slug}{rst}  references {item.path} {dim}(missing){rst}"
                for item in report.dead_refs
            ),
        ),
        (
            "broken-links",
            tuple(
                f"{blue}{item.source_slug}{rst} -> {item.target_slug} "
                f"{dim}(target does not exist){rst}"
                for item in report.broken_links
            ),
        ),
        (
            "broken-xwiki",
            tuple(
                f"{blue}{item.source_slug}{rst} -> "
                f"{item.target_wiki}:{item.target_slug} "
                f"{dim}(wiki unregistered or unreachable){rst}"
                for item in report.broken_xwiki
            ),
        ),
        (
            "empty-topics",
            tuple(f"{blue}{item.slug}{rst}" for item in report.empty_topics),
        ),
        (
            "empty-pages",
            tuple(f"{blue}{item.slug}{rst}" for item in report.empty_pages),
        ),
        (
            "missing-source-citations",
            tuple(
                f"{blue}{item.slug}{rst} cites {item.source_id} "
                f"{dim}(missing source){rst}"
                for item in report.missing_source_citations
            ),
        ),
        (
            "unused-sources",
            tuple(
                f"{blue}{item.slug}{rst} lists {item.source_id} {dim}(not cited){rst}"
                for item in report.unused_sources
            ),
        ),
        (
            "duplicate-sources",
            tuple(
                f"{blue}{item.slug}{rst} repeats {item.source_id}"
                for item in report.duplicate_sources
            ),
        ),
    ]
    rendered = [health_section(name, rows) for name, rows in sections]
    print("\n\n".join(rendered))


def health_section(name: str, rows: tuple[str, ...]) -> str:
    if not rows:
        return f"{style.BOLD}{name}{style.RST} {style.GREEN}(0): ok{style.RST}"
    lines = [f"{style.BOLD}{name}{style.RST} {style.RED}({len(rows)}){style.RST}:"]
    lines.extend(f"  {row}" for row in rows)
    return "\n".join(lines)


def render_validate(result: ValidationResult, json_output: bool) -> None:
    if json_output:
        print_json_model(result)
        return
    if result.ok:
        status = f"{style.GREEN}ok{style.RST}"
    else:
        status = f"{style.RED}failed{style.RST}"
    print(f"{style.BOLD}validate{style.RST}: {status}")
    print(f"{style.DIM}wiki:{style.RST}  {result.repository_name}")
    print(f"{style.DIM}path:{style.RST}  {result.almanac_path}")
    if result.index is not None:
        print(f"{style.DIM}index:{style.RST} {result.index.pages_indexed} pages")
    if result.ok:
        return
    print(f"issues ({len(result.issues)}):")
    for issue in result.issues:
        print(f"  {format_validation_issue(issue)}")


def format_validation_issue(issue: ValidationIssue) -> str:
    location = issue.page or issue.path or ""
    subject = f"{style.BLUE}{location}{style.RST} " if location else ""
    return f"{subject}{issue.message} {style.DIM}({issue.category}){style.RST}"
