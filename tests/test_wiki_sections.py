from codealmanac.services.wiki.sections import project_sections


def test_projects_heading_hierarchy_and_exact_source_slices():
    body = (
        "Preamble sentence.\n\n"
        "# Run Lifecycle\n\n"
        "Introduction.\n\n"
        "## Cancellation\n\n"
        "Cancel a worker.\n\n"
        "### Confirmation\n\n"
        "Wait for exit.\n"
    )

    sections = project_sections(body, page_title="Run Lifecycle")

    assert [section.section_id for section in sections] == [
        "0000",
        "0001",
        "0002",
        "0003",
    ]
    assert [section.heading_path for section in sections] == [
        ("Run Lifecycle",),
        ("Run Lifecycle",),
        ("Run Lifecycle", "Cancellation"),
        ("Run Lifecycle", "Cancellation", "Confirmation"),
    ]
    assert sections[0].body == "Preamble sentence.\n\n"
    assert sections[1].body == "\nIntroduction.\n\n"
    assert sections[2].body == "\nCancel a worker.\n\n"
    assert sections[3].body == "\nWait for exit.\n"


def test_markdown_parser_owns_code_blocks_and_setext_headings():
    body = (
        "# Top\n\n"
        "```python\n# This is code, not a heading\n```\n\n"
        "Setext child\n------------\n"
        "Body.\n"
    )

    sections = project_sections(body, page_title="Top")

    assert len(sections) == 2
    assert "# This is code" in sections[0].body
    assert sections[1].heading_path == ("Top", "Setext child")
    assert sections[1].body == "Body.\n"


def test_duplicate_and_empty_headings_have_deterministic_distinct_ids():
    body = "# Page\n\n## Retry\n\n## Retry\n"

    first = project_sections(body, page_title="Page")
    rebuilt = project_sections(body, page_title="Page")

    assert first == rebuilt
    assert [section.section_id for section in first] == ["0000", "0001", "0002"]
    assert first[1].heading_path == first[2].heading_path
    assert first[1].body == "\n"
    assert first[2].body == ""


def test_heading_free_page_still_has_one_searchable_section():
    sections = project_sections("Only prose.\n", page_title="Note")

    assert len(sections) == 1
    assert sections[0].heading_path == ("Note",)
    assert sections[0].body == "Only prose.\n"
