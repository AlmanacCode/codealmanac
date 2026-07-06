import argparse

from codealmanac.cli.render.common import print_json_model, print_lines
from codealmanac.services.index.models import PageView


def render_page(page: PageView, args: argparse.Namespace) -> None:
    if args.json:
        print_json_model(page)
        return
    if args.body:
        print(body_with_trailing_newline(page.body), end="")
        return
    if args.links:
        print_lines(page.page_links_out)
        return
    if args.backlinks:
        print_lines(page.page_links_in)
        return
    if args.files:
        print_lines(tuple(ref.path for ref in page.file_refs))
        return
    if args.topics:
        print_lines(page.topics)
        return
    if args.meta:
        print(metadata_header(page))
        return
    if args.lead:
        print(first_paragraph(page.body))
        return
    print(body_with_trailing_newline(page.body), end="")


def metadata_header(page: PageView) -> str:
    lines = [
        f"page: {page.slug}",
        f"title: {page.title or ''}",
        f"path: {page.file_path}",
    ]
    if page.summary:
        lines.append(f"summary: {page.summary}")
    if page.topics:
        lines.append(f"topics: {', '.join(page.topics)}")
    if page.sources:
        lines.append("sources:")
        for source in page.sources:
            target = f" {source.target}" if source.target else ""
            note = f" - {source.note}" if source.note else ""
            lines.append(
                f"  {source.source_id} [{source.source_type.value}]{target}{note}"
            )
    return "\n".join(lines)


def first_paragraph(body: str) -> str:
    paragraphs = [part.strip() for part in body.split("\n\n") if part.strip()]
    return paragraphs[0] if paragraphs else ""


def body_with_trailing_newline(body: str) -> str:
    if body == "" or body.endswith("\n"):
        return body
    return f"{body}\n"
