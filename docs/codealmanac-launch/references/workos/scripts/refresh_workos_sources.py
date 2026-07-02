#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

LLMS_URL = "https://workos.com/docs/llms.txt"
LINK_PATTERN = re.compile(
    r"^- \[(?P<title>[^\]]+)\]\((?P<url>[^)]+)\)"
    r"(?:: (?P<description>.*))?$"
)
HEADING_PATTERN = re.compile(r"^(#{1,4})\s+(?P<title>.+)$")
DEFAULT_HEADING_LIMIT = 80


@dataclass(frozen=True)
class WorkosSource:
    section: str
    title: str
    url: str
    description: str

    @property
    def slug(self) -> str:
        path = self.url.replace("https://workos.com/", "")
        path = path.removesuffix(".md")
        return slug_text(path)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Refresh the local WorkOS documentation source map.",
    )
    parser.add_argument(
        "--output",
        default="docs/workos",
        help="Output folder. Default: docs/workos",
    )
    parser.add_argument(
        "--fetch-headings",
        action="store_true",
        help="Fetch selected pages and store headings only.",
    )
    parser.add_argument(
        "--heading-limit",
        type=int,
        default=DEFAULT_HEADING_LIMIT,
        help="Maximum pages to fetch for headings.",
    )
    args = parser.parse_args()

    output = Path(args.output)
    cache = output / "research-cache"
    cache.mkdir(parents=True, exist_ok=True)

    llms_text = fetch_text(LLMS_URL)
    (cache / "workos-llms.txt").write_text(llms_text, encoding="utf-8")

    sources = parse_sources(llms_text)
    headings = {}
    failures = []
    if args.fetch_headings:
        headings, failures = fetch_headings_for(
            priority_sources(sources)[: args.heading_limit]
        )

    write_json(cache / "sources.json", [asdict(source) for source in sources])
    write_json(cache / "headings.json", headings)
    write_json(cache / "heading-failures.json", failures)
    write_source_index(output / "source-index.md", sources, headings, failures)
    return 0


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "almanac-workos-research/1.0"})
    try:
        with urlopen(request, timeout=30) as response:
            return response.read().decode("utf-8")
    except URLError as error:
        raise SystemExit(f"failed to fetch {url}: {error}") from error


def parse_sources(text: str) -> list[WorkosSource]:
    sources: list[WorkosSource] = []
    section = "Other"
    for line in text.splitlines():
        if line.startswith("## "):
            section = line.removeprefix("## ").strip()
            continue
        match = LINK_PATTERN.match(line.strip())
        if not match:
            continue
        sources.append(
            WorkosSource(
                section=section,
                title=match.group("title").strip(),
                url=match.group("url").strip(),
                description=(match.group("description") or "").strip(),
            )
        )
    return sources


def priority_sources(sources: list[WorkosSource]) -> list[WorkosSource]:
    keywords = (
        "authkit",
        "cli-auth",
        "agent",
        "organization",
        "organization-membership",
        "invitation",
        "role",
        "fga",
        "rbac",
        "widgets",
        "user-management",
        "organization-switcher",
        "session",
        "api-keys",
        "audit",
        "directory",
        "sso",
        "scim",
    )

    def score(source: WorkosSource) -> tuple[int, str]:
        haystack = f"{source.section} {source.title} {source.url}".lower()
        return (sum(1 for keyword in keywords if keyword in haystack), source.url)

    return sorted(sources, key=score, reverse=True)


def fetch_headings_for(
    sources: list[WorkosSource],
) -> tuple[dict[str, list[str]], list[dict[str, str]]]:
    headings: dict[str, list[str]] = {}
    failures: list[dict[str, str]] = []
    for source in sources:
        try:
            text = fetch_text(source.url)
        except SystemExit as error:
            print(error, file=sys.stderr)
            failures.append(
                {"url": source.url, "title": source.title, "error": str(error)}
            )
            continue
        extracted = []
        for line in text.splitlines():
            match = HEADING_PATTERN.match(line)
            if match:
                extracted.append(line.strip())
        if extracted:
            headings[source.url] = extracted
    return headings, failures


def write_json(path: Path, value: object) -> None:
    path.write_text(
        json.dumps(value, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_source_index(
    path: Path,
    sources: list[WorkosSource],
    headings: dict[str, list[str]],
    failures: list[dict[str, str]],
) -> None:
    sections: dict[str, list[WorkosSource]] = {}
    for source in sources:
        sections.setdefault(source.section, []).append(source)

    lines = [
        "# WorkOS source index",
        "",
        f"Generated: {datetime.now(UTC).isoformat()}",
        "",
        "Source: https://workos.com/docs/llms.txt",
        "",
        "This file is an index of official WorkOS documentation URLs and short",
        "descriptions. It is not a vendored copy of the documentation.",
        "",
        "## Counts",
        "",
        f"- sources: {len(sources)}",
        f"- sections: {len(sections)}",
        f"- heading snapshots: {len(headings)}",
        f"- heading fetch failures: {len(failures)}",
        "",
    ]
    if failures:
        lines.extend(["## Heading fetch failures", ""])
        for failure in failures:
            lines.append(
                f"- [{failure['title']}]({failure['url']}) - {failure['error']}"
            )
        lines.append("")
    for section, section_sources in sections.items():
        lines.extend([f"## {section}", ""])
        for source in section_sources:
            description = f" - {source.description}" if source.description else ""
            lines.append(f"- [{source.title}]({source.url}){description}")
            for heading in headings.get(source.url, [])[:12]:
                lines.append(f"  - `{heading}`")
        lines.append("")
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def slug_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


if __name__ == "__main__":
    raise SystemExit(main())
