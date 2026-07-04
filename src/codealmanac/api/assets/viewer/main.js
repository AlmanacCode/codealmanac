import { viewerApi } from "./api.js";
import { navLink } from "./components.js";
import { clearRunPolling, renderRun, renderRuns } from "./runs.js";
import {
  renderError,
  renderFile,
  renderHome,
  renderPage,
  renderSearch,
  renderTopic,
} from "./renderers.js";
import {
  pageHref,
  parseHash,
  RouteKind,
  searchHref,
} from "./routes.js";

const state = {
  overview: null,
  selectedWiki: "",
};

export function startViewer() {
  const elements = readElements();
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.hash = searchHref(elements.searchInput.value.trim());
  });
  elements.workspaceSelect.addEventListener("change", async () => {
    clearRunPolling();
    state.selectedWiki = elements.workspaceSelect.value;
    await loadOverview(elements, state.selectedWiki);
    await route(elements);
  });

  window.addEventListener("hashchange", () => route(elements));
  loadOverview(elements).then(() => route(elements));
}

async function loadOverview(elements, wiki = state.selectedWiki) {
  state.overview = await viewerApi.overview(wiki);
  state.selectedWiki = state.overview.workspace.workspace_id;
  renderWorkspaceOptions(elements, state.overview);
  renderNav(elements, state.overview);
}

async function route(elements) {
  if (!state.overview) return;
  clearRunPolling();
  const context = {
    elements,
    overview: state.overview,
    wiki: state.selectedWiki,
    setRouteTitle: (title) => setRouteTitle(elements, title),
  };
  try {
    const routeState = parseHash(window.location.hash);
    setActiveNav(elements, routeState);
    if (routeState.kind === RouteKind.PAGE && routeState.value) {
      await renderPage(context, routeState.value);
      return;
    }
    if (routeState.kind === RouteKind.TOPIC && routeState.value) {
      await renderTopic(context, routeState.value);
      return;
    }
    if (routeState.kind === RouteKind.SEARCH) {
      await renderSearch(context, routeState.value);
      return;
    }
    if (routeState.kind === RouteKind.FILE && routeState.value) {
      await renderFile(context, routeState.value);
      return;
    }
    if (routeState.kind === RouteKind.JOBS) {
      await renderRuns(context);
      return;
    }
    if (routeState.kind === RouteKind.JOB && routeState.value) {
      await renderRun(context, routeState.value);
      return;
    }
    renderHome(context);
  } catch (error) {
    renderError(context, error);
  }
}

function readElements() {
  return {
    workspaceSelect: document.getElementById("workspace-select"),
    routeTitle: document.getElementById("route-title"),
    searchForm: document.getElementById("search-form"),
    searchInput: document.getElementById("search-input"),
    pageList: document.getElementById("page-list"),
    main: document.getElementById("main"),
    navItems: Array.from(document.querySelectorAll("[data-nav-kind]")),
    railLinks: () => Array.from(document.querySelectorAll("[data-rail-kind]")),
  };
}

function renderWorkspaceOptions(elements, overview) {
  elements.workspaceSelect.replaceChildren(
    ...overview.workspaces.map((workspace) => {
      const option = document.createElement("option");
      option.value = workspace.workspace_id;
      option.textContent = workspace.name;
      return option;
    }),
  );
  elements.workspaceSelect.value = overview.workspace.workspace_id;
  elements.workspaceSelect.disabled = overview.workspaces.length <= 1;
}

function renderNav(elements, overview) {
  elements.pageList.replaceChildren(
    ...pageTree(overview.navigation_pages || overview.pages),
  );
}

function pageTree(pages) {
  const root = createFolderNode("");
  for (const page of pages) {
    insertPage(root, page);
  }
  return renderFolderChildren(root, 0);
}

function createFolderNode(name) {
  return {
    name,
    folders: new Map(),
    pages: [],
  };
}

function insertPage(root, page) {
  const path = page.path || `${page.slug}.md`;
  const parts = path.split("/").filter(Boolean);
  const filename = parts.pop() || `${page.slug}.md`;
  let cursor = root;
  for (const part of parts) {
    if (!cursor.folders.has(part)) {
      cursor.folders.set(part, createFolderNode(part));
    }
    cursor = cursor.folders.get(part);
  }
  cursor.pages.push({ ...page, filename });
}

function renderFolderChildren(folder, depth) {
  const children = [];
  for (const child of sortedFolders(folder)) {
    children.push(renderFolder(child, depth));
  }
  for (const page of sortedPages(folder.pages)) {
    children.push(renderPageLink(page, depth));
  }
  return children;
}

function renderFolder(folder, depth) {
  const details = document.createElement("details");
  details.className = "wiki-rail-folder";

  const summary = document.createElement("summary");
  summary.className = "wiki-rail-folder-summary";
  setRailIndent(summary, depth);
  summary.textContent = folderTitle(folder.name);

  const children = document.createElement("div");
  children.className = "wiki-rail-folder-children";
  children.append(...renderFolderChildren(folder, depth + 1));

  details.append(summary, children);
  return details;
}

function renderPageLink(page, depth) {
  const link = navLink(pageHref(page.slug), page.title || page.slug, {
    kind: RouteKind.PAGE,
    value: page.slug,
    title: page.summary || page.path || `${page.slug}.md`,
  });
  link.classList.add("wiki-rail-page");
  setRailIndent(link, depth);
  return link;
}

function setRailIndent(element, depth) {
  element.style.setProperty("--rail-indent", `${depth * 14}px`);
}

function sortedFolders(folder) {
  return Array.from(folder.folders.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function sortedPages(pages) {
  return [...pages].sort((a, b) => {
    const aTitle = a.title || a.filename || a.slug;
    const bTitle = b.title || b.filename || b.slug;
    return aTitle.localeCompare(bTitle);
  });
}

function folderTitle(name) {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function setActiveNav(elements, routeState) {
  const active = activeNavKind(routeState);
  for (const item of elements.navItems) {
    item.classList.toggle("is-active", item.dataset.navKind === active);
  }
  for (const link of elements.railLinks()) {
    const routeMatches =
      link.dataset.railKind === routeState.kind &&
      link.dataset.railValue === routeState.value;
    link.classList.toggle("is-active", routeMatches);
  }
}

function activeNavKind(routeState) {
  if (
    routeState.kind === RouteKind.HOME ||
    routeState.kind === RouteKind.SEARCH ||
    routeState.kind === RouteKind.JOBS
  ) {
    return routeState.kind;
  }
  if (routeState.kind === RouteKind.JOB) {
    return RouteKind.JOBS;
  }
  return "";
}

function setRouteTitle(elements, title) {
  document.title = `${title} | CodeAlmanac`;
  elements.routeTitle.textContent = title;
}
