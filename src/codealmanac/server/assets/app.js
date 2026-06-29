const state = {
  overview: null,
};

const el = {
  workspaceName: document.getElementById("workspace-name"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  topicList: document.getElementById("topic-list"),
  pageList: document.getElementById("page-list"),
  main: document.getElementById("main"),
  backlinks: document.getElementById("backlinks"),
  fileRefs: document.getElementById("file-refs"),
  related: document.getElementById("related"),
};

el.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = el.searchInput.value.trim();
  window.location.hash = query ? `#/search/${encodeURIComponent(query)}` : "#/";
});

window.addEventListener("hashchange", route);
loadOverview().then(route);

async function loadOverview() {
  state.overview = await getJson("/api/overview");
  el.workspaceName.textContent = state.overview.workspace.name;
  renderNav();
}

async function route() {
  if (!state.overview) return;
  const [kind, value] = parseHash();
  clearSidebars();
  try {
    if (kind === "page" && value) {
      await renderPage(value);
      return;
    }
    if (kind === "topic" && value) {
      await renderTopic(value);
      return;
    }
    if (kind === "search" && value) {
      await renderSearch(value);
      return;
    }
    if (kind === "file" && value) {
      await renderFile(value);
      return;
    }
    renderHome();
  } catch (error) {
    renderError(error);
  }
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return ["home", ""];
  const parts = raw.split("/");
  return [parts[0], decodeURIComponent(parts.slice(1).join("/"))];
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail?.message || `Request failed: ${response.status}`);
  }
  return data;
}

function renderNav() {
  el.topicList.replaceChildren(
    ...state.overview.topics.map((topic) =>
      navLink(`#/topic/${encodeURIComponent(topic.slug)}`, topic.title || topic.slug),
    ),
  );
  el.pageList.replaceChildren(
    ...state.overview.pages.map((page) =>
      navLink(`#/page/${encodeURIComponent(page.slug)}`, page.title || page.slug),
    ),
  );
}

function renderHome() {
  const title = state.overview.featured_page?.title || "Wiki";
  el.main.innerHTML = "";
  el.main.append(
    readerHeader(
      title,
      `${state.overview.page_count} pages · ${state.overview.topic_count} topics`,
      [],
    ),
    gridList(state.overview.pages),
  );
  el.main.focus();
}

async function renderPage(slug) {
  const page = await getJson(`/api/page/${encodeURIComponent(slug)}`);
  el.main.innerHTML = "";
  el.main.append(
    readerHeader(page.title || page.slug, page.summary || "", page.topics),
    markdown(page.html),
  );
  renderSidebarLinks(el.backlinks, page.backlinks, "page");
  renderSidebarFiles(page.file_refs);
  renderSidebarPages(el.related, page.related_pages);
  el.main.focus();
}

async function renderTopic(slug) {
  const topic = await getJson(`/api/topic/${encodeURIComponent(slug)}`);
  el.main.innerHTML = "";
  el.main.append(
    readerHeader(topic.title || topic.slug, topic.description || "", []),
    gridList(topic.pages),
  );
  el.main.focus();
}

async function renderSearch(query) {
  el.searchInput.value = query;
  const result = await getJson(`/api/search?q=${encodeURIComponent(query)}`);
  el.main.innerHTML = "";
  el.main.append(
    readerHeader(`Search: ${query}`, `${result.pages.length} results`, []),
    gridList(result.pages),
  );
  el.main.focus();
}

async function renderFile(path) {
  const result = await getJson(`/api/file?path=${encodeURIComponent(path)}`);
  const noun = result.kind === "directory" ? "folder" : "file";
  el.main.innerHTML = "";
  el.main.append(
    readerHeader(
      result.path,
      `${result.pages.length} pages mention this ${noun}`,
      [],
    ),
    gridList(result.pages),
  );
  el.main.focus();
}

function readerHeader(title, summary, topics) {
  const header = document.createElement("header");
  header.className = "reader-header";
  const h1 = document.createElement("h1");
  h1.textContent = title;
  header.append(h1);
  if (summary) {
    const p = document.createElement("p");
    p.className = "summary";
    p.textContent = summary;
    header.append(p);
  }
  if (topics.length > 0) {
    const row = document.createElement("div");
    row.className = "meta-row";
    for (const topic of topics) {
      const pill = document.createElement("a");
      pill.className = "pill";
      pill.href = `#/topic/${encodeURIComponent(topic)}`;
      pill.textContent = topic;
      row.append(pill);
    }
    header.append(row);
  }
  return header;
}

function markdown(html) {
  const article = document.createElement("article");
  article.className = "markdown";
  article.innerHTML = html;
  return article;
}

function gridList(pages) {
  const list = document.createElement("div");
  list.className = "grid-list";
  if (pages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "summary";
    empty.textContent = "No pages found.";
    return empty;
  }
  for (const page of pages) {
    const item = document.createElement("a");
    item.href = `#/page/${encodeURIComponent(page.slug)}`;
    const title = document.createElement("strong");
    title.textContent = page.title || page.slug;
    const summary = document.createElement("small");
    summary.textContent = page.summary || page.topics.join(", ");
    item.append(title, summary);
    list.append(item);
  }
  return list;
}

function navLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  return link;
}

function renderSidebarLinks(target, slugs, kind) {
  target.replaceChildren(
    ...slugs.map((slug) =>
      navLink(`#/${kind}/${encodeURIComponent(slug)}`, slug),
    ),
  );
  if (slugs.length === 0) {
    target.replaceChildren(sidebarEmpty());
  }
}

function renderSidebarFiles(files) {
  el.fileRefs.replaceChildren(
    ...files.map((file) => {
      const row = document.createElement("a");
      row.href = `#/file/${encodeURIComponent(file.path)}`;
      row.textContent = file.path;
      return row;
    }),
  );
  if (files.length === 0) {
    el.fileRefs.replaceChildren(sidebarEmpty());
  }
}

function renderSidebarPages(target, pages) {
  target.replaceChildren(
    ...pages.map((page) =>
      navLink(`#/page/${encodeURIComponent(page.slug)}`, page.title || page.slug),
    ),
  );
  if (pages.length === 0) {
    target.replaceChildren(sidebarEmpty());
  }
}

function sidebarEmpty() {
  const empty = document.createElement("span");
  empty.textContent = "None";
  return empty;
}

function clearSidebars() {
  el.backlinks.replaceChildren(sidebarEmpty());
  el.fileRefs.replaceChildren(sidebarEmpty());
  el.related.replaceChildren(sidebarEmpty());
}

function renderError(error) {
  el.main.innerHTML = "";
  const header = readerHeader("Error", "", []);
  const message = document.createElement("p");
  message.className = "error";
  message.textContent = error.message;
  el.main.append(header, message);
}
