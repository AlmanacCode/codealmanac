from codealmanac.wiki.viewer.renderer import MarkdownRenderer


def test_markdown_renderer_rewrites_only_text_wikilinks():
    html = MarkdownRenderer().render(
        """Inline `[[inline-code]]` and [[page-link]].

```python
[[fenced-code]]
```
"""
    )

    assert '<a href="#/page/page-link">page-link</a>' in html
    assert "<code>[[inline-code]]</code>" in html
    assert "#/page/inline-code" not in html
    assert "[[fenced-code]]" in html
    assert "#/page/fenced-code" not in html


def test_markdown_renderer_escapes_wikilink_label_html():
    html = MarkdownRenderer().render("[[session-store|<script>alert(1)</script>]]")

    assert '<a href="#/page/session-store">' in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "<script>" not in html
