from codealmanac.cli.render.common import print_json_model
from codealmanac.wiki.validation.models import WikiValidationIssue, WikiValidationReport


def render_validation(report: WikiValidationReport, *, json_output: bool) -> None:
    if json_output:
        print_json_model(report)
        return
    if report.ok:
        print(f"wiki valid: {report.pages_checked} {page_word(report.pages_checked)}")
        return
    issue_word = "issue" if len(report.issues) == 1 else "issues"
    print(f"wiki invalid: {len(report.issues)} {issue_word}")
    for issue in report.issues:
        print(f"- {format_validation_issue(issue)}")


def format_validation_issue(issue: WikiValidationIssue) -> str:
    location = issue.path.as_posix()
    if issue.line is not None:
        location = f"{location}:{issue.line}"
        if issue.column is not None:
            location = f"{location}:{issue.column}"
    return f"{location}: {issue.message}"


def page_word(count: int) -> str:
    return "page" if count == 1 else "pages"
