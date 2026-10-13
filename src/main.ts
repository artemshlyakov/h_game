import Phaser from "phaser";
import { CatchScene, type GameSummary } from "./game/CatchScene";
import "./styles.css";

type ScoreEntry = { name: string; score: number; date: number };
const SCORE_KEY = "h-game-local-scores-v1";
const NAME_KEY = "h-game-player-name-v1";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root missing");

app.innerHTML = `
  <div class="page-glow" aria-hidden="true"></div>
  <div class="shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">✦</span><span>BOO<span class="brand-accent">.</span>PLAY</span></div>
      <div class="topbar-meta"><span class="prototype-tag">ХЭЛЛОУИНСКАЯ ИГРА</span><button class="icon-button" id="sound-button" type="button" aria-label="Выключить звук" title="Звук">♫</button></div>
    </header>

    <main>
      <section class="intro">
        <div><p class="eyebrow"><span>✦</span> ХЭЛЛОУИНСКАЯ АРКАДА · 2026</p><h1>Ловец <span>тыкв!</span></h1><p class="lead">Ночь коротка, а тыкв много. Собирай урожай, избегай призраков и побей свой рекорд!</p></div>
        <div class="intro-decoration" aria-hidden="true"><span>✴</span><span>☾</span><span>✦</span></div>
      </section>

      <div class="layout">
        <section class="game-shell" aria-label="Ловец тыкв">
          <div class="hud">
            <div class="hud-stat"><small>ОЧКИ</small><strong id="score">0000</strong></div>
            <div class="hud-stat hud-center"><small>ВРЕМЯ</small><strong><span id="timer">60</span><i> сек</i></strong></div>
            <div class="hud-stat hud-right"><small>ЖИЗНИ</small><strong id="lives" class="hearts" aria-label="3 жизни">♥ ♥ ♥</strong></div>
          </div>
          <div class="game-frame">
            <div id="game" role="img" aria-label="Игровое поле: двигайте ведьму мышью, пальцем или клавишами влево и вправо"></div>
            <div id="overlay" class="overlay">
              <div class="overlay-card">
                <div class="overlay-icon" id="overlay-icon">🎃</div>
                <p class="overlay-kicker" id="overlay-kicker">ГОТОВЫ К ОХОТЕ?</p>
                <h2 id="overlay-title">Поймай удачу!</h2>
                <p class="overlay-copy" id="overlay-copy">За 60 секунд собери как можно больше тыкв и сладостей. У тебя три жизни.</p>
                <label for="player-name">ИМЯ ИГРОКА</label>
                <input id="player-name" type="text" maxlength="24" autocomplete="name" placeholder="Как тебя зовут?" />
                <p class="input-error" id="input-error" role="alert"></p>
                <button id="play-button" class="play-button" type="button">НАЧАТЬ ИГРУ <span>↗</span></button>
              </div>
            </div>
            <div id="toast" class="toast" aria-live="polite"></div>
          </div>
          <div class="game-footer"><span>↔ ВЕДИ ВЕДЬМУ МЫШЬЮ ИЛИ ПАЛЬЦЕМ</span><span>КЛАВИАТУРА: ← → / A D</span></div>
        </section>

        <aside class="sidebar">
          <section class="score-card">
            <div class="score-card-head"><div><small>ТАБЛИЦА РЕКОРДОВ</small><h2>Зал славы <span>🏆</span></h2></div><span class="local-pill">ЭТОТ БРАУЗЕР</span></div>
            <ol id="leaderboard" class="leaderboard"></ol>
            <div class="leaderboard-note">Общий рейтинг подключим после согласования игры и базы данных.</div>
          </section>
          <section class="rules-card"><div class="rules-head"><span>✦</span><h2>Что ловить?</h2></div><div class="rule"><img src="${import.meta.env.BASE_URL}assets/pumpkin.svg" alt="" /><span>Тыква</span><strong>+10</strong></div><div class="rule"><img src="${import.meta.env.BASE_URL}assets/candy.svg" alt="" /><span>Конфета</span><strong>+20</strong></div><div class="rule"><img src="${import.meta.env.BASE_URL}assets/golden.svg" alt="" /><span>Золотая тыква</span><strong>+50</strong></div><div class="rule danger"><img src="${import.meta.env.BASE_URL}assets/skull.svg" alt="" /><span>Череп / призрак</span><strong>−1 ♥</strong></div><p class="combo-hint">Лови подряд — серия добавит бонусные очки!</p></section>
        </aside>
      </div>
    </main>
    <footer><span>СОЗДАНО ДЛЯ ХЭЛЛОУИНСКОЙ НОЧИ ✦</span><span>ПОЙМАЙ СВОЙ РЕКОРД 🎃</span></footer>
  </div>`;

function get<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const ui = {
  score: get<HTMLElement>("#score"), timer: get<HTMLElement>("#timer"), lives: get<HTMLElement>("#lives"),
  overlay: get<HTMLElement>("#overlay"), icon: get<HTMLElement>("#overlay-icon"),
  kicker: get<HTMLElement>("#overlay-kicker"), title: get<HTMLElement>("#overlay-title"),
  copy: get<HTMLElement>("#overlay-copy"), input: get<HTMLInputElement>("#player-name"),
  error: get<HTMLElement>("#input-error"), play: get<HTMLButtonElement>("#play-button"),
  toast: get<HTMLElement>("#toast"), board: get<HTMLOListElement>("#leaderboard"),
  sound: get<HTMLButtonElement>("#sound-button"),
};

ui.input.value = localStorage.getItem(NAME_KEY) ?? "";
let playerName = "";
let soundEnabled = true;
let audio: AudioContext | null = null;
let toastTimer = 0;

function readScores(): ScoreEntry[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SCORE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is ScoreEntry => entry && typeof entry.name === "string" && Number.isFinite(entry.score) && Number.isFinite(entry.date));
  } catch { return []; }
}

function renderBoard() {
  const scores = readScores().sort((a, b) => b.score - a.score || a.date - b.date).slice(0, 6);
  ui.board.replaceChildren();
  if (!scores.length) {
    const empty = document.createElement("li"); empty.className = "empty-board";
    empty.textContent = "Здесь пока тихо... Сыграй первым и забери корону!"; ui.board.append(empty); return;
  }
  for (const [index, entry] of scores.entries()) {
    const row = document.createElement("li"); row.className = `board-row ${entry.name === playerName ? "current" : ""}`;
    const rank = document.createElement("span"); rank.className = `rank rank-${index + 1}`; rank.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("span"); name.className = "board-name"; name.textContent = entry.name;
    const points = document.createElement("strong"); points.textContent = String(entry.score);
    row.append(rank, name, points); ui.board.append(row);
  }
}

function saveScore(score: number) {
  const scores = readScores();
  const current = scores.find((entry) => entry.name.toLocaleLowerCase("ru") === playerName.toLocaleLowerCase("ru"));
  if (current) { if (score > current.score) { current.score = score; current.date = Date.now(); } }
  else scores.push({ name: playerName, score, date: Date.now() });
  localStorage.setItem(SCORE_KEY, JSON.stringify(scores.sort((a, b) => b.score - a.score).slice(0, 20)));
  renderBoard();
}

function playSound(frequency: number, duration = 0.09, waveform: OscillatorType = "sine") {
  if (!soundEnabled) return;
  try {
    audio ??= new AudioContext();
    const oscillator = audio.createOscillator(); const gain = audio.createGain();
    oscillator.type = waveform; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration);
  } catch { /* Sound is optional. */ }
}

function showToast(message: string) {
  ui.toast.textContent = message; ui.toast.classList.add("visible");
  window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => ui.toast.classList.remove("visible"), 850);
}

function showEnd(summary: GameSummary) {
  saveScore(summary.score);
  ui.icon.textContent = summary.score >= 500 ? "🏆" : "🎃";
  ui.kicker.textContent = summary.lives > 0 ? "ВРЕМЯ ВЫШЛО" : "ИГРА ОКОНЧЕНА";
  ui.title.textContent = `${summary.score} очков!`;
  ui.copy.textContent = summary.score >= 500 ? "Отличная охота! Сыграй ещё раз и побей свой рекорд." : "Ещё одна попытка? Золотые тыквы помогут набрать больше очков.";
  ui.play.innerHTML = "ИГРАТЬ ЕЩЁ <span>↗</span>";
  ui.overlay.classList.remove("hidden");
}

const GAME_WIDTH = window.matchMedia("(max-width: 650px)").matches ? 640 : 960;
const scene = new CatchScene({
  onHud: ({ score, time, lives }) => {
    ui.score.textContent = String(score).padStart(4, "0");
    ui.timer.textContent = String(time);
    ui.lives.textContent = `${"♥ ".repeat(lives)}${"♡ ".repeat(3 - lives)}`.trim();
    ui.lives.setAttribute("aria-label", `${lives} жизни`);
  },
  onFinish: showEnd,
  onToast: showToast,
  onSound: playSound,
}, GAME_WIDTH);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: 600,
  backgroundColor: "#231936",
  render: { antialias: true, pixelArt: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_WIDTH, height: 600 },
  scene: [scene],
});

ui.play.addEventListener("click", () => {
  const name = ui.input.value.trim().replace(/\s+/g, " ");
  if (name.length < 2) { ui.error.textContent = "Введите имя минимум из 2 символов"; ui.input.focus(); return; }
  ui.error.textContent = "";
  playerName = name; localStorage.setItem(NAME_KEY, name);
  if (scene.startRound()) ui.overlay.classList.add("hidden");
  renderBoard();
});

ui.input.addEventListener("keydown", (event) => { if (event.key === "Enter") ui.play.click(); });
ui.sound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  ui.sound.textContent = soundEnabled ? "♫" : "♪̸";
  ui.sound.setAttribute("aria-label", soundEnabled ? "Выключить звук" : "Включить звук");
  ui.sound.classList.toggle("muted", !soundEnabled);
});

renderBoard();
