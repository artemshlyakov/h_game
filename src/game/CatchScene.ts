import Phaser from "phaser";

type Kind = "pumpkin" | "candy" | "golden" | "skull" | "ghost";
type Falling = { kind: Kind; sprite: Phaser.GameObjects.Image; x: number; y: number; speed: number; age: number; sway: number; phase: number; rotation: number };
export type GameSummary = { score: number; lives: number };
type Hud = { score: number; time: number; lives: number; combo: number };
type Callbacks = { onHud: (hud: Hud) => void; onFinish: (summary: GameSummary) => void; onToast: (message: string) => void; onSound: (frequency: number, duration?: number, waveform?: OscillatorType) => void; onCatch: () => void };

const ROUND_SECONDS = 60;

export class CatchScene extends Phaser.Scene {
  private callbacks: Callbacks;
  private worldWidth: number;
  private worldHeight: number;
  private witch?: Phaser.GameObjects.Image;
  private keys?: Record<"left" | "right" | "a" | "d", Phaser.Input.Keyboard.Key>;
  private falling: Falling[] = [];
  private score = 0;
  private lives = 3;
  private combo = 0;
  private remaining = ROUND_SECONDS;
  private spawnIn = 0;
  private elapsed = 0;
  private nextGolden = 10;
  private targetX: number;
  private invulnerableUntil = 0;
  private running = false;
  private ready = false;
  private lastShownTime = ROUND_SECONDS;

  constructor(callbacks: Callbacks, worldWidth = 960, worldHeight = 600) {
    super({ key: "CatchScene" });
    this.callbacks = callbacks;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.targetX = worldWidth / 2;
  }

  preload() {
    const base = `${import.meta.env.BASE_URL}assets/`;
    this.load.svg("background", `${base}${this.worldHeight > 600 ? "scene-mobile" : "scene"}.svg`, { width: this.worldWidth, height: this.worldHeight });
    this.load.svg("witch", `${base}witch.svg`, { width: 240, height: 280 });
    for (const kind of ["pumpkin", "candy", "golden", "skull", "ghost"] as const) {
      this.load.svg(kind, `${base}${kind}.svg`, { width: 96, height: 96 });
    }
  }

  create() {
    this.add.image(this.worldWidth / 2, this.worldHeight / 2, "background").setDisplaySize(this.worldWidth, this.worldHeight);
    this.add.ellipse(this.worldWidth / 2, this.worldHeight - 39, 440, 35, 0x0e1525, 0.45);
    this.witch = this.add.image(this.worldWidth / 2, this.worldHeight - 30, "witch").setOrigin(0.5, 1).setDisplaySize(154, 180).setDepth(5);
    this.keys = this.input.keyboard?.addKeys({ left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT, a: Phaser.Input.Keyboard.KeyCodes.A, d: Phaser.Input.Keyboard.KeyCodes.D }) as typeof this.keys;
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.running) this.targetX = Phaser.Math.Clamp(pointer.x, 72, this.worldWidth - 72);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.running) this.targetX = Phaser.Math.Clamp(pointer.x, 72, this.worldWidth - 72);
    });
    this.ready = true;
    this.callbacks.onHud({ score: 0, time: ROUND_SECONDS, lives: 3, combo: 0 });
  }

  startRound(): boolean {
    if (!this.ready || !this.witch) return false;
    for (const item of this.falling) this.removeItem(item);
    this.falling = [];
    this.score = 0; this.lives = 3; this.combo = 0;
    this.remaining = ROUND_SECONDS; this.lastShownTime = ROUND_SECONDS;
    this.elapsed = 0; this.spawnIn = 0.75; this.nextGolden = 10;
    this.targetX = this.worldWidth / 2; this.invulnerableUntil = 0;
    this.witch.setPosition(this.worldWidth / 2, this.worldHeight - 30).setAlpha(1).setDisplaySize(154, 180);
    this.running = true;
    this.callbacks.onHud({ score: 0, time: ROUND_SECONDS, lives: 3, combo: 0 });
    this.callbacks.onSound(590, 0.13);
    return true;
  }

  update(_time: number, delta: number) {
    if (!this.running || !this.witch) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.elapsed += dt;
    this.remaining = Math.max(0, this.remaining - dt);
    const currentSecond = Math.ceil(this.remaining);
    if (currentSecond !== this.lastShownTime) { this.lastShownTime = currentSecond; this.emitHud(); }

    const left = this.keys?.left.isDown || this.keys?.a.isDown;
    const right = this.keys?.right.isDown || this.keys?.d.isDown;
    if (left !== right) {
      this.witch.x = Phaser.Math.Clamp(this.witch.x + (left ? -1 : 1) * 490 * dt, 72, this.worldWidth - 72);
      this.targetX = this.witch.x;
    } else {
      this.witch.x += (this.targetX - this.witch.x) * Math.min(1, dt * 12);
    }
    this.witch.setRotation(Math.sin(this.elapsed * 4) * 0.015);

    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnItem();
      this.spawnIn = Math.max(0.42, 0.96 - this.elapsed * 0.007) + Math.random() * 0.16;
    }

    for (let i = this.falling.length - 1; i >= 0; i--) {
      const item = this.falling[i];
      item.age += dt;
      item.y += item.speed * dt;
      const displayX = item.x + Math.sin(item.age * 2.6 + item.phase) * item.sway;
      item.sprite.setPosition(displayX, item.y).setRotation(Math.sin(item.age * 2 + item.phase) * item.rotation);
      const caught = item.y >= this.worldHeight - 141 && item.y <= this.worldHeight - 77 && Math.abs(displayX - this.witch.x) < 62;
      if (caught) {
        this.collect(item, displayX);
        this.falling.splice(i, 1);
      } else if (item.y > this.worldHeight + 45) {
        if (item.kind === "pumpkin" || item.kind === "candy" || item.kind === "golden") this.combo = 0;
        this.removeItem(item);
        this.falling.splice(i, 1);
      }
    }

    if (this.remaining <= 0 || this.lives <= 0) this.finishRound();
  }

  private spawnItem() {
    const random = Math.random();
    let kind: Kind = random < 0.54 ? "pumpkin" : random < 0.76 ? "candy" : random < 0.83 ? "golden" : random < 0.93 ? "skull" : "ghost";
    if (this.elapsed >= this.nextGolden) { kind = "golden"; this.nextGolden += 12; }
    const x = Phaser.Math.Between(64, this.worldWidth - 64);
    const size = kind === "candy" ? 57 : kind === "ghost" ? 66 : 62;
    const sprite = this.add.image(x, -50, kind).setDisplaySize(size, size).setDepth(3);
    if (kind === "golden") this.tweens.add({ targets: sprite, alpha: 0.72, duration: 360, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.falling.push({ kind, sprite, x, y: -50, speed: (this.worldHeight > 600 ? 290 : 190) + this.elapsed * 2.45 + Math.random() * 35, age: 0, sway: 10 + Math.random() * 18, phase: Math.random() * Math.PI * 2, rotation: kind === "ghost" ? 0.08 : 0.22 });
  }

  private collect(item: Falling, x: number) {
    this.removeItem(item);
    const hazard = item.kind === "skull" || item.kind === "ghost";
    if (hazard) {
      if (this.elapsed < this.invulnerableUntil) return;
      this.lives--;
      this.combo = 0;
      this.invulnerableUntil = this.elapsed + 0.8;
      this.flash(this.witch!, 0xff9aaa);
      this.burst(x, item.y, 0xdcb0f9);
      this.floatText("−1 ♥", x, item.y, "#ffc0c6");
      this.callbacks.onToast(this.lives ? "Осторожно! −1 жизнь" : "Жизни закончились");
      this.callbacks.onSound(145, 0.22, "sawtooth");
    } else {
      this.combo++;
      const base = item.kind === "golden" ? 50 : item.kind === "candy" ? 20 : 10;
      const bonus = Math.min(25, Math.floor(this.combo / 5) * 5);
      const points = base + bonus;
      this.score += points;
      this.burst(x, item.y, item.kind === "golden" ? 0xffe18c : 0xffae75);
      this.floatText(`+${points}`, x, item.y, item.kind === "golden" ? "#ffe485" : "#fff0be");
      this.callbacks.onCatch();
      if (item.kind === "golden") this.callbacks.onToast("Золотая тыква! +50");
      else if (this.combo > 0 && this.combo % 5 === 0) this.callbacks.onToast(`Серия x${this.combo}! Бонус к очкам`);
    }
    this.emitHud();
  }

  private burst(x: number, y: number, color: number) {
    for (let i = 0; i < 11; i++) {
      const spark = this.add.circle(x, y, Phaser.Math.Between(2, 5), color).setDepth(8);
      this.tweens.add({ targets: spark, x: x + Phaser.Math.Between(-75, 75), y: y + Phaser.Math.Between(-95, 25), alpha: 0, scale: 0.1, duration: Phaser.Math.Between(360, 700), ease: "Cubic.Out", onComplete: () => spark.destroy() });
    }
  }

  private removeItem(item: Falling) {
    this.tweens.killTweensOf(item.sprite);
    item.sprite.destroy();
  }

  private floatText(message: string, x: number, y: number, color: string) {
    const label = this.add.text(x, y - 24, message, { fontFamily: "Rubik, Arial, sans-serif", fontSize: "27px", fontStyle: "bold", color, stroke: "#241731", strokeThickness: 6 }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: label, y: y - 90, alpha: 0, duration: 830, ease: "Cubic.Out", onComplete: () => label.destroy() });
  }

  private flash(sprite: Phaser.GameObjects.Image, color: number) {
    sprite.setTint(color);
    this.time.delayedCall(400, () => sprite.clearTint());
  }

  private emitHud() { this.callbacks.onHud({ score: this.score, time: Math.ceil(this.remaining), lives: this.lives, combo: this.combo }); }

  private finishRound() {
    if (!this.running) return;
    this.running = false;
    for (const item of this.falling) this.removeItem(item);
    this.falling = [];
    this.callbacks.onFinish({ score: this.score, lives: this.lives });
    this.callbacks.onSound(this.score >= 500 ? 720 : 340, 0.18);
  }
}
