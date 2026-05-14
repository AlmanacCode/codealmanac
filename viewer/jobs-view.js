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
    document.title = "Jobs — Almanac";
    const runs = result.runs;
    const counts = countJobs(runs);
    const days = groupByDay(runs);
    const totals = listTotals(runs, counts);

    deps.reader.innerHTML = `
      <section class="ca-hero">
        <div class="ca-section-label">Jobs</div>
        <h1 class="ca-display-h1">Every capture run, in order.</h1>
        <p class="ca-lede">${listDeck(runs.length, counts)}</p>
        ${totals !== "" ? `<div class="ca-hero-strip" aria-label="Run totals">${totals}</div>` : ""}
      </section>
      ${
        days.length === 0
          ? `<div class="ca-bento-empty">No jobs have been recorded yet.</div>`
          : `
            ${filterStrip(counts)}
            <div class="ca-logbook">${days.map(renderDay).join("")}</div>
          `
      }
    `;
    wireListFilters();
  }

  async function renderDetail(runId) {
    const detail = await deps.api(deps.jobPath(runId));
    const run = detail.run;
    const agents = detail.agents ?? [];
    const transcript = buildTranscript(detail.events, agents);
    const startMs = new Date(run.startedAt).getTime();
    document.title = `${run.displayTitle} — Almanac Jobs`;
    const heroStrip = detailHeroStrip(run);
    deps.reader.innerHTML = `
      ${deps.pageActions()}
      <section class="ca-hero">
        <div class="ca-section-label">${deps.escapeHtml(run.operation)}</div>
        <h1 class="ca-display-h1">${deps.escapeHtml(run.displayTitle)}</h1>
        <p class="ca-lede">${deps.escapeHtml(run.displaySubtitle ?? runFallbackSubtitle(run))}</p>
        <div class="ca-run-marks">
          ${statusMark(run.displayStatus)}
          ${run.transcriptSource ? `<span class="ca-run-mark">${deps.escapeHtml(transcriptSourceLabel(run))}</span>` : ""}
          <span class="ca-run-mark">${deps.escapeHtml(providerLabel(run))}</span>
          <span class="ca-run-mark">${deps.escapeHtml(deps.formatElapsed(run.elapsedMs))}</span>
          ${run.targetKind ? `<span class="ca-run-mark">${deps.escapeHtml(run.targetKind)}</span>` : ""}
        </div>
        ${heroStrip !== "" ? `<div class="ca-hero-strip" aria-label="Run barometer">${heroStrip}</div>` : ""}
      </section>

      <section class="ca-colophon-section">
        <h2 class="ca-section-label">Colophon</h2>
        <dl class="ca-colophon">
          ${colophonEntries(run).map(colophonEntry).join("")}
        </dl>
      </section>

      ${failureCallout(run)}
      ${warningsSection(detail.warnings ?? [])}
      ${agentsSection(agents, run)}
      ${targetsSection(run)}

      <section class="ca-transcript-section">
        <h2 class="ca-section-label">Logs</h2>
        <div class="ca-transcript-heading">
          <span class="ca-display-h2">Transcript</span>
          <small>${detail.events.length} ${detail.events.length === 1 ? "event" : "events"}</small>
        </div>
        ${terminalFrame(run, agents, transcript, startMs)}
      </section>
    `;
    wireTranscriptFilters();
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

  function listTotals(runs, counts) {
    if (runs.length === 0) return "";
    const totalCreated = runs.reduce((sum, run) => sum + (run.summary?.created ?? 0), 0);
    const totalUpdated = runs.reduce((sum, run) => sum + (run.summary?.updated ?? 0), 0);
    const active = counts.running + counts.queued;
    const cells = [];
    cells.push(heroCell("runs", runs.length));
    if (totalCreated > 0) cells.push(heroCell("pages created", totalCreated));
    if (totalUpdated > 0) cells.push(heroCell("pages updated", totalUpdated));
    if (active > 0) cells.push(heroCell("active", active));
    return cells.join("");
  }

  function heroCell(label, value) {
    return `
      <span class="ca-hero-strip-cell">
        <span class="ca-hero-strip-label">${deps.escapeHtml(label)}</span>
        <span class="ca-hero-strip-value">${deps.escapeHtml(value)}</span>
      </span>
    `;
  }

  function filterStrip(counts) {
    const options = [
      { value: "all", label: "All", tone: "muted", count: total(counts) },
      { value: "active", label: "Active", tone: "active", count: counts.running + counts.queued },
      { value: "done", label: "Done", tone: "done", count: counts.done },
      { value: "alert", label: "Needs attention", tone: "alert", count: counts.failed + counts.stale },
      { value: "cancelled", label: "Cancelled", tone: "muted", count: counts.cancelled },
    ].filter((opt) => opt.value === "all" || opt.count > 0);
    if (options.length <= 1) return "";
    return `
      <div class="ca-log-filter-strip" role="toolbar" aria-label="Run filters">
        <span class="ca-log-filter-prefix">filter</span>
        ${options.map((opt, index) => `
          <button
            type="button"
            class="ca-log-filter${index === 0 ? " is-active" : ""}"
            data-tone="${deps.escapeAttr(opt.tone)}"
            data-list-filter="${deps.escapeAttr(opt.value)}"
          >
            <span class="ca-log-filter-dot" aria-hidden="true"></span>
            <span>${deps.escapeHtml(opt.label)}</span>
            <span class="ca-log-filter-count">${deps.escapeHtml(opt.count)}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function wireListFilters() {
    const buttons = deps.reader.querySelectorAll("[data-list-filter]");
    const entries = deps.reader.querySelectorAll("[data-list-entry-tone]");
    const days = deps.reader.querySelectorAll(".ca-log-day");
    if (buttons.length === 0) return;
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.getAttribute("data-list-filter") ?? "all";
        buttons.forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
        entries.forEach((entry) => {
          const tone = entry.getAttribute("data-list-entry-tone") ?? "";
          entry.hidden = !(filter === "all" || tone === filter);
        });
        days.forEach((day) => {
          const visible = Array.from(day.querySelectorAll("[data-list-entry-tone]"))
            .some((entry) => !entry.hidden);
          day.hidden = !visible;
        });
      });
    });
  }

  function total(counts) {
    return Object.values(counts).reduce((sum, value) => sum + value, 0);
  }

  function renderDay(day) {
    return `
      <section class="ca-log-day">
        <header class="ca-log-day-head">
          <h2 class="ca-log-day-label">${deps.escapeHtml(day.label)}</h2>
          <span class="ca-log-day-count">${day.runs.length} ${day.runs.length === 1 ? "run" : "runs"}</span>
          ${dayRibbon(day.runs)}
        </header>
        <div class="ca-log-day-list">
          ${day.runs.map(logEntry).join("")}
        </div>
      </section>
    `;
  }

  function dayRibbon(runs) {
    const bars = new Array(24).fill(null).map(() => ({ count: 0, tones: new Set() }));
    for (const run of runs) {
      const date = new Date(run.startedAt);
      if (Number.isNaN(date.getTime())) continue;
      const hour = date.getHours();
      bars[hour].count += 1;
      bars[hour].tones.add(statusTone(run.displayStatus));
    }
    const max = Math.max(1, ...bars.map((b) => b.count));
    return `
      <div class="ca-log-day-ribbon" aria-hidden="true">
        ${bars.map((bar) => {
          const height = bar.count === 0 ? 12 : 22 + Math.round((bar.count / max) * 78);
          const tone = bar.tones.has("alert")
            ? "alert"
            : bar.tones.has("active")
              ? "active"
              : bar.tones.has("done")
                ? "done"
                : "muted";
          return `<span class="ca-log-day-ribbon-bar" data-tone="${deps.escapeAttr(tone)}" style="height: ${height}%"></span>`;
        }).join("")}
      </div>
    `;
  }

  function logEntry(run) {
    const tone = statusTone(run.displayStatus);
    return `
      <a class="ca-log-entry"
         href="${deps.escapeAttr(deps.jobRoute(run.id))}"
         data-route="${deps.escapeAttr(deps.jobRoute(run.id))}"
         data-list-entry-tone="${deps.escapeAttr(tone)}">
        <span class="ca-log-seal ca-log-seal-pulse" data-tone="${deps.escapeAttr(tone)}" aria-hidden="true">${deps.escapeHtml(sealGlyph(run))}</span>
        <span class="ca-log-stamp">
          <span class="ca-log-time">${deps.escapeHtml(formatClock(run.startedAt))}</span>
          ${typeof run.elapsedMs === "number" ? `<span class="ca-log-elapsed">${deps.escapeHtml(deps.formatElapsed(run.elapsedMs))}</span>` : ""}
        </span>
        <span class="ca-log-entry-body">
          <span class="ca-log-kicker">
            <span class="ca-log-kicker-tag">${deps.escapeHtml(run.operation)}</span>
            <span>${deps.escapeHtml(providerLabel(run))}</span>
          </span>
          ${run.transcriptSource ? `<span class="ca-log-source">${deps.escapeHtml(transcriptSourceLabel(run))}</span>` : ""}
          <span class="ca-log-title">${deps.escapeHtml(run.displayTitle)}</span>
          <span class="ca-log-summary">${deps.escapeHtml(cleanSummary(run.displaySubtitle ?? runFallbackSubtitle(run)))}</span>
          ${impactRow(run)}
        </span>
        <span class="ca-log-status">${listStatusChip(run.displayStatus)}</span>
      </a>
    `;
  }

  function sealGlyph(run) {
    const tone = statusTone(run.displayStatus);
    if (tone === "active") return "•";
    if (tone === "alert") return "!";
    if (tone === "done") return "✓";
    return "·";
  }

  function listStatusChip(status) {
    const tone = statusTone(status);
    const word = statusWord(status);
    return `
      <span class="ca-status-chip" data-tone="${deps.escapeAttr(tone)}">
        <span class="ca-status-dot" aria-hidden="true"></span>
        <span>${deps.escapeHtml(word)}</span>
      </span>
    `;
  }

  function impactRow(run) {
    const parts = impactParts(run);
    if (parts.length === 0) return "";
    return `
      <span class="ca-log-impact">
        ${parts.map((part) => `<span class="ca-log-impact-part" data-tone="${deps.escapeAttr(part.tone)}">${deps.escapeHtml(part.text)}</span>`).join("")}
      </span>
    `;
  }

  function impactParts(run) {
    const created = run.summary?.created ?? 0;
    const updated = run.summary?.updated ?? 0;
    const archived = run.summary?.archived ?? 0;
    const parts = [];
    if (created > 0) parts.push({ tone: "created", text: `+${created} created` });
    if (updated > 0) parts.push({ tone: "updated", text: `${updated} updated` });
    if (archived > 0) parts.push({ tone: "archived", text: `${archived} archived` });
    if (parts.length === 0 && run.displayStatus === "done") {
      parts.push({ tone: "muted", text: "no wiki changes" });
    }
    return parts;
  }

  function detailHeroStrip(run) {
    const cells = [];
    cells.push(heroCell("status", statusWord(run.displayStatus)));
    if (typeof run.elapsedMs === "number") cells.push(heroCell("elapsed", deps.formatElapsed(run.elapsedMs)));
    if (run.summary?.created || run.summary?.updated || run.summary?.archived) {
      const created = run.summary?.created ?? 0;
      const updated = run.summary?.updated ?? 0;
      const archived = run.summary?.archived ?? 0;
      const bits = [];
      if (created) bits.push(`+${created}`);
      if (updated) bits.push(`~${updated}`);
      if (archived) bits.push(`-${archived}`);
      cells.push(heroCell("pages", bits.join(" ")));
    }
    if (run.summary?.usage?.totalTokens !== undefined) {
      cells.push(heroCell("tokens", deps.formatNumber(run.summary.usage.totalTokens)));
    }
    if (run.summary?.costUsd !== undefined) {
      cells.push(heroCell("cost", `$${run.summary.costUsd.toFixed(4)}`));
    }
    if (run.summary?.turns !== undefined) cells.push(heroCell("turns", run.summary.turns));
    return cells.join("");
  }

  function colophonEntries(run) {
    const rows = [
      ["Started", deps.formatTimestamp(run.startedAt)],
      ["Finished", run.finishedAt ? deps.formatTimestamp(run.finishedAt) : "—"],
      ["Operation", run.operation],
      ["Provider", providerLabel(run)],
      ...(run.transcriptSource ? [["Transcript source", transcriptSourceLabel(run)]] : []),
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

  function warningsSection(warnings) {
    if (!warnings.length) return "";
    return `
      <section class="ca-warnings-section">
        <h2 class="ca-section-label">Warnings</h2>
        <div class="ca-warning-list">
          ${warnings.map((warning) => `
            <aside class="ca-run-warning ca-run-warning-${deps.escapeAttr(warning.severity)}">
              <div class="ca-run-warning-code">${deps.escapeHtml(warning.code)}</div>
              <p>${deps.escapeHtml(warning.message)}</p>
              ${warning.threadId ? `<div class="ca-run-warning-meta">${deps.escapeHtml(warning.threadId)}</div>` : ""}
            </aside>
          `).join("")}
        </div>
      </section>
    `;
  }

  function agentsSection(agents, run) {
    if (!agents.length) return "";
    const root = agents.find((agent) => agent.role === "root");
    const endedBy = doneActorLabel(agents, run);
    return `
      <section class="ca-agents-section">
        <div class="ca-agents-head">
          <div>
            <h2 class="ca-section-label">Agents</h2>
            <p>${deps.escapeHtml(agentDeck(root, agents, endedBy))}</p>
          </div>
          ${endedBy ? `<span class="ca-agent-ended">Ended by ${deps.escapeHtml(endedBy)}</span>` : ""}
        </div>
        <div class="ca-agent-grid">
          ${agents.map((agent) => agentCard(agent)).join("")}
        </div>
      </section>
    `;
  }

  function agentCard(agent) {
    return `
      <article class="ca-agent-card ca-agent-${deps.escapeAttr(agent.role)}">
        <header class="ca-agent-card-head">
          <div class="ca-agent-avatar">${deps.escapeHtml(agentInitial(agent))}</div>
          <div>
            <h3>${deps.escapeHtml(agent.label)}</h3>
            <div class="ca-agent-role">${deps.escapeHtml(agent.role)} · ${deps.escapeHtml(agent.status)}</div>
          </div>
        </header>
        <div class="ca-agent-stats">
          <span>${deps.escapeHtml(`${agent.eventCount} events`)}</span>
          <span>${deps.escapeHtml(`${agent.toolCount} tools`)}</span>
          ${agent.children?.length ? `<span>${deps.escapeHtml(`${agent.children.length} children`)}</span>` : ""}
        </div>
        <div class="ca-agent-id">${deps.escapeHtml(agent.threadId)}</div>
        ${agent.prompt ? `
          <details class="ca-agent-prompt">
            <summary>Prompt</summary>
            <pre>${deps.escapeHtml(agent.prompt)}</pre>
          </details>
        ` : ""}
        ${agent.finalMessage ? `<p>${deps.escapeHtml(cleanSummary(agent.finalMessage))}</p>` : ""}
      </article>
    `;
  }

  function agentDeck(root, agents, endedBy) {
    const helpers = agents.filter((agent) => agent.role === "helper").length;
    const rootName = root?.label ?? "Main";
    const helperText = helpers === 1 ? "1 helper" : `${helpers} helpers`;
    const endText = endedBy ? ` The terminal result came from ${endedBy}.` : "";
    return `${rootName} coordinated ${helperText}.${endText}`;
  }

  function doneActorLabel(agents, run) {
    const root = agents.find((agent) => agent.threadId === run.providerSessionId && agent.role === "root");
    return root?.label ?? agents.find((agent) => agent.role === "root")?.label ?? null;
  }

  function agentInitial(agent) {
    if (agent.role === "root") return "M";
    const match = agent.label.match(/\d+/);
    return match ? match[0] : "H";
  }

  function terminalFrame(run, agents, transcript, startMs) {
    const eventCount = transcript.length;
    const sessionId = run.providerSessionId ? run.providerSessionId.slice(0, 8) : run.id.slice(0, 8);
    const titlePath = `run/${sessionId}.log`;
    return `
      <div class="ca-terminal" data-component="terminal">
        <div class="ca-terminal-bar">
          <span class="ca-terminal-dots" aria-hidden="true">
            <span class="ca-terminal-dot ca-terminal-dot-red"></span>
            <span class="ca-terminal-dot ca-terminal-dot-yellow"></span>
            <span class="ca-terminal-dot ca-terminal-dot-green"></span>
          </span>
          <span class="ca-terminal-title">
            <span class="ca-terminal-title-prefix">~/.almanac/runs/</span>${deps.escapeHtml(titlePath)}
          </span>
          <span class="ca-terminal-events">${eventCount} ${eventCount === 1 ? "event" : "events"}</span>
        </div>
        ${transcriptFilters(agents)}
        <div class="ca-transcript">
          ${
            transcript.map((entry) => transcriptEntry(entry, startMs)).join("")
            || `<div class="ca-meta-empty">No log events have been written yet.</div>`
          }
        </div>
      </div>
    `;
  }

  function transcriptFilters(agents) {
    const filters = [
      ["all", "all"],
      ["main", "main"],
      ...agents.filter((agent) => agent.role === "helper").map((agent) => [agent.threadId, agent.label]),
      ["tools", "tools"],
      ["raw", "raw"],
    ];
    return `
      <div class="ca-transcript-filters" role="toolbar" aria-label="Transcript filters">
        ${filters.map(([value, label], index) => `
          <button type="button" class="ca-transcript-filter${index === 0 ? " is-active" : ""}" data-filter="${deps.escapeAttr(value)}">
            ${deps.escapeHtml(label)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function wireTranscriptFilters() {
    const buttons = deps.reader.querySelectorAll(".ca-transcript-filter");
    const rows = deps.reader.querySelectorAll("[data-actor-filter]");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.getAttribute("data-filter") ?? "all";
        buttons.forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
        rows.forEach((row) => {
          const actor = row.getAttribute("data-actor-filter") ?? "";
          const kind = row.getAttribute("data-kind-filter") ?? "";
          const visible =
            filter === "all" ||
            (filter === "main" && actor === "root") ||
            (filter === "tools" && (kind === "tool" || kind === "status" || kind === "lifecycle")) ||
            (filter === "raw" && (kind === "status" || kind === "invalid")) ||
            actor === filter;
          row.hidden = !visible;
        });
      });
    });
  }

  function targetsSection(run) {
    if (!run.targetPaths?.length) return "";
    return `
      <section class="ca-targets-section">
        <h2 class="ca-section-label">Targets</h2>
        <div class="ca-chip-row">
          ${run.targetPaths.map((path) => `<span class="ca-chip">${deps.escapeHtml(path)}</span>`).join("")}
        </div>
      </section>
    `;
  }

  function statusMark(status) {
    const tone = statusTone(status);
    const word = statusWord(status);
    return `
      <span class="ca-run-mark ca-run-mark-status" data-tone="${deps.escapeAttr(tone)}">
        <span class="ca-run-mark-dot" aria-hidden="true"></span>
        <span class="ca-status-word">${deps.escapeHtml(word)}</span>
      </span>
    `;
  }

  function transcriptEntry(entry, startMs) {
    if (entry.type === "assistant") {
      return `
        <div class="ca-chat-row ca-chat-row-assistant ${actorClass(entry.actor)}" ${actorData(entry.actor, "message")}>
          ${timeOffsetCell(entry.timestamp, startMs)}
          <div class="ca-chat-avatar" aria-hidden="true">${deps.escapeHtml(actorGlyph(entry.actor))}</div>
          <div class="ca-chat-bubble">
            <div class="ca-chat-meta">${actorPill(entry.actor)}${entry.timestamp ? ` <span>${deps.escapeHtml(deps.formatTimestamp(entry.timestamp))}</span>` : ""}</div>
            <div class="ca-chat-text">${deps.renderMarkdown(entry.text.trim())}</div>
          </div>
        </div>
      `;
    }
    if (entry.type === "invalid") {
      return `
        <div class="ca-tool-step ca-tool-step-error" data-actor-filter="raw" data-kind-filter="invalid">
          ${timeOffsetCell(null, startMs)}
          <div class="ca-tool-step-body">
            <div class="ca-tool-step-title">Invalid JSON at line ${deps.escapeHtml(entry.line)}</div>
            <pre>${deps.escapeHtml(entry.raw)}</pre>
          </div>
        </div>
      `;
    }
    if (entry.type === "status" || entry.type === "lifecycle") return statusStep(entry, startMs);
    return toolStep(entry, startMs);
  }

  function timeOffsetCell(timestamp, startMs) {
    const text = formatTimeOffset(timestamp, startMs);
    if (text === "") return `<span class="ca-time-offset ca-time-offset-empty" aria-hidden="true">+00:00</span>`;
    return `<span class="ca-time-offset" aria-hidden="true">${deps.escapeHtml(text)}</span>`;
  }

  function formatTimeOffset(timestamp, startMs) {
    if (timestamp === undefined || timestamp === null) return "";
    const ms = new Date(timestamp).getTime();
    if (Number.isNaN(ms) || Number.isNaN(startMs)) return "";
    const delta = Math.max(0, ms - startMs);
    const totalSeconds = Math.floor(delta / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((delta % 1000) / 100);
    return `+${pad(minutes)}:${pad(seconds)}.${tenths}`;
  }

  function pad(n) {
    return n < 10 ? `0${n}` : String(n);
  }

  function statusStep(entry, startMs) {
    return `
      <div class="ca-tool-step ca-tool-status ca-tool-status-${deps.escapeAttr(entry.tone)} ${actorClass(entry.actor)}" ${actorData(entry.actor, entry.type)}>
        ${timeOffsetCell(entry.timestamp, startMs)}
        <div class="ca-tool-step-body">
          <div class="ca-tool-step-icon">${entry.tone === "error" ? "!" : entry.type === "lifecycle" ? "A" : "·"}</div>
          <div>
            <div class="ca-tool-step-title">${deps.escapeHtml(entry.title)}</div>
            <div class="ca-tool-step-meta">
              ${actorPill(entry.actor)}<span>${deps.escapeHtml(entry.type === "lifecycle" ? "agent lifecycle" : entry.tone)}</span>${entry.timestamp ? ` <span>${deps.escapeHtml(deps.formatTimestamp(entry.timestamp))}</span>` : ""}
            </div>
            ${entry.detail ? `<details class="ca-status-detail"><summary>details</summary><pre>${deps.escapeHtml(entry.detail)}</pre></details>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function toolStep(step, startMs) {
    const model = getToolCardModel(step);
    return `
      <div class="ca-tool-flow ca-tool-${deps.escapeAttr(model.kind)} ${actorClass(step.actor)}" ${actorData(step.actor, "tool")}>
        ${timeOffsetCell(step.timestamp, startMs)}
        <details class="ca-tool-card">
          <summary class="ca-tool-summary">
            <span class="ca-tool-step-icon">${deps.escapeHtml(model.icon)}</span>
            <span class="ca-tool-copy">
              ${actorPill(step.actor)}
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
      ["Actor", actorLabel(step.actor)],
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

  function transcriptSourceLabel(run) {
    if (run.transcriptSource === "claude") return "Claude transcript";
    if (run.transcriptSource === "codex") return "Codex transcript";
    return "Transcript file";
  }

  function actorLabel(actor) {
    if (!actor) return null;
    return actor.label ?? (actor.role === "root" ? "Main" : actor.role === "helper" ? "Helper" : "Unknown actor");
  }

  function actorClass(actor) {
    if (!actor) return "ca-actor-run";
    return `ca-actor-${deps.escapeAttr(actor.role)}`;
  }

  function actorData(actor, kind) {
    const value = actor?.role === "root" ? "root" : actor?.threadId ?? "run";
    return `data-actor-filter="${deps.escapeAttr(value)}" data-kind-filter="${deps.escapeAttr(kind)}"`;
  }

  function actorGlyph(actor) {
    if (!actor) return "·";
    if (actor.role === "root") return "M";
    if (actor.role === "helper") {
      const match = (actor.label ?? "").match(/\d+/);
      return match ? match[0] : "H";
    }
    return "?";
  }

  function actorPill(actor) {
    const label = actorLabel(actor) ?? "Run";
    const role = actor?.role ?? "system";
    return `<span class="ca-actor-pill ca-actor-pill-${deps.escapeAttr(role)}">${deps.escapeHtml(label)}</span>`;
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
