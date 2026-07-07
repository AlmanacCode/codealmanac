from codealmanac.core.models import CodeAlmanacModel

ALLOWED_WIKI_SOURCE_FILES = (
    "almanac/**/*.md",
    "almanac/topics.yaml",
    "almanac/config.toml",
)
FORBIDDEN_COMMIT_FILES = (
    "runtime state under ~/.codealmanac/",
    "application source files",
    "logs",
    "unrelated repository files",
)
COMMIT_MESSAGE_SHAPE = "almanac: <summary>"


class OperationCommitPolicy(CodeAlmanacModel):
    auto_commit: bool
    allowed_files: tuple[str, ...]
    forbidden_files: tuple[str, ...]
    commit_message: str
    instructions: tuple[str, ...]


def operation_commit_policy(auto_commit: bool) -> OperationCommitPolicy:
    return OperationCommitPolicy(
        auto_commit=auto_commit,
        allowed_files=ALLOWED_WIKI_SOURCE_FILES,
        forbidden_files=FORBIDDEN_COMMIT_FILES,
        commit_message=COMMIT_MESSAGE_SHAPE,
        instructions=commit_instructions(auto_commit),
    )


def commit_instructions(auto_commit: bool) -> tuple[str, ...]:
    if auto_commit:
        return (
            "You may commit wiki source changes during this run.",
            "Use normal git commands from the repository root.",
            "Commit only allowed wiki source files.",
            f"Use commit message shape `{COMMIT_MESSAGE_SHAPE}`.",
            "Do not commit runtime state, app source files, logs, or unrelated files.",
        )
    return (
        "Do not commit during this run.",
        "Leave wiki source changes in the working tree for the user to review.",
        "Do not stage files.",
        "Do not run git commit.",
    )
