import { viewerApi } from "./api.js";
import { navLink } from "./components.js";
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
  topicHref,
} from "./routes.js";

const state = {
  overview: null,
};

export function startViewer() {
  const elements = readElements();
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.hash = searchHref(elements.searchInput.value.trim());
  });

  window.addEventListener("hashchange", () => route(elements));
  loadOverview(elements).then(() => route(elements));
}

async function loadOverview(elements) {
  state.overview = await viewerApi.overview();
  elements.workspaceName.textContent = state.overview.workspace.name;
  renderNav(elements, state.overview);
}

async function route(elements) {
  if (!state.overview) return;
  const context = {
    elements,
    overview: state.overview,
    setRouteTitle: (title) => setRouteTitle(elements, title),
  };
  try {
    const routeState = parseHash(window.location.hash);
    setActiveNav(elements, routeState.kind);
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
    renderHome(context);
  } catch (error) {
    renderError(context, error);
  }
}

function readElements() {
  return {
    workspaceName: document.getElementById("workspace-name"),
    routeTitle: document.getElementById("route-title"),
    searchForm: document.getElementById("search-form"),
    searchInput: document.getElementById("search-input"),
    topicList: document.getElementById("topic-list"),
    pageList: document.getElementById("page-list"),
    main: document.getElementById("main"),
    navItems: Array.from(document.querySelectorAll("[data-nav-kind]")),
  };
}

function renderNav(elements, overview) {
  elements.topicList.replaceChildren(
    ...overview.topics.map((topic) =>
      navLink(topicHref(topic.slug), topic.title || topic.slug),
    ),
  );
  elements.pageList.replaceChildren(
    ...overview.pages.map((page) =>
      navLink(pageHref(page.slug), page.title || page.slug),
    ),
  );
}

function setActiveNav(elements, kind) {
  const active = kind === RouteKind.SEARCH ? RouteKind.SEARCH : RouteKind.HOME;
  for (const item of elements.navItems) {
    item.classList.toggle("is-active", item.dataset.navKind === active);
  }
}

function setRouteTitle(elements, title) {
  document.title = `${title} | CodeAlmanac`;
  elements.routeTitle.textContent = title;
}
