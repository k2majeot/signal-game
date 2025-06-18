class MainGame extends Phaser.Scene {
  constructor() {
    super('MainGame');
  }

  preload() {}

  create() {
    const { width, height } = this.scale;
    this.centerX = width / 2;
    this.centerY = height / 2;

    this.waveGraphics = this.add.graphics();
    this.pointerY = this.centerY;

    this.pointerDot = this.add.circle(this.centerX, this.pointerY, 6, 0xffffff);
    this.lockGlow = this.add.circle(this.centerX, this.pointerY, 12)
      .setStrokeStyle(2, 0xffff00)
      .setVisible(false);

    this.gradientColors = [0x00ffff, 0x8000ff, 0xff0080];

    this.phase = 0;
    this.baseAmplitude = height * 0.15;
    this.amplitudeVariation = height * 0.05;
    this.baseFrequency = 0.02;
    this.frequencyVariation = 0.005;

    this.input.on('pointermove', pointer => {
      this.pointerY = Phaser.Math.Clamp(pointer.y, 0, height);
    });
  }

  getGradientColor(t) {
    const n = this.gradientColors.length - 1;
    const scaled = t * n;
    const idx = Math.floor(scaled);
    const localT = scaled - idx;
    const colorA = Phaser.Display.Color.ValueToColor(this.gradientColors[idx]);
    const colorB = Phaser.Display.Color.ValueToColor(this.gradientColors[Math.min(idx + 1, n)]);
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(colorA, colorB, 1, localT);
    return Phaser.Display.Color.GetColor(col.r, col.g, col.b);
  }

  getWaveY(x, amplitude, frequency, phase) {
    return this.centerY + amplitude * Math.sin(frequency * (x - this.centerX) + phase);
  }

  update(time, delta) {
    const { width, height } = this.scale;
    this.phase += delta * 0.001;
    const amplitude = this.baseAmplitude + this.amplitudeVariation * Math.sin(this.phase * 0.5);
    const frequency = this.baseFrequency + this.frequencyVariation * Math.sin(this.phase * 0.3);

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

    // Update pointer dot
    this.pointerDot.y = this.pointerY;
    this.lockGlow.y = this.pointerY;

    // Lock-on detection at centerX
    const waveY = this.getWaveY(this.centerX, amplitude, frequency, this.phase);
    const dist = Math.abs(this.pointerY - waveY);
    const locked = dist <= 20;

    this.lockGlow.visible = locked;
    if (locked) {
      const pulse = 1 + 0.3 * Math.sin(this.phase * 10);
      this.lockGlow.setScale(pulse);
      this.pointerDot.setFillStyle(0xffff00);
    } else {
      this.pointerDot.setFillStyle(0xffffff);
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#080808',
  scene: MainGame
};

window.addEventListener('load', () => {
  const game = new Phaser.Game(config);
});
