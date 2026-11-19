(() => {
  const LANG_KEY = "bot-map:lang:v1";
  const SUPPORTED = ["en", "ko"];
  const LOCALES = { en: "en-US", ko: "ko-KR" };

  const STRINGS = {
    en: {
      "brand": "Bot Map",
      "refreshMeta": "Last updated {time} · refreshes every minute",
      "refreshMeta.placeholder": "Last updated — · refreshes every minute",
      "filter.botLabel": "Filter by bot name",
      "filter.botPlaceholder": "Bot name",
      "filter.mineOnly": "My tasks",
      "filter.mineOnlyTitle": "Show only items awaiting approval or review",
      "tabs.label": "View",
      "tabs.graph": "Graph",
      "tabs.list": "List",
      "tabs.board": "Board",
      "lang.label": "Language",
      "lang.en": "EN",
      "lang.ko": "한국어",
      "reset": "Reset layout",
      "reset.title": "Clear pinned positions and lay out again",
      "inbox.title": "Needs you now",
      "inbox.empty": "Nothing to approve or review right now.",
      "graph.label": "Graph of bots and their tasks",
      "legend.label": "Status colors",
      "hint": "Drag a bot to move it, and pin it to keep it in place. Click a row to open its history. On phones, pinch to zoom and pan.",
      "panel.close": "Close",

      "status.approval": "Awaiting approval",
      "status.check": "Needs review",
      "status.in_progress": "In progress",
      "status.done": "Done",
      "status.cancelled": "Cancelled",

      "time.today": "Today {clock}",
      "time.yesterday": "Yesterday {clock}",

      "dur.day.one": "{n} day",
      "dur.day.other": "{n} days",
      "dur.hour.one": "{n} hour",
      "dur.hour.other": "{n} hours",
      "dur.min.other": "{n} min",
      "remain.left": "{time} left",
      "remain.overdue": "{time} overdue",
      "remain.justOverdue": "just overdue",
      "remain.oneMinLeft": "1 min left",

      "stage.active": "Active",
      "stage.queued": "Queued",
      "link": "Link",
      "shortcut": "Shortcut",
      "tag.overdue": "Overdue",
      "requested": "Requested {time}",
      "due": "Due",
      "noDue": "No due date",
      "timeline.title": "History",
      "timeline.empty": "No history yet.",
      "pin.on": "Pin here",
      "pin.off": "Unpin",

      "bot.defaultRole": "Bot",
      "lastUpdated": "Last updated {time}",
      "stale.long": " · idle over an hour",
      "stale.short": " · idle",
      "none": "none",
      "botCounts": "In progress {active} · queued {queued} · done today {done}",
      "boardCounts": "In progress {active} · queued {queued}",
      "section.active": "In progress",
      "section.queued": "Queued",
      "section.doneToday": "Done today",
      "doneTodayCount": "Done today {n}",
      "empty.active": "Nothing in progress.",
      "empty.group": "None",
      "empty.tasksFilter": "No tasks match the filter.",
      "empty.botsFilter": "No bots match the filter.",
      "empty.open": "No open tasks",
      "fold.show": "Done today {n} · show",
      "fold.hide": "Done today {n} · hide",

      "graph.noUpdate": "No update time",
      "graph.updated": "Updated {time}",
      "graph.updatedStale": "Updated {time} · idle",

      "error.load": "Couldn't load the data.",
    },
    ko: {
      "brand": "봇 맵",
      "refreshMeta": "마지막 갱신 {time} · 1분마다 갱신",
      "refreshMeta.placeholder": "마지막 갱신 — · 1분마다 갱신",
      "filter.botLabel": "봇 이름 필터",
      "filter.botPlaceholder": "봇 이름",
      "filter.mineOnly": "내 할 일만",
      "filter.mineOnlyTitle": "승인대기·확인필요만 보기",
      "tabs.label": "보기",
      "tabs.graph": "그래프",
      "tabs.list": "목록",
      "tabs.board": "보드",
      "lang.label": "언어",
      "lang.en": "EN",
      "lang.ko": "한국어",
      "reset": "배치 초기화",
      "reset.title": "고정한 위치를 지우고 다시 배치합니다",
      "inbox.title": "지금 내가 할 일",
      "inbox.empty": "지금은 승인하거나 확인할 일이 없어.",
      "graph.label": "봇과 업무 그래프",
      "legend.label": "상태 색",
      "hint": "봇을 끌어 옮기고, 핀으로 고정할 수 있어요. 행을 누르면 기록이 열려요. 휴대폰에서는 두 손가락으로 확대·이동해요.",
      "panel.close": "닫기",

      "status.approval": "승인대기",
      "status.check": "확인필요",
      "status.in_progress": "진행중",
      "status.done": "끝남",
      "status.cancelled": "취소",

      "time.today": "오늘 {clock}",
      "time.yesterday": "어제 {clock}",

      "dur.day.other": "{n}일",
      "dur.hour.other": "{n}시간",
      "dur.min.other": "{n}분",
      "remain.left": "{time} 남음",
      "remain.overdue": "{time} 지남",
      "remain.justOverdue": "방금 지남",
      "remain.oneMinLeft": "1분 남음",

      "stage.active": "하는 중",
      "stage.queued": "대기",
      "link": "링크",
      "shortcut": "바로가기",
      "tag.overdue": "지연",
      "requested": "요청 {time}",
      "due": "마감",
      "noDue": "마감 없음",
      "timeline.title": "진행 기록",
      "timeline.empty": "아직 기록이 없어.",
      "pin.on": "이 자리에 핀 고정",
      "pin.off": "핀 해제",

      "bot.defaultRole": "봇",
      "lastUpdated": "마지막 갱신 {time}",
      "stale.long": " · 1시간 넘게 멈춤",
      "stale.short": " · 멈춤",
      "none": "없음",
      "botCounts": "하는 중 {active} · 대기 {queued} · 오늘 끝남 {done}",
      "boardCounts": "하는 중 {active} · 대기 {queued}",
      "section.active": "하는 중",
      "section.queued": "대기",
      "section.doneToday": "오늘 끝남",
      "doneTodayCount": "오늘 끝남 {n}",
      "empty.active": "지금 하는 일은 없어.",
      "empty.group": "해당 없음",
      "empty.tasksFilter": "필터에 맞는 업무가 없어.",
      "empty.botsFilter": "필터에 맞는 봇이 없어.",
      "empty.open": "열린 일 없음",
      "fold.show": "오늘 끝남 {n} · 펼치기",
      "fold.hide": "오늘 끝남 {n} · 접기",

      "graph.noUpdate": "갱신 시각 없음",
      "graph.updated": "갱신 {time}",
      "graph.updatedStale": "갱신 {time} · 멈춤",

      "error.load": "데이터를 불러오지 못했어.",
    },
  };

  function normalize(lang) {
    const primary = String(lang || "").trim().toLowerCase().split(/[-_]/)[0];
    return SUPPORTED.includes(primary) ? primary : null;
  }

  function savedLang() {
    try {
      return normalize(localStorage.getItem(LANG_KEY));
    } catch {
      return null;
    }
  }

  function browserLang() {
    const tags = [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language,
    ];
    for (const tag of tags) {
      const lang = normalize(tag);
      if (lang) return lang;
    }
    return null;
  }

  let configDefault = "en";
  let current = resolve();

  function resolve() {
    return savedLang() || browserLang() || configDefault;
  }

  function t(key, vars) {
    const table = STRINGS[current] || STRINGS.en;
    let s = table[key] ?? STRINGS.en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
    return s;
  }

  function tCount(key, n, vars) {
    const table = STRINGS[current] || STRINGS.en;
    const one = `${key}.one`;
    const k = n === 1 && (one in table) ? one : `${key}.other`;
    return t(k, { n, ...vars });
  }

  function applyChrome(root = document) {
    document.documentElement.lang = current;
    document.title = t("brand");
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.dataset.i18nTitle));
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAria));
    });
    root.querySelectorAll("[data-lang]").forEach((el) => {
      el.setAttribute("aria-pressed", el.dataset.lang === current ? "true" : "false");
    });
  }

  /* Persist an explicit choice and apply it. Returns true when the language changed. */
  function setLang(lang) {
    const next = normalize(lang);
    if (!next) return false;
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* storage may be unavailable; still switch for this session */
    }
    const changed = next !== current;
    current = next;
    applyChrome();
    return changed;
  }

  /* Feed config.json's defaultLanguage. Returns true when the resolved language changed. */
  function setConfigDefault(lang) {
    configDefault = SUPPORTED.includes(lang) ? lang : "en";
    const next = resolve();
    if (next === current) return false;
    current = next;
    applyChrome();
    return true;
  }

  window.BotMapI18n = {
    STRINGS,
    t,
    tCount,
    getLang: () => current,
    getLocale: () => LOCALES[current] || LOCALES.en,
    setLang,
    setConfigDefault,
    applyChrome,
  };

  applyChrome();
})();
