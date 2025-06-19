class Pulse {
  constructor(scene, x, y, velocityY) {
    this.scene = scene;
    this.body = scene.add.circle(x, y, 8, 0xffcc00);
    this.velY = velocityY;
    this.alive = true;
  }

  update(dt) {
    this.velY += 500 * dt; // gravity
    this.body.y += this.velY * dt;
    if (this.body.y > this.scene.scale.height + 20) {
      this.alive = false;
    }
  }

  destroy() {
    this.body.destroy();
  }
}

class MainGame extends Phaser.Scene {
  constructor() {
    super("MainGame");
  }

  init(data) {
    this.upgrades = data?.upgrades || { launch: 1, wave: 1 };
  }

  preload() {}

  create() {
    const { width, height } = this.scale;
    this.centerX = width / 2;
    this.centerY = height / 2;

    // ─── Wave drawing helper ──────────────────────────────────────────────
    this.waveGraphics = this.add.graphics();

    // ─── Pointer (player-controlled) ──────────────────────────────────────
    this.pointerY = this.centerY;
    this.prevPointerY = this.pointerY; // store last-frame y for velocity
    this.pointerDot = this.add.circle(this.centerX, this.pointerY, 6, 0xffffff);

    // ─── Wave parameters ──────────────────────────────────────────────────
    this.phase = 0; // time phase for vertical pulse
    this.baseAmplitude = height * 0.15 * this.upgrades.wave;
    this.baseFrequency = 0.02; // spatial frequency (rad / px)

    // Dynamic multipliers modified by interference logic
    this.ampFactor = 1; // 0.5 ≤ ampFactor ≤ 3
    this.freqFactor = 1; // 0.5 ≤ freqFactor ≤ 3

    // Color gradient for the wave
    this.gradientColors = [0x00ffff, 0x8000ff, 0xff0080];

    // Pointer input
    this.input.on("pointermove", (pointer) => {
      this.pointerY = Phaser.Math.Clamp(pointer.y, 0, height);
    });

    // Track previous crest Y to compute its velocity
    this.prevCrestY = this.centerY;

    // ─── Game state --------------------------------------------------------
    this.state = "aim"; // aim → launch → end
    this.score = 0;

    this.scoreText = this.add
      .text(10, 10, "Score: 0", { fontFamily: "monospace", fontSize: 16, color: "#ffffff" })
      .setDepth(10);

    // Pointer click launches a pulse
    this.input.on("pointerdown", () => {
      if (this.state !== "aim") return;
      const crestY = this.getWaveY(
        this.centerX,
        this.baseAmplitude * this.ampFactor,
        this.baseFrequency * this.freqFactor,
        this.phase
      );
      const strength = -600 * this.ampFactor * this.upgrades.launch;
      this.pulse = new Pulse(this, this.centerX, crestY, strength);
      this.score = 0;
      this.state = "launch";
    });
  }

  // Linear gradient helper --------------------------------------------------
  getGradientColor(t) {
    const n = this.gradientColors.length - 1;
    const scaled = t * n;
    const idx = Math.floor(scaled);
    const localT = scaled - idx;
    const cA = Phaser.Display.Color.ValueToColor(this.gradientColors[idx]);
    const cB = Phaser.Display.Color.ValueToColor(
      this.gradientColors[Math.min(idx + 1, n)]
    );
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(
      cA,
      cB,
      1,
      localT
    );
    return Phaser.Display.Color.GetColor(col.r, col.g, col.b);
  }

  // Stationary wave with Gaussian fall-off from center ----------------------
  getWaveY(x, amplitude, frequency, phase) {
    const decayLen = this.scale.width * 0.1; // tweak: smaller = steeper drop
    const falloff = Math.exp(-Math.pow((x - this.centerX) / decayLen, 2));

    return (
      this.centerY +
      falloff *
        amplitude *
        Math.cos(frequency * (x - this.centerX)) * // horizontal pattern stays
        Math.sin(phase) // vertical pulse driver
    );
  }

  update(time, delta) {
    const dt = delta / 1000; // convert ms → s
    const { width } = this.scale;

    // ─── Interference + State Updates ─────────────────────────────────---
    // Current crest (wave value at centerX)
    const crestY = this.getWaveY(
      this.centerX,
      this.baseAmplitude * this.ampFactor,
      this.baseFrequency * this.freqFactor,
      this.phase
    );

    if (this.state === "aim") {
      const pointerVel = (this.pointerY - this.prevPointerY) / dt;
      const crestVel = (crestY - this.prevCrestY) / dt;
      const sameDir = pointerVel * crestVel > 0;
      const adjust = sameDir ? 1 : -1;
      const ampStep = 0.3 * dt * adjust;
      const freqStep = 0.15 * dt * adjust;
      this.ampFactor = Phaser.Math.Clamp(this.ampFactor + ampStep, 0.5, 3);
      this.freqFactor = Phaser.Math.Clamp(this.freqFactor + freqStep, 0.5, 3);
    } else if (this.state === "launch") {
      this.pulse.update(dt);
      this.score = Math.max(this.score, this.centerY - this.pulse.body.y);
      this.scoreText.setText("Score: " + Math.floor(this.score));
      if (!this.pulse.alive) {
        this.pulse.destroy();
        this.endRun();
      }
    }

    // ─── Advance phase for vertical oscillation only ─────────────────----
    this.phase += 2 * Math.PI * dt; // 1 Hz pulse

    // ─── Draw wave ────────────────────────────────────────────────────────
    const amplitude = this.baseAmplitude * this.ampFactor;
    const frequency = this.baseFrequency * this.freqFactor;

    this.waveGraphics.clear();
    const step = 4;
    for (let x = 0; x < width; x += step) {
      const nextX = x + step;
      const t = x / width;
      const color = this.getGradientColor(t);
      const y1 = this.getWaveY(x, amplitude, frequency, this.phase);
      const y2 = this.getWaveY(nextX, amplitude, frequency, this.phase);
      this.waveGraphics.lineStyle(2, color);
      this.waveGraphics.beginPath();
      this.waveGraphics.moveTo(x, y1);
      this.waveGraphics.lineTo(nextX, y2);
      this.waveGraphics.strokePath();
    }

    // ─── Update pointer dot ───────────────────────────────────────────────
    this.pointerDot.y = this.pointerY;

    // ─── Store previous values for next frame ─────────────────────────────
    this.prevPointerY = this.pointerY;
    this.prevCrestY = crestY;
  }

  endRun() {
    this.state = "end";
    const final = Math.floor(this.score);
    const msg = this.add
      .text(this.centerX, this.centerY - 40, `Final Score: ${final}`,
        { fontFamily: "monospace", fontSize: 24, color: "#ffffff" })
      .setOrigin(0.5);
    const restart = this.add
      .text(this.centerX, this.centerY, "Click to restart",
        { fontFamily: "monospace", fontSize: 18, color: "#ffffff" })
      .setOrigin(0.5);

    this.input.once("pointerdown", () => {
      msg.destroy();
      restart.destroy();
      if (this.score > 200) {
        this.upgrades.launch += 0.1; // simple progression
      }
      if (this.score > 400) {
        this.upgrades.wave += 0.1;
      }
      this.scene.restart({ upgrades: this.upgrades });
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#080808",
  scene: MainGame,
};

window.addEventListener("load", () => {
  new Phaser.Game(config);
});
