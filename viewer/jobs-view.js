import {
  buildTranscript,
  getToolCardModel,
  parseJsonObject,
  stringifyEventValue,
} from "./jobs-transcript.js";

export function createJobsView(deps) {
  let pollTimer = null;

  async function renderList() {
    const result = await deps.api("/api/jobs");
    document.title = "Jobs - Almanac";
    const counts = countJobs(result.runs);
    deps.reader.innerHTML = `
      <section class="ca-hero">
        <div class="ca-kicker">Jobs</div>
        <h1 class="ca-title">Run history</h1>
        <p class="ca-subtitle">
          Agent operations recorded from <span class="ca-file-code">.almanac/runs</span>, including settings,
          outcomes, and the normalized provider stream.
        </p>
        <div class="ca-run-ledger">
          ${ledgerCell(result.runs.length, "Total runs")}
          ${ledgerCell(counts.running + counts.queued, "Active")}
          ${ledgerCell(counts.done, "Completed")}
          ${ledgerCell(counts.failed + counts.stale, "Need attention")}
        </div>
      </section>
      <div class="ca-job-list">
        ${result.runs.map(jobRow).join("") || `<div class="ca-meta-empty">No jobs found.</div>`}
      </div>
    `;
  }

  async function renderDetail(runId) {
    const detail = await deps.api(`/api/jobs/${encodeURIComponent(runId)}`);
    const run = detail.run;
    const transcript = buildTranscript(detail.events);
    document.title = `${run.displayTitle} - Almanac Jobs`;
    deps.reader.innerHTML = `
      <section class="ca-hero">
        <div class="ca-kicker">Job</div>
        <h1 class="ca-title">${deps.escapeHtml(run.displayTitle)}</h1>
        <p class="ca-subtitle">
          ${deps.escapeHtml(run.displaySubtitle ?? runFallbackSubtitle(run))}
        </p>
        <div class="ca-chip-row">
          <span class="ca-chip ca-status-${deps.escapeAttr(run.displayStatus)}">${deps.escapeHtml(statusLabel(run.displayStatus))}</span>
          <span class="ca-chip">${deps.escapeHtml(providerLabel(run))}</span>
          <span class="ca-chip">${deps.escapeHtml(deps.formatElapsed(run.elapsedMs))}</span>
          ${run.targetKind ? `<span class="ca-chip">${deps.escapeHtml(run.targetKind)}</span>` : ""}
        </div>
      </section>
      ${runOutcomeStrip(run)}
      <section class="ca-grid">
        <div class="ca-panel">
          <h2>Settings</h2>
          <div class="ca-job-facts">
            ${jobFact("Operation", run.operation)}
            ${jobFact("Provider", run.provider)}
            ${jobFact("Model", run.model ?? "default")}
            ${jobFact("Started", deps.formatTimestamp(run.startedAt))}
            ${jobFact("Finished", run.finishedAt ? deps.formatTimestamp(run.finishedAt) : "not finished")}
            ${run.providerSessionId ? jobFact("Provider session", run.providerSessionId) : ""}
          </div>
        </div>
        <div class="ca-panel">
          <h2>Outcome</h2>
          <div class="ca-job-facts">
            ${jobFact("Pages created", String(run.summary?.created ?? 0))}
            ${jobFact("Pages updated", String(run.summary?.updated ?? 0))}
            ${jobFact("Pages archived", String(run.summary?.archived ?? 0))}
            ${run.summary?.costUsd !== undefined ? jobFact("Cost", `$${run.summary.costUsd.toFixed(4)}`) : ""}
            ${run.summary?.turns !== undefined ? jobFact("Turns", String(run.summary.turns)) : ""}
            ${run.summary?.usage?.totalTokens !== undefined ? jobFact("Tokens", deps.formatNumber(run.summary.usage.totalTokens)) : ""}
            ${jobFact("Log", run.logPath)}
            ${run.failure ? jobFact("Failure", run.failure.message) : ""}
            ${run.failure?.fix ? jobFact("Fix", run.failure.fix) : ""}
            ${run.error ? jobFact("Error", run.error) : ""}
          </div>
        </div>
      </section>
      ${run.targetPaths?.length ? `
        <section class="ca-panel ca-job-targets">
          <h2>Targets</h2>
          <div class="ca-chip-row">${run.targetPaths.map((path) => `<span class="ca-chip ca-file-code">${deps.escapeHtml(path)}</span>`).join("")}</div>
        </section>
      ` : ""}
      <section class="ca-job-stream">
        <div class="ca-section-heading">
          <h2>Transcript</h2>
          <span>${detail.events.length} stream event${detail.events.length === 1 ? "" : "s"}</span>
        </div>
        <div class="ca-transcript">
          ${transcript.map(transcriptEntry).join("") || `<div class="ca-meta-empty">No log events have been written yet.</div>`}
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
      if (deps.getPathname() === `/jobs/${runId}`) {
        renderDetail(runId).catch((error) => deps.renderError(error));
      }
    }, 1500);
  }

  function ledgerCell(value, label) {
    return `
      <div>
        <span>${deps.escapeHtml(value)}</span>
        <small>${deps.escapeHtml(label)}</small>
      </div>
    `;
  }

  function jobRow(run) {
    return `
      <div class="ca-job-row" data-route="/jobs/${deps.escapeAttr(run.id)}">
        <div class="ca-job-row-main">
          <div class="ca-job-row-head">
            <span class="ca-job-op">${deps.escapeHtml(run.operation)}</span>
            <span class="ca-job-status ca-status-${deps.escapeAttr(run.displayStatus)}">${deps.escapeHtml(statusLabel(run.displayStatus))}</span>
          </div>
          <div class="ca-job-row-title">${deps.escapeHtml(run.displayTitle)}</div>
          <div class="ca-job-row-summary">${deps.escapeHtml(cleanSummary(run.displaySubtitle ?? runFallbackSubtitle(run)))}</div>
          <div class="ca-job-row-meta">
            <span>${deps.escapeHtml(deps.formatTimestamp(run.startedAt))}</span>
            <span>${deps.escapeHtml(providerLabel(run))}</span>
            <span>${deps.escapeHtml(run.id)}</span>
          </div>
        </div>
        ${jobImpact(run)}
      </div>
    `;
  }

  function jobImpact(run) {
    const created = run.summary?.created ?? 0;
    const updated = run.summary?.updated ?? 0;
    const archived = run.summary?.archived ?? 0;
    const primary = primaryImpact(created, updated, archived);
    return `
      <div class="ca-job-impact">
        <div class="ca-job-impact-primary">${deps.escapeHtml(primary)}</div>
        <div class="ca-job-impact-grid">
          ${impactCell("Created", created)}
          ${impactCell("Updated", updated)}
          ${impactCell("Archived", archived)}
        </div>
      </div>
    `;
  }

  function impactCell(label, value) {
    return `
      <div class="${value > 0 ? "is-active" : ""}">
        <span>${deps.escapeHtml(value)}</span>
        <small>${deps.escapeHtml(label)}</small>
      </div>
    `;
  }

  function primaryImpact(created, updated, archived) {
    const total = created + updated + archived;
    if (total === 0) return "No wiki changes";
    if (created > 0) return `${created} created`;
    if (updated > 0) return `${updated} updated`;
    return `${archived} archived`;
  }

  function runOutcomeStrip(run, compact = false) {
    return `
      <div class="${compact ? "ca-run-outcome ca-run-outcome-compact" : "ca-run-outcome"}">
        ${outcomeCell("Created", run.summary?.created ?? 0)}
        ${outcomeCell("Updated", run.summary?.updated ?? 0)}
        ${outcomeCell("Archived", run.summary?.archived ?? 0)}
        ${run.summary?.turns !== undefined ? outcomeCell("Turns", run.summary.turns) : ""}
        ${run.summary?.usage?.totalTokens !== undefined ? outcomeCell("Tokens", deps.formatNumber(run.summary.usage.totalTokens)) : ""}
      </div>
    `;
  }

  function outcomeCell(label, value) {
    return `
      <div>
        <span>${deps.escapeHtml(value)}</span>
        <small>${deps.escapeHtml(label)}</small>
      </div>
    `;
  }

  function jobFact(label, value) {
    return `
      <div class="ca-job-fact">
        <span>${deps.escapeHtml(label)}</span>
        <strong>${deps.escapeHtml(value)}</strong>
      </div>
    `;
  }

  function transcriptEntry(entry) {
    if (entry.type === "assistant") {
      return `
        <div class="ca-chat-row ca-chat-row-assistant">
          <div class="ca-chat-avatar">A</div>
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
    ].filter(Boolean).join(" | ");
  }

  function cleanSummary(value) {
    return String(value)
      .replace(/\*\*/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
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

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function isLiveStatus(status) {
  return status === "queued" || status === "running";
}
