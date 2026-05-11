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

const SIDEBAR_TAG_LIMIT = 8;

const state = {
  wikis: [],
  currentWiki: null,
  overview: null,
  currentPage: null,
  pageTitles: new Map(),
  showAllTopics: false,
  historyIndex: 0,
};

const els = {
  shell: document.querySelector("#app"),
  reader: document.querySelector("#reader"),
  topicList: document.querySelector("#topic-list"),
  pageMeta: document.querySelector("#page-meta"),
  backlinks: document.querySelector("#backlinks"),
  fileRefs: document.querySelector("#file-refs"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
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
    const topicToggle = event.target.closest("[data-topic-toggle]");
    if (topicToggle !== null) {
      event.preventDefault();
      state.showAllTopics = !state.showAllTopics;
      renderChrome();
      setActiveNav(location.pathname);
      return;
    }

    const back = event.target.closest("[data-back]");
    if (back !== null) {
      event.preventDefault();
      goBack();
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
    state.showAllTopics = false;
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
  els.searchInput.placeholder = inWiki ? "Search pages" : "Open a wiki to search";

  document.querySelectorAll(".ca-nav [data-route]").forEach((button) => {
    button.disabled = !inWiki && button.dataset.route !== "/";
  });

  if (!inWiki) {
    els.topicList.innerHTML = `<div class="ca-meta-empty">Open a wiki to browse topics.</div>`;
    return;
  }

  const topics = state.overview.topics;
  const topicNavigation = state.overview.topicNavigation;
  const isCurated = topicNavigation?.source === "curated";
  const limit = topicNavigation?.sidebarLimit ?? SIDEBAR_TAG_LIMIT;
  const visibleTopics = isCurated || state.showAllTopics ? topics : topics.slice(0, limit);
  const toggle = !isCurated && topics.length > limit
    ? topicToggleButton(state.showAllTopics, topics.length - limit)
    : "";
  els.topicList.innerHTML = `${renderTopicTree(visibleTopics)}${toggle}`;
}

function renderTopicTree(topics) {
  const bySlug = new Map(topics.map((topic) => [topic.slug, topic]));
  const childrenByParent = new Map();
  const roots = [];

  for (const topic of topics) {
    const parents = Array.isArray(topic.parents)
      ? topic.parents.filter((parent) => bySlug.has(parent))
      : [];
    if (parents.length === 0) {
      roots.push(topic.slug);
      continue;
    }
    for (const parent of parents) {
      const children = childrenByParent.get(parent) ?? [];
      children.push(topic.slug);
      childrenByParent.set(parent, children);
    }
  }

  return renderTopicBranch(roots, bySlug, childrenByParent, 0, new Set());
}

function renderTopicBranch(slugs, bySlug, childrenByParent, depth, path) {
  return slugs
    .map((slug) => {
      if (path.has(slug)) return "";
      const topic = bySlug.get(slug);
      if (topic === undefined) return "";
      const nextPath = new Set(path);
      nextPath.add(slug);
      const displayDepth = Math.min(depth, 4);
      return [
        linkButton(
          topic.title ?? topic.slug,
          wikiRoute(`/topic/${topic.slug}`),
          `${topic.page_count} pages`,
          `ca-topic-link ca-topic-depth-${displayDepth}`,
        ),
        renderTopicBranch(childrenByParent.get(slug) ?? [], bySlug, childrenByParent, depth + 1, nextPath),
      ].join("");
    })
    .join("");
}

function topicToggleButton(showAll, hiddenCount) {
  const label = showAll ? "Show fewer topics" : "Show all topics";
  const detail = showAll ? "" : `${hiddenCount} more`;
  return `
    <button class="ca-link-button ca-topic-toggle" type="button" data-topic-toggle>
      <span class="ca-link-label">${escapeHtml(label)}</span>
      ${detail ? `<span class="ca-link-detail">${escapeHtml(detail)}</span>` : ""}
    </button>
  `;
}

function renderWikiDirectory() {
  document.title = "All wikis - Almanac";
  const rows = state.wikis.length > 0
    ? state.wikis.map(wikiRow).join("")
    : `<div class="ca-meta-empty">No wikis registered yet. Run <span class="ca-file-code">almanac init</span> in a repo.</div>`;
  els.reader.innerHTML = `
    <section class="ca-hero">
      <div class="ca-kicker">Local library</div>
      <h1 class="ca-title">All wikis</h1>
      <p class="ca-subtitle">
        Browse every reachable Almanac wiki registered on this computer.
      </p>
    </section>
    <section class="ca-wiki-directory">
      <div class="ca-page-list">${rows}</div>
    </section>
  `;
}

function wikiRow(wiki) {
  return `
    <div class="ca-page-row ca-wiki-row" data-route="/w/${escapeAttr(encodeURIComponent(wiki.name))}">
      <div class="ca-page-row-title">${escapeHtml(wiki.name)}</div>
      <div class="ca-page-row-summary">${escapeHtml(wiki.description || "No description.")}</div>
      <div class="ca-wiki-stats">
        <span>${escapeHtml(wiki.pageCount)} active pages</span>
        <span>${escapeHtml(wiki.topicCount)} topics</span>
      </div>
      <div class="ca-file-code">${escapeHtml(wiki.path)}</div>
    </div>
  `;
}

async function renderOverview() {
  const overview = state.overview;
  document.title = `${state.currentWiki} - Almanac`;
  els.reader.innerHTML = `
    ${renderPageActions("/")}
    <section class="ca-hero">
      <div class="ca-kicker">Project overview</div>
      <h1 class="ca-title">${escapeHtml(projectName(overview.repoRoot))}</h1>
      <p class="ca-subtitle">
        ${escapeHtml(overview.pageCount)} active pages and ${escapeHtml(overview.topicCount)} topics indexed from
        <span class="ca-file-code">${escapeHtml(overview.repoRoot)}</span>.
      </p>
    </section>
    <section class="ca-grid">
      <div class="ca-panel">
        <h2>Recent pages</h2>
        <div class="ca-page-list">${overview.recentPages.map(pageRow).join("")}</div>
      </div>
      <div class="ca-panel">
        <h2>Root topics</h2>
        <div class="ca-page-list">
          ${overview.rootTopics.map((topic) => `
            <div class="ca-page-row" data-route="${escapeAttr(wikiRoute(`/topic/${topic.slug}`))}">
              <div class="ca-page-row-title">${escapeHtml(topic.title ?? topic.slug)}</div>
              <div class="ca-page-row-summary">${escapeHtml(topic.description ?? `${topic.page_count} active pages`)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    </section>
  `;
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

  document.title = `Getting started - ${state.currentWiki}`;
  els.reader.innerHTML = `
    ${renderPageActions(wikiRoute("/"))}
    <section class="ca-hero">
      <div class="ca-kicker">Getting started</div>
      <h1 class="ca-title">No getting started page</h1>
      <p class="ca-subtitle">
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
  document.title = `${page.title ?? page.slug} - Almanac`;
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
  document.title = `${topic.title ?? topic.slug} - Almanac`;
  els.reader.innerHTML = `
    ${renderPageActions(wikiRoute("/"))}
    <section class="ca-hero">
      <div class="ca-kicker">Topic</div>
      <h1 class="ca-title">${escapeHtml(topic.title ?? topic.slug)}</h1>
      <p class="ca-subtitle">${escapeHtml(topic.description ?? "Pages grouped under this topic.")}</p>
      <div class="ca-chip-row">
        ${topic.parents.map((parent) => `<button class="ca-chip" data-route="${escapeAttr(wikiRoute(`/topic/${parent.slug}`))}">${escapeHtml(parent.title ?? parent.slug)}</button>`).join("")}
      </div>
    </section>
    <section class="ca-grid">
      <div class="ca-panel">
        <h2>Pages</h2>
        <div class="ca-page-list">${topic.pages.map(pageRow).join("")}</div>
      </div>
      <div class="ca-panel">
        <h2>Child topics</h2>
        <div class="ca-page-list">
          ${topic.children.map((child) => `
            <div class="ca-page-row" data-route="${escapeAttr(wikiRoute(`/topic/${child.slug}`))}">
              <div class="ca-page-row-title">${escapeHtml(child.title ?? child.slug)}</div>
              <div class="ca-page-row-summary">${escapeHtml(child.page_count)} active pages</div>
            </div>
          `).join("") || `<div class="ca-meta-empty">No child topics.</div>`}
        </div>
      </div>
    </section>
  `;
}

async function renderSearch(query) {
  els.searchInput.value = query;
  const result = await api(wikiApi(`/search?q=${encodeURIComponent(query)}`));
  rememberPages(result.pages);
  document.title = `${query ? `Search: ${query}` : "Recent pages"} - Almanac`;
  els.reader.innerHTML = `
    ${renderPageActions(wikiRoute("/"))}
    <section class="ca-hero">
      <div class="ca-kicker">${query ? "Search" : "Recent"}</div>
      <h1 class="ca-title">${query ? escapeHtml(query) : "Recent pages"}</h1>
      <p class="ca-subtitle">${result.pages.length} page${result.pages.length === 1 ? "" : "s"} found.</p>
    </section>
    <div class="ca-page-list">${result.pages.map(pageRow).join("")}</div>
  `;
}

async function renderFile(path) {
  const result = await api(wikiApi(`/file?path=${encodeURIComponent(path)}`));
  rememberPages(result.pages);
  els.reader.innerHTML = `
    ${renderPageActions(wikiRoute("/"))}
    <section class="ca-hero">
      <div class="ca-kicker">File reference</div>
      <h1 class="ca-title">${escapeHtml(path || "File references")}</h1>
      <p class="ca-subtitle">${result.pages.length} page${result.pages.length === 1 ? "" : "s"} mention this path or one of its containing folders.</p>
    </section>
    <div class="ca-page-list">${result.pages.map(pageRow).join("")}</div>
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

function pageRow(page) {
  return `
    <div class="ca-page-row" data-route="${escapeAttr(wikiRoute(`/page/${page.slug}`))}">
      <div class="ca-page-row-title">${escapeHtml(pageTitle(page))}</div>
      <div class="ca-page-row-summary">${escapeHtml(page.summary ?? formatDate(page.updated_at))}</div>
      <div class="ca-chip-row">${page.topics.slice(0, 4).map((topic) => `<span class="ca-chip">${escapeHtml(topic)}</span>`).join("")}</div>
    </div>
  `;
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

function setActiveNav(pathname) {
  document.querySelectorAll(".ca-left [data-route]").forEach((button) => {
    const route = button.dataset.route;
    const active = route === "/"
      ? pathname === "/"
      : state.currentWiki !== null && (
        route === "/jobs"
          ? pathname === wikiRoute("/jobs") || pathname.startsWith(wikiRoute("/jobs/"))
          : pathname === wikiRoute(route)
      );
    button.classList.toggle("is-active", active);
  });
}

function setRailVisible(visible) {
  els.shell.classList.toggle("is-rail-hidden", !visible);
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
