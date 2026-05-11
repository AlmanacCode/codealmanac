import {
  buildTranscript,
  getToolCardModel,
  parseJsonObject,
  stringifyEventValue,
} from "./jobs-transcript.js";

export function createJobsView(deps) {
  let pollTimer = null;

  async function renderList() {
    const result = await deps.api(deps.jobsPath());
    document.title = "Jobs - Almanac";
    const runs = result.runs;
    const counts = countJobs(runs);
    const days = groupByDay(runs);

    deps.reader.innerHTML = `
      ${deps.pageActions()}
      <section class="ca-hero">
        <div class="ca-kicker">Ledger</div>
        <h1 class="ca-title">Run history</h1>
        <p class="ca-subtitle">${listDeck(runs.length, counts)}</p>
      </section>
      ${
        days.length === 0
          ? `<div class="ca-meta-empty">No jobs found.</div>`
          : `<div class="ca-logbook">${days.map(renderDay).join("")}</div>`
      }
    `;
  }

  async function renderDetail(runId) {
    const detail = await deps.api(deps.jobPath(runId));
    const run = detail.run;
    const transcript = buildTranscript(detail.events);
    document.title = `${run.displayTitle} - Almanac Jobs`;
    deps.reader.innerHTML = `
      ${deps.pageActions()}
      <section class="ca-hero">
        <div class="ca-kicker">${deps.escapeHtml(run.operation)}</div>
        <h1 class="ca-title">${deps.escapeHtml(run.displayTitle)}</h1>
        <p class="ca-subtitle">${deps.escapeHtml(run.displaySubtitle ?? runFallbackSubtitle(run))}</p>
        <div class="ca-run-marks">
          ${statusMark(run.displayStatus)}
          <span class="ca-run-mark">${deps.escapeHtml(providerLabel(run))}</span>
          <span class="ca-run-mark">${deps.escapeHtml(deps.formatElapsed(run.elapsedMs))}</span>
          ${run.targetKind ? `<span class="ca-run-mark">${deps.escapeHtml(run.targetKind)}</span>` : ""}
        </div>
      </section>

      <section class="ca-colophon-section">
        <h2 class="ca-section-label">Colophon</h2>
        <dl class="ca-colophon">
          ${colophonEntries(run).map(colophonEntry).join("")}
        </dl>
      </section>

      ${failureCallout(run)}
      ${targetsSection(run)}

      <section class="ca-transcript-section">
        <div class="ca-page-ornament"><span>✥</span></div>
        <h2 class="ca-transcript-heading">
          Transcript
          <small>${detail.events.length} stream event${detail.events.length === 1 ? "" : "s"}</small>
        </h2>
        <div class="ca-transcript">
          ${
            transcript.map(transcriptEntry).join("")
            || `<div class="ca-meta-empty">No log events have been written yet.</div>`
          }
        </div>
      </section>
    `;
    if (isLiveStatus(run.displayStatus)) schedulePoll(run.id);
  }

  function clearPoll() {
    if (pollTimer !== null) {
      window.clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll(runId) {
    clearPoll();
    pollTimer = window.setTimeout(() => {
      pollTimer = null;
      if (deps.isCurrentJobRoute(runId)) {
        renderDetail(runId).catch((error) => deps.renderError(error));
      }
    }, 1500);
  }

  function listDeck(total, counts) {
    if (total === 0) {
      return `No runs recorded yet in <span class="ca-file-code">.almanac/runs</span>.`;
    }
    const active = counts.running + counts.queued;
    const attention = counts.failed + counts.stale;
    const parts = [];
    if (active > 0) parts.push(`${active} active`);
    if (counts.done > 0) parts.push(`${counts.done} completed`);
    if (attention > 0) parts.push(`${attention} need attention`);
    if (counts.cancelled > 0) parts.push(`${counts.cancelled} cancelled`);
    const tail = parts.length > 0 ? ` — ${parts.join(", ")}.` : ".";
    const noun = total === 1 ? "run" : "runs";
    return `${total} ${noun} recorded in <span class="ca-file-code">.almanac/runs</span>${tail}`;
  }

  function renderDay(day) {
    return `
      <section class="ca-log-day">
        <header class="ca-log-day-head">
          <h2 class="ca-log-day-label">${deps.escapeHtml(day.label)}</h2>
          <span class="ca-log-day-count">${day.runs.length} ${day.runs.length === 1 ? "run" : "runs"}</span>
        </header>
        <div class="ca-log-day-list">
          ${day.runs.map(logEntry).join("")}
        </div>
      </section>
    `;
  }

  function logEntry(run) {
    return `
      <a class="ca-log-entry" href="${deps.escapeAttr(deps.jobRoute(run.id))}" data-route="${deps.escapeAttr(deps.jobRoute(run.id))}">
        <time class="ca-log-time">${deps.escapeHtml(formatClock(run.startedAt))}</time>
        <div class="ca-log-entry-body">
          <div class="ca-log-kicker">${deps.escapeHtml(`${run.operation} · ${providerLabel(run)}`)}</div>
          <div class="ca-log-title">${deps.escapeHtml(run.displayTitle)}</div>
          <div class="ca-log-summary">${deps.escapeHtml(cleanSummary(run.displaySubtitle ?? runFallbackSubtitle(run)))}</div>
          <div class="ca-log-tally">
            ${statusMark(run.displayStatus)}
            ${tallyParts(run).map((part) => `<span class="ca-log-tally-part">${deps.escapeHtml(part)}</span>`).join("")}
          </div>
        </div>
      </a>
    `;
  }

  function tallyParts(run) {
    const parts = [];
    const impact = impactPhrase(run);
    if (impact) parts.push(impact);
    if (typeof run.elapsedMs === "number") parts.push(deps.formatElapsed(run.elapsedMs));
    return parts;
  }

  function impactPhrase(run) {
    const created = run.summary?.created ?? 0;
    const updated = run.summary?.updated ?? 0;
    const archived = run.summary?.archived ?? 0;
    const bits = [];
    if (created > 0) bits.push(`+${created} created`);
    if (updated > 0) bits.push(`${updated} updated`);
    if (archived > 0) bits.push(`${archived} archived`);
    if (bits.length === 0 && (run.displayStatus === "done")) return "no wiki changes";
    return bits.join(", ");
  }

  function colophonEntries(run) {
    const rows = [
      ["Started", deps.formatTimestamp(run.startedAt)],
      ["Finished", run.finishedAt ? deps.formatTimestamp(run.finishedAt) : "—"],
      ["Operation", run.operation],
      ["Provider", providerLabel(run)],
      ["Status", statusWord(run.displayStatus)],
      ["Created", String(run.summary?.created ?? 0)],
      ["Updated", String(run.summary?.updated ?? 0)],
      ["Archived", String(run.summary?.archived ?? 0)],
    ];
    if (run.summary?.turns !== undefined) rows.push(["Turns", String(run.summary.turns)]);
    if (run.summary?.usage?.totalTokens !== undefined) {
      rows.push(["Tokens", deps.formatNumber(run.summary.usage.totalTokens)]);
    }
    if (run.summary?.costUsd !== undefined) {
      rows.push(["Cost", `$${run.summary.costUsd.toFixed(4)}`]);
    }
    if (run.providerSessionId) rows.push(["Session", run.providerSessionId, "mono"]);
    if (run.logPath) rows.push(["Log", run.logPath, "mono"]);
    return rows;
  }

  function colophonEntry([label, value, kind]) {
    const valueClass = kind === "mono" ? "ca-colophon-value ca-colophon-value-mono" : "ca-colophon-value";
    return `
      <div class="ca-colophon-row">
        <dt class="ca-colophon-label">${deps.escapeHtml(label)}</dt>
        <dd class="${valueClass}">${deps.escapeHtml(value)}</dd>
      </div>
    `;
  }

  function failureCallout(run) {
    if (!run.failure && !run.error) return "";
    const message = run.failure?.message ?? run.error;
    const fix = run.failure?.fix;
    return `
      <aside class="ca-failure">
        <div class="ca-failure-label">Failure</div>
        <p class="ca-failure-message">${deps.escapeHtml(message)}</p>
        ${fix ? `<p class="ca-failure-fix"><strong>Fix — </strong>${deps.escapeHtml(fix)}</p>` : ""}
      </aside>
    `;
  }

  function targetsSection(run) {
    if (!run.targetPaths?.length) return "";
    return `
      <section class="ca-targets-section">
        <h2 class="ca-section-label">Targets</h2>
        <div class="ca-chip-row">
          ${run.targetPaths.map((path) => `<span class="ca-chip ca-file-code">${deps.escapeHtml(path)}</span>`).join("")}
        </div>
      </section>
    `;
  }

  function statusMark(status) {
    const tone = statusTone(status);
    const word = statusWord(status);
    return `
      <span class="ca-run-mark ca-run-mark-status ca-status-tone-${deps.escapeAttr(tone)}">
        <span class="ca-status-dot" aria-hidden="true"></span>
        <span class="ca-status-word">${deps.escapeHtml(word)}</span>
      </span>
    `;
  }

  function transcriptEntry(entry) {
    if (entry.type === "assistant") {
      return `
        <div class="ca-chat-row ca-chat-row-assistant">
          <div class="ca-chat-avatar" aria-hidden="true">✦</div>
          <div class="ca-chat-bubble">
            <div class="ca-chat-meta">Assistant${entry.timestamp ? ` &middot; ${deps.escapeHtml(deps.formatTimestamp(entry.timestamp))}` : ""}</div>
            <div class="ca-chat-text">${deps.renderMarkdown(entry.text.trim())}</div>
          </div>
        </div>
      `;
    }
    if (entry.type === "invalid") {
      return `
        <div class="ca-tool-step ca-tool-step-error">
          <div class="ca-tool-step-title">Invalid JSON at line ${deps.escapeHtml(entry.line)}</div>
          <pre>${deps.escapeHtml(entry.raw)}</pre>
        </div>
      `;
    }
    if (entry.type === "status") return statusStep(entry);
    return toolStep(entry);
  }

  function statusStep(entry) {
    return `
      <div class="ca-tool-step ca-tool-status ca-tool-status-${deps.escapeAttr(entry.tone)}">
        <div class="ca-tool-step-icon">${entry.tone === "error" ? "!" : "-"}</div>
        <div class="ca-tool-step-body">
          <div class="ca-tool-step-title">${deps.escapeHtml(entry.title)}</div>
          <div class="ca-tool-step-meta">
            ${deps.escapeHtml(entry.tone)}${entry.timestamp ? ` &middot; ${deps.escapeHtml(deps.formatTimestamp(entry.timestamp))}` : ""}
          </div>
          ${entry.detail ? `<pre>${deps.escapeHtml(entry.detail)}</pre>` : ""}
        </div>
      </div>
    `;
  }

  function toolStep(step) {
    const model = getToolCardModel(step);
    return `
      <div class="ca-tool-flow ca-tool-${deps.escapeAttr(model.kind)}">
        <details class="ca-tool-card">
          <summary class="ca-tool-summary">
            <span class="ca-tool-step-icon">${deps.escapeHtml(model.icon)}</span>
            <span class="ca-tool-copy">
              <span class="ca-tool-title">${deps.escapeHtml(model.title)}</span>
              ${model.target ? `<span class="ca-tool-preview">${deps.escapeHtml(model.target)}</span>` : ""}
            </span>
            ${toolState(model)}
          </summary>
          <div class="ca-tool-body">
            ${toolOverview(step, model)}
            ${toolInput(step)}
            ${toolResult(step)}
          </div>
        </details>
      </div>
    `;
  }

  function toolState(model) {
    if (model.statusLabel === "completed") return "";
    return `<span class="ca-tool-state ca-tool-state-${deps.escapeAttr(model.statusLabel)}">${deps.escapeHtml(model.statusLabel)}</span>`;
  }

  function toolOverview(step, model) {
    const rows = [
      ["Tool", step.name],
      ["Kind", model.kind],
      ["Started", step.timestamp ? deps.formatTimestamp(step.timestamp) : ""],
      ["Result", step.resultTimestamp ? deps.formatTimestamp(step.resultTimestamp) : ""],
      ["Path", step.display?.path],
      ["Command", step.display?.command],
      ["Cwd", step.display?.cwd],
      ["Exit", step.display?.exitCode ?? step.resultDisplay?.exitCode],
    ].filter(([, value]) => value !== undefined && value !== null && String(value).length > 0);

    if (model.kind === "agent") {
      const parsed = parseJsonObject(step.input);
      rows.push(
        ...[
          ["Agent type", parsed?.subagent_type],
          ["Description", parsed?.description],
        ].filter(([, value]) => typeof value === "string" && value.length > 0),
      );
    }

    if (rows.length === 0) return "";
    return `
      <div class="ca-tool-facts">
        ${rows.map(([label, value]) => `
          <div class="ca-tool-fact">
            <span>${deps.escapeHtml(label)}</span>
            <strong>${deps.escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function toolInput(step) {
    if (!step.input) return "";
    const parsed = parseJsonObject(step.input);
    const prompt = parsed?.prompt;
    const input = parsed !== null ? JSON.stringify(parsed, null, 2) : step.input;
    return `
      <div class="ca-tool-section">
        <div class="ca-tool-section-title">${typeof prompt === "string" ? "Task" : "Input"}</div>
        <pre>${deps.escapeHtml(typeof prompt === "string" ? prompt : input)}</pre>
      </div>
    `;
  }

  function toolResult(step) {
    if (!step.hasResult) {
      return `<div class="ca-tool-pending">Waiting for result...</div>`;
    }
    return `
      <div class="ca-tool-section">
        <div class="ca-tool-section-title">${step.isError ? "Error result" : "Result"}</div>
        <pre>${deps.escapeHtml(stringifyEventValue(step.result))}</pre>
      </div>
    `;
  }

  function providerLabel(run) {
    return run.provider + (run.model ? ` / ${run.model}` : "");
  }

  function runFallbackSubtitle(run) {
    return [
      providerLabel(run),
      deps.formatElapsed(run.elapsedMs),
      run.targetKind,
    ].filter(Boolean).join(" · ");
  }

  function cleanSummary(value) {
    return String(value)
      .replace(/\*\*/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatClock(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function groupByDay(runs) {
    const buckets = new Map();
    const order = [];
    for (const run of runs) {
      const key = dayKey(run.startedAt);
      if (!buckets.has(key)) {
        buckets.set(key, { key, label: dayLabel(run.startedAt), runs: [] });
        order.push(key);
      }
      buckets.get(key).runs.push(run);
    }
    return order.map((key) => buckets.get(key));
  }

  return {
    clearPoll,
    renderDetail,
    renderList,
  };
}

function countJobs(runs) {
  return runs.reduce((counts, run) => {
    counts[run.displayStatus] = (counts[run.displayStatus] ?? 0) + 1;
    return counts;
  }, { queued: 0, running: 0, done: 0, failed: 0, cancelled: 0, stale: 0 });
}

function statusWord(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusTone(status) {
  if (status === "done") return "done";
  if (status === "running" || status === "queued") return "active";
  if (status === "failed" || status === "stale") return "alert";
  return "muted";
}

function isLiveStatus(status) {
  return status === "queued" || status === "running";
}

function dayKey(iso) {
  // Intentionally local time — this viewer is single-user local only.
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const today = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
  if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
