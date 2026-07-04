PULL_REQUEST_PROMPT_HINT = (
    "Inspect the pull request, diff, commits, reviews, and linked issues before "
    "deciding whether durable wiki knowledge changed."
)
ISSUE_PROMPT_HINT = (
    "Inspect the issue, linked pull requests, decisions, labels, and comments "
    "before deciding whether durable wiki knowledge changed."
)
GIT_RANGE_PROMPT_HINT = (
    "Inspect the commit range and changed files before deciding whether durable "
    "wiki knowledge changed."
)
GIT_DIFF_PROMPT_HINT = (
    "Inspect the diff and current files before deciding whether durable wiki "
    "knowledge changed."
)
WEB_PROMPT_HINT = (
    "Inspect the web page as source material before deciding whether durable "
    "wiki knowledge changed."
)
DIRECTORY_PROMPT_HINT = (
    "Inspect the directory as bounded local source material before deciding "
    "whether durable wiki knowledge changed."
)
FILE_PROMPT_HINT = (
    "Inspect the file as bounded local source material before deciding whether "
    "durable wiki knowledge changed."
)
MISSING_PATH_PROMPT_HINT = (
    "Resolve the missing local path before attempting to use it as source material."
)
TRANSCRIPT_PROMPT_HINT = (
    "Inspect the transcript structurally and preserve only reusable project knowledge."
)
