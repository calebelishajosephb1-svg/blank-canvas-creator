/** Web Audio pulse layer — zero dependencies, lazily created on first gesture. */
type Ctx = AudioContext;

class AudioPulse {
  private ctx: Ctx | null = null;
  private enabled = false;
  private hydrated = false;

  private ensureCtx(): Ctx | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Read the persisted preference. Safe to call only in the browser. */
  hydrate(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.hydrated) {
      this.enabled = window.localStorage.getItem("iale_audio") === "1";
      this.hydrated = true;
    }
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    this.hydrated = true;
    if (typeof window !== "undefined") window.localStorage.setItem("iale_audio", v ? "1" : "0");
    if (v) this.ensureCtx();
  }

  private blip(freq: number, dur: number, gainValue: number, type: OscillatorType = "sine", delay = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  tick() {
    if (!this.enabled) return;
    this.blip(720, 0.08, 0.06);
  }

  accept() {
    if (!this.enabled) return;
    this.blip(660, 0.12, 0.07);
    this.blip(880, 0.18, 0.07, "sine", 0.1);
  }

  reject() {
    if (!this.enabled) return;
    this.blip(180, 0.16, 0.05, "square");
  }
}

export const audioPulse = new AudioPulse();
