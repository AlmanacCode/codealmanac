import { viewerApi } from "./api.js";
import { emptyState, pageIntro } from "./components.js";
import { jobHref } from "./routes.js";

export async function renderJobs(context) {
  const { elements, setRouteTitle, wiki } = context;
  const result = await viewerApi.jobs(wiki);
  setRouteTitle("Jobs");
  replaceMain(
    elements,
    pageIntro("Lifecycle runs", "Jobs", `${result.runs.length} local runs.`),
    jobList(result.runs),
  );
}

export async function renderJob(context, runId) {
  const { elements, setRouteTitle, wiki } = context;
  const detail = await viewerApi.job(runId, wiki);
  const run = detail.run;
  setRouteTitle(run.title || run.run_id);
  replaceMain(
    elements,
    pageIntro("Job", run.title || run.run_id, `${run.operation} · ${run.status}`),
    jobDetail(run),
    eventList(detail.events),
  );
}

function jobList(runs) {
  if (runs.length === 0) {
    return emptyState("No jobs yet", "Lifecycle runs appear here after ingest, garden, or sync.");
  }
  const list = document.createElement("nav");
  list.className = "job-list";
  list.setAttribute("aria-label", "Lifecycle jobs");
  for (const run of runs) {
    list.append(jobRow(run));
  }
  return list;
}

function jobRow(run) {
  const item = document.createElement("a");
  item.className = "job-row";
  item.href = jobHref(run.run_id);

  const main = document.createElement("span");
  main.className = "job-row-main";
  const title = document.createElement("span");
  title.className = "job-row-title";
  title.textContent = run.title || run.run_id;
  const summary = document.createElement("span");
  summary.className = "job-row-summary";
  summary.textContent = run.summary || run.error || run.run_id;
  main.append(title, summary);

  const meta = document.createElement("span");
  meta.className = "job-row-meta";
  meta.append(jobPill(run.status), textSpan(run.operation), textSpan(shortTime(run.updated_at)));

  item.append(main, meta);
  return item;
}

function jobDetail(run) {
  const section = document.createElement("section");
  section.className = "job-detail";
  section.append(
    detailRow("Run", run.run_id),
    detailRow("Status", run.status),
    detailRow("Operation", run.operation),
    detailRow("Updated", run.updated_at),
    detailRow("Log", run.log_path),
  );
  if (run.harness_transcript) {
    section.append(
      detailRow("Transcript", `${run.harness_transcript.kind} ${run.harness_transcript.session_id}`),
    );
  }
  if (run.summary) section.append(detailRow("Summary", run.summary));
  if (run.error) section.append(detailRow("Error", run.error));
  return section;
}

function eventList(events) {
  if (events.length === 0) {
    return emptyState("No events", "This run has no persisted log events.");
  }
  const section = document.createElement("section");
  section.className = "job-events";
  const heading = document.createElement("h2");
  heading.textContent = "Event log";
  section.append(heading);
  for (const event of events) {
    section.append(eventRow(event));
  }
  return section;
}

function eventRow(event) {
  const row = document.createElement("article");
  row.className = "job-event";

  const header = document.createElement("header");
  header.className = "job-event-header";
  header.append(textSpan(`#${event.sequence}`), jobPill(event.kind), textSpan(shortTime(event.timestamp)));

  const message = document.createElement("p");
  message.className = "job-event-message";
  message.textContent = event.message;

  row.append(header, message);
  if (event.harness_event) {
    row.append(harnessSummary(event.harness_event));
  }
  return row;
}

function harnessSummary(event) {
  const box = document.createElement("div");
  box.className = "job-harness";
  box.append(detailRow("Harness", event.kind));
  if (event.actor) box.append(detailRow("Actor", event.actor.label || event.actor.role));
  if (event.tool_name) box.append(detailRow("Tool", event.tool_name));
  if (event.provider_session_id) box.append(detailRow("Session", event.provider_session_id));
  if (event.usage?.total_tokens !== null && event.usage?.total_tokens !== undefined) {
    box.append(detailRow("Tokens", String(event.usage.total_tokens)));
  }
  return box;
}

function detailRow(label, value) {
  const row = document.createElement("div");
  row.className = "job-detail-row";
  const key = document.createElement("span");
  key.textContent = label;
  const val = document.createElement("strong");
  val.textContent = value;
  row.append(key, val);
  return row;
}

function jobPill(value) {
  const pill = document.createElement("span");
  pill.className = `job-pill job-pill--${String(value).replace(/[^a-z0-9_-]/gi, "")}`;
  pill.textContent = value;
  return pill;
}

function textSpan(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span;
}

function shortTime(value) {
  if (!value) return "";
  return String(value).replace("T", " ").replace(/\.\d+.*$/, " UTC");
}

function replaceMain(elements, ...children) {
  elements.main.replaceChildren(...children);
  elements.main.focus();
}
