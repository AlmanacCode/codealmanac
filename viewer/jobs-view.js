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
          <div class="ca-job-row-topline">
            <span class="ca-job-op">${deps.escapeHtml(run.operation)}</span>
            <span class="ca-job-status ca-status-${deps.escapeAttr(run.displayStatus)}">${deps.escapeHtml(statusLabel(run.displayStatus))}</span>
          </div>
          <div class="ca-job-row-title">${deps.escapeHtml(run.displayTitle)}</div>
          <div class="ca-job-row-summary">${deps.escapeHtml(run.displaySubtitle ?? runFallbackSubtitle(run))}</div>
          <div class="ca-job-row-meta">
            ${deps.escapeHtml(deps.formatTimestamp(run.startedAt))} &middot; ${deps.escapeHtml(providerLabel(run))} &middot; ${deps.escapeHtml(run.id)}
          </div>
        </div>
        ${runOutcomeStrip(run, true)}
      </div>
    `;
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
    return toolStep(entry.event, entry.timestamp);
  }

  function toolStep(event, timestamp) {
    const display = event.display ?? {};
    const title = eventTitle(event, display);
    const detail = eventDetail(event, display);
    return `
      <div class="ca-tool-step ca-tool-${deps.escapeAttr(event.type)}">
        <div class="ca-tool-step-icon">${deps.escapeHtml(toolIcon(event, display))}</div>
        <div class="ca-tool-step-body">
          <div class="ca-tool-step-title">${deps.escapeHtml(title)}</div>
          <div class="ca-tool-step-meta">
            ${deps.escapeHtml(toolMeta(event, display))}${timestamp ? ` &middot; ${deps.escapeHtml(deps.formatTimestamp(timestamp))}` : ""}
          </div>
          ${detail ? `<pre>${deps.escapeHtml(detail)}</pre>` : ""}
        </div>
      </div>
    `;
  }

  function eventTitle(event, display) {
    if (display.title) return display.title;
    if (event.type === "text_delta" || event.type === "text") return event.content.slice(0, 120) || "Text";
    if (event.type === "tool_use") return event.tool;
    if (event.type === "tool_result") return display.status ?? (event.isError ? "Tool error" : "Tool result");
    if (event.type === "tool_summary") return event.summary.slice(0, 120);
    if (event.type === "context_usage") return "Context usage";
    if (event.type === "error") return event.error;
    if (event.type === "done") return event.error ?? event.result ?? "Done";
    return event.type;
  }

  function toolIcon(event, display) {
    const kind = display.kind ?? event.tool ?? event.type;
    if (kind === "read") return "R";
    if (kind === "write" || kind === "edit") return "E";
    if (kind === "search") return "S";
    if (kind === "shell") return "$";
    if (kind === "web") return "W";
    if (kind === "agent") return "A";
    if (event.type === "tool_result") return event.isError ? "!" : "OK";
    if (event.type === "error") return "!";
    return "-";
  }

  function toolMeta(event, display) {
    if (display.path) return display.path;
    if (display.command) return display.command;
    if (display.status) return display.status;
    if (event.type === "tool_summary") return "status";
    if (event.type === "tool_result") return event.isError ? "tool error" : "tool result";
    return display.kind ?? event.type;
  }

  function eventDetail(event, display) {
    const parts = [];
    if (display.path) parts.push(display.path);
    if (display.command) parts.push(display.command);
    if (display.summary) parts.push(display.summary);
    if (event.type === "text_delta" || event.type === "text") parts.push(event.content);
    if (event.type === "tool_use" && event.input) parts.push(event.input);
    if (event.type === "tool_result" && event.content !== undefined) parts.push(stringifyEventValue(event.content));
    if (event.type === "tool_summary") parts.push(event.summary);
    if (event.type === "context_usage") parts.push(stringifyEventValue(event.usage));
    if (event.type === "error" && event.failure?.fix) parts.push(event.failure.fix);
    if (event.type === "done" && event.usage) parts.push(stringifyEventValue(event.usage));
    return parts.filter(Boolean).join("\n");
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

  return {
    clearPoll,
    renderDetail,
    renderList,
  };
}

function buildTranscript(entries) {
  const transcript = [];
  let assistant = null;
  const ensureAssistant = (timestamp) => {
    if (assistant === null) {
      assistant = { type: "assistant", timestamp, text: "" };
      transcript.push(assistant);
    }
    return assistant;
  };

  for (const entry of entries) {
    if (entry.invalid) {
      assistant = null;
      transcript.push({ type: "invalid", line: entry.line, raw: entry.raw });
      continue;
    }
    const event = entry.event;
    if (event.type === "text_delta" || event.type === "text") {
      ensureAssistant(entry.timestamp).text += event.content;
      continue;
    }
    if (event.type === "done" && event.result) {
      ensureAssistant(entry.timestamp).text += `${assistant?.text ? "\n\n" : ""}${event.result}`;
      continue;
    }
    assistant = null;
    if (event.type === "tool_use" || event.type === "tool_result" || event.type === "tool_summary" || event.type === "error") {
      transcript.push({ type: "tool", timestamp: entry.timestamp, event });
    }
  }

  return transcript.filter((entry) => entry.type !== "assistant" || entry.text.trim().length > 0);
}

function stringifyEventValue(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
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
