import { Marked } from "./vendor/marked.esm.js";

// Markdown rendering for the viewer, backed by `marked` (vendored).
//
// Four deliberate departures from stock `marked`:
//  - `[[wikilinks]]` are a custom inline token resolved against the viewer's
//    routing helpers (see routes.js).
//  - Standard `[text](target)` links are resolved through `resolveLink` so a
//    target pointing at a `pages/*.md` file becomes an in-app page route, an
//    `http(s)` target opens in a new tab, and an unresolvable target renders
//    as plain text. This mirrors the previous hand-rolled renderer.
//  - Raw inline/block HTML is escaped, not passed through. Almanac pages are
//    AI-authored markdown; rendering arbitrary HTML into innerHTML is not worth
//    the XSS surface. This matches the previous hand-rolled renderer.
//  - The first `# heading` of a page article is rendered as the decorated
//    title (summary + ornament); other level-1 headings are demoted to h2 so
//    they don't read as a second page title.
//
// `resolveWikilink(target)` returns `{ href, label }`.
// `resolveLink(href)` returns one of:
//   { type: "external", href }      — opens in a new tab
//   { type: "page", route, label }  — in-app route; label null falls back to
//                                     the link text (with a trailing .md trimmed)
//   { type: "dead" }                — rendered as plain, non-clickable text

export function createMarkdown({ resolveWikilink, resolveLink }) {
  const md = new Marked({ gfm: true, breaks: false });

  md.use({
    extensions: [
      {
        name: "wikilink",
        level: "inline",
        start(src) {
          const index = src.indexOf("[[");
          return index < 0 ? undefined : index;
        },
        tokenizer(src) {
          const match = /^\[\[([^\]]+)\]\]/.exec(src);
          if (match === null) return undefined;
          return { type: "wikilink", raw: match[0], target: match[1].trim() };
        },
        renderer(token) {
          const { href, label } = resolveWikilink(token.target);
          return `<a href="${escapeAttr(href)}" data-route="${escapeAttr(href)}">${escapeHtml(label)}</a>`;
        },
      },
    ],
    renderer: {
      heading(token) {
        const inner = this.parser.parseInline(token.tokens);
        if (token.isArticleTitle === true) {
          return `<h1>${inner}</h1>\n${articleSummary(token.articleSummary)}\n<div class="ca-page-ornament" aria-hidden="true"><span>✥</span></div>`;
        }
        const level = token.depth <= 2 ? 2 : token.depth;
        return `<h${level}>${inner}</h${level}>`;
      },
      html(token) {
        return escapeHtml(token.text);
      },
      link(token) {
        const inner = this.parser.parseInline(token.tokens);
        const resolved = resolveLink(token.href ?? "");
        if (resolved.type === "external") {
          return `<a href="${escapeAttr(resolved.href)}" target="_blank" rel="noreferrer">${inner}</a>`;
        }
        if (resolved.type === "page") {
          const text = resolved.label != null ? escapeHtml(resolved.label) : inner.replace(/\.md$/, "");
          return `<a href="${escapeAttr(resolved.route)}" data-route="${escapeAttr(resolved.route)}">${text}</a>`;
        }
        return `<span>${inner}</span>`;
      },
    },
  });

  function renderMarkdown(source, options = {}) {
    if (typeof source !== "string" || source.trim().length === 0) return "";
    const decorateTitle = options.decorateTitle === true;
    const summary = options.summary ?? null;
    let titleMarked = false;
    return md.parse(source, {
      walkTokens(token) {
        if (
          decorateTitle &&
          !titleMarked &&
          token.type === "heading" &&
          token.depth === 1
        ) {
          titleMarked = true;
          token.isArticleTitle = true;
          token.articleSummary = summary;
        }
      },
    });
  }

  return { renderMarkdown };
}

function articleSummary(summary) {
  const text = (summary ?? "").trim();
  return text ? `<p class="ca-article-summary">${escapeHtml(text)}</p>` : "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}
