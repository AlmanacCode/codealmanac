import { createJobsView } from "./jobs-view.js";
import {
  isWikiPageRoute,
  labelForWikilink,
  parseWikiPath,
  routeForWikilink,
  routeFromElement,
  wikiApi as buildWikiApi,
  wikiRoute as buildWikiRoute,
} from "./routes.js";
import { createSearchSuggestions } from "./search-suggestions.js";

const state = {
  wikis: [],
  currentWiki: null,
  overview: null,
  currentPage: null,
  pageTitles: new Map(),
  topicFilter: null,
  historyIndex: 0,
};

const els = {
  shell: document.querySelector("#app"),
  reader: document.querySelector("#reader"),
  pageMeta: document.querySelector("#page-meta"),
  backlinks: document.querySelector("#backlinks"),
  fileRefs: document.querySelector("#file-refs"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  topbarLinks: document.querySelectorAll(".ca-topbar-nav [data-route]"),
};

const jobsView = createJobsView({
  api,
  reader: els.reader,
  jobsPath: () => wikiApi("/jobs"),
  jobPath: (runId) => wikiApi(`/jobs/${encodeURIComponent(runId)}`),
  jobRoute: (runId) => wikiRoute(`/jobs/${runId}`),
  isCurrentJobRoute: (runId) => location.pathname === wikiRoute(`/jobs/${runId}`),
  pageActions: () => renderPageActions(wikiRoute("/")),
  renderError,
  renderMarkdown,
  escapeHtml,
  escapeAttr,
  formatTimestamp,
  formatElapsed,
  formatNumber,
});

const searchSuggestions = createSearchSuggestions({
  api,
  form: els.searchForm,
  input: els.searchInput,
  navigate,
  suggestPath: (query) => wikiApi(`/suggest?q=${encodeURIComponent(query)}`),
  pageRoute: (page) => wikiRoute(`/page/${page.slug}`),
  escapeHtml,
  escapeAttr,
});

boot().catch((error) => renderError(error));

async function boot() {
  wireEvents();
  initializeHistoryState();
  const result = await api("/api/wikis");
  state.wikis = result.wikis ?? [];
  renderChrome();
  await route(location.pathname, location.search, false);
}

function wireEvents() {
  searchSuggestions.wire();

  document.addEventListener("click", (event) => {
    const back = event.target.closest("[data-back]");
    if (back !== null) {
      event.preventDefault();
      goBack();
      return;
    }

    const filterBtn = event.target.closest("[data-topic-filter]");
    if (filterBtn !== null) {
      event.preventDefault();
      const value = filterBtn.dataset.topicFilter || "";
      const next = value === "" ? null : value;
      state.topicFilter = state.topicFilter === next ? null : next;
      if (state.currentWiki !== null && state.overview !== null
          && (location.pathname === wikiRoute("/") || location.pathname === wikiRoute(""))) {
        renderOverview().catch((error) => renderError(error));
      }
      return;
    }

    const target = event.target.closest("[data-route]");
    if (target === null || target.disabled === true) return;
    event.preventDefault();
    navigate(routeFromElement(target.dataset.route, state.currentWiki));
  });

  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.currentWiki === null) return;
    const query = els.searchInput.value.trim();
    navigate(query.length > 0
      ? wikiRoute(`/search?q=${encodeURIComponent(query)}`)
      : wikiRoute("/search"));
  });

  window.addEventListener("popstate", (event) => {
    state.historyIndex = historyIndexFromState(event.state);
    route(location.pathname, location.search, false).catch((error) => renderError(error));
  });
}

async function route(pathname, search = "", push = true) {
  if (push) {
    const nextIndex = state.historyIndex + 1;
    state.historyIndex = nextIndex;
    history.pushState(historyState(nextIndex), "", pathname + search);
  }
  jobsView.clearPoll();

  if (pathname === "/" || !pathname.startsWith("/w/")) {
    state.currentWiki = null;
    state.overview = null;
    state.currentPage = null;
    state.topicFilter = null;
    renderChrome();
    setActiveNav(pathname);
    setRailVisible(false);
    clearPageRail();
    renderWikiDirectory();
    return;
  }

  const parsed = parseWikiPath(pathname);
  if (parsed === null) {
    navigate("/");
    return;
  }

  await selectWiki(parsed.wiki);
  renderChrome();
  setActiveNav(pathname);
  setRailVisible(isWikiPageRoute(pathname));

  const wikiPath = parsed.path;
  if (wikiPath === "" || wikiPath === "/") {
    await renderOverview();
    clearPageRail();
    return;
  }

  if (wikiPath === "/getting-started") {
    await renderGettingStarted();
    clearPageRail();
    return;
  }

  if (wikiPath.startsWith("/page/")) {
    await renderPage(decodeURIComponent(wikiPath.slice("/page/".length)));
    return;
  }

  if (wikiPath.startsWith("/topic/")) {
    await renderTopic(decodeURIComponent(wikiPath.slice("/topic/".length)));
    clearPageRail();
    return;
  }

  if (wikiPath === "/search") {
    const params = new URLSearchParams(search);
    await renderSearch(params.get("q") ?? "");
    clearPageRail();
    return;
  }

  if (wikiPath === "/jobs") {
    await jobsView.renderList();
    clearPageRail();
    return;
  }

  if (wikiPath.startsWith("/jobs/")) {
    await jobsView.renderDetail(decodeURIComponent(wikiPath.slice("/jobs/".length)));
    clearPageRail();
    return;
  }

  if (wikiPath === "/file") {
    const params = new URLSearchParams(search);
    await renderFile(params.get("path") ?? "");
    clearPageRail();
    return;
  }

  await renderOverview();
  clearPageRail();
}

function navigate(path) {
  const url = new URL(path, location.origin);
  route(url.pathname, url.search).catch((error) => renderError(error));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { accept: "application/json", ...(options.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`);
  return body;
}

async function selectWiki(name) {
  if (state.currentWiki !== name) {
    state.currentWiki = name;
    state.overview = null;
    state.currentPage = null;
    state.pageTitles = new Map();
    state.topicFilter = null;
  }
  if (state.overview === null) {
    state.overview = await api(wikiApi("/overview"));
    rememberPages(state.overview.recentPages);
  }
}

function wikiRoute(path = "") {
  return buildWikiRoute(state.currentWiki, path);
}

function wikiApi(path = "") {
  return buildWikiApi(state.currentWiki, path);
}

function renderChrome() {
  const inWiki = state.currentWiki !== null && state.overview !== null;
  els.searchInput.disabled = !inWiki;
  els.searchInput.placeholder = inWiki ? `Search ${state.currentWiki} pages` : "Open a wiki to search";

  els.topbarLinks.forEach((button) => {
    const route = button.dataset.route;
    button.disabled = !inWiki && route !== "/";
  });
}

function setActiveNav(pathname) {
  els.topbarLinks.forEach((button) => {
    const route = button.dataset.route;
    const active = route === "/"
      ? pathname === "/" || pathname.startsWith("/w/")
        && !pathname.includes("/jobs")
      : state.currentWiki !== null && (
        route === "/jobs"
          ? pathname === wikiRoute("/jobs") || pathname.startsWith(wikiRoute("/jobs/"))
          : pathname === wikiRoute(route)
      );
    button.classList.toggle("is-active", active);
  });
}

function setRailVisible(visible) {
  els.shell.classList.toggle("has-rail", visible);
  const rail = document.querySelector(".ca-right");
  if (rail !== null) rail.hidden = !visible;
}

function renderWikiDirectory() {
  document.title = "Library — Almanac";
  const total = state.wikis.length;
  const totalPages = state.wikis.reduce((sum, wiki) => sum + (wiki.pageCount ?? 0), 0);
  const totalTopics = state.wikis.reduce((sum, wiki) => sum + (wiki.topicCount ?? 0), 0);
  els.reader.innerHTML = `
    <section class="ca-hero">
      <div class="ca-section-label">Library</div>
      <h1 class="ca-display-h1">
        <span class="ca-display-soft">Field guide,</span>
        codebase by codebase.
      </h1>
      <p class="ca-lede">
        Every reachable Almanac wiki on this machine. Open one to read its margins —
        the decisions, the gotchas, the routes through it.
      </p>
      ${total > 0 ? `
        <div class="ca-hero-strip" aria-label="Library totals">
          <span class="ca-hero-strip-cell">
            <span class="ca-hero-strip-label">wikis</span>
            <span class="ca-hero-strip-value">${escapeHtml(total)}</span>
          </span>
          <span class="ca-hero-strip-cell">
            <span class="ca-hero-strip-label">pages</span>
            <span class="ca-hero-strip-value">${escapeHtml(totalPages)}</span>
          </span>
          <span class="ca-hero-strip-cell">
            <span class="ca-hero-strip-label">topics</span>
            <span class="ca-hero-strip-value">${escapeHtml(totalTopics)}</span>
          </span>
        </div>
      ` : ""}
    </section>
    <section class="ca-library">
      ${total > 0 ? `
        <div class="ca-library-grid">${state.wikis.map(wikiCard).join("")}</div>
      ` : `
        <div class="ca-bento-empty">
          No wikis registered yet. Run <span class="ca-file-code">almanac init</span> in a repo to scribe the first entry.
        </div>
      `}
    </section>
  `;
}

function wikiCard(wiki) {
  return `
    <div class="ca-wiki-card" data-route="/w/${escapeAttr(encodeURIComponent(wiki.name))}">
      <div class="ca-wiki-card-seal" aria-hidden="true">
        <span class="ca-wiki-card-seal-mark">${escapeHtml(wikiInitial(wiki.name))}</span>
      </div>
      <div class="ca-wiki-card-body">
        <div class="ca-wiki-card-kicker">${escapeHtml(wiki.name)}</div>
        <div class="ca-wiki-card-title">${escapeHtml(projectName(wiki.path) || wiki.name)}</div>
        <div class="ca-wiki-card-path">${escapeHtml(wiki.path)}</div>
        <div class="ca-wiki-card-stats">
          <span><strong>${escapeHtml(wiki.pageCount)}</strong> ${wiki.pageCount === 1 ? "page" : "pages"}</span>
          <span><strong>${escapeHtml(wiki.topicCount)}</strong> ${wiki.topicCount === 1 ? "topic" : "topics"}</span>
        </div>
      </div>
    </div>
  `;
}

function wikiInitial(name) {
  const cleaned = String(name).replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.charAt(0).toUpperCase() || "✥";
}

async function renderOverview() {
  const overview = state.overview;
  document.title = `${state.currentWiki} — Almanac`;
  const lastUpdate = mostRecentTimestamp(overview.recentPages);
  const pages = filteredPages(overview.recentPages, state.topicFilter);
  const filterStrip = renderTopicStrip(overview.rootTopics, overview.recentPages, state.topicFilter);
  els.reader.innerHTML = `
    <section class="ca-hero">
      <div class="ca-section-label">${escapeHtml(state.currentWiki)}</div>
      <h1 class="ca-display-h1">${escapeHtml(projectName(overview.repoRoot))}</h1>
      <p class="ca-lede">
        Living wiki, written in the margins by your agents. Indexed from
        <span class="ca-file-code">${escapeHtml(overview.repoRoot)}</span>.
      </p>
      <div class="ca-hero-strip" aria-label="Wiki state">
        <span class="ca-hero-strip-cell">
          <span class="ca-hero-strip-label">pages</span>
          <span class="ca-hero-strip-value">${escapeHtml(overview.pageCount)}</span>
        </span>
        <span class="ca-hero-strip-cell">
          <span class="ca-hero-strip-label">topics</span>
          <span class="ca-hero-strip-value">${escapeHtml(overview.topicCount)}</span>
        </span>
        ${lastUpdate !== null ? `
          <span class="ca-hero-strip-cell">
            <span class="ca-hero-strip-label">last entry</span>
            <span class="ca-hero-strip-value">${escapeHtml(formatRelativeTime(lastUpdate))}</span>
          </span>
        ` : ""}
      </div>
    </section>
    ${filterStrip}
    <section class="ca-bento" aria-label="Pages">
      ${
        pages.length > 0
          ? pages.map(pageCard).join("")
          : `<div class="ca-bento-empty">No pages match this filter.</div>`
      }
    </section>
  `;
}

function renderTopicStrip(rootTopics, pages, active) {
  if (!Array.isArray(rootTopics) || rootTopics.length === 0) return "";
  const buttons = [
    {
      slug: "",
      title: "All",
      count: pages.length,
    },
    ...rootTopics.map((topic) => ({
      slug: topic.slug,
      title: topic.title ?? topic.slug,
      count: pages.filter((page) => Array.isArray(page.topics) && page.topics.includes(topic.slug)).length,
    })),
  ];
  return `
    <div class="ca-topic-strip" role="toolbar" aria-label="Filter by topic">
      <span class="ca-topic-strip-label">topics</span>
      ${buttons.map((btn) => {
        const isActive = (active === null && btn.slug === "") || active === btn.slug;
        return `
          <button
            type="button"
            class="ca-topic-strip-button${isActive ? " is-active" : ""}"
            data-topic-filter="${escapeAttr(btn.slug)}"
          >
            <span>${escapeHtml(btn.title)}</span>
            <span class="ca-topic-strip-count">${escapeHtml(btn.count)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function filteredPages(pages, topicSlug) {
  if (topicSlug === null) return pages;
  return pages.filter((page) => Array.isArray(page.topics) && page.topics.includes(topicSlug));
}

function mostRecentTimestamp(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return null;
  let latest = null;
  for (const page of pages) {
    if (typeof page?.updated_at === "number" && (latest === null || page.updated_at > latest)) {
      latest = page.updated_at;
    }
  }
  return latest;
}

function formatRelativeTime(epochSeconds) {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - epochSeconds);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return formatDate(epochSeconds);
}

async function optionalPage(summary) {
  if (summary === undefined || summary === null) return null;
  try {
    return await api(wikiApi(`/page/${encodeURIComponent(summary.slug)}`));
  } catch {
    return null;
  }
}

async function renderGettingStarted() {
  const gettingStarted = await optionalPage(
    state.overview.featuredPages?.gettingStarted ?? state.overview.featuredPages?.projectOverview,
  );
  if (gettingStarted !== null) {
    rememberPages([gettingStarted]);
    renderPageArticle(gettingStarted);
    return;
  }

  document.title = `Getting started — ${state.currentWiki}`;
  els.reader.innerHTML = `
    ${renderPageActions(wikiRoute("/"))}
    <section class="ca-hero">
      <div class="ca-section-label">Getting started</div>
      <h1 class="ca-display-h1">No getting started page</h1>
      <p class="ca-lede">
        Add <span class="ca-file-code">.almanac/pages/getting-started.md</span> or
        <span class="ca-file-code">.almanac/pages/project-overview.md</span> to show page content here.
      </p>
    </section>
  `;
}

async function renderPage(slug) {
  const page = await api(wikiApi(`/page/${encodeURIComponent(slug)}`));
  state.currentPage = page;
  rememberPages([page, ...(page.related_pages ?? [])]);
  renderPageArticle(page);
  renderPageRail(page);
}

function renderPageArticle(page) {
  document.title = `${page.title ?? page.slug} — Almanac`;
  els.reader.innerHTML = `
    ${renderPageActions(wikiRoute("/"))}
    <article class="ca-article">
      <div class="ca-prose">${renderMarkdown(page.body, { decorateTitle: true, summary: page.summary })}</div>
    </article>
  `;
}

function renderArticleSummary(summary) {
  const text = summary?.trim();
  return text ? `<p class="ca-article-summary">${escapeHtml(text)}</p>` : "";
}

async function renderTopic(slug) {
  const topic = await api(wikiApi(`/topic/${encodeURIComponent(slug)}`));
  rememberPages(topic.pages);
  document.title = `${topic.title ?? topic.slug} — Almanac`;
  els.reader.innerHTML = `
    ${renderPageActions(wikiRoute("/"))}
    <section class="ca-hero">
      <div class="ca-section-label">Topic</div>
      <h1 class="ca-display-h1">${escapeHtml(topic.title ?? topic.slug)}</h1>
      ${topic.description ? `<p class="ca-lede">${escapeHtml(topic.description)}</p>` : ""}
      <div class="ca-hero-strip" aria-label="Topic state">
        <span class="ca-hero-strip-cell">
          <span class="ca-hero-strip-label">pages</span>
          <span class="ca-hero-strip-value">${escapeHtml(topic.pages.length)}</span>
        </span>
        ${topic.parents.length > 0 ? `
          <span class="ca-hero-strip-cell">
            <span class="ca-hero-strip-label">in</span>
            <span class="ca-hero-strip-value">${topic.parents.map((parent) => `<a class="ca-meta-link" href="${escapeAttr(wikiRoute(`/topic/${parent.slug}`))}" data-route="${escapeAttr(wikiRoute(`/topic/${parent.slug}`))}">${escapeHtml(parent.title ?? parent.slug)}</a>`).join(", ")}</span>
          </span>
        ` : ""}
      </div>
    </section>
    <section class="ca-bento" aria-label="Pages">
      ${
        topic.pages.length > 0
          ? topic.pages.map(pageCard).join("")
          : `<div class="ca-bento-empty">No pages in this topic yet.</div>`
      }
    </section>
  `;
}

async function renderSearch(query) {
  els.searchInput.value = query;
  const result = await api(wikiApi(`/search?q=${encodeURIComponent(query)}`));
  rememberPages(result.pages);
  document.title = `${query ? `Search: ${query}` : "Recent pages"} — Almanac`;
  els.reader.innerHTML = `
    ${renderPageActions(wikiRoute("/"))}
    <section class="ca-hero">
      <div class="ca-section-label">${query ? "Search" : "Recent"}</div>
      <h1 class="ca-display-h1">${query ? escapeHtml(query) : "Recent pages"}</h1>
      <p class="ca-lede">${result.pages.length} page${result.pages.length === 1 ? "" : "s"} found.</p>
    </section>
    <section class="ca-bento" aria-label="Pages">
      ${
        result.pages.length > 0
          ? result.pages.map(pageCard).join("")
          : `<div class="ca-bento-empty">Nothing matched.</div>`
      }
    </section>
  `;
}

async function renderFile(path) {
  const result = await api(wikiApi(`/file?path=${encodeURIComponent(path)}`));
  rememberPages(result.pages);
  els.reader.innerHTML = `
    ${renderPageActions(wikiRoute("/"))}
    <section class="ca-hero">
      <div class="ca-section-label">File reference</div>
      <h1 class="ca-display-h1">${escapeHtml(path || "File references")}</h1>
      <p class="ca-lede">${result.pages.length} page${result.pages.length === 1 ? "" : "s"} mention this path or one of its containing folders.</p>
    </section>
    <section class="ca-bento" aria-label="Pages">
      ${
        result.pages.length > 0
          ? result.pages.map(pageCard).join("")
          : `<div class="ca-bento-empty">No page mentions this path.</div>`
      }
    </section>
  `;
}

function renderPageRail(page) {
  els.pageMeta.innerHTML = `
    <div class="ca-meta-title">${escapeHtml(pageTitle(page))}</div>
    <div class="ca-meta-line">
      <span class="ca-meta-label">Updated</span>
      <span class="ca-meta-value">${new Date(page.updated_at * 1000).toLocaleString()}</span>
    </div>
    <div class="ca-meta-line">
      <span class="ca-meta-label">Markdown</span>
      <span class="ca-file-code">${escapeHtml(page.file_path)}</span>
    </div>
    ${page.archived_at ? `<div class="ca-meta-line"><span class="ca-meta-label">Archived</span><span class="ca-meta-value">${new Date(page.archived_at * 1000).toLocaleDateString()}</span></div>` : ""}
    ${page.superseded_by ? `<div class="ca-meta-line"><span class="ca-meta-label">Superseded by</span><a class="ca-meta-link" href="${escapeAttr(wikiRoute(`/page/${page.superseded_by}`))}" data-route="${escapeAttr(wikiRoute(`/page/${page.superseded_by}`))}">${escapeHtml(pageLabel(page.superseded_by))}</a></div>` : ""}
  `;
  els.backlinks.innerHTML = page.wikilinks_in.length > 0
    ? page.wikilinks_in.map((slug) => linkButton(pageLabel(slug), wikiRoute(`/page/${slug}`))).join("")
    : `<div class="ca-meta-empty">No pages link here.</div>`;
  els.fileRefs.innerHTML = page.file_refs.length > 0
    ? page.file_refs.map((ref) => linkButton(ref.path, wikiRoute(`/file?path=${encodeURIComponent(ref.path)}`), "", "ca-file-link")).join("")
    : `<div class="ca-meta-empty">No file refs.</div>`;
}

function clearPageRail() {
  els.pageMeta.innerHTML = `<div class="ca-meta-empty">Select a page.</div>`;
  els.backlinks.innerHTML = "";
  els.fileRefs.innerHTML = "";
}

function pageCard(page) {
  const relative = typeof page.updated_at === "number" ? formatRelativeTime(page.updated_at) : null;
  const topics = Array.isArray(page.topics) ? page.topics.slice(0, 2) : [];
  const summaryRaw = (page.summary ?? "").trim();
  const hasSummary = summaryRaw.length > 0;
  const summaryHtml = hasSummary
    ? renderCardSummary(summaryRaw)
    : `<span class="ca-page-card-summary-empty">No summary recorded yet. The agents will fill this in on the next capture.</span>`;
  return `
    <article class="ca-page-card" data-route="${escapeAttr(wikiRoute(`/page/${page.slug}`))}">
      <h3 class="ca-page-card-title">${escapeHtml(pageTitle(page))}</h3>
      <p class="ca-page-card-summary">${summaryHtml}</p>
      <footer class="ca-page-card-meta">
        ${topics.length > 0 ? `<span class="ca-page-card-meta-topics">${topics.map(escapeHtml).join(" · ")}</span>` : ""}
        ${topics.length > 0 && relative !== null ? `<span class="ca-page-card-meta-sep" aria-hidden="true">·</span>` : ""}
        ${relative !== null ? `<span class="ca-page-card-meta-time">${escapeHtml(relative)}</span>` : ""}
        <span class="ca-page-card-arrow" aria-hidden="true">→</span>
      </footer>
    </article>
  `;
}

function renderCardSummary(text) {
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function linkButton(label, route, detail = "", extraClass = "") {
  return `
    <button class="ca-link-button ${escapeAttr(extraClass)}" data-route="${escapeAttr(route)}">
      <span class="ca-link-label">${escapeHtml(label)}</span>
      ${detail ? `<span class="ca-link-detail">${escapeHtml(detail)}</span>` : ""}
    </button>
  `;
}

function renderPageActions(fallbackRoute) {
  return `
    <div class="ca-page-actions">
      <button class="ca-back-button" type="button" data-back data-fallback-route="${escapeAttr(fallbackRoute)}">Back</button>
    </div>
  `;
}

function renderMarkdown(source, options = {}) {
  const blocks = [];
  let inCode = false;
  let code = [];
  let decoratedHeading = false;
  const decorateTitle = options.decorateTitle === true;

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (line.trim().length === 0) {
      blocks.push("");
      continue;
    }
    if (line.startsWith("### ")) blocks.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (line.startsWith("## ")) blocks.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) {
      blocks.push(renderHeading(line.slice(2), decorateTitle && !decoratedHeading, options.summary));
      decoratedHeading = true;
    }
    else if (line.startsWith("- ")) blocks.push(`<p>• ${inline(line.slice(2))}</p>`);
    else blocks.push(`<p>${inline(line)}</p>`);
  }
  if (inCode) blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return blocks.filter(Boolean).join("\n");
}

function renderHeading(text, decorated, summary = null) {
  const level = decorated ? "h1" : "h2";
  const heading = `<${level}>${inline(text)}</${level}>`;
  if (!decorated) return heading;
  return `${heading}\n${renderArticleSummary(summary)}\n<div class="ca-page-ornament" aria-hidden="true"><span>✥</span></div>`;
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[\[([^\]]+)\]\]/g, (_, target) => {
      const route = routeForWikilink(target, state.currentWiki);
      const label = labelForWikilink(target, pageLabel);
      return `<a href="${escapeAttr(route)}" data-route="${escapeAttr(route)}">${escapeHtml(label)}</a>`;
    })
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function rememberPages(pages) {
  for (const page of pages ?? []) {
    if (page?.slug) state.pageTitles.set(page.slug, pageTitle(page));
  }
}

function pageTitle(page) {
  return page.title ?? page.slug;
}

function pageLabel(slug) {
  return state.pageTitles.get(slug) ?? slug;
}

function formatDate(epochSeconds) {
  return new Date(epochSeconds * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString();
}

function formatElapsed(ms) {
  if (ms < 1_000) return `${ms}ms`;
  const seconds = Math.round(ms / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function goBack() {
  const active = document.querySelector("[data-back]");
  const fallbackRoute = active?.dataset?.fallbackRoute ?? "/";
  if (state.historyIndex > 0) {
    history.back();
    return;
  }
  navigate(fallbackRoute);
}

function initializeHistoryState() {
  state.historyIndex = historyIndexFromState(history.state);
  history.replaceState(historyState(state.historyIndex), "", location.href);
}

function historyState(index) {
  return { ...(history.state ?? {}), almanacHistoryIndex: index };
}

function historyIndexFromState(value) {
  return typeof value?.almanacHistoryIndex === "number" ? value.almanacHistoryIndex : 0;
}

function projectName(repoRoot) {
  return repoRoot.split("/").filter(Boolean).at(-1) ?? "Project";
}

function renderError(error) {
  els.reader.innerHTML = `<div class="ca-error">${escapeHtml(error.message ?? String(error))}</div>`;
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
