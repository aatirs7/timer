/* Deep Work Timer
   - Countdown + Stopwatch
   - Theme cycling through assets/1.jpg..assets/4.jpg
   - Keyboard shortcuts: Space, R, T, F
*/

const THEMES = ["./assets/1.jpg", "./assets/2.jpg", "./assets/3.jpg", "./assets/4.jpg"];

const bg = document.getElementById("bg");
const timeDisplay = document.getElementById("timeDisplay");
const statusText = document.getElementById("statusText");

const btnCountdown = document.getElementById("btnCountdown");
const btnStopwatch = document.getElementById("btnStopwatch");
const countdownPanel = document.getElementById("countdownPanel");
const stopwatchHint = document.getElementById("stopwatchHint");

const btnStartPause = document.getElementById("btnStartPause");
const btnReset = document.getElementById("btnReset");
const btnTheme = document.getElementById("btnTheme");
const btnFullscreen = document.getElementById("btnFullscreen");

const minutesInput = document.getElementById("minutesInput");
const applyMinutes = document.getElementById("applyMinutes");
const ding = document.getElementById("ding");

const presetButtons = Array.from(document.querySelectorAll(".chip[data-min]"));

/** State */
let mode = load("mode", "countdown"); // "countdown" | "stopwatch"
let isRunning = false;
let tickHandle = null;

// countdown: remainingMs
// stopwatch: elapsedMs
let remainingMs = clampInt(load("remainingMs", 25 * 60 * 1000), 1000, 999 * 60 * 1000);
let elapsedMs = 0;

let lastTickTs = null;

let themeIndex = clampInt(load("themeIndex", 0), 0, THEMES.length - 1);

init();

/** ---------- Init ---------- */
function init() {
  setTheme(themeIndex);
  setMode(mode, { persist: false });

  // Initialize countdown minutes input to match remainingMs (rounded minutes)
  minutesInput.value = String(Math.max(1, Math.round(remainingMs / 60000)));

  render();

  // Mode buttons
  btnCountdown.addEventListener("click", () => setMode("countdown"));
  btnStopwatch.addEventListener("click", () => setMode("stopwatch"));

  // Start/Pause
  btnStartPause.addEventListener("click", toggleStartPause);

  // Reset
  btnReset.addEventListener("click", resetTimer);

  // Theme
  btnTheme.addEventListener("click", nextTheme);

  // Fullscreen
  btnFullscreen.addEventListener("click", toggleFullscreen);

  // Presets
  presetButtons.forEach((b) => {
    b.addEventListener("click", () => {
      const mins = clampInt(b.dataset.min, 1, 999);
      setCountdownMinutes(mins);
    });
  });

  // Custom minutes set
  applyMinutes.addEventListener("click", () => {
    const mins = clampInt(minutesInput.value, 1, 999);
    setCountdownMinutes(mins);
  });

  minutesInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const mins = clampInt(minutesInput.value, 1, 999);
      setCountdownMinutes(mins);
    }
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    // Don’t hijack typing in the minutes input
    const isTyping =
      document.activeElement === minutesInput ||
      (document.activeElement && document.activeElement.tagName === "INPUT");

    if (e.code === "Space" && !isTyping) {
      e.preventDefault();
      toggleStartPause();
    } else if ((e.key === "r" || e.key === "R") && !isTyping) {
      resetTimer();
    } else if ((e.key === "t" || e.key === "T") && !isTyping) {
      nextTheme();
    } else if ((e.key === "f" || e.key === "F") && !isTyping) {
      toggleFullscreen();
    }
  });

  // Save on unload
  window.addEventListener("beforeunload", () => {
    save("mode", mode);
    save("themeIndex", themeIndex);
    save("remainingMs", remainingMs);
  });
}

/** ---------- Mode ---------- */
function setMode(newMode, opts = { persist: true }) {
  mode = newMode;

  btnCountdown.classList.toggle("active", mode === "countdown");
  btnStopwatch.classList.toggle("active", mode === "stopwatch");

  countdownPanel.hidden = mode !== "countdown";
  stopwatchHint.hidden = mode !== "stopwatch";

  // Stop timer when switching modes for clarity
  stopTick();

  isRunning = false;
  btnStartPause.textContent = "Start";
  statusText.textContent = "Ready.";

  if (mode === "countdown") {
    // Ensure display uses remainingMs
    elapsedMs = 0;
    // Keep remainingMs as-is; user can change minutes
  } else {
    // Stopwatch
    elapsedMs = 0;
  }

  render();

  if (opts.persist) save("mode", mode);
}

/** ---------- Theme ---------- */
function setTheme(idx) {
  themeIndex = idx;
  bg.style.backgroundImage = `url("${THEMES[themeIndex]}")`;
  save("themeIndex", themeIndex);
}

function nextTheme() {
  setTheme((themeIndex + 1) % THEMES.length);
}

/** ---------- Countdown setup ---------- */
function setCountdownMinutes(mins) {
  if (mode !== "countdown") setMode("countdown");
  stopTick();
  isRunning = false;
  btnStartPause.textContent = "Start";

  remainingMs = mins * 60 * 1000;
  minutesInput.value = String(mins);

  statusText.textContent = `Set to ${mins} minute${mins === 1 ? "" : "s"}.`;
  save("remainingMs", remainingMs);
  render();
}

/** ---------- Timer controls ---------- */
function toggleStartPause() {
  if (!isRunning) {
    // Start
    if (mode === "countdown" && remainingMs <= 0) {
      // If it already finished, reset to whatever input says
      const mins = clampInt(minutesInput.value, 1, 999);
      remainingMs = mins * 60 * 1000;
    }

    isRunning = true;
    btnStartPause.textContent = "Pause";
    statusText.textContent = "Running…";
    startTick();
  } else {
    // Pause
    isRunning = false;
    btnStartPause.textContent = "Resume";
    statusText.textContent = "Paused.";
    stopTick();
  }
  render();
}

function resetTimer() {
  stopTick();
  isRunning = false;
  btnStartPause.textContent = "Start";

  if (mode === "countdown") {
    const mins = clampInt(minutesInput.value, 1, 999);
    remainingMs = mins * 60 * 1000;
    save("remainingMs", remainingMs);
    statusText.textContent = "Reset.";
  } else {
    elapsedMs = 0;
    statusText.textContent = "Reset.";
  }

  render();
}

function startTick() {
  stopTick();
  lastTickTs = performance.now();
  tickHandle = setInterval(onTick, 100); // smooth enough, cheap
}

function stopTick() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
  lastTickTs = null;
}

function onTick() {
  if (!isRunning) return;

  const now = performance.now();
  const dt = now - (lastTickTs ?? now);
  lastTickTs = now;

  if (mode === "countdown") {
    remainingMs = Math.max(0, remainingMs - dt);

    if (remainingMs === 0) {
      // finished
      isRunning = false;
      btnStartPause.textContent = "Start";
      stopTick();
      statusText.textContent = "Done.";
      try { ding.currentTime = 0; ding.play(); } catch (_) {}
    }

    save("remainingMs", Math.round(remainingMs));
  } else {
    elapsedMs += dt;
  }

  render();
}

/** ---------- Render ---------- */
function render() {
  if (mode === "countdown") {
    timeDisplay.textContent = formatMMSS(remainingMs);
    document.title = `${timeDisplay.textContent} · Deep Work Timer`;
  } else {
    timeDisplay.textContent = formatHHMMSS(elapsedMs);
    document.title = `${timeDisplay.textContent} · Deep Work Timer`;
  }
}

/** ---------- Fullscreen ---------- */
async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_) {
    // ignore
  }
}

/** ---------- Utils ---------- */
function formatMMSS(ms) {
  const totalSec = Math.ceil(ms / 1000); // countdown feels better rounded up
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function formatHHMMSS(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function save(key, value) {
  try { localStorage.setItem(`dwt:${key}`, String(value)); } catch (_) {}
}

function load(key, fallback) {
  try {
    const v = localStorage.getItem(`dwt:${key}`);
    if (v === null || v === undefined) return fallback;
    // number-ish?
    if (typeof fallback === "number") return Number(v);
    return v;
  } catch (_) {
    return fallback;
  }
}

function clampInt(v, min, max) {
  const n = Math.max(min, Math.min(max, parseInt(String(v), 10) || min));
  return n;
}
