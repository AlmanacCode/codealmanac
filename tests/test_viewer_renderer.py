from codealmanac.services.viewer.renderer import MarkdownRenderer


def render_markdown(body: str, page_id: str = "architecture/indexing"):
    return MarkdownRenderer().render(
        body,
        page_id=page_id,
        source_is_folder_landing=False,
    )


def test_markdown_renderer_rewrites_internal_markdown_page_links():
    rendered = render_markdown(
        """See [Session Store](session-store), [Sibling](wiki-tree),
and [External](https://example.com).

```python
[Fenced](fenced-code)
```
"""
    )

    assert (
        '<a href="#/page/architecture%2Fsession-store">Session Store</a>'
        in rendered.html
    )
    assert '<a href="#/page/architecture%2Fwiki-tree">Sibling</a>' in rendered.html
    assert '<a href="https://example.com">External</a>' in rendered.html
    assert "#/page/fenced-code" not in rendered.html


def test_markdown_renderer_escapes_link_label_html():
    rendered = render_markdown(
        "[<script>alert(1)</script>](session-store)",
        page_id="auth-flow",
    )

    assert '<a href="#/page/session-store">' in rendered.html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in rendered.html
    assert "<script>" not in rendered.html


def test_markdown_renderer_numbers_source_citations_in_reading_order():
    rendered = render_markdown(
        "First [@source-a], second [@source-b], first again [@source-a]."
    )

    assert rendered.citation_order == ("source-a", "source-b")
    assert (
        '<a href="#source-source-a" class="wiki-citation" '
        'data-source-id="source-a">[1]</a>'
    ) in rendered.html
    assert (
        '<a href="#source-source-b" class="wiki-citation" '
        'data-source-id="source-b">[2]</a>'
    ) in rendered.html
    assert rendered.html.count('data-source-id="source-a">[1]</a>') == 2


def test_markdown_renderer_leaves_code_citations_alone():
    rendered = render_markdown("Inline `[@source-a]` and [@source-b].")

    assert "<code>[@source-a]</code>" in rendered.html
    assert 'data-source-id="source-a"' not in rendered.html
    assert rendered.citation_order == ("source-b",)
