import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("viewer UI assets", () => {
  it("ships structured sidebar topic links with active styling", async () => {
    const indexHtml = await readFile(join(process.cwd(), "viewer", "index.html"), "utf8");
    const mark = await readFile(join(process.cwd(), "viewer", "almanac-mark.png"));
    const appJs = await readFile(join(process.cwd(), "viewer", "app.js"), "utf8");
    const appCss = await readFile(join(process.cwd(), "viewer", "app.css"), "utf8");

    expect(mark.byteLength).toBeGreaterThan(0);
    expect(indexHtml).toContain('src="/almanac-mark.png"');
    expect(indexHtml).toContain("Your code wiki");
    expect(indexHtml).not.toContain("Local wiki viewer");
    expect(indexHtml).toContain('data-route="/getting-started"');
    expect(indexHtml).not.toContain("recent-list");
    expect(appJs).not.toContain("recentList");
    expect(appJs).toContain("featuredPages?.projectOverview");
    expect(appJs).toContain("featuredPages?.gettingStarted");
    expect(appJs).toContain("featuredPages?.gettingStarted ?? state.overview.featuredPages?.projectOverview");
    expect(appJs).not.toContain("const projectOverview = await optionalPage");
    expect(appJs).toContain("state.overview.topics");
    expect(appJs).toContain("topicNavigation?.source === \"curated\"");
    expect(appJs).toContain("const SIDEBAR_TAG_LIMIT = 8");
    expect(appJs).toContain("data-topic-toggle");
    expect(appJs).toContain("Show all topics");
    expect(appJs).toContain("Show fewer topics");
    expect(appJs).toContain("renderTopicTree");
    expect(appJs).toContain("topic.parents");
    expect(appJs).toContain("ca-topic-depth-");
    expect(appJs).toContain("state.overview.featuredPages");
    expect(appJs).toContain('pathname === "/getting-started"');
    expect(appJs).toContain("renderGettingStarted");
    expect(appJs).not.toContain("Start with the map");
    expect(appJs).toContain('setRailVisible(pathname.startsWith("/page/"))');
    expect(appJs).toContain("ca-topic-link");
    expect(appJs).toContain("ca-link-label");
    expect(appJs).toContain("ca-link-detail");
    expect(appJs).toContain('querySelectorAll(".ca-left [data-route]")');
    expect(appJs).not.toContain("<br><small>");

    expect(appCss).toContain(".ca-topic-link");
    expect(appCss).toContain(".ca-brand-mark-image");
    expect(appCss).toContain("brightness(0.68)");
    expect(appCss).toContain(".ca-left .ca-link-button.is-active");
    expect(appCss).toContain(".ca-shell.is-rail-hidden");
    expect(appCss).toContain("overflow-wrap: anywhere");
  });
});
