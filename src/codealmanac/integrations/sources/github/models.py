from pydantic import BaseModel, ConfigDict, Field

PULL_REQUEST_FIELDS = ",".join(
    (
        "title",
        "state",
        "author",
        "body",
        "url",
        "createdAt",
        "updatedAt",
        "mergedAt",
        "baseRefName",
        "headRefName",
        "commits",
        "files",
        "comments",
        "reviews",
    )
)
ISSUE_FIELDS = ",".join(
    (
        "title",
        "state",
        "author",
        "body",
        "url",
        "createdAt",
        "updatedAt",
        "closedAt",
        "labels",
        "assignees",
        "comments",
    )
)


class GitHubCliModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore", populate_by_name=True)


class GitHubActor(GitHubCliModel):
    login: str
    name: str | None = None
    is_bot: bool | None = Field(default=None, alias="is_bot")


class GitHubLabel(GitHubCliModel):
    name: str
    description: str | None = None
    color: str | None = None


class GitHubComment(GitHubCliModel):
    author: GitHubActor | None = None
    body: str | None = None
    created_at: str | None = Field(default=None, alias="createdAt")
    url: str | None = None
    author_association: str | None = Field(default=None, alias="authorAssociation")
    is_minimized: bool | None = Field(default=None, alias="isMinimized")
    minimized_reason: str | None = Field(default=None, alias="minimizedReason")


class GitHubReview(GitHubCliModel):
    author: GitHubActor | None = None
    body: str | None = None
    state: str | None = None
    submitted_at: str | None = Field(default=None, alias="submittedAt")


class GitHubCommitAuthor(GitHubCliModel):
    name: str | None = None
    email: str | None = None
    login: str | None = None


class GitHubCommit(GitHubCliModel):
    oid: str
    message_headline: str | None = Field(default=None, alias="messageHeadline")
    message_body: str | None = Field(default=None, alias="messageBody")
    authored_date: str | None = Field(default=None, alias="authoredDate")
    committed_date: str | None = Field(default=None, alias="committedDate")
    authors: tuple[GitHubCommitAuthor, ...] = ()


class GitHubFile(GitHubCliModel):
    path: str
    additions: int = 0
    deletions: int = 0


class GitHubPullRequestPayload(GitHubCliModel):
    title: str
    state: str
    author: GitHubActor | None = None
    body: str | None = None
    url: str
    created_at: str | None = Field(default=None, alias="createdAt")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    merged_at: str | None = Field(default=None, alias="mergedAt")
    base_ref_name: str | None = Field(default=None, alias="baseRefName")
    head_ref_name: str | None = Field(default=None, alias="headRefName")
    commits: tuple[GitHubCommit, ...] = ()
    files: tuple[GitHubFile, ...] = ()
    comments: tuple[GitHubComment, ...] = ()
    reviews: tuple[GitHubReview, ...] = ()


class GitHubIssuePayload(GitHubCliModel):
    title: str
    state: str
    author: GitHubActor | None = None
    body: str | None = None
    url: str
    created_at: str | None = Field(default=None, alias="createdAt")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    closed_at: str | None = Field(default=None, alias="closedAt")
    labels: tuple[GitHubLabel, ...] = ()
    assignees: tuple[GitHubActor, ...] = ()
    comments: tuple[GitHubComment, ...] = ()
