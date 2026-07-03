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
    pageIntro("Lifecycle jobs", "Jobs", `${result.jobs.length} local jobs.`),
    jobList(result.jobs),
  );
  if (result.jobs.some((job) => isActiveJobStatus(job.status))) {
    scheduleJobPolling(routeHash, () => renderJobs(context));
  }
}

export async function renderJob(context, jobId) {
  const { elements, setRouteTitle, wiki } = context;
  const routeHash = window.location.hash;
  const detail = await viewerApi.job(jobId, wiki);
  if (window.location.hash !== routeHash) return;
  const job = detail.job;
  setRouteTitle(job.title || job.job_id);
  replaceMain(
    elements,
    pageIntro("Job", job.title || job.job_id, `${job.operation} · ${job.status}`),
    jobDetail(job),
    eventList(detail.events),
  );
  if (isActiveJobStatus(job.status)) {
    scheduleJobPolling(routeHash, () => renderJob(context, jobId));
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

function jobList(jobs) {
  if (jobs.length === 0) {
    return emptyState(
      "No jobs yet",
      "Lifecycle jobs appear here after ingest, garden, or sync.",
    );
  }
  const list = document.createElement("nav");
  list.className = "job-list";
  list.setAttribute("aria-label", "Lifecycle jobs");
  for (const job of jobs) {
    list.append(jobRow(job));
  }
  return list;
}

function jobRow(job) {
  const item = document.createElement("a");
  item.className = "job-row";
  item.href = jobHref(job.job_id);

  const main = document.createElement("span");
  main.className = "job-row-main";
  const title = document.createElement("span");
  title.className = "job-row-title";
  title.textContent = job.title || job.job_id;
  const summary = document.createElement("span");
  summary.className = "job-row-summary";
  summary.textContent = job.summary || job.error || job.job_id;
  main.append(title, summary);

  const meta = document.createElement("span");
  meta.className = "job-row-meta";
  meta.append(
    jobPill(job.status),
    textSpan(job.operation),
    textSpan(shortTime(job.updated_at)),
  );

  item.append(main, meta);
  return item;
}

function jobDetail(job) {
  const section = document.createElement("section");
  section.className = "job-detail";
  section.append(
    detailRow("Job", job.job_id),
    detailRow("Status", job.status),
    detailRow("Operation", job.operation),
    detailRow("Updated", job.updated_at),
    detailRow("Log", job.log_path),
  );
  if (job.harness_transcript) {
    section.append(
      detailRow(
        "Transcript",
        `${job.harness_transcript.kind} ${job.harness_transcript.session_id}`,
      ),
    );
  }
  if (job.summary) section.append(detailRow("Summary", job.summary));
  if (job.error) section.append(detailRow("Error", job.error));
  return section;
}

function eventList(events) {
  if (events.length === 0) {
    return emptyState("No events", "This job has no persisted log events.");
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
  header.append(
    textSpan(`#${event.sequence}`),
    jobPill(event.kind),
    textSpan(shortTime(event.timestamp)),
  );

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
  if (event.status) box.append(detailRow("Run status", event.status));
  if (event.actor) box.append(actorRows(event.actor));
  if (event.tool_name) box.append(detailRow("Tool", event.tool_name));
  if (event.tool_id) box.append(detailRow("Tool id", event.tool_id));
  if (event.tool_input) box.append(detailRow("Tool input", event.tool_input));
  if (event.tool_result !== null && event.tool_result !== undefined) {
    box.append(detailRow("Tool result", valueText(event.tool_result)));
  }
  if (event.tool_is_error === true) box.append(detailRow("Tool error", "true"));
  if (event.provider_session_id) box.append(detailRow("Session", event.provider_session_id));
  if (event.provider_event_id) box.append(detailRow("Event id", event.provider_event_id));
  if (event.tool_display) box.append(toolDisplayRows(event.tool_display));
  if (event.usage) box.append(usageRows(event.usage));
  if (event.failure) box.append(failureRows(event.failure));
  if (event.agent_trace) box.append(agentTraceRows(event.agent_trace));
  return box;
}

function actorRows(actor) {
  return detailGroup(
    "Actor",
    [
      ["Role", actor.role],
      ["Label", actor.label],
      ["Thread", actor.thread_id],
      ["Parent", actor.parent_thread_id],
      ["Confidence", actor.confidence],
    ],
  );
}

function toolDisplayRows(display) {
  return detailGroup(
    "Tool display",
    [
      ["Kind", display.kind],
      ["Title", display.title],
      ["Path", display.path],
      ["Command", display.command],
      ["Cwd", display.cwd],
      ["Status", display.status],
      ["Exit code", display.exit_code],
      ["Duration", millis(display.duration_ms)],
      ["Summary", display.summary],
      ["Thread", display.provider_thread_id],
      ["Turn", display.provider_turn_id],
    ],
  );
}

function usageRows(usage) {
  return detailGroup(
    "Usage",
    [
      ["Input tokens", usage.input_tokens],
      ["Cached input", usage.cached_input_tokens],
      ["Output tokens", usage.output_tokens],
      ["Reasoning output", usage.reasoning_output_tokens],
      ["Total tokens", usage.total_tokens],
      ["Processed tokens", usage.total_processed_tokens],
      ["Max tokens", usage.max_tokens],
    ],
  );
}

function failureRows(failure) {
  return detailGroup(
    "Failure",
    [
      ["Provider", failure.provider],
      ["Code", failure.code],
      ["Message", failure.message],
      ["Fix", failure.fix],
      ["Raw", failure.raw],
      ["Details", failure.details],
    ],
  );
}

function agentTraceRows(trace) {
  return detailGroup(
    "Agent trace",
    [
      ["Parent", trace.parent_thread_id],
      ["Child", trace.child_thread_id],
      ["Children", trace.child_thread_ids?.join(", ")],
      ["Model", trace.model],
      ["Reasoning", trace.reasoning_effort],
      ["Prompt", trace.prompt],
      ["Result", trace.result],
    ],
  );
}

function detailGroup(title, rows) {
  const group = document.createElement("section");
  group.className = "job-detail-group";
  const heading = document.createElement("h3");
  heading.textContent = title;
  group.append(heading);
  for (const [label, value] of rows) {
    if (value === null || value === undefined || value === "") continue;
    group.append(detailRow(label, valueText(value)));
  }
  return group;
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

function valueText(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function millis(value) {
  if (value === null || value === undefined) return null;
  return `${value}ms`;
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
