import { describe, expect, it } from "vitest";

// @ts-expect-error viewer assets are plain browser JavaScript without declarations.
const routes = await import("../viewer/routes.js");
const {
  isWikiPageRoute,
  labelForWikilink,
  parseWikiPath,
  routeForWikilink,
  routeFromElement,
  wikiApi,
  wikiRoute,
} = routes;

describe("viewer routes", () => {
  it("parses and builds wiki-scoped UI and API paths", () => {
    expect(parseWikiPath("/w/codealmanac/page/global-registry")).toEqual({
      wiki: "codealmanac",
      path: "/page/global-registry",
    });
    expect(wikiRoute("codealmanac", "/search?q=registry")).toBe(
      "/w/codealmanac/search?q=registry",
    );
    expect(wikiApi("ctx", "/overview")).toBe("/api/wikis/ctx/overview");
    expect(routeFromElement("/jobs", "ctx")).toBe("/w/ctx/jobs");
    expect(routeFromElement("/", "ctx")).toBe("/");
    expect(isWikiPageRoute("/w/ctx/page/rendering")).toBe(true);
    expect(isWikiPageRoute("/w/ctx/topic/rendering")).toBe(false);
  });

  it("classifies wikilinks using cross-wiki before file refs", () => {
    expect(routeForWikilink("ctx:rendering", "codealmanac")).toBe(
      "/w/ctx/page/rendering",
    );
    expect(routeForWikilink("openalmanac:docs/page", "codealmanac")).toBe(
      "/w/openalmanac/page/docs%2Fpage",
    );
    expect(routeForWikilink("src/viewer/app.js", "codealmanac")).toBe(
      "/w/codealmanac/file?path=src%2Fviewer%2Fapp.js",
    );
    expect(routeForWikilink("global-registry", "codealmanac")).toBe(
      "/w/codealmanac/page/global-registry",
    );
  });

  it("supports wikilink display aliases", () => {
    expect(routeForWikilink("global-registry|registry", "codealmanac")).toBe(
      "/w/codealmanac/page/global-registry",
    );
    expect(labelForWikilink("global-registry|registry", () => "Global Registry")).toBe(
      "registry",
    );
    expect(labelForWikilink("global-registry", () => "Global Registry")).toBe(
      "Global Registry",
    );
  });
});
