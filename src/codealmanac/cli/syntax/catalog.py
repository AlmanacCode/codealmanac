from difflib import get_close_matches

from codealmanac.cli.syntax.models import (
    CommandAlias,
    CommandGuide,
    CommandRow,
)


class CommandCatalog:
    def __init__(self, guides: tuple[CommandGuide, ...]):
        self.guides = guides

    def guide_for_path(self, path: tuple[str, ...]) -> CommandGuide:
        for guide in self.guides:
            if guide.path == path:
                return guide
        return self.root_guide()

    def guide_for_argv(self, argv: tuple[str, ...]) -> CommandGuide:
        for length in range(len(argv), -1, -1):
            guide = self.match_path(argv[:length])
            if guide is not None:
                return guide
        return self.root_guide()

    def match_path(self, path: tuple[str, ...]) -> CommandGuide | None:
        for guide in self.guides:
            if guide.path == path:
                return guide
        return None

    def root_guide(self) -> CommandGuide:
        for guide in self.guides:
            if guide.path == ():
                return guide
        raise AssertionError("command catalog requires a root guide")

    def replacement_for(self, guide: CommandGuide, token: str | None) -> str | None:
        if token is None:
            return None
        for alias in guide.aliases:
            if alias.token == token:
                return alias.replacement
        if guide.path == ():
            return self.closest_root_replacement(token)
        return None

    def closest_root_replacement(self, token: str) -> str | None:
        names = tuple(
            guide.path[0]
            for guide in self.guides
            if len(guide.path) == 1 and not guide.path[0].startswith("__")
        )
        matches = get_close_matches(token, names, n=1, cutoff=0.72)
        if len(matches) == 0:
            return None
        return f"codealmanac {matches[0]}"


def command_catalog() -> CommandCatalog:
    return CommandCatalog(
        (
            guide(
                (),
                "CodeAlmanac commands",
                "Choose a command to query, update, inspect, or configure "
                "a local wiki.",
                (
                    row("codealmanac init [path]", "Set up a repo wiki"),
                    row("codealmanac ingest <input...>", "Add source material"),
                    row("codealmanac garden", "Improve the wiki"),
                    row("codealmanac sync", "Scan local conversations"),
                    row("codealmanac search [query]", "Search pages"),
                    row("codealmanac show <page>", "Read one page"),
                    row("codealmanac topics", "List topics"),
                    row("codealmanac jobs", "Inspect background work"),
                    row("codealmanac automation", "Manage schedules"),
                    row("codealmanac doctor", "Check local setup"),
                ),
            ),
            guide(
                ("jobs",),
                "Jobs commands",
                "Inspect background work and follow a run by id.",
                (
                    row("codealmanac jobs", "List recent jobs"),
                    row("codealmanac jobs show <run-id>", "Show one job"),
                    row("codealmanac jobs logs <run-id>", "Read its log"),
                    row("codealmanac jobs attach <run-id>", "Follow it live"),
                    row("codealmanac jobs cancel <run-id>", "Cancel it"),
                ),
                aliases=(alias("list", "codealmanac jobs"),),
            ),
            guide(
                ("topics",),
                "Topics commands",
                "List, inspect, and edit the topic graph.",
                (
                    row("codealmanac topics", "List topics"),
                    row("codealmanac topics show <slug>", "Show one topic"),
                    row("codealmanac topics create <name>", "Create a topic"),
                    row("codealmanac topics describe <slug> <text>", "Set description"),
                    row("codealmanac topics link <child> <parent>", "Link topics"),
                    row("codealmanac topics unlink <child> <parent>", "Remove a link"),
                    row("codealmanac topics rename <old> <new>", "Rename a topic"),
                    row("codealmanac topics delete <slug>", "Delete a topic"),
                ),
                aliases=(alias("list", "codealmanac topics"),),
            ),
            guide(
                ("config",),
                "Config commands",
                "Read and change user-level CodeAlmanac settings.",
                (
                    row("codealmanac config list", "List config values"),
                    row("codealmanac config get <key>", "Read one value"),
                    row("codealmanac config set <key> <value>", "Set one value"),
                    row("codealmanac config apply", "Apply config to automation"),
                ),
            ),
            guide(
                ("automation",),
                "Automation commands",
                "Inspect local scheduled work.",
                (row("codealmanac automation status", "Show schedules"),),
            ),
            guide(
                ("sync",),
                "Sync commands",
                "Scan local conversations and queue wiki work.",
                (
                    row("codealmanac sync", "Scan now"),
                    row("codealmanac sync status", "Show readiness"),
                    row("codealmanac sync --from codex", "Scan one source"),
                ),
            ),
            guide(
                ("search",),
                "Search options",
                "Search the selected wiki by text, topic, or file mention.",
                (
                    row('codealmanac search "auth"', "Search page text"),
                    row("codealmanac search --topic cli", "Filter by topic"),
                    row(
                        "codealmanac search --mentions src/app.py",
                        "Find file context",
                    ),
                    row("codealmanac search --slugs", "Print only slugs"),
                    row("codealmanac search --json", "Print JSON"),
                ),
            ),
            guide(
                ("show",),
                "Show options",
                "Read one indexed wiki page.",
                (
                    row("codealmanac show <page>", "Read metadata and body"),
                    row("codealmanac show <page> --lead", "Read the lead"),
                    row("codealmanac show <page> --links", "Show outgoing links"),
                    row("codealmanac show <page> --backlinks", "Show backlinks"),
                    row("codealmanac show <page> --json", "Print JSON"),
                ),
            ),
            guide(
                ("init",),
                "Init options",
                "Set up a repository wiki.",
                (
                    row("codealmanac init [path]", "Set up a wiki"),
                    row("codealmanac init --name <name>", "Set repository name"),
                    row("codealmanac init --description <text>", "Set description"),
                    row("codealmanac init --using codex", "Choose runner"),
                    row("codealmanac init --json", "Print JSON"),
                ),
            ),
            guide(
                ("list",),
                "List options",
                "List registered local wikis.",
                (
                    row("codealmanac list", "List wikis"),
                    row("codealmanac list --json", "Print JSON"),
                ),
            ),
            guide(
                ("ingest",),
                "Ingest options",
                "Add selected material to the wiki.",
                (
                    row("codealmanac ingest README.md", "Ingest a file"),
                    row("codealmanac ingest github:pr:123", "Ingest a GitHub source"),
                    row("codealmanac ingest <input...> --using codex", "Choose runner"),
                    row("codealmanac ingest <input...> --json", "Print JSON"),
                ),
            ),
            guide(
                ("garden",),
                "Garden options",
                "Improve the existing wiki.",
                (
                    row("codealmanac garden", "Improve this wiki"),
                    row("codealmanac garden --title <text>", "Set a run title"),
                    row("codealmanac garden --using codex", "Choose runner"),
                    row("codealmanac garden --json", "Print JSON"),
                ),
            ),
            guide(
                ("health",),
                "Health options",
                "Check wiki graph and source health.",
                (
                    row("codealmanac health", "Show health"),
                    row("codealmanac health --wiki <name>", "Check one wiki"),
                    row("codealmanac health --json", "Print JSON"),
                ),
            ),
            guide(
                ("validate",),
                "Validate options",
                "Validate a wiki and return nonzero when issues exist.",
                (
                    row("codealmanac validate", "Validate this wiki"),
                    row("codealmanac validate --wiki <name>", "Validate one wiki"),
                    row("codealmanac validate --json", "Print JSON"),
                ),
            ),
            guide(
                ("reindex",),
                "Reindex options",
                "Force a full index rebuild.",
                (
                    row("codealmanac reindex", "Rebuild the index"),
                    row("codealmanac reindex --wiki <name>", "Rebuild one wiki index"),
                    row("codealmanac reindex --json", "Print JSON"),
                ),
            ),
            guide(
                ("serve",),
                "Serve options",
                "Open the local wiki viewer.",
                (
                    row("codealmanac serve", "Serve on 127.0.0.1:3927"),
                    row("codealmanac serve --port <n>", "Choose port"),
                    row("codealmanac serve --host <host>", "Choose host"),
                    row("codealmanac serve --wiki <name>", "Serve one wiki"),
                ),
            ),
            guide(
                ("tag",),
                "Tag command",
                "Add topics to a page.",
                (
                    row("codealmanac tag <page> <topic...>", "Add topics"),
                    row(
                        "codealmanac tag <page> <topic...> --wiki <name>",
                        "Use one wiki",
                    ),
                ),
            ),
            guide(
                ("untag",),
                "Untag command",
                "Remove topics from a page.",
                (
                    row("codealmanac untag <page> <topic...>", "Remove topics"),
                    row(
                        "codealmanac untag <page> <topic...> --wiki <name>",
                        "Use one wiki",
                    ),
                ),
            ),
            guide(
                ("setup",),
                "Setup options",
                "Install local CodeAlmanac instructions and schedules.",
                (
                    row("codealmanac setup", "Interactive setup"),
                    row("codealmanac setup --yes", "Use defaults"),
                    row("codealmanac setup --runner codex", "Choose runner"),
                    row("codealmanac setup --json", "Print JSON"),
                ),
            ),
            guide(
                ("uninstall",),
                "Uninstall options",
                "Remove CodeAlmanac-owned local setup.",
                (
                    row("codealmanac uninstall", "Interactive uninstall"),
                    row("codealmanac uninstall --yes", "Use defaults"),
                    row("codealmanac uninstall --json", "Print JSON"),
                ),
            ),
            guide(
                ("doctor",),
                "Doctor options",
                "Check local install and wiki state.",
                (
                    row("codealmanac doctor", "Run diagnostics"),
                    row("codealmanac doctor --wiki <name>", "Check one wiki"),
                    row("codealmanac doctor --json", "Print JSON"),
                ),
            ),
            guide(
                ("update",),
                "Update options",
                "Check for or install a CLI update.",
                (
                    row("codealmanac update", "Update the CLI"),
                    row("codealmanac update --check", "Check only"),
                    row("codealmanac update --json", "Print JSON"),
                ),
            ),
        )
    )


def guide(
    path: tuple[str, ...],
    title: str,
    summary: str,
    rows: tuple[CommandRow, ...],
    aliases: tuple[CommandAlias, ...] = (),
) -> CommandGuide:
    return CommandGuide(
        path=path,
        title=title,
        summary=summary,
        rows=rows,
        aliases=aliases,
    )


def row(command: str, description: str) -> CommandRow:
    return CommandRow(command=command, description=description)


def alias(token: str, replacement: str) -> CommandAlias:
    return CommandAlias(token=token, replacement=replacement)
