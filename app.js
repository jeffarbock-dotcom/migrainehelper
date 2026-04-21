const STORAGE_KEYS = {
  logs: "migraine-helper-logs",
  daily: "migraine-helper-daily",
  lastResetDate: "migraine-helper-last-reset-date",
  view: "migraine-helper-active-view"
};

const DAILY_GROUPS = [
  {
    title: "Morning",
    items: [
      "Morning water",
      "ADHD meds",
      "Vitamin B2",
      "Coenzyme Q10",
      "Morning walk"
    ]
  },
  {
    title: "Then",
    items: [
      "Breakfast",
      "Caffeine around 10 AM",
      "Lunch",
      "Dinner",
      "Topiramate at night",
      "Magnesium at night"
    ]
  }
];

const ATTACK_TIMER_SECONDS = 20 * 60;

let logs = loadLogs();
let dailyState = loadDailyState();
let timerInterval = null;
let timerRemaining = ATTACK_TIMER_SECONDS;
let deferredPrompt = null;

const elements = {
  views: [...document.querySelectorAll(".view")],
  navButtons: [...document.querySelectorAll(".nav-button")],
  toast: document.getElementById("toast"),
  todaySummary: document.getElementById("todaySummary"),
  dailyProgressRing: document.getElementById("dailyProgressRing"),
  dailyProgressText: document.getElementById("dailyProgressText"),
  dailyProgressDetail: document.getElementById("dailyProgressDetail"),
  weeklyMigraineCount: document.getElementById("weeklyMigraineCount"),
  insightsList: document.getElementById("insightsList"),
  severityInput: document.getElementById("logSeverity"),
  severityValue: document.getElementById("severityValue"),
  logForm: document.getElementById("logForm"),
  logDate: document.getElementById("logDate"),
  recentLogs: document.getElementById("recentLogs"),
  exportJsonButton: document.getElementById("exportJsonButton"),
  exportCsvButton: document.getElementById("exportCsvButton"),
  importJsonInput: document.getElementById("importJsonInput"),
  clearLogsButton: document.getElementById("clearLogsButton"),
  dailyChecklist: document.getElementById("dailyChecklist"),
  timerPanel: document.getElementById("timerPanel"),
  timerDisplay: document.getElementById("timerDisplay"),
  startTimerButton: document.getElementById("startTimerButton"),
  resetTimerButton: document.getElementById("resetTimerButton"),
  installButton: document.getElementById("installButton")
};

boot();

function boot() {
  resetDailyStateIfNeeded();
  setDefaultDate();
  renderDailyChecklist();
  renderLogs();
  renderDashboard();
  bindEvents();
  restoreView();
  updateTimerDisplay();
  registerServiceWorker();
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.target));
  });

  elements.severityInput.addEventListener("input", () => {
    elements.severityValue.textContent = elements.severityInput.value;
  });

  elements.logForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveLog();
  });

  elements.exportJsonButton.addEventListener("click", exportLogsJson);
  elements.exportCsvButton.addEventListener("click", exportLogsCsv);
  elements.importJsonInput.addEventListener("change", importLogsJson);
  elements.clearLogsButton.addEventListener("click", clearLogs);

  elements.startTimerButton.addEventListener("click", startTimer);
  elements.resetTimerButton.addEventListener("click", resetTimer);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener("click", async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    elements.installButton.hidden = true;
  });
}

function switchView(viewName) {
  elements.views.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === viewName);
  });

  elements.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.target === viewName);
  });

  localStorage.setItem(STORAGE_KEYS.view, viewName);
}

function restoreView() {
  const savedView = localStorage.getItem(STORAGE_KEYS.view) || "home";
  switchView(savedView);
}

function setDefaultDate() {
  elements.logDate.value = todayKey();
}

function saveLog() {
  const migraineValue = document.querySelector('input[name="migraine"]:checked')?.value;
  const severity = Number(elements.severityInput.value);

  const entry = {
    id: createId(),
    date: elements.logDate.value,
    migraine: migraineValue === "yes",
    severity: migraineValue === "yes" ? severity : 0,
    trigger: document.getElementById("logTrigger").value.trim(),
    notes: document.getElementById("logNotes").value.trim(),
    createdAt: new Date().toISOString()
  };

  logs.unshift(entry);
  logs.sort((a, b) => new Date(b.date) - new Date(a.date));
  persistLogs();
  renderLogs();
  renderDashboard();
  elements.logForm.reset();
  elements.severityInput.value = "5";
  elements.severityValue.textContent = "5";
  setDefaultDate();
  showToast("Your log was saved gently, little one.");
}

function renderLogs() {
  if (!logs.length) {
    elements.recentLogs.innerHTML = `
      <div class="log-item">
        <p class="muted">No logs yet. Your first note can be tiny and simple.</p>
      </div>
    `;
    return;
  }

  elements.recentLogs.innerHTML = logs.slice(0, 8).map((log) => `
    <article class="log-item">
      <h4>${formatDate(log.date)}</h4>
      <div class="log-meta">
        <span class="tag">${log.migraine ? "Migraine day" : "No migraine"}</span>
        <span class="tag">Severity ${log.severity || 0}/10</span>
        ${log.trigger ? `<span class="tag">${escapeHtml(log.trigger)}</span>` : ""}
      </div>
      <p class="muted">${log.notes ? escapeHtml(log.notes) : "No extra notes for this day."}</p>
    </article>
  `).join("");
}

function renderDashboard() {
  const todayStatus = buildTodaySummary();
  const analysis = analyzeLogs(logs);
  const totalTasks = DAILY_GROUPS.flatMap((group) => group.items).length;
  const completedTasks = Object.values(dailyState).filter(Boolean).length;
  const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  elements.todaySummary.textContent = todayStatus;
  elements.dailyProgressRing.style.setProperty("--progress", String(progress));
  elements.dailyProgressText.textContent = `${progress}%`;
  elements.dailyProgressDetail.textContent = `${completedTasks} of ${totalTasks} gentle steps checked today`;
  elements.weeklyMigraineCount.textContent = String(analysis.weeklyCount);
  elements.insightsList.innerHTML = analysis.friendlyInsights.map((item) => `
    <div class="insight-pill">${item}</div>
  `).join("");
}

function renderDailyChecklist() {
  elements.dailyChecklist.innerHTML = DAILY_GROUPS.map((group) => `
    <section>
      <h3 class="daily-group-title">${group.title}</h3>
      <div class="daily-group">
        ${group.items.map((item) => {
          const checked = Boolean(dailyState[item]);
          return `
            <div class="daily-item ${checked ? "done" : ""}">
              <label>
                <input type="checkbox" data-daily-item="${escapeAttribute(item)}" ${checked ? "checked" : ""}>
                <span>${item}</span>
              </label>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");

  [...elements.dailyChecklist.querySelectorAll('input[type="checkbox"]')].forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const key = event.target.dataset.dailyItem;
      dailyState[key] = event.target.checked;
      persistDailyState();
      renderDailyChecklist();
      renderDashboard();
    });
  });
}

function buildTodaySummary() {
  const completedTasks = Object.values(dailyState).filter(Boolean).length;
  const today = todayKey();
  const todaysLog = logs.find((log) => log.date === today);

  if (todaysLog?.migraine) {
    return `You logged a migraine today. Be extra soft with yourself, little one. ${completedTasks} daily steps are already done.`;
  }

  if (todaysLog && !todaysLog.migraine) {
    return `You checked in today and noted no migraine. ${completedTasks} daily steps are keeping your rhythm lovely.`;
  }

  if (completedTasks > 0) {
    return `You have already cared for ${completedTasks} daily steps today. That is tender progress, little one.`;
  }

  return "A calm little reset can start with one sip of water and one tiny checkmark.";
}

function analyzeLogs(entries) {
  const migraineLogs = entries.filter((entry) => entry.migraine);
  const weekAgo = startOfDay(new Date());
  weekAgo.setDate(weekAgo.getDate() - 6);

  const weeklyCount = migraineLogs.filter((entry) => {
    const entryDate = new Date(`${entry.date}T00:00:00`);
    return entryDate >= weekAgo;
  }).length;

  const averageSeverity = migraineLogs.length
    ? (migraineLogs.reduce((sum, entry) => sum + Number(entry.severity || 0), 0) / migraineLogs.length).toFixed(1)
    : "0.0";

  const triggerCounts = new Map();
  let skippedMealCount = 0;
  let skippedMealSeverityTotal = 0;
  let caffeineCount = 0;

  migraineLogs.forEach((entry) => {
    const combinedText = `${entry.trigger} ${entry.notes}`.toLowerCase();
    const parts = entry.trigger
      .split(/[;,/]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    parts.forEach((part) => {
      triggerCounts.set(part, (triggerCounts.get(part) || 0) + 1);
    });

    if (containsMealPattern(combinedText)) {
      skippedMealCount += 1;
      skippedMealSeverityTotal += Number(entry.severity || 0);
    }

    if (containsCaffeinePattern(combinedText)) {
      caffeineCount += 1;
    }
  });

  const sortedTriggers = [...triggerCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topTrigger = sortedTriggers[0];
  const friendlyInsights = [];

  if (!entries.length) {
    friendlyInsights.push("Start with one tiny log and I will look for patterns here, little one 💜");
  } else {
    friendlyInsights.push(`Your average migraine severity is ${averageSeverity}/10 across ${migraineLogs.length} migraine logs.`);
  }

  if (topTrigger) {
    friendlyInsights.push(`The most common trigger you noted was "${topTrigger[0]}" (${topTrigger[1]} times), little one 🌸`);
  }

  if (skippedMealCount > 0) {
    const skippedMealAvg = (skippedMealSeverityTotal / skippedMealCount).toFixed(1);
    friendlyInsights.push(`You've had ${skippedMealCount} migraines after skipping meals, little one 💜 Average severity there was ${skippedMealAvg}/10.`);
  }

  if (caffeineCount > 0) {
    friendlyInsights.push(`I noticed ${caffeineCount} migraine logs mentioning caffeine. It may help to watch the timing gently.`);
  }

  if (migraineLogs.length >= 3 && !topTrigger && skippedMealCount === 0 && caffeineCount === 0) {
    friendlyInsights.push("You have enough logs that patterns may start showing soon. Food, sleep, stress, and light notes can help little clues appear.");
  }

  while (friendlyInsights.length < 3) {
    friendlyInsights.push("Small patterns become clearer with a few gentle notes. You do not need perfect tracking to learn something helpful.");
  }

  return {
    weeklyCount,
    averageSeverity,
    topTrigger: topTrigger?.[0] || "",
    friendlyInsights
  };
}

function containsMealPattern(text) {
  return [
    "skip meal",
    "skipped meal",
    "missed meal",
    "missed breakfast",
    "missed lunch",
    "empty stomach",
    "didn't eat",
    "didnt eat"
  ].some((pattern) => text.includes(pattern));
}

function containsCaffeinePattern(text) {
  return ["caffeine", "coffee", "latte", "energy drink", "tea"].some((pattern) => text.includes(pattern));
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.logs);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function persistLogs() {
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
}

function loadDailyState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.daily);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function persistDailyState() {
  localStorage.setItem(STORAGE_KEYS.daily, JSON.stringify(dailyState));
  localStorage.setItem(STORAGE_KEYS.lastResetDate, todayKey());
}

function resetDailyStateIfNeeded() {
  const today = todayKey();
  const lastResetDate = localStorage.getItem(STORAGE_KEYS.lastResetDate);

  if (lastResetDate !== today) {
    dailyState = {};
    localStorage.setItem(STORAGE_KEYS.daily, JSON.stringify(dailyState));
    localStorage.setItem(STORAGE_KEYS.lastResetDate, today);
  }
}

function exportLogsJson() {
  const payload = JSON.stringify(logs, null, 2);
  downloadFile("migraine-helper-logs.json", payload, "application/json");
  showToast("JSON export is ready, little one.");
}

function exportLogsCsv() {
  const headers = ["date", "migraine", "severity", "trigger", "notes", "createdAt"];
  const rows = logs.map((entry) => headers.map((key) => csvEscape(entry[key])));
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  downloadFile("migraine-helper-logs.csv", csv, "text/csv;charset=utf-8");
  showToast("CSV export is ready, little one.");
}

function importLogsJson(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported)) {
        throw new Error("Invalid file format");
      }

      logs = imported
        .filter((item) => item && typeof item === "object" && item.date)
        .map((item) => ({
          id: item.id || createId(),
          date: item.date,
          migraine: Boolean(item.migraine),
          severity: Number(item.severity || 0),
          trigger: String(item.trigger || ""),
          notes: String(item.notes || ""),
          createdAt: item.createdAt || new Date().toISOString()
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      persistLogs();
      renderLogs();
      renderDashboard();
      showToast("Your logs were restored gently.");
    } catch (error) {
      showToast("That file could not be imported.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

function clearLogs() {
  const confirmed = window.confirm("Clear all migraine logs from this device, little one?");
  if (!confirmed) {
    return;
  }

  logs = [];
  persistLogs();
  renderLogs();
  renderDashboard();
  showToast("All logs were cleared from this device.");
}

function startTimer() {
  if (timerInterval) {
    return;
  }

  elements.timerPanel.classList.add("running");
  timerInterval = window.setInterval(() => {
    timerRemaining -= 1;
    updateTimerDisplay();

    if (timerRemaining <= 0) {
      window.clearInterval(timerInterval);
      timerInterval = null;
      timerRemaining = 0;
      elements.timerPanel.classList.remove("running");
      updateTimerDisplay();
      showToast("20 minutes are up. Check in gently with yourself.");
    }
  }, 1000);
}

function resetTimer() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }

  timerRemaining = ATTACK_TIMER_SECONDS;
  elements.timerPanel.classList.remove("running");
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const minutes = String(Math.floor(timerRemaining / 60)).padStart(2, "0");
  const seconds = String(timerRemaining % 60).padStart(2, "0");
  elements.timerDisplay.textContent = `${minutes}:${seconds}`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2400);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {
        showToast("Offline mode could not be prepared.");
      });
    });
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function csvEscape(value) {
  const safe = String(value ?? "");
  return `"${safe.replace(/"/g, '""')}"`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(text) {
  return escapeHtml(text);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `mh-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
