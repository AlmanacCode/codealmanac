export function parseWikiPath(pathname) {
  const match = pathname.match(/^\/w\/([^/]+)(\/.*)?$/);
  if (match === null) return null;
  return {
    wiki: decodeURIComponent(match[1]),
    path: match[2] ?? "",
  };
}

export function wikiRoute(wiki, path = "") {
  return `${wikiBase(wiki)}${path}`;
}

export function wikiApi(wiki, path = "") {
  return `/api/wikis/${encodeURIComponent(wiki)}${path}`;
}

export function routeFromElement(route, currentWiki) {
  if (route === undefined || route === "") return "/";
  if (route === "/" || route.startsWith("/w/") || currentWiki === null) return route;
  return wikiRoute(currentWiki, route);
}

export function pageRouteFor(wiki, slug) {
  return `/w/${encodeURIComponent(wiki)}/page/${encodeURIComponent(slug)}`;
}

export function routeForWikilink(rawTarget, currentWiki) {
  const target = wikilinkTarget(rawTarget);
  if (isCrossWikiTarget(target)) {
    const colonIndex = target.indexOf(":");
    return pageRouteFor(target.slice(0, colonIndex), target.slice(colonIndex + 1));
  }
  if (target.includes("/")) {
    return wikiRoute(currentWiki, `/file?path=${encodeURIComponent(target)}`);
  }
  return wikiRoute(currentWiki, `/page/${encodeURIComponent(target)}`);
}

export function labelForWikilink(rawTarget, pageLabel) {
  const pipeIndex = rawTarget.indexOf("|");
  if (pipeIndex !== -1) return rawTarget.slice(pipeIndex + 1);
  const target = wikilinkTarget(rawTarget);
  if (isCrossWikiTarget(target) || target.includes("/")) return target;
  return pageLabel(target);
}

export function isCrossWikiTarget(target) {
  const colonIndex = target.indexOf(":");
  if (colonIndex === -1) return false;
  const slashIndex = target.indexOf("/");
  return slashIndex === -1 || colonIndex < slashIndex;
}

export function isWikiPageRoute(pathname) {
  const parsed = parseWikiPath(pathname);
  return parsed !== null && parsed.path.startsWith("/page/");
}

function wikiBase(wiki) {
  return `/w/${encodeURIComponent(wiki)}`;
}

function wikilinkTarget(rawTarget) {
  const pipeIndex = rawTarget.indexOf("|");
  return pipeIndex === -1 ? rawTarget : rawTarget.slice(0, pipeIndex);
}
