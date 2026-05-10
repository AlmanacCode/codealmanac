const state = {
  overview: null,
  currentPage: null,
  pageTitles: new Map(),
};

const els = {
  reader: document.querySelector("#reader"),
  topicList: document.querySelector("#topic-list"),
  recentList: document.querySelector("#recent-list"),
  pageMeta: document.querySelector("#page-meta"),
  backlinks: document.querySelector("#backlinks"),
  fileRefs: document.querySelector("#file-refs"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
};

boot().catch((error) => renderError(error));

async function boot() {
  wireEvents();
  state.overview = await api("/api/overview");
  rememberPages(state.overview.recentPages);
  renderChrome();
  await route(location.pathname, location.search, false);
}

function wireEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-route]");
    if (target === null) return;
    event.preventDefault();
    navigate(target.dataset.route);
  });

  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = els.searchInput.value.trim();
    navigate(query.length > 0 ? `/search?q=${encodeURIComponent(query)}` : "/search");
  });

  window.addEventListener("popstate", () => {
    route(location.pathname, location.search, false).catch((error) => renderError(error));
  });
}

async function route(pathname, search = "", push = true) {
  if (push) history.pushState(null, "", pathname + search);
  setActiveNav(pathname);

  if (pathname === "/") {
    renderOverview();
    clearPageRail();
    return;
  }

  if (pathname.startsWith("/page/")) {
    await renderPage(decodeURIComponent(pathname.slice("/page/".length)));
    return;
  }

  if (pathname.startsWith("/topic/")) {
    await renderTopic(decodeURIComponent(pathname.slice("/topic/".length)));
    clearPageRail();
    return;
  }

  if (pathname === "/search") {
    const params = new URLSearchParams(search);
    await renderSearch(params.get("q") ?? "");
    clearPageRail();
    return;
  }

  if (pathname === "/file") {
    const params = new URLSearchParams(search);
    await renderFile(params.get("path") ?? "");
    clearPageRail();
    return;
  }

  renderOverview();
  clearPageRail();
}

function navigate(path) {
  const url = new URL(path, location.origin);
  route(url.pathname, url.search).catch((error) => renderError(error));
}

async function api(path) {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`);
  return body;
}

function renderChrome() {
  els.topicList.innerHTML = state.overview.rootTopics
    .map((topic) => linkButton(topic.title ?? topic.slug, `/topic/${topic.slug}`, `${topic.page_count} pages`))
    .join("");

  els.recentList.innerHTML = state.overview.recentPages
    .slice(0, 8)
    .map((page) => linkButton(pageTitle(page), `/page/${page.slug}`, page.summary ?? ""))
    .join("");
}

function renderOverview() {
  const overview = state.overview;
  els.reader.innerHTML = `
    <section class="ca-hero">
      <div class="ca-kicker">Local wiki</div>
      <h1 class="ca-title">${escapeHtml(overview.wikiTitle)}</h1>
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
            <div class="ca-page-row" data-route="/topic/${escapeAttr(topic.slug)}">
              <div class="ca-page-row-title">${escapeHtml(topic.title ?? topic.slug)}</div>
              <div class="ca-page-row-summary">${escapeHtml(topic.description ?? `${topic.page_count} active pages`)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

async function renderPage(slug) {
  const page = await api(`/api/page/${encodeURIComponent(slug)}`);
  state.currentPage = page;
  rememberPages([page, ...(page.related_pages ?? [])]);
  document.title = `${page.title ?? page.slug} - Almanac`;
  els.reader.innerHTML = `
    <article class="ca-article">
      <header class="ca-page-header">
        <h1>${escapeHtml(pageTitle(page))}</h1>
        <div class="ca-page-header-meta">Last revised ${escapeHtml(formatDate(page.updated_at))}</div>
        <div class="ca-chip-row" style="justify-content: center;">
          ${page.topics.map((topic) => `<button class="ca-chip" data-route="/topic/${escapeAttr(topic)}">${escapeHtml(topic)}</button>`).join("")}
        </div>
        <div class="ca-page-ornament"><span>✥</span></div>
      </header>
      <div class="ca-prose">${renderMarkdown(page.body)}</div>
    </article>
  `;
  renderPageRail(page);
}

async function renderTopic(slug) {
  const topic = await api(`/api/topic/${encodeURIComponent(slug)}`);
  rememberPages(topic.pages);
  document.title = `${topic.title ?? topic.slug} - Almanac`;
  els.reader.innerHTML = `
    <section class="ca-hero">
      <div class="ca-kicker">Topic</div>
      <h1 class="ca-title">${escapeHtml(topic.title ?? topic.slug)}</h1>
      <p class="ca-subtitle">${escapeHtml(topic.description ?? "Pages grouped under this topic.")}</p>
      <div class="ca-chip-row">
        ${topic.parents.map((parent) => `<button class="ca-chip" data-route="/topic/${escapeAttr(parent.slug)}">${escapeHtml(parent.title ?? parent.slug)}</button>`).join("")}
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
            <div class="ca-page-row" data-route="/topic/${escapeAttr(child.slug)}">
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
  const result = await api(`/api/search?q=${encodeURIComponent(query)}`);
  rememberPages(result.pages);
  els.reader.innerHTML = `
    <section class="ca-hero">
      <div class="ca-kicker">${query ? "Search" : "Recent"}</div>
      <h1 class="ca-title">${query ? escapeHtml(query) : "Recent pages"}</h1>
      <p class="ca-subtitle">${result.pages.length} page${result.pages.length === 1 ? "" : "s"} found.</p>
    </section>
    <div class="ca-page-list">${result.pages.map(pageRow).join("")}</div>
  `;
}

async function renderFile(path) {
  const result = await api(`/api/file?path=${encodeURIComponent(path)}`);
  rememberPages(result.pages);
  els.reader.innerHTML = `
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
    <div class="ca-meta-line"><strong>Updated:</strong> ${new Date(page.updated_at * 1000).toLocaleString()}</div>
    <div class="ca-meta-line"><strong>Markdown:</strong><br><span class="ca-file-code">${escapeHtml(page.file_path)}</span></div>
    ${page.archived_at ? `<div class="ca-meta-line"><strong>Archived:</strong> ${new Date(page.archived_at * 1000).toLocaleDateString()}</div>` : ""}
    ${page.superseded_by ? `<div class="ca-meta-line"><strong>Superseded by:</strong> <a class="ca-meta-link" href="/page/${escapeAttr(page.superseded_by)}" data-route="/page/${escapeAttr(page.superseded_by)}">${escapeHtml(pageLabel(page.superseded_by))}</a></div>` : ""}
  `;
  els.backlinks.innerHTML = page.wikilinks_in.length > 0
    ? page.wikilinks_in.map((slug) => linkButton(pageLabel(slug), `/page/${slug}`)).join("")
    : `<div class="ca-meta-empty">No backlinks.</div>`;
  els.fileRefs.innerHTML = page.file_refs.length > 0
    ? page.file_refs.map((ref) => linkButton(ref.path, `/file?path=${encodeURIComponent(ref.path)}`)).join("")
    : `<div class="ca-meta-empty">No file refs.</div>`;
}

function clearPageRail() {
  els.pageMeta.innerHTML = `<div class="ca-meta-empty">Select a page.</div>`;
  els.backlinks.innerHTML = "";
  els.fileRefs.innerHTML = "";
}

function pageRow(page) {
  return `
    <div class="ca-page-row" data-route="/page/${escapeAttr(page.slug)}">
      <div class="ca-page-row-title">${escapeHtml(pageTitle(page))}</div>
      <div class="ca-page-row-summary">${escapeHtml(page.summary ?? formatDate(page.updated_at))}</div>
      <div class="ca-chip-row">${page.topics.slice(0, 4).map((topic) => `<span class="ca-chip">${escapeHtml(topic)}</span>`).join("")}</div>
    </div>
  `;
}

function linkButton(label, route, detail = "") {
  return `
    <button class="ca-link-button" data-route="${escapeAttr(route)}">
      ${escapeHtml(label)}
      ${detail ? `<br><small>${escapeHtml(detail)}</small>` : ""}
    </button>
  `;
}

function renderMarkdown(source) {
  const blocks = [];
  let inCode = false;
  let code = [];

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
    else if (line.startsWith("# ")) blocks.push(`<h2>${inline(line.slice(2))}</h2>`);
    else if (line.startsWith("- ")) blocks.push(`<p>• ${inline(line.slice(2))}</p>`);
    else blocks.push(`<p>${inline(line)}</p>`);
  }
  if (inCode) blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return blocks.filter(Boolean).join("\n");
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[\[([^\]]+)\]\]/g, (_, target) => {
      const route = target.includes("/") ? `/file?path=${encodeURIComponent(target)}` : `/page/${encodeURIComponent(target)}`;
      const label = target.includes("/") ? target : pageLabel(target);
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

function setActiveNav(pathname) {
  document.querySelectorAll(".ca-nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.route === pathname);
  });
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
