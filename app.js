const dingEl = document.getElementById("ding");

Notification.requestPermission();

// async function playDing() {
//   try {
//     if (!dingEl) {
//       console.warn("Ding-Sound-Element nicht gefunden!");
//       return;
//     }
//     // Audio neu laden und abspielen
//     dingEl.currentTime = 0;
//     await dingEl.play();
//   } catch (err) {
//     console.warn("Konnte Ding-Sound nicht abspielen:", err);
//   }
// }

// ===== State =====
let mode = "focus"; // "focus" | "break"
let running = false;
let endAt = null; // ms since epoch
let tickId = null;

// --- Notifications ---
function notify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") new Notification(title, { body });
}

// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const el = {
  display: $("#display"),
  btnStartPause: $("#btnStartPause"),
  btnReset: $("#btnReset"),
  btnFocus: $("#btnFocus"),
  btnBreak: $("#btnBreak"),
  inFocus: $("#inFocus"),
  inBreak: $("#inBreak"),
  todayCount: $("#todayCount"),
  bgColor: $("#bgColor"),
  bgImage: $("#bgImage"),
  bgReset: $("#bgReset"),
};

//today stats
const STATS_KEY = "pomoweb:stats";
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function getStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
  } catch {
    return {};
  }
}
function setStats(s) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}
function updateTodayDisplay() {
  const stats = getStats();
  const today = todayKey();
  const count = stats[today] || 0;
  if (el.todayCount) {
    el.todayCount.textContent = `Heutige Fokus Sessions: ${count}`;
  }
}

// ===== Background (user custom) =====
function setBackgroundColor(color) {
  try {
    document.body.style.backgroundColor = color || "";
  } catch (e) {
    console.warn("Konnte Hintergrundfarbe nicht setzen", e);
  }
  try {
    localStorage.setItem("pomoweb:bg", color || "");
  } catch (e) {}
}

function setBackgroundImage(dataUrl) {
  try {
    if (dataUrl) {
      document.body.style.backgroundImage = `url(${dataUrl})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundAttachment = "fixed";
    } else {
      document.body.style.backgroundImage = "";
    }
  } catch (e) {
    console.warn("Konnte Hintergrundbild nicht setzen", e);
  }
  try {
    localStorage.setItem("pomoweb:bgImage", dataUrl || "");
  } catch (e) {}
}

function removeBackgroundImage() {
  setBackgroundImage("");
}

function applySavedBackground() {
  try {
    const saved = localStorage.getItem("pomoweb:bg");
    if (saved) {
      setBackgroundColor(saved);
      if (el.bgColor) el.bgColor.value = saved;
    }
  } catch (e) {
    /* ignore */
  }
  try {
    const img = localStorage.getItem("pomoweb:bgImage");
    if (img) {
      setBackgroundImage(img);
    }
  } catch (e) {
    /* ignore */
  }
}

function incToday() {
  const s = getStats();
  const k = todayKey();
  s[k] = (s[k] || 0) + 1;
  setStats(s);
  updateTodayDisplay(); // Anzeige aktualisieren
}

const durMs = () =>
  (mode === "focus" ? +el.inFocus.value : +el.inBreak.value) * 60 * 1000;
const mmss = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(t / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return `${m}:${s}`;
};

// ===== Core =====
function setMode(newMode) {
  mode = newMode;
  el.btnFocus.classList.toggle("active", mode === "focus");
  el.btnBreak.classList.toggle("active", mode === "break");
  if (!running) {
    el.display.textContent = mmss(durMs());
  }
}

function start() {
  if (running) return;
  running = true;
  const currentRemaining = readRemainingFromDisplay();
  endAt = Date.now() + currentRemaining;
  el.btnStartPause.textContent = "Pause";
  tick(); // sofort updaten
  tickId = setInterval(tick, 250);
}

function pause() {
  if (!running) return;
  running = false;
  clearInterval(tickId);
  tickId = null;
  if (endAt) {
    const r = Math.max(0, endAt - Date.now());
    el.display.textContent = mmss(r);
  }
  endAt = null;
  el.btnStartPause.textContent = "Start";
}

function reset() {
  running = false;
  clearInterval(tickId);
  tickId = null;
  endAt = null;
  el.display.textContent = mmss(durMs());
  el.btnStartPause.textContent = "Start";
}

function tick() {
  if (endAt == null) return;
  const r = Math.max(0, endAt - Date.now());
  el.display.textContent = mmss(r);
  if (r <= 0) {
    clearInterval(tickId);
    tickId = null;
    running = false;
    endAt = null;
    // Session Ende → Modus wechseln
    if (mode === "focus") {
      incToday(); // Zähler nur bei Focus-Session erhöhen
    }
    setMode(mode === "focus" ? "break" : "focus");
    el.btnStartPause.textContent = "Start";
    notify(mode === "focus" ? "break done!" : "okaaaay let's goo!");
    playDing();

    const txt = mmss(durMs());
    el.display.textContent = txt;
    document.title = `⏱ ${txt} • Pomodoro`;
  }
}

function readRemainingFromDisplay() {
  const [m, s] = el.display.textContent.split(":").map((n) => parseInt(n, 10));
  return (m * 60 + s) * 1000;
}

// ===== Events =====
el.btnStartPause.addEventListener("click", () => (running ? pause() : start()));
el.btnReset.addEventListener("click", reset);
el.btnFocus.addEventListener("click", () => {
  setMode("focus");
  reset();
});
el.btnBreak.addEventListener("click", () => {
  setMode("break");
  reset();
});
el.inFocus.addEventListener("change", () => {
  if (!running) el.display.textContent = mmss(durMs());
});
el.inBreak.addEventListener("change", () => {
  if (!running) el.display.textContent = mmss(durMs());
});
document.addEventListener("visibilitychange", () => {
  if (running) tick();
});
// Shortcuts
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    running ? pause() : start();
  }
  if (e.key.toLowerCase() === "r") {
    reset();
  }
});

// ===== Hamburger-Menü =====
const $$ = (sel) => document.querySelector(sel); // falls $ schon existiert, nimm das
const menuBtn = $$("#menuToggle");
const menu = $$("#menuPanel");

function openMenu() {
  menu.classList.add("open");
  menuBtn.classList.add("open");
  menuBtn.setAttribute("aria-expanded", "true");
}
function closeMenu() {
  menu.classList.remove("open");
  menuBtn.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
}
function toggleMenu() {
  menu.classList.contains("open") ? closeMenu() : openMenu();
}

menuBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // Klick nicht hochbubblen lassen
  toggleMenu();
});

// Klick außerhalb schließt Menü
document.addEventListener("click", (e) => {
  if (!menu.contains(e.target) && e.target !== menuBtn) closeMenu();
});

// ESC schließt Menü
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

// ===== Init =====
setMode("focus");
reset();
updateTodayDisplay(); // Initialen Counter-Stand anzeigen

// Sound-Test und Vorbereitung
if (dingEl) {
  dingEl.volume = 1.0; // Volle Lautstärke
  // Optional: Ersten Klick abwarten für Sound (Browser-Politik)
  document.addEventListener(
    "click",
    function initSound() {
      dingEl.load(); // Audio laden
      document.removeEventListener("click", initSound);
    },
    { once: true }
  );
}

// Apply saved background and hook up color picker
applySavedBackground();
if (el.bgColor) {
  el.bgColor.addEventListener("input", (e) => {
    setBackgroundColor(e.target.value);
  });
}

// Background image upload handling
if (el.bgImage) {
  el.bgImage.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const dataUrl = ev.target.result;
      setBackgroundImage(dataUrl);
    };
    reader.readAsDataURL(f);
  });
}

fetch("aboutText.txt")
  .then((res) => res.text())
  .then((text) => {
    document.getElementById("aboutText").textContent = text;
  });

  function openAbout() {
    closeMenu();

    const aboutSection = document.getElementById("about");
    if (!aboutSection) return;

    aboutSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}




document.querySelectorAll("button[data-action]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    if (action === "settings") openSettings();
    if (action === "stats") openStats();
    if (action === "theme") openTheme();
    if (action === "about") openAbout();
  });
});

if (el.bgReset) {
  el.bgReset.addEventListener("click", () => {
    try {
      localStorage.removeItem("pomoweb:bgImage");
    } catch (e) {}
    if (el.bgImage) el.bgImage.value = null;
    removeBackgroundImage();
  });
}

// Scroll up button
const scrollUpBtn = document.querySelector(".button");
if (scrollUpBtn) {
  scrollUpBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}
