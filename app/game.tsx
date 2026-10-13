"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ItemKind = "pumpkin" | "candy" | "gold" | "skull" | "ghost";
type Item = { kind: ItemKind; x: number; y: number; speed: number; size: number; sway: number; phase: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Leader = { name: string; score: number };
type GameState = { running: boolean; x: number; target: number; score: number; lives: number; combo: number; time: number; spawn: number; last: number; runId: string; items: Item[]; sparks: Spark[] };

const W = 900, H = 520;
const initial = (): GameState => ({ running: false, x: W / 2, target: W / 2, score: 0, lives: 3, combo: 0, time: 60, spawn: 0, last: 0, runId: "", items: [], sparks: [] });
const icons: Record<ItemKind, string> = { pumpkin: "/pumpkin.svg", candy: "/candy.svg", gold: "/pumpkin.svg", skull: "/skull.svg", ghost: "/ghost.svg" };

export default function Game() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<GameState>(initial());
  const images = useRef<Record<string, HTMLImageElement>>({});
  const sound = useRef<AudioContext | null>(null);
  const soundOn = useRef(true);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<"ready" | "loading" | "playing" | "ended">("ready");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [time, setTime] = useState(60);
  const [best, setBest] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [boardError, setBoardError] = useState(false);
  const [tab, setTab] = useState<"top" | "how">("top");

  const refreshBoard = useCallback(async () => {
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      if (!response.ok) throw new Error("board");
      const data = await response.json() as { leaders: Leader[] };
      setLeaders(data.leaders);
      setBoardError(false);
    } catch { setBoardError(true); }
  }, []);

  useEffect(() => {
    setDraft(localStorage.getItem("pumpkin-player-name") || "");
    setName(localStorage.getItem("pumpkin-player-name") || "");
    setBest(Number(localStorage.getItem("pumpkin-best") || 0));
    void refreshBoard();
    for (const [key, src] of Object.entries({ ...icons, player: "/player-witch.svg" })) {
      const img = new Image(); img.src = src; images.current[key] = img;
    }
  }, [refreshBoard]);

  const tone = useCallback((freq: number, duration = .08, type: OscillatorType = "sine") => {
    if (!soundOn.current) return;
    try {
      sound.current ??= new AudioContext();
      const ctx = sound.current;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(.075, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration);
    } catch { /* Audio is optional. */ }
  }, []);

  const finish = useCallback(async () => {
    const g = state.current;
    if (!g.running) return;
    g.running = false;
    setPhase("ended");
    setScore(g.score);
    if (g.score > Number(localStorage.getItem("pumpkin-best") || 0)) {
      localStorage.setItem("pumpkin-best", String(g.score)); setBest(g.score);
    }
    try {
      const response = await fetch("/api/run/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: g.runId, score: g.score }) });
      const data = await response.json() as { rank?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить результат");
      setRank(data.rank ?? null); void refreshBoard();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Результат не сохранён"); }
  }, [refreshBoard]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d"); if (!ctx) return;
    let frame = 0;
    const stars = Array.from({ length: 48 }, (_, i) => ({ x: (i * 163 + 37) % W, y: (i * 97 + 13) % 315, r: i % 5 === 0 ? 2 : 1 }));
    const spawn = (g: GameState) => {
      const r = Math.random();
      const kind: ItemKind = r < .53 ? "pumpkin" : r < .73 ? "candy" : r < .80 ? "gold" : r < .92 ? "skull" : "ghost";
      g.items.push({ kind, x: 48 + Math.random() * (W - 96), y: -45, speed: 135 + (60 - g.time) * 2.4 + Math.random() * 45, size: kind === "candy" ? 50 : 58, sway: Math.random() * 24, phase: Math.random() * Math.PI * 2 });
    };
    const burst = (g: GameState, x: number, y: number, color: string) => {
      for (let i = 0; i < 12; i++) g.sparks.push({ x, y, vx: (Math.random() - .5) * 220, vy: (Math.random() - .7) * 210, life: .55 + Math.random() * .25, color });
    };
    const draw = (now: number) => {
      const g = state.current;
      const dt = Math.min((now - (g.last || now)) / 1000, .05); g.last = now;
      if (g.running) {
        g.time = Math.max(0, g.time - dt); g.spawn -= dt;
        if (g.spawn <= 0) { spawn(g); g.spawn = Math.max(.42, .92 - (60 - g.time) * .006); }
        g.x += (g.target - g.x) * Math.min(1, dt * 13);
        const keep: Item[] = [];
        for (const item of g.items) {
          item.y += item.speed * dt; item.phase += dt * 3;
          const ix = item.x + Math.sin(item.phase) * item.sway;
          if (item.y > 390 && item.y < 476 && Math.abs(ix - g.x) < 46) {
            if (item.kind === "skull" || item.kind === "ghost") {
              g.lives--; g.combo = 0; setLives(g.lives); burst(g, ix, item.y, "#a879e4"); tone(150, .22, "sawtooth");
            } else {
              g.combo++;
              const points = (item.kind === "gold" ? 50 : item.kind === "candy" ? 20 : 10) + Math.min(30, Math.floor(g.combo / 5) * 5);
              g.score += points; setScore(g.score); burst(g, ix, item.y, item.kind === "gold" ? "#ffdf6a" : "#ff9b55"); tone(item.kind === "gold" ? 800 : 430 + Math.min(g.combo * 28, 300));
            }
          } else if (item.y < H + 50) { keep.push(item); }
          else if (item.kind === "pumpkin" || item.kind === "gold") { g.combo = 0; }
        }
        g.items = keep;
        g.sparks = g.sparks.filter(s => s.life > 0);
        for (const s of g.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 270 * dt; s.life -= dt; }
        setTime(Math.ceil(g.time));
        if (g.time <= 0 || g.lives <= 0) void finish();
      }
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#201438"); sky.addColorStop(.63, "#3c2851"); sky.addColorStop(1, "#58344f"); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,238,171,.8)";
      for (const s of stars) { ctx.globalAlpha = .45 + Math.sin(now / 1200 + s.x) * .25; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
      ctx.shadowColor = "#ffe4a4"; ctx.shadowBlur = 35; ctx.fillStyle = "#ffe8b5"; ctx.beginPath(); ctx.arc(745, 92, 49, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#372344"; ctx.beginPath(); ctx.moveTo(0, 363); ctx.quadraticCurveTo(155, 301, 320, 375); ctx.quadraticCurveTo(530, 321, 900, 366); ctx.lineTo(900, 520); ctx.lineTo(0, 520); ctx.fill();
      ctx.fillStyle = "#261d36"; ctx.beginPath(); ctx.moveTo(0, 414); ctx.quadraticCurveTo(240, 346, 465, 414); ctx.quadraticCurveTo(655, 356, 900, 404); ctx.lineTo(900, 520); ctx.lineTo(0, 520); ctx.fill();
      // Cartoon graveyard silhouettes and little glowing windows.
      for (const [x, y, scale] of [[72, 382, 1], [184, 368, .72], [647, 373, .9], [832, 389, 1.1]] as number[][]) {
        ctx.fillStyle = "#1d182b"; ctx.beginPath(); ctx.roundRect(x, y, 26 * scale, 66 * scale, [13 * scale, 13 * scale, 2, 2]); ctx.fill();
        ctx.fillStyle = "#5b4464"; ctx.fillRect(x + 10 * scale, y + 13 * scale, 6 * scale, 26 * scale);
      }
      ctx.fillStyle = "#161927"; ctx.fillRect(0, 462, W, 58);
      ctx.fillStyle = "#2d2b38"; for (let x = 0; x < W; x += 62) { ctx.beginPath(); ctx.ellipse(x + 25, 465, 48, 11, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = "#66604d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 458); ctx.lineTo(W, 458); ctx.stroke();
      for (const item of g.items) {
        const img = images.current[item.kind]; const x = item.x + Math.sin(item.phase) * item.sway;
        if (item.kind === "gold") { ctx.shadowColor = "#ffd45c"; ctx.shadowBlur = 24; }
        if (img?.complete && img.naturalWidth) ctx.drawImage(img, x - item.size / 2, item.y - item.size / 2, item.size, item.size);
        ctx.shadowBlur = 0;
      }
      const player = images.current.player;
      if (player?.complete && player.naturalWidth) ctx.drawImage(player, g.x - 51, 342, 102, 120);
      else { ctx.fillStyle = "#a36acd"; ctx.beginPath(); ctx.arc(g.x, 423, 40, 0, 7); ctx.fill(); }
      for (const s of g.sparks) { ctx.globalAlpha = Math.max(0, s.life); ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, 3.5, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [finish, tone]);

  const move = (clientX: number) => {
    const rect = canvas.current?.getBoundingClientRect(); if (!rect) return;
    state.current.target = Math.max(48, Math.min(W - 48, (clientX - rect.left) / rect.width * W));
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") { event.preventDefault(); state.current.target = Math.max(48, state.current.target - 72); }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") { event.preventDefault(); state.current.target = Math.min(W - 48, state.current.target + 72); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);

  const start = async () => {
    const clean = draft.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || clean.length > 40) { setError("Введите имя и фамилию (2–40 символов)"); return; }
    setError(""); setRank(null); setPhase("loading");
    let playerId = localStorage.getItem("pumpkin-player-id");
    if (!playerId) { playerId = crypto.randomUUID(); localStorage.setItem("pumpkin-player-id", playerId); }
    try {
      const response = await fetch("/api/run/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: clean, playerId }) });
      const data = await response.json() as { runId?: string; error?: string };
      if (!response.ok || !data.runId) throw new Error(data.error || "Не удалось начать игру");
      localStorage.setItem("pumpkin-player-name", clean); setName(clean);
      const g = initial(); g.running = true; g.runId = data.runId; g.last = performance.now(); state.current = g;
      setScore(0); setLives(3); setTime(60); setPhase("playing"); tone(560, .14);
    } catch (cause) { setPhase("ready"); setError(cause instanceof Error ? cause.message : "Не удалось начать игру"); }
  };

  return <main className="site-shell">
    <div className="starscape" aria-hidden="true" />
    <header className="topbar"><div className="brand"><span className="brand-icon">✦</span><span>BOO<span className="brand-dot">.</span>PLAY</span></div><div className="topbar-right"><span className="event-tag">✦ КОРПОРАТИВНЫЙ ТУРНИР · 2026</span><button className="sound-toggle" type="button" onClick={() => { soundOn.current = muted; setMuted(!muted); }} aria-label={muted ? "Включить звук" : "Выключить звук"}>{muted ? "🔇" : "🔊"}</button></div></header>
    <section className="intro"><div><div className="eyebrow">31 ОКТЯБРЯ / ХЭЛЛОУИНСКАЯ АРКАДА</div><h1>Тыквенный <em>переполох!</em></h1><p>Лови волшебные тыквы, собирай сладости и покажи коллегам, кто здесь главный охотник за очками.</p></div><div className="intro-moon" aria-hidden="true">☾ <span>✳</span></div></section>
    <div className="content-grid">
      <section className="game-card" aria-label="Игра"><div className="game-top"><div className="stat"><span>ТВОИ ОЧКИ</span><strong>{String(score).padStart(4, "0")}</strong></div><div className="stat stat-center"><span>ОСТАЛОСЬ</span><strong>{time}<small> сек</small></strong></div><div className="stat"><span>ЖИЗНИ</span><strong className="hearts" aria-label={`${lives} жизни`}>{"♥".repeat(lives)}<i>{"♥".repeat(3 - lives)}</i></strong></div></div>
        <div className="canvas-wrap"><canvas ref={canvas} width={W} height={H} onPointerMove={e => move(e.clientX)} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }} aria-label="Игровое поле: двигайте ведьму мышью, пальцем или стрелками" />
          {phase !== "playing" && <div className="game-overlay"><div className="overlay-panel"><div className="overlay-emoji">{phase === "ended" ? "🏆" : "🎃"}</div><span className="overlay-kicker">{phase === "ended" ? "РАУНД ЗАВЕРШЁН" : "ГОТОВЫ К ОХОТЕ?"}</span><h2>{phase === "ended" ? `${score} очков!` : "Поймай удачу за хвост"}</h2><p>{phase === "ended" ? rank ? `Ваше место в рейтинге: №${rank}. Попробуете ещё раз?` : "Отличная попытка! Сыграйте ещё и улучшите результат." : "У тебя 60 секунд и 3 жизни. Лови тыквы и конфеты, берегись призраков и черепов."}</p><div className="name-field"><label htmlFor="player-name">ИМЯ ДЛЯ РЕЙТИНГА</label><input id="player-name" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Имя и фамилия" maxLength={40} autoComplete="name" /></div>{error && <div className="error-message" role="alert">{error}</div>}<button className="play-button" type="button" disabled={phase === "loading"} onClick={start}>{phase === "loading" ? "ЗАПУСКАЕМ..." : phase === "ended" ? "ИГРАТЬ ЕЩЁ" : "НАЧАТЬ ИГРУ"}<span>↗</span></button></div></div>}
        </div><div className="game-bottom"><span>✦ ВЕДИ ВЕДЬМУ МЫШЬЮ ИЛИ ПАЛЬЦЕМ</span><span>НА КЛАВИАТУРЕ: ← → / A D</span></div></section>
      <aside className="side-column"><section className="leader-card"><div className="card-heading"><div><span className="card-kicker">ЗАЛ СЛАВЫ</span><h2>Таблица лидеров <span>🏆</span></h2></div><button type="button" className="refresh" onClick={() => void refreshBoard()} title="Обновить рейтинг">↻</button></div><div className="tabs"><button className={tab === "top" ? "active" : ""} onClick={() => setTab("top")}>ТОП ИГРОКОВ</button><button className={tab === "how" ? "active" : ""} onClick={() => setTab("how")}>КАК ИГРАТЬ</button></div>{tab === "top" ? <div className="ranking">{boardError ? <p className="empty-state">Не удалось загрузить рейтинг. Нажмите ↻, чтобы повторить.</p> : leaders.length ? leaders.slice(0, 8).map((entry, i) => <div className={`rank-row ${entry.name === name ? "mine" : ""}`} key={`${entry.name}-${i}`}><span className={`place place-${i + 1}`}>{String(i + 1).padStart(2, "0")}</span><span className="rank-name">{entry.name}</span><strong>{entry.score}</strong></div>) : <p className="empty-state">Пока здесь пусто. Сыграй первым и займи вершину!</p>}</div> : <div className="rules"><p><span>🎃</span> Тыква <b>+10</b></p><p><span>🍬</span> Конфета <b>+20</b></p><p><span>✨</span> Золотая тыква <b>+50</b></p><p><span>💀</span> Череп и призрак <b>−1 жизнь</b></p><p className="rules-note">Серия удачных уловов добавляет бонусные очки.</p></div>}<div className="personal-best"><span>ТВОЙ ЛУЧШИЙ РЕЗУЛЬТАТ</span><strong>{best} <small>очков</small></strong></div></section><div className="tip-card"><div className="tip-icon">✦</div><div><b>Лайфхак от ведьмы</b><p>Следи за золотыми тыквами — они стоят целых 50 очков!</p></div></div></aside>
    </div><footer><span>СДЕЛАНО С МАГИЕЙ ДЛЯ КОМАНДЫ ✦</span><span>BOO.PLAY © 2026</span></footer>
  </main>;
}
