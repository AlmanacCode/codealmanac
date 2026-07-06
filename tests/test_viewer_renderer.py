from codealmanac.services.viewer.renderer import MarkdownRenderer


def test_markdown_renderer_rewrites_internal_markdown_page_links():
    html = MarkdownRenderer().render(
        """See [Session Store](session-store), [Sibling](wiki-tree),
and [External](https://example.com).

```python
[Fenced](fenced-code)
```
""",
        page_id="architecture/indexing",
        source_is_folder_landing=False,
    )

    assert '<a href="#/page/architecture%2Fsession-store">Session Store</a>' in html
    assert '<a href="#/page/architecture%2Fwiki-tree">Sibling</a>' in html
    assert '<a href="https://example.com">External</a>' in html
    assert "#/page/fenced-code" not in html


def test_markdown_renderer_escapes_link_label_html():
    html = MarkdownRenderer().render(
        "[<script>alert(1)</script>](session-store)",
        page_id="auth-flow",
        source_is_folder_landing=False,
    )

    assert '<a href="#/page/session-store">' in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "<script>" not in html
