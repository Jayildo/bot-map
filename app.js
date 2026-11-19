(() => {
  const PIN_KEY = "bot-map:pins:v2";
  const FILTER_KEY = "bot-map:filters:v1";
  const POLL_MS = 60_000;
  const STALE_MS = 60 * 60 * 1000;
  const ROW_H = 26;
  const COL_W = 228;
  const { t, tCount } = window.BotMapI18n;
  const STATUS = {
    approval: { color: "#f43f5e" },
    check: { color: "#f5b942" },
    in_progress: { color: "#5b9dff" },
    done: { color: "#86c9a5" },
    cancelled: { color: "#6d6d77" },
  };
  const AVATAR_COLORS = {
    blue: "#3b82f6",
    orange: "#f59e0b",
    black: "#111113",
    gray: "#9ca3af",
    violet: "#8b5cf6",
    magenta: "#e879f9",
    green: "#22c55e",
    red: "#f43f5e",
  };
  const NEUTRAL = "#c5c5ce";

  const savedFilters = (() => {
    try {
      return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}");
    } catch {
      return {};
    }
  })();

  const state = {
    bots: [],
    tasks: [],
    selected: null,
    view: "graph",
    graph: null,
    filterBot: typeof savedFilters.filterBot === "string" ? savedFilters.filterBot : "",
    mineOnly: Boolean(savedFilters.mineOnly),
    botOrder: [],
    loaded: false,
    loadFailed: false,
  };

  const els = {
    refreshMeta: document.getElementById("refresh-meta"),
    inboxTrack: document.getElementById("inbox-track"),
    inboxCount: document.getElementById("inbox-count"),
    panel: document.getElementById("panel"),
    panelBody: document.getElementById("panel-body"),
    panelClose: document.getElementById("panel-close"),
    stage: document.querySelector(".stage"),
    views: {
      graph: document.getElementById("view-graph"),
      list: document.getElementById("view-list"),
      board: document.getElementById("view-board"),
    },
    graphWrap: document.getElementById("graph-wrap"),
    svg: document.getElementById("graph"),
    reset: document.getElementById("reset-layout"),
    botFilter: document.getElementById("bot-filter"),
    mineOnly: document.getElementById("mine-only"),
  };

  function parseTime(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const s = String(value).trim();
    if (/T/.test(s)) return new Date(s);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return new Date(s);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
  }

  const formatters = new Map();

  function localeFormats() {
    const locale = window.BotMapI18n.getLocale();
    if (!formatters.has(locale)) {
      formatters.set(locale, {
        clock: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
        date: new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }),
      });
    }
    return formatters.get(locale);
  }

  function formatTime(value, withDate = false) {
    const d = parseTime(value);
    if (!d || Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const fmt = localeFormats();
    const clock = fmt.clock.format(d);
    const sameDay = d.toDateString() === now.toDateString();
    const yday = new Date(now);
    yday.setDate(now.getDate() - 1);
    if (!withDate && sameDay) return t("time.today", { clock });
    if (!withDate && d.toDateString() === yday.toDateString()) return t("time.yesterday", { clock });
    return `${fmt.date.format(d)} ${clock}`;
  }

  function isOverdue(task) {
    if (!task.deadline) return false;
    if (task.status === "done" || task.status === "cancelled") return false;
    const d = parseTime(task.deadline);
    return d && d.getTime() < Date.now();
  }

  function remainLabel(task) {
    if (!task.deadline) return "";
    if (task.status === "done" || task.status === "cancelled") return "";
    const d = parseTime(task.deadline);
    if (!d || Number.isNaN(d.getTime())) return "";
    const ms = d.getTime() - Date.now();
    const late = ms < 0;
    const abs = Math.abs(ms);
    const min = Math.floor(abs / 60000);
    const hour = Math.floor(min / 60);
    const day = Math.floor(hour / 24);
    let text;
    if (day >= 1) {
      const h = hour % 24;
      text = h ? `${tCount("dur.day", day)} ${tCount("dur.hour", h)}` : tCount("dur.day", day);
    } else if (hour >= 1) {
      const m = min % 60;
      text = m ? `${tCount("dur.hour", hour)} ${tCount("dur.min", m)}` : tCount("dur.hour", hour);
    } else if (min < 1) {
      return late ? t("remain.justOverdue") : t("remain.oneMinLeft");
    } else {
      text = tCount("dur.min", min);
    }
    return t(late ? "remain.overdue" : "remain.left", { time: text });
  }

  function isSameDay(value, now = new Date()) {
    const d = parseTime(value);
    if (!d || Number.isNaN(d.getTime())) return false;
    return d.toDateString() === now.toDateString();
  }

  function doneAt(task) {
    if (task?.done_at) return task.done_at;
    const tl = [...(task?.timeline || [])].sort(
      (a, b) => (parseTime(a.at)?.getTime() ?? 0) - (parseTime(b.at)?.getTime() ?? 0)
    );
    return tl.length ? tl[tl.length - 1].at : null;
  }

  function todaysDone(tasks) {
    return (tasks || []).filter((t) => (t.status === "done" || t.status === "cancelled") && isSameDay(doneAt(t)));
  }

  function isStale(bot) {
    const d = parseTime(bot.updated_at);
    if (!d || Number.isNaN(d.getTime())) return true;
    return Date.now() - d.getTime() > STALE_MS;
  }

  function taskHref(task) {
    if (!task) return null;
    const candidates = [];
    if (typeof task.link === "string") candidates.push(task.link);
    if (Array.isArray(task.links)) {
      for (const l of task.links) {
        if (typeof l === "string") candidates.push(l);
        else if (l && typeof l.href === "string") candidates.push(l.href);
      }
    }
    if (typeof task.note_url === "string") candidates.push(task.note_url);
    if (Array.isArray(task.timeline)) {
      for (const e of task.timeline) {
        if (typeof e.link === "string") candidates.push(e.link);
      }
    }
    return candidates.find((u) => /^https?:\/\//i.test(u)) || null;
  }

  function statusLabel(key) {
    return t(`status.${STATUS[key] ? key : "in_progress"}`);
  }

  function avatarFill(colorKey) {
    if (!colorKey) return NEUTRAL;
    return AVATAR_COLORS[colorKey] || NEUTRAL;
  }

  function loadPins() {
    try {
      return JSON.parse(localStorage.getItem(PIN_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function savePins(pins) {
    localStorage.setItem(PIN_KEY, JSON.stringify(pins));
  }

  function setPin(id, x, y) {
    const pins = loadPins();
    pins[id] = { x, y };
    savePins(pins);
  }

  function clearPin(id) {
    const pins = loadPins();
    delete pins[id];
    savePins(pins);
  }

  function saveFilters() {
    localStorage.setItem(
      FILTER_KEY,
      JSON.stringify({ filterBot: state.filterBot, mineOnly: state.mineOnly })
    );
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tagHtml(status, extraClass = "") {
    return `<span class="tag ${status} ${extraClass}">${statusLabel(status)}</span>`;
  }

  function stageHtml(stage) {
    if (stage === "active") return `<span class="stage-tag active">${t("stage.active")}</span>`;
    if (stage === "queued") return `<span class="stage-tag">${t("stage.queued")}</span>`;
    return "";
  }

  function dueHtml(task) {
    const remain = remainLabel(task);
    if (!remain) return "";
    return `<span class="due${isOverdue(task) ? " is-overdue" : ""}">${escapeHtml(remain)}</span>`;
  }

  function extLinkHtml(task) {
    const href = taskHref(task);
    if (!href) return "";
    return `<span class="task-ext-link" data-ext-href="${escapeHtml(href)}">${t("link")}</span>`;
  }

  function splitTasks(tasks) {
    const open = (tasks || []).filter((t) => t.status !== "done" && t.status !== "cancelled");
    const done = (tasks || []).filter((t) => t.status === "done" || t.status === "cancelled");
    const doneToday = todaysDone(tasks);
    const active = open.filter((t) => (t.stage || "active") === "active");
    const queued = open.filter((t) => t.stage === "queued");
    return { open, done, doneToday, active, queued };
  }

  function normalizeQuery(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  function visibleBots() {
    const q = normalizeQuery(state.filterBot);
    return state.bots
      .filter((bot) => {
        if (q) {
          const name = normalizeQuery(bot.bot);
          const slug = normalizeQuery(bot.slug);
          const role = normalizeQuery(bot.role);
          if (!name.includes(q) && !slug.includes(q) && !role.includes(q)) return false;
        }
        if (state.mineOnly) {
          const mine = (bot.tasks || []).some((t) => t.status === "approval" || t.status === "check");
          if (!mine) return false;
        }
        return true;
      })
      .map((bot) => {
        if (!state.mineOnly) return bot;
        return {
          ...bot,
          tasks: (bot.tasks || []).filter((t) => t.status === "approval" || t.status === "check"),
        };
      });
  }

  function visibleTasks() {
    return visibleBots().flatMap((bot) =>
      (bot.tasks || []).map((task) => ({
        ...task,
        bot: bot.bot,
        botSlug: bot.slug,
        botRole: bot.role,
      }))
    );
  }

  function columnHeight(botNode) {
    const rows = botNode.active.length + botNode.queued.length + (botNode.doneToday.length ? 1 : 0);
    return 36 + rows * ROW_H + 10;
  }

  function columnBox(d) {
    const header = d.r + 52;
    const h = header + columnHeight(d);
    const w = COL_W + 16;
    return { x: d.x - w / 2, y: d.y - d.r - 6, w, h };
  }

  async function loadConfig() {
    try {
      const res = await fetch(`/config.json?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      /* no optional config */
    }
    return {};
  }

  function sortBots(bots, order) {
    const list = Array.isArray(bots) ? bots : [];
    if (Array.isArray(order) && order.length) {
      const rank = new Map(order.map((slug, i) => [slug, i]));
      return [...list].sort((a, b) => {
        const ai = rank.has(a.slug) ? rank.get(a.slug) : 1000;
        const bi = rank.has(b.slug) ? rank.get(b.slug) : 1000;
        if (ai !== bi) return ai - bi;
        return String(a.slug || "").localeCompare(String(b.slug || ""));
      });
    }
    return [...list].sort((a, b) => String(a.slug || "").localeCompare(String(b.slug || "")));
  }

  async function loadBots() {
    let results = null;
    try {
      const res = await fetch(`/api/tasks?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.bots) && data.bots.length) results = data.bots;
      }
    } catch {
      /* fall back to local files listed in config.json */
    }
    const config = await loadConfig();
    window.BotMapI18n.setConfigDefault(config.defaultLanguage);
    if (Array.isArray(config.order)) state.botOrder = config.order;
    if (!results) {
      const files = Array.isArray(config.localFiles) ? config.localFiles : [];
      results = [];
      for (const path of files) {
        try {
          const res = await fetch(`${path}?t=${Date.now()}`);
          if (res.ok) results.push(await res.json());
        } catch {
          /* skip missing local example files */
        }
      }
    }
    state.bots = sortBots(results, state.botOrder);
    state.tasks = results.flatMap((bot) =>
      (bot.tasks || []).map((task) => ({
        ...task,
        bot: bot.bot,
        botSlug: bot.slug,
        botRole: bot.role,
      }))
    );
    state.loadFailed = false;
  }

  function inboxTasks() {
    return state.tasks
      .filter((t) => t.status === "approval" || t.status === "check")
      .sort((a, b) => {
        const ao = isOverdue(a) ? 0 : 1;
        const bo = isOverdue(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const ad = parseTime(a.deadline)?.getTime() ?? Infinity;
        const bd = parseTime(b.deadline)?.getTime() ?? Infinity;
        return ad - bd;
      });
  }

  function renderRefresh() {
    if (state.loadFailed) {
      els.refreshMeta.textContent = t("error.load");
      return;
    }
    const times = state.bots
      .map((b) => parseTime(b.updated_at))
      .filter((d) => d && !Number.isNaN(d.getTime()));
    const latest = times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : new Date();
    els.refreshMeta.textContent = t("refreshMeta", { time: formatTime(latest, true) });
  }

  function renderInbox() {
    const items = inboxTasks();
    els.inboxCount.textContent = String(items.length);
    if (!items.length) {
      els.inboxTrack.innerHTML = `<p class="inbox-empty">${t("inbox.empty")}</p>`;
      return;
    }
    els.inboxTrack.innerHTML = items
      .map((t) => {
        const open = state.selected === `task:${t.id}` ? " is-open" : "";
        const late = isOverdue(t) ? " is-overdue" : "";
        return `<button type="button" class="inbox-card${open}${late}" data-open="task:${t.id}">
          <div class="row">${tagHtml(t.status)} ${dueHtml(t)}</div>
          <div class="title">${escapeHtml(t.title)}${extLinkHtml(t)}</div>
          <div class="note"><span class="bot-chip">${escapeHtml(t.bot)}</span> · ${escapeHtml(t.note || "")}</div>
        </button>`;
      })
      .join("");
  }

  function taskById(id) {
    return state.tasks.find((t) => t.id === id);
  }

  function botBySlug(slug) {
    return state.bots.find((b) => b.slug === slug);
  }

  function renderLinks(links) {
    if (!links || !links.length) return "";
    const pills = links
      .map((l) => {
        const label = escapeHtml(typeof l === "string" ? l : l.label);
        const href = typeof l === "string" ? l : l.href;
        if (href && /^https?:\/\//i.test(href)) {
          return `<a class="link-pill" href="${escapeHtml(href)}" target="_blank" rel="noopener">${label}</a>`;
        }
        return `<span class="link-pill">${label}</span>`;
      })
      .join("");
    return `<div class="links">${pills}</div>`;
  }

  function renderTimeline(entries) {
    if (!entries || !entries.length) return `<p class="note" style="opacity:.7">${t("timeline.empty")}</p>`;
    const items = [...entries]
      .sort((a, b) => (parseTime(a.at)?.getTime() ?? 0) - (parseTime(b.at)?.getTime() ?? 0))
      .map((e) => {
        const link =
          e.link && /^https?:/.test(e.link)
            ? `<div><a class="link-pill" href="${escapeHtml(e.link)}" target="_blank" rel="noopener">${t("link")}</a></div>`
            : e.link
              ? `<div><span class="link-pill">${escapeHtml(e.link)}</span></div>`
              : "";
        return `<li><span class="at">${escapeHtml(formatTime(e.at, true))}</span><span class="tx">${escapeHtml(e.text)}</span>${link}</li>`;
      })
      .join("");
    return `<h4>${t("timeline.title")}</h4><ol class="timeline">${items}</ol>`;
  }

  function pinButton(nodeId) {
    const pinned = Boolean(loadPins()[nodeId]);
    return `<button type="button" class="pin-btn${pinned ? " is-on" : ""}" data-pin="${escapeHtml(nodeId)}">${pinned ? t("pin.off") : t("pin.on")}</button>`;
  }

  function renderTaskPanel(task) {
    const late = isOverdue(task);
    const remain = remainLabel(task);
    const href = taskHref(task);
    const extraLink = href && !(task.links || []).some((l) => (typeof l === "string" ? l : l?.href) === href)
      ? renderLinks([{ label: t("shortcut"), href }])
      : "";
    els.panelBody.innerHTML = `
      <div class="panel-kicker">${tagHtml(task.status)}${stageHtml(task.stage)}${late ? `<span class="tag delay">${t("tag.overdue")}</span>` : ""}
        <span class="bot-chip">${escapeHtml(task.bot)}${task.botRole ? ` · ${escapeHtml(task.botRole)}` : ""}</span>
      </div>
      <h3>${escapeHtml(task.title)}</h3>
      <div class="meta-row">
        <span>${escapeHtml(t("requested", { time: formatTime(task.requested_at, true) }))}</span>
        ${
          task.deadline
            ? `<span class="due${late ? " is-overdue" : ""}">${remain ? escapeHtml(remain) : t("due")} · ${escapeHtml(formatTime(task.deadline, true))}</span>`
            : `<span>${t("noDue")}</span>`
        }
      </div>
      ${pinButton(`bot:${task.botSlug}`)}
      <p class="note">${escapeHtml(task.note || "")}</p>
      ${renderLinks(task.links)}${extraLink}
      ${renderTimeline(task.timeline)}
    `;
  }

  function renderBotPanel(bot) {
    const { open, doneToday, active, queued } = splitTasks(bot.tasks);
    const stale = isStale(bot);
    const list = (arr) =>
      arr
        .map(
          (t) => `<button type="button" class="task-mini${isOverdue(t) ? " is-overdue" : ""}" data-open="task:${t.id}">
            <div class="row">${tagHtml(t.status)} ${stageHtml(t.stage)} ${dueHtml(t)}</div>
            <div class="title">${escapeHtml(t.title)}${extLinkHtml(t)}</div>
          </button>`
        )
        .join("");
    els.panelBody.innerHTML = `
      <div class="panel-kicker"><span class="bot-chip${stale ? " is-stale" : ""}">${escapeHtml(bot.role || t("bot.defaultRole"))}</span></div>
      <h3>${escapeHtml(bot.bot)}</h3>
      <div class="meta-row"><span>${escapeHtml(t("lastUpdated", { time: formatTime(bot.updated_at, true) }))}${stale ? t("stale.long") : ""}</span>
        <span>${t("botCounts", { active: active.length, queued: queued.length, done: doneToday.length })}</span></div>
      ${pinButton(`bot:${bot.slug}`)}
      <h4 style="margin-top:16px">${t("section.active")}</h4>
      ${active.length ? list(active) : `<p class="note">${t("empty.active")}</p>`}
      ${queued.length ? `<h4 style="margin-top:16px">${t("section.queued")}</h4>${list(queued)}` : ""}
      ${doneToday.length ? `<h4 style="margin-top:16px">${t("doneTodayCount", { n: doneToday.length })}</h4>${list(doneToday)}` : ""}
    `;
  }

  function openNode(id) {
    state.selected = id;
    els.panel.hidden = false;
    els.stage.classList.add("is-panel-open");
    if (id.startsWith("task:")) {
      const task = taskById(id.slice(5));
      if (task) renderTaskPanel(task);
    } else if (id.startsWith("bot:")) {
      const bot = botBySlug(id.slice(4));
      if (bot) renderBotPanel(bot);
    } else if (id.startsWith("done:")) {
      const bot = botBySlug(id.slice(5));
      if (bot) renderBotPanel(bot);
    }
    renderInbox();
    if (state.graph) {
      state.graph.resize();
      state.graph.highlight(id);
    }
  }

  function closePanel() {
    state.selected = null;
    els.panel.hidden = true;
    els.stage.classList.remove("is-panel-open");
    renderInbox();
    if (state.graph) {
      state.graph.resize();
      state.graph.highlight(null);
    }
  }

  function cardHtml(t, cls) {
    const queued = t.stage === "queued" ? " is-queued" : "";
    const late = isOverdue(t) ? " is-overdue" : "";
    return `<button type="button" class="${cls}${queued}${late}" data-open="task:${t.id}">
      <div class="row">${tagHtml(t.status)} ${stageHtml(t.stage)} <span class="bot-chip">${escapeHtml(t.bot || "")}</span> ${dueHtml(t)}</div>
      <div class="title">${escapeHtml(t.title)}${extLinkHtml(t)}</div>
      <div class="note">${escapeHtml(t.note || "")}</div>
    </button>`;
  }

  function renderList() {
    const tasks = visibleTasks();
    const groups = [
      { key: "approval", title: t("status.approval") },
      { key: "check", title: t("status.check") },
      { key: "in_progress", title: t("status.in_progress") },
      { key: "done", title: t("section.doneToday") },
    ];
    const html = groups
      .map((g) => {
        const items =
          g.key === "done"
            ? todaysDone(tasks)
            : tasks.filter((t) => t.status === g.key);
        if (g.key === "done" && !items.length) return "";
        const cards = items.length
          ? items.map((t) => cardHtml(t, "list-card")).join("")
          : `<p class="inbox-empty">${t("empty.group")}</p>`;
        return `<section class="group"><h3>${tagHtml(g.key)} ${g.title} · ${items.length}</h3>${cards}</section>`;
      })
      .join("");
    els.views.list.innerHTML = html || `<p class="inbox-empty">${t("empty.tasksFilter")}</p>`;
  }

  function renderBoard() {
    const bots = visibleBots();
    if (!bots.length) {
      els.views.board.innerHTML = `<p class="inbox-empty">${t("empty.botsFilter")}</p>`;
      return;
    }
    els.views.board.innerHTML = `<div class="board">${bots
      .map((bot) => {
        const { active, queued, doneToday } = splitTasks(bot.tasks);
        const fill = avatarFill(bot.color);
        const stale = isStale(bot);
        const cards = [...active, ...queued]
          .map((t) => cardHtml({ ...t, bot: "" }, "board-card"))
          .join("");
        const doneCards = doneToday
          .map(
            (t) => `<button type="button" class="board-card" data-open="task:${t.id}">
              <div class="row">${tagHtml(t.status)}</div>
              <div class="title">${escapeHtml(t.title)}${extLinkHtml(t)}</div>
            </button>`
          )
          .join("");
        return `<section class="board-col${stale ? " is-stale" : ""}" data-bot="${escapeHtml(bot.slug)}">
          <h3><span class="board-avatar" style="background:${fill}"></span>${escapeHtml(bot.bot)}</h3>
          <div class="role">${escapeHtml(bot.role || "")} · ${t("boardCounts", { active: active.length, queued: queued.length })}</div>
          <div class="bot-updated-plain">${escapeHtml(t("lastUpdated", { time: formatTime(bot.updated_at) || t("none") }))}${stale ? t("stale.short") : ""}</div>
          ${cards || `<p class="inbox-empty">${t("empty.open")}</p>`}
          ${
            doneToday.length
              ? `<button type="button" class="done-fold" data-fold="${escapeHtml(bot.slug)}">${t("fold.show", { n: doneToday.length })}</button>
                 <div class="done-fold-body" data-fold-body="${escapeHtml(bot.slug)}" hidden>${doneCards}</div>`
              : ""
          }
        </section>`;
      })
      .join("")}</div>`;
  }

  function setView(name) {
    state.view = name;
    document.querySelectorAll(".tab").forEach((tab) => {
      const on = tab.dataset.view === name;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(els.views).forEach(([key, el]) => {
      const on = key === name;
      el.classList.toggle("is-active", on);
      el.hidden = !on;
    });
    if (name === "list") renderList();
    if (name === "board") renderBoard();
    if (name === "graph" && state.graph) {
      requestAnimationFrame(() => state.graph.resize());
    }
  }

  function avatarPath(shape, r) {
    const s = r;
    if (shape === "teardrop") {
      return `M 0,${s * 1.28}
        C ${s * 0.18},${s * 0.72} ${s * 0.98},${s * 0.28} ${s * 0.98},${-s * 0.18}
        C ${s * 0.98},${-s * 0.82} ${s * 0.52},${-s * 1.08} 0,${-s * 1.08}
        C ${-s * 0.52},${-s * 1.08} ${-s * 0.98},${-s * 0.82} ${-s * 0.98},${-s * 0.18}
        C ${-s * 0.98},${s * 0.28} ${-s * 0.18},${s * 0.72} 0,${s * 1.28} Z`;
    }
    if (shape === "blob") {
      return `M 0,${-s * 0.95}
        C ${s * 0.5},${-s * 1.15} ${s * 1.15},${-s * 0.45} ${s * 1.05},${s * 0.05}
        C ${s * 1.15},${s * 0.55} ${s * 0.45},${s * 1.15} ${-s * 0.05},${s * 0.98}
        C ${-s * 0.55},${s * 1.18} ${-s * 1.12},${s * 0.45} ${-s * 0.98},${-s * 0.1}
        C ${-s * 1.05},${-s * 0.65} ${-s * 0.45},${-s * 1.05} 0,${-s * 0.95} Z`;
    }
    if (shape === "pebble") {
      return `M ${-s * 0.95},${-s * 0.15}
        C ${-s * 0.85},${-s * 0.85} ${-s * 0.15},${-s * 1.05} ${s * 0.35},${-s * 0.85}
        C ${s * 1.0},${-s * 0.6} ${s * 1.1},${s * 0.2} ${s * 0.7},${s * 0.7}
        C ${s * 0.25},${s * 1.15} ${-s * 0.55},${s * 1.0} ${-s * 0.85},${s * 0.35}
        C ${-s * 1.08},${-s * 0.15} ${-s * 1.0},${0} ${-s * 0.95},${-s * 0.15} Z`;
    }
    if (shape === "sparkle") {
      const o = s * 1.15,
        i = s * 0.28;
      return `M 0,${-o} L ${i},${-i} L ${o},0 L ${i},${i} L 0,${o} L ${-i},${i} L ${-o},0 L ${-i},${-i} Z`;
    }
    if (shape === "star") {
      const pts = [];
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
        const b = a + Math.PI / 5;
        pts.push([Math.cos(a) * s * 1.15, Math.sin(a) * s * 1.15]);
        pts.push([Math.cos(b) * s * 0.46, Math.sin(b) * s * 0.46]);
      }
      return `M ${pts.map((p) => p.join(",")).join(" L ")} Z`;
    }
    return null;
  }

  function updatedLabel(d) {
    const when = formatTime(d.updatedAt);
    if (!when) return t("graph.noUpdate");
    return t(d.stale ? "graph.updatedStale" : "graph.updated", { time: when });
  }

  function truncate(text, max) {
    const s = String(text || "");
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  }

  function buildGraphData() {
    return visibleBots().map((bot) => {
      const { active, queued, doneToday } = splitTasks(bot.tasks);
      return {
        id: `bot:${bot.slug}`,
        kind: bot.kind === "person" ? "person" : "bot",
        slug: bot.slug,
        label: bot.bot,
        sub: bot.role || "",
        updatedAt: bot.updated_at,
        stale: isStale(bot),
        shape: bot.shape || "",
        colorKey: bot.color || "",
        color: avatarFill(bot.color),
        r: 22,
        active,
        queued,
        doneToday,
      };
    });
  }

  function initGraph() {
    const wrap = els.graphWrap;
    const svg = d3.select(els.svg);
    let width = 0;
    let height = 0;
    let simulation;
    let gRoot;
    let clusterSel;
    let zoom;
    let fittedOnce = false;
    let autoFitAllowed = true;
    let dragging = false;
    let rafId = 0;
    const nodes = buildGraphData();

    function size() {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(200, rect.width);
      height = Math.max(200, rect.height);
      svg.attr("viewBox", `0 0 ${width} ${height}`);
    }

    function seedPositions(targets = nodes) {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(200, rect.width);
      const h = Math.max(200, rect.height);
      const bySlug = Object.fromEntries(targets.map((n) => [n.slug, n]));
      const preferred = Array.isArray(state.botOrder) ? state.botOrder : [];
      const unique = [
        ...new Set([
          ...preferred.filter((slug) => bySlug[slug]),
          ...targets.map((n) => n.slug),
        ]),
      ];
      if (w >= 980) {
        const gap = Math.min(300, (w - 80) / Math.max(unique.length, 1));
        const start = w / 2 - (gap * (unique.length - 1)) / 2;
        const y = Math.max(90, h * 0.28);
        unique.forEach((slug, i) => {
          const n = bySlug[slug];
          if (!n) return;
          n.x = start + i * gap;
          n.y = y;
        });
      } else {
        const cols = Math.min(2, Math.max(1, unique.length));
        const rows = Math.max(1, Math.ceil(unique.length / cols));
        unique.forEach((slug, i) => {
          const n = bySlug[slug];
          if (!n) return;
          const col = i % cols;
          const row = Math.floor(i / cols);
          n.x = w * (cols === 1 ? 0.5 : 0.3 + col * 0.4);
          n.y = h * (0.22 + (rows <= 1 ? 0 : (row / Math.max(rows - 1, 1)) * 0.5));
        });
      }
    }

    function placeIfMissing(list) {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(200, rect.width);
      const h = Math.max(200, rect.height);
      list.forEach((n, i) => {
        if (n.x != null && Number.isFinite(n.x) && n.y != null && Number.isFinite(n.y)) return;
        n.x = w * (0.3 + (i % 2) * 0.4);
        n.y = h * (0.32 + Math.floor(i / 2) * 0.22);
      });
    }

    function applyPins(list) {
      const pins = loadPins();
      for (const n of list) {
        if (pins[n.id]) {
          n.fx = pins[n.id].x;
          n.fy = pins[n.id].y;
          n.x = pins[n.id].x;
          n.y = pins[n.id].y;
          n.pinned = true;
        }
      }
    }

    function cancelPaint() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function paint() {
      if (clusterSel) clusterSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    }

    function schedulePaint() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        paint();
      });
    }

    function tick() {
      schedulePaint();
    }

    size();
    seedPositions();
    applyPins(nodes);

    svg.selectAll("*").remove();
    const defs = svg.append("defs");
    const glow = defs
      .append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    glow.append("feGaussianBlur").attr("stdDeviation", "2.2").attr("result", "blur");
    glow.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).enter().append("feMergeNode").attr("in", (d) => d);
    const grey = defs.append("filter").attr("id", "stale-grey");
    grey.append("feColorMatrix").attr("type", "saturate").attr("values", "0");

    const blackShine = defs.append("radialGradient").attr("id", "black-shine").attr("cx", "35%").attr("cy", "30%");
    blackShine.append("stop").attr("offset", "0%").attr("stop-color", "#4a4a50");
    blackShine.append("stop").attr("offset", "55%").attr("stop-color", "#161618");
    blackShine.append("stop").attr("offset", "100%").attr("stop-color", "#050506");

    gRoot = svg.append("g").attr("class", "viewport");
    const gClusters = gRoot.append("g").attr("class", "clusters");

    zoom = d3
      .zoom()
      .scaleExtent([0.4, 3.2])
      .filter((event) => {
        if (event.type === "wheel") return true;
        const t = event.target;
        if (t && t.closest && t.closest(".avatar")) return false;
        return (!event.ctrlKey || event.type === "wheel") && !event.button;
      })
      .on("zoom", (event) => {
        gRoot.attr("transform", event.transform);
      });
    svg.call(zoom).on("dblclick.zoom", null);

    function fitView(animate = true) {
      if (!nodes.length || !width || !height) return;
      const boxes = nodes.map(columnBox);
      const minX = Math.min(...boxes.map((b) => b.x)) - 16;
      const maxX = Math.max(...boxes.map((b) => b.x + b.w)) + 16;
      const minY = Math.min(...boxes.map((b) => b.y)) - 10;
      const maxY = Math.max(...boxes.map((b) => b.y + b.h)) + 12;
      const bw = Math.max(120, maxX - minX);
      const bh = Math.max(120, maxY - minY);
      const padX = width < 600 ? 20 : 48;
      const padY = width < 600 ? 20 : 36;
      const cap = width < 600 ? 1.85 : 1.35;
      const scale = Math.min((width - padX * 2) / bw, (height - padY * 2) / bh, cap);
      const tx = width / 2 - scale * ((minX + maxX) / 2);
      const ty = height / 2 - scale * ((minY + maxY) / 2);
      const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
      if (animate) svg.transition().duration(400).call(zoom.transform, t);
      else svg.call(zoom.transform, t);
    }

    function forceColumns(alpha) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const A = nodes[i];
          const B = nodes[j];
          const a = columnBox(A);
          const b = columnBox(B);
          const gap = 26;
          const acx = a.x + a.w / 2;
          const acy = a.y + a.h / 2;
          const bcx = b.x + b.w / 2;
          const bcy = b.y + b.h / 2;
          const ox = (a.w + b.w) / 2 + gap - Math.abs(acx - bcx);
          const oy = (a.h + b.h) / 2 + gap - Math.abs(acy - bcy);
          if (ox > 0 && oy > 0) {
            const preferX = ox <= oy * 1.15;
            const s = Math.min(1, 0.35 + alpha);
            if (preferX) {
              const dir = acx <= bcx ? -1 : 1;
              const push = (ox / 2) * s;
              if (!A.fx && !A.pinned) A.x += dir * push;
              if (!B.fx && !B.pinned) B.x -= dir * push;
              if (A.pinned && !B.fx && !B.pinned) B.x -= dir * ox * s;
              if (B.pinned && !A.fx && !A.pinned) A.x += dir * ox * s;
            } else {
              const dir = acy <= bcy ? -1 : 1;
              const push = (oy / 2) * s;
              if (!A.fy && !A.pinned) A.y += dir * push;
              if (!B.fy && !B.pinned) B.y -= dir * push;
              if (A.pinned && !B.fy && !B.pinned) B.y -= dir * oy * s;
              if (B.pinned && !A.fy && !A.pinned) A.y += dir * oy * s;
            }
          }
        }
      }
    }

    function buildAvatar(sel, d) {
      const path = avatarPath(d.shape, d.r);
      const haloPath = avatarPath(d.shape, d.r + 8);
      if (haloPath) {
        sel.append("path")
          .attr("class", "avatar-halo")
          .attr("d", haloPath)
          .attr("fill", d.color)
          .attr("fill-opacity", d.colorKey === "black" ? 0.22 : 0.16)
          .attr("filter", "url(#glow)");
      } else {
        sel.append("ellipse")
          .attr("class", "avatar-halo")
          .attr("rx", d.r + 9)
          .attr("ry", d.r + 9)
          .attr("fill", d.color)
          .attr("fill-opacity", d.colorKey === "black" ? 0.2 : 0.16)
          .attr("filter", "url(#glow)");
      }
      const stroke = d.colorKey === "black" ? "#e8e6e1" : d.colorKey ? d3.color(d.color).brighter(0.8) : "#edede8";
      const fill = d.colorKey === "black" ? "url(#black-shine)" : d.color;
      if (path) {
        sel
          .append("path")
          .attr("class", "avatar-shape")
          .attr("d", path)
          .attr("fill", fill)
          .attr("stroke", stroke)
          .attr("stroke-width", d.colorKey === "black" ? 1.7 : 1.5);
      } else {
        sel
          .append("circle")
          .attr("class", "avatar-shape")
          .attr("r", d.r)
          .attr("fill", fill)
          .attr("stroke", stroke)
          .attr("stroke-width", 1.6);
      }
    }

    /* Due and link label widths vary by language, so lay them out right-to-left by measured width. */
    function fitRowLabels(row) {
      const due = row.select("text.due").node();
      const link = row.select("text.ext-link").node();
      const title = row.select("text.title").node();
      let right = COL_W / 2 - 8;
      if (due) right -= due.getComputedTextLength() + 8;
      if (link) {
        if (!due) right -= 4;
        link.setAttribute("x", right);
        link.setAttribute("text-anchor", "end");
        right -= link.getComputedTextLength() + 8;
      }
      if (!title) return;
      const avail = right - (-COL_W / 2 + 24);
      let text = title.textContent;
      while (text.length > 2 && title.getComputedTextLength() > avail) {
        text = text.replace(/…$/, "").slice(0, -1);
        title.textContent = `${text}…`;
      }
    }

    function redrawColumn(sel, d) {
      sel.selectAll("*").remove();
      const rows = [...d.active.map((t) => ({ ...t, rowType: "active" })), ...d.queued.map((t) => ({ ...t, rowType: "queued" }))];
      const h = rows.length * ROW_H + (d.doneToday.length ? ROW_H + 2 : 0) + 8;
      sel
        .append("rect")
        .attr("class", "col-bg")
        .attr("x", -COL_W / 2)
        .attr("y", -4)
        .attr("rx", 10)
        .attr("width", COL_W)
        .attr("height", h);

      const row = sel
        .selectAll("g.task-row")
        .data(rows, (t) => t.id)
        .join("g")
        .attr("class", (t) => `task-row is-${t.rowType}${isOverdue(t) ? " is-overdue" : ""}`)
        .attr("data-open", (t) => `task:${t.id}`)
        .attr("transform", (_, i) => `translate(0, ${i * ROW_H})`);

      row
        .append("rect")
        .attr("class", "hit")
        .attr("x", -COL_W / 2 + 2)
        .attr("y", 1)
        .attr("width", COL_W - 4)
        .attr("height", ROW_H - 2)
        .attr("rx", 6);
      row
        .append("circle")
        .attr("class", "dot")
        .attr("cx", -COL_W / 2 + 14)
        .attr("cy", ROW_H / 2)
        .attr("r", 4.2)
        .attr("fill", (t) => (STATUS[t.status] || STATUS.in_progress).color);
      row
        .append("text")
        .attr("class", "title")
        .attr("x", -COL_W / 2 + 24)
        .attr("y", ROW_H / 2 + 4)
        .text((t) => truncate(t.title, remainLabel(t) ? (taskHref(t) ? 10 : 12) : taskHref(t) ? 14 : 16));
      row
        .filter((t) => taskHref(t))
        .append("text")
        .attr("class", "ext-link")
        .attr("x", (t) => (remainLabel(t) ? COL_W / 2 - 78 : COL_W / 2 - 12))
        .attr("y", ROW_H / 2 + 4)
        .attr("text-anchor", (t) => (remainLabel(t) ? "start" : "end"))
        .text(t("link"));
      row
        .filter((t) => remainLabel(t))
        .append("text")
        .attr("class", (t) => `due${isOverdue(t) ? " is-overdue" : ""}`)
        .attr("x", COL_W / 2 - 8)
        .attr("y", ROW_H / 2 + 4)
        .text((t) => remainLabel(t));
      row.each(function () {
        fitRowLabels(d3.select(this));
      });

      if (d.doneToday.length) {
        const y = rows.length * ROW_H + 2;
        const done = sel
          .append("g")
          .attr("class", "done-row")
          .attr("data-open", `done:${d.slug}`)
          .attr("transform", `translate(0, ${y})`);
        done
          .append("rect")
          .attr("class", "hit")
          .attr("x", -COL_W / 2 + 2)
          .attr("y", 1)
          .attr("width", COL_W - 4)
          .attr("height", ROW_H - 2)
          .attr("rx", 6);
        done
          .append("circle")
          .attr("cx", -COL_W / 2 + 14)
          .attr("cy", ROW_H / 2)
          .attr("r", 3.6)
          .attr("fill", STATUS.done.color);
        done
          .append("text")
          .attr("class", "title")
          .attr("x", -COL_W / 2 + 24)
          .attr("y", ROW_H / 2 + 4)
          .text(t("doneTodayCount", { n: d.doneToday.length }));
      }
    }

    function createCluster(enter) {
      const g = enter
        .append("g")
        .attr("class", (d) => `cluster${d.stale ? " is-stale" : ""}`)
        .attr("data-id", (d) => d.id);

      g.append("line")
        .attr("class", "stem")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", (d) => d.r - 2)
        .attr("y2", (d) => d.r + 48);

      const av = g.append("g").attr("class", "avatar").style("cursor", "grab");
      av.each(function (d) {
        buildAvatar(d3.select(this), d);
      });

      av.append("path")
        .attr("class", "pin-mark")
        .attr("d", "M-2.2,-28 l4.4,0 l0,4.2 l-2.2,3.2 l-2.2,-3.2 z")
        .attr("fill", "#f5b942")
        .attr("stroke", "#0c0c0e")
        .attr("stroke-width", 0.6)
        .attr("display", (d) => (d.pinned ? "block" : "none"));

      g.append("text")
        .attr("class", "bot-name")
        .attr("y", (d) => d.r + 16)
        .text((d) => d.label);
      g.append("text")
        .attr("class", "bot-sub")
        .attr("y", (d) => d.r + 28)
        .text((d) => d.sub);
      g.append("text")
        .attr("class", "bot-updated")
        .attr("y", (d) => d.r + 40)
        .text((d) => updatedLabel(d));

      g.append("g").attr("class", "column").attr("transform", (d) => `translate(0, ${d.r + 50})`);
      return g;
    }

    function parentId(id) {
      if (!id) return null;
      if (id.startsWith("bot:")) return id;
      if (id.startsWith("done:")) return `bot:${id.slice(5)}`;
      if (id.startsWith("task:")) {
        const t = taskById(id.slice(5));
        return t ? `bot:${t.botSlug}` : null;
      }
      return id;
    }

    function highlight(id) {
      const botId = parentId(id);
      if (!clusterSel) return;
      clusterSel.classed("is-dim", (d) => Boolean(botId) && d.id !== botId);
      clusterSel.selectAll(".task-row").classed("is-selected", function () {
        return this.getAttribute("data-open") === id;
      });
    }

    const drag = d3
      .drag()
      .container(() => gRoot.node())
      .subject((event, d) => d)
      .clickDistance(4)
      .on("start", (event, d) => {
        if (event.sourceEvent) {
          event.sourceEvent.stopPropagation();
          if (event.sourceEvent.stopImmediatePropagation) event.sourceEvent.stopImmediatePropagation();
        }
        dragging = true;
        autoFitAllowed = false;
        d3.select(event.sourceEvent && event.sourceEvent.target ? event.sourceEvent.target.closest(".avatar") || event.sourceEvent.target : null).style("cursor", "grabbing");
        if (!event.active && simulation) simulation.alphaTarget(0.15).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
        d.x = event.x;
        d.y = event.y;
        if (d.pinned) setPin(d.id, d.x, d.y);
        schedulePaint();
      })
      .on("end", (event, d) => {
        dragging = false;
        clusterSel.selectAll(".avatar").style("cursor", "grab");
        if (!event.active && simulation) simulation.alphaTarget(0);
        if (d.pinned) setPin(d.id, d.x, d.y);
        else {
          d.fx = null;
          d.fy = null;
        }
      });

    function bindClusterEvents() {
      clusterSel.selectAll(".avatar").on("click", (event, d) => {
        event.stopPropagation();
        openNode(d.id);
      });
      clusterSel.selectAll(".bot-name, .bot-sub, .bot-updated").on("click", (event, d) => {
        event.stopPropagation();
        openNode(d.id);
      });
      clusterSel.selectAll("[data-open]").on("click", (event) => {
        event.stopPropagation();
        if (event.target && event.target.classList && event.target.classList.contains("ext-link")) {
          const t = d3.select(event.target).datum();
          const href = taskHref(t);
          if (href) window.open(href, "_blank", "noopener");
          return;
        }
        const id = event.currentTarget.getAttribute("data-open");
        if (id) openNode(id);
      });
      clusterSel.selectAll(".avatar").call(drag);
    }

    function drawClusters() {
      clusterSel = gClusters
        .selectAll("g.cluster")
        .data(nodes, (d) => d.id)
        .join(
          (enter) => createCluster(enter),
          (update) => update,
          (exit) => exit.remove()
        );

      clusterSel.classed("is-stale", (d) => d.stale);
      clusterSel.select(".bot-name").text((d) => d.label);
      clusterSel.select(".bot-sub").text((d) => d.sub);
      clusterSel.select(".bot-updated").text((d) => updatedLabel(d));
      clusterSel.selectAll(".pin-mark").attr("display", (d) => (d.pinned ? "block" : "none"));
      clusterSel.select(".column").each(function (d) {
        redrawColumn(d3.select(this), d);
      });
      bindClusterEvents();
      if (state.selected) highlight(state.selected);
      paint();
    }

    svg.on("click", (event) => {
      if (event.target === els.svg) closePanel();
    });

    function pinToggle(id) {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      if (node.pinned) {
        node.pinned = false;
        node.fx = null;
        node.fy = null;
        clearPin(id);
        if (simulation) simulation.alpha(0.2).restart();
      } else {
        node.pinned = true;
        node.fx = node.x;
        node.fy = node.y;
        setPin(id, node.x, node.y);
      }
      clusterSel.selectAll(".pin-mark").attr("display", (d) => (d.pinned ? "block" : "none"));
    }

    function resetPins() {
      localStorage.removeItem(PIN_KEY);
      for (const n of nodes) {
        n.pinned = false;
        n.fx = null;
        n.fy = null;
      }
      clusterSel.selectAll(".pin-mark").attr("display", "none");
      fittedOnce = false;
      autoFitAllowed = true;
      seedPositions();
      if (simulation) simulation.alpha(0.6).restart();
    }

    function startSim() {
      size();
      if (!nodes.length) {
        size();
        return;
      }
      if (simulation) simulation.stop();
      simulation = d3
        .forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(-60))
        .force("center", d3.forceCenter(width / 2, height * 0.34))
        .force("x", d3.forceX((d) => d.x).strength(0.03))
        .force("y", d3.forceY((d) => d.y).strength(0.04))
        .force("columns", forceColumns)
        .alphaDecay(0.03)
        .velocityDecay(0.5)
        .on("tick", tick)
        .on("end", () => {
          if (!fittedOnce && autoFitAllowed) {
            fittedOnce = true;
            fitView(true);
          }
        });
      setTimeout(() => {
        if (!fittedOnce && autoFitAllowed) {
          fittedOnce = true;
          fitView(true);
        }
      }, 900);
    }

    function update(nextNodes) {
      const prev = new Map(nodes.map((n) => [n.id, n]));
      for (const n of nextNodes) {
        const old = prev.get(n.id);
        if (old) {
          n.x = old.x;
          n.y = old.y;
          n.vx = old.vx || 0;
          n.vy = old.vy || 0;
          n.fx = old.fx;
          n.fy = old.fy;
          n.pinned = old.pinned;
        }
      }
      applyPins(nextNodes);
      const newcomers = nextNodes.filter((n) => n.x == null || !Number.isFinite(n.x));
      nodes.splice(0, nodes.length, ...nextNodes);
      if (newcomers.length) placeIfMissing(newcomers);
      drawClusters();
      if (simulation) {
        simulation.nodes(nodes);
        if (!dragging) simulation.alpha(0.05).restart();
      } else {
        startSim();
      }
    }

    drawClusters();
    startSim();

    function resize() {
      const prevW = width;
      const prevH = height;
      size();
      if (!simulation) return;
      simulation.force("center", d3.forceCenter(width / 2, height * 0.34));
      if (Math.abs(prevW - width) > 80 || Math.abs(prevH - height) > 80) {
        if (!dragging) simulation.alpha(0.12).restart();
      }
      if (fittedOnce) fitView(false);
    }

    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);

    return {
      nodes,
      highlight,
      resize,
      fitView,
      pinToggle,
      resetPins,
      update,
      columnBoxes() {
        return nodes.map((n) => ({ id: n.id, ...columnBox(n) }));
      },
      destroy() {
        ro.disconnect();
        cancelPaint();
        if (simulation) simulation.stop();
      },
    };
  }

  function renderAll() {
    state.loaded = true;
    renderRefresh();
    renderInbox();
    renderList();
    renderBoard();
    if (state.graph) state.graph.update(buildGraphData());
    else state.graph = initGraph();
    if (state.selected) openNode(state.selected);
  }

  function applyFiltersFromUi() {
    state.filterBot = els.botFilter ? els.botFilter.value : "";
    state.mineOnly = els.mineOnly ? els.mineOnly.getAttribute("aria-pressed") === "true" : false;
    saveFilters();
    renderAll();
  }

  // app.js owns the refresh line from here on; i18n.js only sets its first-paint placeholder.
  els.refreshMeta.removeAttribute("data-i18n");

  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (window.BotMapI18n.setLang(btn.dataset.lang) && state.loaded) renderAll();
    });
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
  els.reset.addEventListener("click", () => {
    if (state.graph) state.graph.resetPins();
  });
  els.panelClose.addEventListener("click", closePanel);
  if (els.botFilter) {
    els.botFilter.value = state.filterBot;
    els.botFilter.addEventListener("input", applyFiltersFromUi);
  }
  if (els.mineOnly) {
    els.mineOnly.setAttribute("aria-pressed", state.mineOnly ? "true" : "false");
    els.mineOnly.addEventListener("click", () => {
      const next = els.mineOnly.getAttribute("aria-pressed") !== "true";
      els.mineOnly.setAttribute("aria-pressed", next ? "true" : "false");
      applyFiltersFromUi();
    });
  }

  document.addEventListener("click", (event) => {
    const ext = event.target.closest("[data-ext-href]");
    if (ext) {
      event.preventDefault();
      event.stopPropagation();
      const href = ext.getAttribute("data-ext-href");
      if (href) window.open(href, "_blank", "noopener");
      return;
    }
    const open = event.target.closest("[data-open]");
    if (open && !open.closest("svg")) {
      event.preventDefault();
      openNode(open.getAttribute("data-open"));
      return;
    }
    const pin = event.target.closest("[data-pin]");
    if (pin && state.graph) {
      event.preventDefault();
      state.graph.pinToggle(pin.getAttribute("data-pin"));
      const id = state.selected;
      if (id) openNode(id);
      return;
    }
    const fold = event.target.closest("[data-fold]");
    if (fold) {
      const body = document.querySelector(`[data-fold-body="${fold.getAttribute("data-fold")}"]`);
      if (body) {
        const hidden = body.hidden;
        body.hidden = !hidden;
        const n = body.querySelectorAll(".board-card").length;
        fold.textContent = t(hidden ? "fold.hide" : "fold.show", { n });
      }
    }
  });

  async function boot() {
    await loadBots();
    renderAll();
    setView("graph");
  }

  boot().catch((err) => {
    state.loadFailed = true;
    els.refreshMeta.textContent = t("error.load");
    console.error(err);
  });

  setInterval(() => {
    loadBots()
      .then(() => {
        renderAll();
        if (state.view !== "graph") setView(state.view);
      })
      .catch((err) => console.error(err));
  }, POLL_MS);
})();
