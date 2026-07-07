import sys

from codealmanac.cli.render.style import style, table
from codealmanac.cli.syntax.models import (
    SyntaxProblem,
    SyntaxProblemKind,
)


def render_syntax_problem(problem: SyntaxProblem) -> None:
    err = sys.stderr
    print(blue_heading("◆ codealmanac"), file=err)
    print("", file=err)
    print(blue_heading(problem_title(problem.kind)), file=err)
    print("", file=err)
    print(section_label("You ran:"), file=err)
    print(f"  {command_text(typed_command(problem))}", file=err)
    if problem.replacement is not None:
        print("", file=err)
        print(section_label("Use this instead:"), file=err)
        print(f"  {command_text(problem.replacement)}", file=err)
    elif problem.detail is not None:
        print("", file=err)
        print(problem.detail, file=err)
    print("", file=err)
    print(blue_heading(problem.guide.title), file=err)
    print(f"{style.DIM}{problem.guide.summary}{style.RST}", file=err)
    print("", file=err)
    for line in table(
        ("COMMAND", "WHAT IT DOES"),
        tuple(
            (command_text(row.command), row.description)
            for row in problem.guide.rows
        ),
    ):
        print(line, file=err)


def problem_title(kind: SyntaxProblemKind) -> str:
    if kind == SyntaxProblemKind.UNKNOWN_COMMAND:
        return "Unknown command"
    if kind == SyntaxProblemKind.UNKNOWN_ACTION:
        return "Unknown command"
    if kind == SyntaxProblemKind.UNKNOWN_OPTION:
        return "Unknown option"
    if kind == SyntaxProblemKind.MISSING_ARGUMENT:
        return "Missing command"
    return "Invalid value"


def typed_command(problem: SyntaxProblem) -> str:
    return " ".join(problem.typed)


def blue_heading(value: str) -> str:
    return f"{style.BLUE}{style.BOLD}{value}{style.RST}"


def section_label(value: str) -> str:
    return f"{style.BLUE}{value}{style.RST}"


def command_text(value: str) -> str:
    return f"{style.BLUE}{value}{style.RST}"
