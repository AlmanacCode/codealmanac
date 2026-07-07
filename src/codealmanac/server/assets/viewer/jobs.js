import { viewerApi } from "./api.js";
import { emptyState, pageIntro } from "./components.js";
import { jobHref } from "./routes.js";

const ACTIVE_JOB_STATUSES = new Set(["queued", "running"]);
const JOB_POLL_INTERVAL_MS = 1500;

let jobPollTimer = null;

export function clearJobPolling() {
  if (jobPollTimer === null) return;
  window.clearTimeout(jobPollTimer);
  jobPollTimer = null;
}

export async function renderJobs(context) {
  const { elements, setRouteTitle, wiki } = context;
  const routeHash = window.location.hash;
  const result = await viewerApi.jobs(wiki);
  if (window.location.hash !== routeHash) return;
  setRouteTitle("Jobs");
  replaceMain(
    elements,
    pageIntro("CodeAlmanac runs", "Jobs", jobsDeck(result.runs)),
    jobList(result.runs),
  );
  if (result.runs.some((run) => isActiveJobStatus(run.status))) {
    scheduleJobPolling(routeHash, () => renderJobs(context));
  }
}

export async function renderJob(context, runId) {
  const { elements, setRouteTitle, wiki } = context;
  const routeHash = window.location.hash;
  const detail = await viewerApi.job(runId, wiki);
  if (window.location.hash !== routeHash) return;
  const run = detail.run;
  setRouteTitle(run.title || run.run_id);
  replaceMain(elements, jobOverview(run), transcript(detail.steps));
  if (isActiveJobStatus(run.status)) {
    scheduleJobPolling(routeHash, () => renderJob(context, runId));
  }
}

function scheduleJobPolling(routeHash, render) {
  clearJobPolling();
  jobPollTimer = window.setTimeout(() => {
    jobPollTimer = null;
    if (window.location.hash !== routeHash) return;
    render().catch((error) => {
      console.error("CodeAlmanac job refresh failed", error);
    });
  }, JOB_POLL_INTERVAL_MS);
}

function isActiveJobStatus(status) {
  return ACTIVE_JOB_STATUSES.has(status);
}

/* ── Jobs list ───────────────────────────────────────────────── */

function jobsDeck(runs) {
  if (runs.length === 0) return "No runs recorded yet.";
  const active = runs.filter((run) => isActiveJobStatus(run.status)).length;
  const noun = runs.length === 1 ? "run" : "runs";
  return active > 0
    ? `${runs.length} local ${noun} · ${active} active now.`
    : `${runs.length} local ${noun}.`;
}

function jobList(runs) {
  if (runs.length === 0) {
    return emptyState(
      "No jobs yet",
      "CodeAlmanac runs appear here after ingest, garden, or sync.",
    );
  }
  const wrap = document.createElement("div");
  wrap.className = "job-log";
  wrap.append(filterStrip(runs));
  for (const day of groupByDay(runs)) {
    wrap.append(dayGroup(day));
  }
  wireFilters(wrap);
  return wrap;
}

function filterStrip(runs) {
  const counts = statusCounts(runs);
  const options = [
    { value: "all", label: "All", count: runs.length },
    { value: "active", label: "Active", count: counts.active },
    { value: "done", label: "Done", count: counts.done },
    { value: "alert", label: "Needs attention", count: counts.alert },
  ].filter((option) => option.value === "all" || option.count > 0);
  const strip = document.createElement("div");
  strip.className = "job-filters";
  strip.setAttribute("role", "toolbar");
  strip.setAttribute("aria-label", "Run filters");
  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "job-filter";
    button.dataset.filter = option.value;
    if (index === 0) button.classList.add("is-active");
    const label = document.createElement("span");
    label.textContent = option.label;
    const count = document.createElement("span");
    count.className = "job-filter-count";
    count.textContent = String(option.count);
    button.append(label, count);
    strip.append(button);
  });
  return strip;
}

function wireFilters(wrap) {
  const buttons = Array.from(wrap.querySelectorAll("[data-filter]"));
  if (buttons.length === 0) return;
  const cards = Array.from(wrap.querySelectorAll("[data-tone]"));
  const days = Array.from(wrap.querySelectorAll(".job-day"));
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      for (const other of buttons) {
        other.classList.toggle("is-active", other === button);
      }
      for (const card of cards) {
        card.hidden = !(filter === "all" || card.dataset.tone === filter);
      }
      for (const day of days) {
        const visible = Array.from(day.querySelectorAll("[data-tone]")).some(
          (card) => !card.hidden,
        );
        day.hidden = !visible;
      }
    });
  }
}

function dayGroup(day) {
  const section = document.createElement("section");
  section.className = "job-day";
  const head = document.createElement("header");
  head.className = "job-day-head";
  const label = document.createElement("h2");
  label.className = "job-day-label";
  label.textContent = day.label;
  const count = document.createElement("span");
  count.className = "job-day-count";
  count.textContent = `${day.runs.length} ${day.runs.length === 1 ? "run" : "runs"}`;
  head.append(label, count);
  section.append(head);
  for (const run of day.runs) {
    section.append(jobCard(run));
  }
  return section;
}

function jobCard(run) {
  const tone = statusTone(run.status);
  const card = document.createElement("a");
  card.className = "job-card";
  card.href = jobHref(run.run_id);
  card.dataset.tone = tone;

  const seal = document.createElement("span");
  seal.className = "job-seal";
  seal.dataset.tone = tone;
  if (isActiveJobStatus(run.status)) seal.classList.add("is-live");
  seal.setAttribute("aria-hidden", "true");
  seal.textContent = sealGlyph(tone);

  const body = document.createElement("span");
  body.className = "job-card-body";

  const kicker = document.createElement("span");
  kicker.className = "job-card-kicker";
  kicker.append(tag(run.kind), dim(shortTime(run.started_at || run.created_at)));

  const title = document.createElement("span");
  title.className = "job-card-title";
  title.textContent = run.title || run.run_id;

  const summary = document.createElement("span");
  summary.className = "job-card-summary";
  summary.textContent = cleanText(run.summary || run.error || run.run_id);

  body.append(kicker, title, summary);
  const impact = impactRow(run);
  if (impact) body.append(impact);

  const meta = document.createElement("span");
  meta.className = "job-card-meta";
  meta.append(statusChip(run.status));

  card.append(seal, body, meta);
  return card;
}

function impactRow(run) {
  const changes = run.page_changes;
  if (!changes) return null;
  const parts = [
    ["created", "+", changes.created?.length ?? 0],
    ["updated", "~", changes.updated?.length ?? 0],
    ["deleted", "−", changes.deleted?.length ?? 0],
  ].filter(([, , count]) => count > 0);
  if (parts.length === 0) return null;
  const row = document.createElement("span");
  row.className = "job-impact";
  for (const [kind, mark, count] of parts) {
    const chip = document.createElement("span");
    chip.className = "job-impact-part";
    chip.dataset.kind = kind;
    chip.textContent = `${mark}${count} ${kind}`;
    row.append(chip);
  }
  return row;
}

/* ── Job detail ──────────────────────────────────────────────── */

function jobOverview(run) {
  const tone = statusTone(run.status);
  const section = document.createElement("section");
  section.className = "job-overview";

  const eyebrow = document.createElement("p");
  eyebrow.className = "dashboard-page-eyebrow";
  eyebrow.textContent = "Job";

  const head = document.createElement("div");
  head.className = "job-overview-head";
  const title = document.createElement("h1");
  title.className = "dashboard-page-title";
  title.textContent = run.title || run.run_id;
  head.append(title, statusChip(run.status));

  const meta = document.createElement("p");
  meta.className = "job-overview-meta";
  meta.textContent = overviewMeta(run);

  section.append(eyebrow, head, meta);

  const impact = impactRow(run);
  if (impact) {
    impact.classList.add("job-overview-impact");
    section.append(impact);
  }

  if (run.error) {
    section.append(callout("Failure", run.error, "error"));
  } else if (run.summary) {
    section.append(callout("Summary", cleanText(run.summary), tone));
  }

  return section;
}

function overviewMeta(run) {
  const parts = [run.kind];
  const start = run.started_at || run.created_at;
  if (start) parts.push(shortTime(start));
  const elapsed = elapsedLabel(run);
  if (elapsed) parts.push(elapsed);
  if (run.harness_transcript) parts.push(`${run.harness_transcript.kind} session`);
  return parts.join(" · ");
}

function callout(label, body, tone) {
  const box = document.createElement("aside");
  box.className = "job-callout";
  box.dataset.tone = tone;
  const kicker = document.createElement("div");
  kicker.className = "job-callout-label";
  kicker.textContent = label;
  const text = document.createElement("p");
  text.className = "job-callout-body";
  text.textContent = body;
  box.append(kicker, text);
  return box;
}

function transcript(steps) {
  const section = document.createElement("section");
  section.className = "job-transcript";
  const head = document.createElement("div");
  head.className = "job-transcript-head";
  const heading = document.createElement("h2");
  heading.textContent = "Transcript";
  const count = document.createElement("span");
  count.className = "job-transcript-count";
  count.textContent = `${steps.length} ${steps.length === 1 ? "event" : "events"}`;
  head.append(heading, count);
  section.append(head);

  if (steps.length === 0) {
    section.append(emptyState("No output", "This run has no readable output yet."));
    return section;
  }

  const flow = document.createElement("div");
  flow.className = "job-flow";
  for (const step of steps) flow.append(stepNode(step));
  section.append(flow);
  return section;
}

function stepNode(step) {
  if (step.kind === "assistant") return messageNode(step);
  if (step.kind === "tool" || step.kind === "agent") return toolNode(step);
  return noteNode(step);
}

function messageNode(step) {
  const row = document.createElement("div");
  row.className = "job-msg";
  if (step.actor) {
    const who = document.createElement("div");
    who.className = "job-msg-actor";
    who.textContent = step.actor;
    row.append(who);
  }
  const text = document.createElement("div");
  text.className = "job-msg-text job-prose";
  text.innerHTML = renderMarkdown((step.body || "").trim());
  row.append(text);
  return row;
}

function noteNode(step) {
  const errored = step.error || step.kind === "error";
  const note = document.createElement("div");
  note.className = "job-note";
  if (errored) note.dataset.tone = "error";
  const glyph = document.createElement("span");
  glyph.className = "job-note-glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = errored ? "✕" : "·";
  const body = document.createElement("div");
  body.className = "job-note-body";
  const title = document.createElement("span");
  title.className = "job-note-title";
  title.textContent = step.title;
  body.append(title);
  if (step.body && cleanText(step.body) !== step.title) {
    const detail = document.createElement("span");
    detail.className = "job-note-detail";
    detail.textContent = cleanText(step.body);
    body.append(detail);
  }
  note.append(glyph, body);
  return note;
}

function toolNode(step) {
  const model = toolModel(step);
  const card = document.createElement("details");
  card.className = "job-tool";
  card.dataset.tone = model.tone;
  if (model.tone === "error") card.open = true;

  const summary = document.createElement("summary");
  summary.className = "job-tool-summary";

  const badge = document.createElement("span");
  badge.className = "job-tool-badge";
  badge.dataset.kind = model.kind;
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = model.glyph;

  const copy = document.createElement("span");
  copy.className = "job-tool-copy";
  const verb = document.createElement("span");
  verb.className = "job-tool-verb";
  verb.textContent = model.verb;
  copy.append(verb);
  if (model.target) {
    const target = document.createElement("span");
    target.className = "job-tool-target";
    target.textContent = model.target;
    copy.append(target);
  }

  const state = document.createElement("span");
  state.className = "job-tool-state";
  state.append(toolIndicator(step));

  summary.append(badge, copy, state);
  card.append(summary);

  const body = document.createElement("div");
  body.className = "job-tool-body";
  if (model.sections.length === 0) {
    body.append(pending(step));
  } else {
    for (const part of model.sections) body.append(sectionNode(part));
  }
  card.append(body);
  return card;
}

function pending(step) {
  const p = document.createElement("p");
  p.className = "job-tool-pending";
  p.textContent =
    step.status === "completed" ? "No output recorded." : "Waiting for result…";
  return p;
}

function sectionNode({ label, mode, value }) {
  const box = document.createElement("div");
  box.className = "job-tool-section";
  if (label) {
    const title = document.createElement("div");
    title.className = "job-tool-section-title";
    title.textContent = label;
    box.append(title);
  }
  box.append(contentNode(mode, value));
  return box;
}

function contentNode(mode, value) {
  if (mode === "markdown") {
    const div = document.createElement("div");
    div.className = "job-prose";
    div.innerHTML = renderMarkdown(value);
    return div;
  }
  if (mode === "diff") return diffNode(value);
  const pre = document.createElement("pre");
  pre.className = "job-code";
  pre.textContent = value;
  return pre;
}

function diffNode(value) {
  const box = document.createElement("div");
  box.className = "job-diff";
  for (const raw of String(value).split("\n")) {
    const line = document.createElement("div");
    const tone =
      raw.startsWith("+++") || raw.startsWith("---")
        ? "file"
        : raw.startsWith("@@")
          ? "hunk"
          : raw.startsWith("+")
            ? "add"
            : raw.startsWith("-")
              ? "del"
              : "ctx";
    line.className = `job-diff-line job-diff-${tone}`;
    line.textContent = raw || " ";
    box.append(line);
  }
  return box;
}

const TOOL_GLYPHS = {
  shell: "$",
  read: "≡",
  write: "✎",
  edit: "✎",
  search: "⌕",
  agent: "❖",
  web: "↗",
  mcp: "⚙",
  image: "▦",
};

const TOOL_VERBS = {
  shell: "Ran",
  read: "Read",
  write: "Wrote",
  edit: "Edited",
  search: "Searched",
  agent: "Delegated",
  web: "Fetched",
  mcp: "Called",
  image: "Viewed",
};

function toolModel(step) {
  const kind = normalizeKind(step);
  const parsed = parseJsonObject(step.input);
  const rawPath = step.target || parsed?.file_path || parsed?.path || null;
  const target = toolTarget(step, kind, parsed);
  return {
    kind,
    glyph: TOOL_GLYPHS[kind] || "◆",
    verb: TOOL_VERBS[kind] || step.title || "Tool",
    target: target ? truncateMiddle(target, 88) : null,
    tone: toolTone(step),
    sections: toolSections(step, kind, parsed, rawPath),
  };
}

function normalizeKind(step) {
  if (step.kind === "agent") return "agent";
  const kind = (step.tool || "").toLowerCase();
  return kind in TOOL_GLYPHS ? kind : "tool";
}

function toolTarget(step, kind, parsed) {
  if (kind === "agent") {
    return parsed?.description || parsed?.subagent_type || step.target || null;
  }
  if (kind === "shell") {
    return cleanShell(step.target || parsed?.command || "");
  }
  const raw = step.target || parsed?.file_path || parsed?.path || parsed?.query;
  return raw ? basename(String(raw)) : null;
}

// Show only the single most useful payload, rendered — never raw parameter JSON.
function toolSections(step, kind, parsed, rawPath) {
  const output = stringifyValue(step.output).trim();

  if (kind === "agent") {
    const sections = [];
    if (typeof parsed?.prompt === "string") {
      sections.push({ label: "Task", mode: "markdown", value: parsed.prompt });
    }
    if (output) sections.push({ label: "Result", mode: "markdown", value: output });
    return sections;
  }

  if (kind === "edit" || kind === "write") {
    const change = parsed?.diff ?? parsed?.content ?? parsed?.new_string ?? parsed?.old_string;
    if (typeof change === "string" && change.length > 0) {
      const mode = isDiff(change) ? "diff" : isMarkdownPath(rawPath) ? "markdown" : "code";
      return [{ label: null, mode, value: change }];
    }
  }

  if (kind === "search") {
    const query = parsed?.query ?? parsed?.pattern;
    if (output) return [{ label: null, mode: "code", value: output }];
    if (typeof query === "string") return [{ label: "Query", mode: "code", value: query }];
    return [];
  }

  if (!output) return [];
  if (kind === "read") {
    const mode = isMarkdownPath(rawPath) || looksMarkdown(output) ? "markdown" : "code";
    return [{ label: null, mode, value: output }];
  }
  // shell, web, mcp, default — show output verbatim.
  return [{ label: null, mode: "code", value: output }];
}

/* ── Status + chips ──────────────────────────────────────────── */

function statusChip(status, error = false) {
  const tone = error ? "error" : statusTone(status);
  const chip = document.createElement("span");
  chip.className = "job-chip";
  chip.dataset.tone = tone;
  const dot = document.createElement("span");
  dot.className = "job-chip-dot";
  dot.setAttribute("aria-hidden", "true");
  if (tone === "active") dot.classList.add("is-live");
  const label = document.createElement("span");
  label.textContent = statusWord(status);
  chip.append(dot, label);
  return chip;
}

// Quiet indicator for a tool row: a check when done, a live dot when running,
// a red badge only on failure — completed tools stay visually calm.
function toolIndicator(step) {
  const tone = toolTone(step);
  if (tone === "done") {
    const done = document.createElement("span");
    done.className = "job-tool-check";
    done.setAttribute("aria-hidden", "true");
    done.textContent = "✓";
    return done;
  }
  if (tone === "error") {
    const chip = document.createElement("span");
    chip.className = "job-chip";
    chip.dataset.tone = "error";
    chip.textContent = "failed";
    return chip;
  }
  return statusChip(step.status || "started", false);
}

function tag(value) {
  const span = document.createElement("span");
  span.className = "job-tag";
  span.textContent = value;
  return span;
}

function dim(value) {
  const span = document.createElement("span");
  span.className = "job-dim";
  span.textContent = value;
  return span;
}

function statusCounts(runs) {
  return runs.reduce(
    (counts, run) => {
      counts[statusTone(run.status)] += 1;
      return counts;
    },
    { active: 0, done: 0, alert: 0, muted: 0 },
  );
}

function statusTone(status) {
  if (status === "done" || status === "completed") return "done";
  if (status === "running" || status === "queued" || status === "started") return "active";
  if (status === "failed" || status === "error" || status === "stale") return "alert";
  return "muted";
}

function toolTone(step) {
  if (step.error || step.status === "failed") return "error";
  if (step.status === "completed" || step.status === "done") return "done";
  if (step.status === "started" || step.status === "running") return "active";
  return "muted";
}

function statusWord(status) {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function sealGlyph(tone) {
  if (tone === "active") return "•";
  if (tone === "alert") return "!";
  if (tone === "done") return "✓";
  return "·";
}

/* ── Text + markdown ─────────────────────────────────────────── */

function cleanText(value) {
  return String(value ?? "")
    .replace(/\*\*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanShell(command) {
  if (typeof command !== "string") return "";
  const trimmed = command.trim();
  const match = trimmed.match(/^\/(?:usr\/)?bin\/(?:zsh|bash|sh)\s+-lc\s+(['"])([\s\S]*)\1$/);
  if (match) return match[2].replace(/\\(["`$\\])/g, "$1").replace(/'\\''/g, "'");
  return trimmed;
}

function isMarkdownPath(path) {
  return typeof path === "string" && /\.(md|markdown)$/i.test(path);
}

function looksMarkdown(text) {
  return /(^|\n)#{1,6}\s|\n[-*]\s|\]\(|\n>\s/.test(String(text));
}

function isDiff(value) {
  return typeof value === "string" && /(^|\n)(@@ |--- |\+\+\+ )/.test(value);
}

// Minimal, safe Markdown → HTML for prose and rendered file previews.
function renderMarkdown(source) {
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
  let html = "";
  let list = null;
  let index = 0;
  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };
  const block = /^(#{1,6}\s|>\s?|```|\s*[-*+]\s|\s*\d+\.\s)/;
  while (index < lines.length) {
    const line = lines[index];
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      closeList();
      const buffer = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        buffer.push(lines[index]);
        index += 1;
      }
      index += 1;
      html += `<pre class="job-code"><code>${escapeHtml(buffer.join("\n"))}</code></pre>`;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
      index += 1;
      continue;
    }
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      closeList();
      html += "<hr>";
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeList();
      const buffer = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        buffer.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      html += `<blockquote>${inlineMarkdown(buffer.join(" "))}</blockquote>`;
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet || ordered) {
      const type = bullet ? "ul" : "ol";
      if (list !== type) {
        closeList();
        html += `<${type}>`;
        list = type;
      }
      html += `<li>${inlineMarkdown((bullet || ordered)[1])}</li>`;
      index += 1;
      continue;
    }
    if (line.trim() === "") {
      closeList();
      index += 1;
      continue;
    }
    closeList();
    const buffer = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() !== "" && !block.test(lines[index])) {
      buffer.push(lines[index]);
      index += 1;
    }
    html += `<p>${inlineMarkdown(buffer.join(" "))}</p>`;
  }
  closeList();
  return html;
}

function inlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label, url) => `<a href="${escapeAttr(url)}" rel="noreferrer">${label}</a>`,
  );
  return html;
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
  );
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function parseJsonObject(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function stringifyValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function basename(path) {
  return String(path).split(/[\\/]/).filter(Boolean).at(-1) ?? String(path);
}

function truncateMiddle(text, limit) {
  if (text.length <= limit) return text;
  const head = Math.ceil((limit - 1) * 0.6);
  const tail = Math.max(8, limit - head - 1);
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function elapsedLabel(run) {
  const start = run.started_at || run.created_at;
  const end = run.finished_at || run.updated_at;
  if (!start || !end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const seconds = Math.round(ms / 1000);
  if (seconds < 1) return "under 1s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function shortTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function groupByDay(runs) {
  const buckets = new Map();
  const order = [];
  for (const run of runs) {
    const stamp = run.started_at || run.created_at;
    const key = dayKey(stamp);
    if (!buckets.has(key)) {
      buckets.set(key, { key, label: dayLabel(stamp), runs: [] });
      order.push(key);
    }
    buckets.get(key).runs.push(run);
  }
  return order.map((key) => buckets.get(key));
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function replaceMain(elements, ...children) {
  elements.main.replaceChildren(...children);
  elements.main.focus();
}
