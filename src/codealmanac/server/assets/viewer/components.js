import { fileHref, homeHref, pageHref, topicHref } from "./routes.js";

export function pageIntro(eyebrow, title, copy) {
  const section = document.createElement("section");
  section.className = "dashboard-page-intro";
  if (eyebrow) {
    const label = document.createElement("p");
    label.className = "dashboard-page-eyebrow";
    label.textContent = eyebrow;
    section.append(label);
  }
  const h1 = document.createElement("h1");
  h1.className = "dashboard-page-title";
  h1.textContent = title;
  section.append(h1);
  if (copy) {
    const p = document.createElement("p");
    p.className = "dashboard-page-copy";
    p.textContent = copy;
    section.append(p);
  }
  return section;
}

export function statsGrid(overview) {
  const grid = document.createElement("section");
  grid.className = "wiki-stats";
  grid.append(
    statCard(String(overview.page_count), "Pages"),
    statCard(String(overview.topic_count), "Topics"),
    statCard(overview.repository.name, "Current wiki"),
  );
  return grid;
}

export function pageTitleBlock(page) {
  const header = document.createElement("header");
  header.className = "wiki-page-title-block";

  const path = document.createElement("p");
  path.className = "wiki-page-path";
  path.textContent = `${page.slug}.md`;

  const title = document.createElement("h1");
  title.className = "wiki-page-title";
  title.textContent = page.title || page.slug;

  header.append(path, title);
  if (page.summary) {
    const summary = document.createElement("p");
    summary.className = "wiki-page-summary";
    summary.textContent = page.summary;
    header.append(summary);
  }
  header.append(pageFacts(page));
  return header;
}

export function markdown(html, sources = []) {
  const article = document.createElement("article");
  article.className = "wiki-markdown";
  article.innerHTML = html;
  attachCitationHints(article, sources);
  return article;
}

export function pageList(pages) {
  if (pages.length === 0) {
    return emptyState("No pages found", "Try a different search or topic.");
  }
  const list = document.createElement("nav");
  list.className = "wiki-page-list";
  list.setAttribute("aria-label", "Wiki pages");
  for (const page of pages) {
    list.append(pageRow(page));
  }
  return list;
}

export function navLink(href, label, options = {}) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  if (options.kind) {
    link.dataset.railKind = options.kind;
  }
  if (options.value) {
    link.dataset.railValue = options.value;
  }
  if (options.title) {
    link.title = options.title;
  }
  return link;
}

export function sideSection(title, children) {
  const section = document.createElement("section");
  section.className = "wiki-side-section";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const list = document.createElement("div");
  list.className = "wiki-link-list";
  if (children.length === 0) {
    list.append(sidebarEmpty());
  } else {
    list.append(...children);
  }
  section.append(heading, list);
  return section;
}

export function sideLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  return link;
}

export function pageSideLink(slug, label) {
  return sideLink(pageHref(slug), label);
}

export function fileSideLink(path) {
  return sideLink(fileHref(path), path);
}

export function sourceSideItem(source) {
  const hasTarget = Boolean(source.target);
  const item = document.createElement(hasTarget ? "a" : "span");
  item.className = "wiki-source-item";
  item.id = source.source_id ? `source-${encodeURIComponent(source.source_id)}` : "";
  item.dataset.sourceId = source.source_id || "";
  if (source.source_type === "web" && source.target) {
    item.href = source.target;
    item.rel = "noreferrer";
  } else if (source.source_type === "file" && source.target) {
    item.href = fileHref(source.target);
  }

  const number = document.createElement("span");
  number.className = "wiki-source-number";
  number.textContent =
    source.citation_number === null || source.citation_number === undefined
      ? "–"
      : String(source.citation_number);

  const body = document.createElement("span");
  body.className = "wiki-source-body";
  const title = document.createElement("strong");
  title.textContent = sourceTitle(source);
  const detail = document.createElement("span");
  detail.textContent = sourceDetail(source);
  body.append(title, detail);

  item.append(number, body);
  return item;
}

function attachCitationHints(article, sources) {
  const sourcesById = new Map(
    sources
      .filter((source) => source.source_id)
      .map((source) => [source.source_id, source]),
  );
  for (const citation of article.querySelectorAll(".wiki-citation")) {
    const source = sourcesById.get(citation.dataset.sourceId || "");
    if (!source) continue;
    const label = citationTooltip(source);
    citation.title = label;
    citation.setAttribute("aria-label", label);
    citation.dataset.citationTooltip = label;
  }
}

function citationTooltip(source) {
  const number =
    source.citation_number === null || source.citation_number === undefined
      ? "Source"
      : `Source ${source.citation_number}`;
  const title = sourceTitle(source);
  const detail = sourceDetail(source);
  return detail && detail !== title ? `${number}: ${title} — ${detail}` : `${number}: ${title}`;
}

function sourceTitle(source) {
  if (source.title) {
    return source.title;
  }
  if (source.note) {
    return source.note;
  }
  return humanizeSourceId(source.source_id || "untitled-source");
}

function sourceDetail(source) {
  if (source.title && source.note) {
    return source.note;
  }
  if (source.target) {
    return source.target;
  }
  return source.source_type;
}

function humanizeSourceId(sourceId) {
  return sourceId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function emptyState(title, body) {
  const box = document.createElement("section");
  box.className = "app-empty";
  const h2 = document.createElement("h2");
  h2.className = "app-empty-title";
  h2.textContent = title;
  const p = document.createElement("p");
  p.className = "app-empty-body";
  p.textContent = body;
  box.append(h2, p);
  return box;
}

function statCard(value, label) {
  const card = document.createElement("div");
  card.className = "wiki-stat";
  const strong = document.createElement("strong");
  strong.textContent = value;
  const span = document.createElement("span");
  span.textContent = label;
  card.append(strong, span);
  return card;
}

function pageFacts(page) {
  const row = document.createElement("div");
  row.className = "wiki-page-facts";
  const allPages = document.createElement("a");
  allPages.href = homeHref();
  allPages.textContent = "All pages";
  row.append(allPages);
  for (const topic of page.topics) {
    const link = document.createElement("a");
    link.href = topicHref(topic);
    link.textContent = topic;
    row.append(link);
  }
  return row;
}

function pageRow(page) {
  const item = document.createElement("a");
  item.className = "wiki-page-row";
  item.href = pageHref(page.slug);

  const main = document.createElement("span");
  main.className = "wiki-page-row-main";
  const title = document.createElement("span");
  title.className = "wiki-page-row-title";
  title.textContent = page.title || page.slug;
  const summary = document.createElement("span");
  summary.className = "wiki-page-row-summary";
  summary.textContent = page.summary || "No summary";
  main.append(title, summary);

  const meta = document.createElement("span");
  meta.className = "wiki-page-row-meta";
  const slug = document.createElement("span");
  slug.textContent = `${page.slug}.md`;
  const topics = document.createElement("span");
  topics.textContent = page.topics.slice(0, 3).join(", ") || "untagged";
  meta.append(slug, topics);

  item.append(main, meta);
  return item;
}

function sidebarEmpty() {
  const empty = document.createElement("span");
  empty.textContent = "None";
  return empty;
}
